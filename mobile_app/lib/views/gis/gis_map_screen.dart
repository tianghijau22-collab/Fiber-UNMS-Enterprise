import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import '../infrastructure/odp_port_monitoring_sheet.dart';
import '../odp/odp_form_screen.dart';

class GisMapScreen extends StatefulWidget {
  final int? highlightNodeId;
  const GisMapScreen({super.key, this.highlightNodeId});

  @override
  State<GisMapScreen> createState() => _GisMapScreenState();
}

class _GisMapScreenState extends State<GisMapScreen> {
  // Palet selaras dengan Login, Home, dan Data Node (FONA / BRImo navy)
  static const Color _navyDeep = Color(0xFF001B3A);
  static const Color _brandBlue = Color(0xFF005BAA);
  static const Color _cyan = Color(0xFF008ED6);
  static const Color _bg = Color(0xFFF4F6F9);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textBody = Color(0xFF475569);
  static const Color _textMuted = Color(0xFF94A3B8);
  static const Color _border = Color(0xFFE2E8F0);

  final MapController _mapController = MapController();
  List<_GisNode> _parsedNodes = [];
  List<Polyline> _cachedPolylines = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Viewport & Zoom Optimization
  double _currentZoom = 14.5;
  LatLngBounds? _visibleBounds;
  Timer? _debounceTimer;

  // Filters & Toggles
  String _selectedFilter = 'ALL'; // 'ALL', 'ODP', 'ODC', 'POP', 'LOSS'
  String _selectedOlt = 'ALL';
  List<String> _availableOlts = ['ALL'];
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  // Fitur Cek Titik Koordinat Lokasi
  LatLng? _searchedCoordinate;

  // Fitur Ukur Jarak (Measurement Tool)
  bool _isMeasuring = false;
  final List<LatLng> _measurePoints = [];
  static const Distance _distanceCalculator = Distance();

  bool _showCables = true;
  bool _showLabels = true;
  String _currentTileType = 'google_roadmap'; // 'google_roadmap', 'satellite', 'osm', 'dark'
  Position? _currentPosition;
  _GisNode? _selectedNode;

  static const Map<String, String> _tileLayers = {
    'google_roadmap': 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    'satellite': 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    'osm': 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    'dark': 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
  };

  @override
  void initState() {
    super.initState();
    _fetchGisData();
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchGisData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointGisMapData,
        queryParameters: {'nocache': '1'},
      );

      if (response.data != null) {
        final payload = response.data['data'] is Map ? response.data['data'] : response.data;
        final rawNodes = payload['nodes'] is List ? payload['nodes'] : [];
        final rawCables = payload['cables'] is List ? payload['cables'] : [];

        // Pre-parse nodes in memory for ultra-fast UI rendering
        final List<_GisNode> parsed = [];
        final Set<String> oltsSet = {'ALL'};

        for (var n in rawNodes) {
          if (n is Map<String, dynamic>) {
            final node = _GisNode.fromMap(n);
            if (node.latLng.latitude != 0.0 && node.latLng.longitude != 0.0) {
              parsed.add(node);
              if (node.oltName != '-' && node.oltName.isNotEmpty) {
                oltsSet.add(node.oltName);
              }
            }
          }
        }

        // Pre-build cached polylines
        final polylines = _precomputePolylines(rawCables, parsed);

        if (mounted) {
          setState(() {
            _parsedNodes = parsed;
            _cachedPolylines = polylines;
            _availableOlts = oltsSet.toList();
            _isLoading = false;
          });

          // Auto zoom to highlighted node or fit all
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (widget.highlightNodeId != null) {
              _focusNodeById(widget.highlightNodeId!);
            } else {
              _fitAllNodes();
            }
          });
        }
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat data sebaran peta GIS.';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Terjadi kesalahan: $e';
          _isLoading = false;
        });
      }
    }
  }

  List<Polyline> _precomputePolylines(List<dynamic> rawCables, List<_GisNode> nodesList) {
    final polylines = <Polyline>[];
    final nodeMap = {for (var n in nodesList) n.id: n};

    for (var c in rawCables) {
      final rawCoords = c['route_coordinates'];
      List<LatLng> points = [];

      if (rawCoords is List) {
        for (var pt in rawCoords) {
          if (pt is List && pt.length >= 2) {
            final lat = double.tryParse(pt[0].toString());
            final lng = double.tryParse(pt[1].toString());
            if (lat != null && lng != null) points.add(LatLng(lat, lng));
          } else if (pt is Map && pt['lat'] != null && pt['lng'] != null) {
            final lat = double.tryParse(pt['lat'].toString());
            final lng = double.tryParse(pt['lng'].toString());
            if (lat != null && lng != null) points.add(LatLng(lat, lng));
          }
        }
      } else if (rawCoords is String && rawCoords.isNotEmpty) {
        try {
          final decoded = jsonDecode(rawCoords);
          if (decoded is List) {
            for (var pt in decoded) {
              if (pt is List && pt.length >= 2) {
                final lat = double.tryParse(pt[0].toString());
                final lng = double.tryParse(pt[1].toString());
                if (lat != null && lng != null) points.add(LatLng(lat, lng));
              }
            }
          }
        } catch (_) {}
      }

      if (points.length < 2 && c['from_node_id'] != null && c['to_node_id'] != null) {
        final fromNode = nodeMap[c['from_node_id']];
        final toNode = nodeMap[c['to_node_id']];
        if (fromNode != null && toNode != null) {
          points = [fromNode.latLng, toNode.latLng];
        }
      }

      if (points.length >= 2) {
        final rawColor = (c['cable_color'] ?? '').toString().toLowerCase();
        Color lineColor = _cyan;
        if (rawColor.contains('biru') || rawColor.contains('blue')) {
          lineColor = _cyan;
        } else if (rawColor.contains('orange') || rawColor.contains('oranye')) {
          lineColor = const Color(0xFFF97316);
        } else if (rawColor.contains('hijau') || rawColor.contains('green')) {
          lineColor = const Color(0xFF10B981);
        } else if (rawColor.contains('cokelat') || rawColor.contains('brown')) {
          lineColor = const Color(0xFF78350F);
        }

        polylines.add(
          Polyline(
            points: points,
            color: lineColor.withValues(alpha: 0.85),
            strokeWidth: 3.2,
          ),
        );
      }
    }

    // Fallback topology link
    if (polylines.isEmpty) {
      for (var n in nodesList) {
        final parentId = n.raw['parent_node_id'];
        if (parentId != null && nodeMap.containsKey(parentId)) {
          final parent = nodeMap[parentId]!;
          polylines.add(
            Polyline(
              points: [parent.latLng, n.latLng],
              color: _cyan.withValues(alpha: 0.65),
              strokeWidth: 2.2,
            ),
          );
        }
      }
    }

    return polylines;
  }

  /// Deteksi format koordinat dari input search bar
  LatLng? _parseCoordinates(String text) {
    final clean = text.trim();
    if (clean.isEmpty) return null;

    // Pattern 1: "-0.789275, 100.65345" atau "-0.789275 100.65345"
    final reg = RegExp(r'^(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)$');
    final match = reg.firstMatch(clean);
    if (match != null) {
      final lat = double.tryParse(match.group(1)!);
      final lng = double.tryParse(match.group(2)!);
      if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return LatLng(lat, lng);
      }
    }

    // Pattern 2: "lat: -0.789275, lng: 100.65345"
    final labelReg = RegExp(r'lat[:\s]*(-?\d+(?:\.\d+)?)[,\s]+lng[:\s]*(-?\d+(?:\.\d+)?)', caseSensitive: false);
    final labelMatch = labelReg.firstMatch(clean);
    if (labelMatch != null) {
      final lat = double.tryParse(labelMatch.group(1)!);
      final lng = double.tryParse(labelMatch.group(2)!);
      if (lat != null && lng != null && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return LatLng(lat, lng);
      }
    }

    return null;
  }

  void _onSearchInputChanged(String val) {
    final q = val.trim();
    _debounceTimer?.cancel();
    _debounceTimer = Timer(const Duration(milliseconds: 150), () {
      if (!mounted) return;

      final parsedCoord = _parseCoordinates(q);
      if (parsedCoord != null) {
        setState(() {
          _searchedCoordinate = parsedCoord;
          _searchQuery = '';
        });
        _mapController.move(parsedCoord, 17.5);
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Titik koordinat ditemukan: ${parsedCoord.latitude}, ${parsedCoord.longitude}'),
            backgroundColor: _brandBlue,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 2),
          ),
        );
      } else {
        setState(() {
          _searchQuery = q.toLowerCase();
          if (q.isEmpty) {
            _searchedCoordinate = null;
          }
        });
      }
    });
  }

  void _focusNodeById(int id) {
    final target = _parsedNodes.firstWhere(
      (n) => n.id == id,
      orElse: () => _parsedNodes.first,
    );
    _mapController.move(target.latLng, 17.0);
    _showNodeDetailSheet(target);
  }

  void _fitAllNodes() {
    if (_parsedNodes.isEmpty) return;

    final points = _parsedNodes.map((n) => n.latLng).toList();
    if (points.length == 1) {
      _mapController.move(points.first, 16.0);
      return;
    }

    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.all(50),
      ),
    );
  }

  Future<void> _locateUser() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('GPS tidak aktif. Mohon aktifkan lokasi pada perangkat.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return;
      }

      if (permission == LocationPermission.deniedForever) {
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Izin akses lokasi ditolak permanen.'),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }

      final pos = await Geolocator.getCurrentPosition();
      if (mounted) {
        setState(() => _currentPosition = pos);
        _mapController.move(LatLng(pos.latitude, pos.longitude), 16.5);
      }
    } catch (e) {
      debugPrint('Locate user error: $e');
    }
  }

  void _openGoogleMaps(double lat, double lng) async {
    final url = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  Future<void> _openStreetView(double lat, double lng) async {
    // 1. Coba buka Google Street View native panorama app intent
    final nativeUri = Uri.parse('google.streetview:cbll=$lat,$lng');
    final webUri = Uri.parse('https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=$lat,$lng');

    try {
      if (await canLaunchUrl(nativeUri)) {
        await launchUrl(nativeUri, mode: LaunchMode.externalApplication);
        return;
      }
    } catch (_) {}

    if (await canLaunchUrl(webUri)) {
      await launchUrl(webUri, mode: LaunchMode.externalApplication);
    } else {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Tidak dapat membuka Google Street View pada perangkat.'),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  void _copyToClipboard(String text, String label) {
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('$label berhasil disalin ke clipboard'),
        behavior: SnackBarBehavior.floating,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Color _getNodeTypeColor(String type) {
    switch (type.toUpperCase()) {
      case 'ODC':
        return _cyan;
      case 'POP':
        return const Color(0xFF4F46E5);
      case 'ODP':
      default:
        return const Color(0xFF059669);
    }
  }

  Color _getStatusColor(String status, {bool hasLoss = false, bool isLossTotal = false}) {
    if (isLossTotal) return const Color(0xFFDC2626);
    if (hasLoss) return const Color(0xFFD97706);
    switch (status.toLowerCase()) {
      case 'active':
      case 'online':
        return const Color(0xFF059669);
      case 'maintenance':
        return const Color(0xFFD97706);
      case 'inactive':
      case 'offline':
      default:
        return const Color(0xFF64748B);
    }
  }

  String _getStatusLabel(String status, {bool hasLoss = false, bool isLossTotal = false}) {
    if (isLossTotal) return 'Loss Total';
    if (hasLoss) return 'Ada Loss';
    switch (status.toLowerCase()) {
      case 'active':
      case 'online':
        return 'Aktif';
      case 'maintenance':
        return 'Maintenance';
      case 'inactive':
      case 'offline':
        return 'Non-Aktif';
      default:
        return status.isNotEmpty ? status : 'Normal';
    }
  }

  String _formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.toStringAsFixed(1)} m';
    } else {
      return '${(meters / 1000).toStringAsFixed(2)} km';
    }
  }

  double _calculateTotalMeasureDistance() {
    if (_measurePoints.length < 2) return 0.0;
    double total = 0.0;
    for (int i = 0; i < _measurePoints.length - 1; i++) {
      total += _distanceCalculator.as(LengthUnit.Meter, _measurePoints[i], _measurePoints[i + 1]);
    }
    return total;
  }

  List<Marker> _buildOptimizedMarkers(List<_GisNode> filteredNodes) {
    final markers = <Marker>[];
    final bool isZoomedOut = _currentZoom < 14.0;
    final bool isMidZoom = _currentZoom >= 14.0 && _currentZoom < 15.8;
    final bool isZoomedIn = _currentZoom >= 15.8;

    // Viewport Culling with safety margin
    final bounds = _visibleBounds;

    for (var n in filteredNodes) {
      // If bounds available and not selected, cull off-screen markers to save FPS
      if (bounds != null && (_selectedNode == null || _selectedNode!.id != n.id)) {
        final lat = n.latLng.latitude;
        final lng = n.latLng.longitude;
        final latBuf = (bounds.north - bounds.south).abs() * 0.1;
        final lngBuf = (bounds.east - bounds.west).abs() * 0.1;
        if (lat > bounds.north + latBuf ||
            lat < bounds.south - latBuf ||
            lng > bounds.east + lngBuf ||
            lng < bounds.west - lngBuf) {
          continue;
        }
      }

      final isSelected = _selectedNode != null && _selectedNode!.id == n.id;
      final Color pinColor = n.isLossTotal
          ? const Color(0xFFDC2626)
          : n.hasLoss
              ? const Color(0xFFD97706)
              : _getNodeTypeColor(n.type);

      IconData pinIcon = Icons.grid_view_rounded;
      if (n.type == 'POP') pinIcon = Icons.dns_rounded;
      if (n.type == 'ODC') pinIcon = Icons.account_tree_rounded;
      if (n.isLossTotal) pinIcon = Icons.warning_amber_rounded;

      // ULTRA LIGHTWEIGHT MODE (When Zoomed Out)
      if (isZoomedOut && !isSelected) {
        markers.add(
          Marker(
            point: n.latLng,
            width: 14,
            height: 14,
            child: GestureDetector(
              onTap: () {
                if (_isMeasuring) {
                  _addMeasurePoint(n.latLng);
                  return;
                }
                setState(() => _selectedNode = n);
                _showNodeDetailSheet(n);
              },
              child: Container(
                decoration: BoxDecoration(
                  color: pinColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 1.5),
                ),
              ),
            ),
          ),
        );
        continue;
      }

      // MID ZOOM MODE (Compact Circle with Icon)
      if (isMidZoom && !isSelected) {
        markers.add(
          Marker(
            point: n.latLng,
            width: 26,
            height: 26,
            child: GestureDetector(
              onTap: () {
                if (_isMeasuring) {
                  _addMeasurePoint(n.latLng);
                  return;
                }
                setState(() => _selectedNode = n);
                _showNodeDetailSheet(n);
              },
              child: Container(
                decoration: BoxDecoration(
                  color: pinColor,
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: [
                    BoxShadow(
                      color: pinColor.withValues(alpha: 0.35),
                      blurRadius: 4,
                      offset: const Offset(0, 1.5),
                    ),
                  ],
                ),
                child: Icon(pinIcon, color: Colors.white, size: 13),
              ),
            ),
          ),
        );
        continue;
      }

      // FULL DETAILED PIN (Zoomed in or Selected)
      final showLabel = _showLabels && (isZoomedIn || isSelected);
      markers.add(
        Marker(
          point: n.latLng,
          width: showLabel ? 110 : 38,
          height: showLabel ? 60 : 38,
          alignment: Alignment.topCenter,
          child: GestureDetector(
            onTap: () {
              if (_isMeasuring) {
                _addMeasurePoint(n.latLng);
                return;
              }
              setState(() => _selectedNode = n);
              _showNodeDetailSheet(n);
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Pin Bubble
                Container(
                  width: isSelected ? 38 : 32,
                  height: isSelected ? 38 : 32,
                  decoration: BoxDecoration(
                    color: pinColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white,
                      width: isSelected ? 3 : 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: pinColor.withValues(alpha: isSelected ? 0.65 : 0.4),
                        blurRadius: isSelected ? 12 : 6,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(pinIcon, color: Colors.white, size: isSelected ? 19 : 16),
                ),
                // Text Label Pill
                if (showLabel)
                  Container(
                    margin: const EdgeInsets.only(top: 3),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: pinColor.withValues(alpha: 0.5), width: 0.9),
                      boxShadow: [
                        BoxShadow(
                          color: _navyDeep.withValues(alpha: 0.12),
                          blurRadius: 4,
                          offset: const Offset(0, 1),
                        ),
                      ],
                    ),
                    child: Text(
                      n.name,
                      style: TextStyle(
                        color: _textDark,
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                        fontSize: 10,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
              ],
            ),
          ),
        ),
      );
    }

    // ── FITUR TITIK KOORDINAT HASIL SEARCH ──
    if (_searchedCoordinate != null) {
      markers.add(
        Marker(
          point: _searchedCoordinate!,
          width: 140,
          height: 70,
          alignment: Alignment.topCenter,
          child: GestureDetector(
            onTap: () => _showSearchedCoordinateSheet(_searchedCoordinate!),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626),
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFFDC2626).withValues(alpha: 0.5),
                        blurRadius: 14,
                        offset: const Offset(0, 3),
                      ),
                    ],
                  ),
                  child: const Icon(Icons.location_pin, color: Colors.white, size: 24),
                ),
                Container(
                  margin: const EdgeInsets.only(top: 3),
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: _navyDeep,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: const [
                      BoxShadow(color: Colors.black26, blurRadius: 4, offset: Offset(0, 2)),
                    ],
                  ),
                  child: const Text(
                    'Titik Koordinat',
                    style: TextStyle(color: Colors.white, fontSize: 10.5, fontWeight: FontWeight.w800),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    // ── FITUR MARKERS UKUR JARAK ──
    if (_isMeasuring && _measurePoints.isNotEmpty) {
      for (int i = 0; i < _measurePoints.length; i++) {
        final pt = _measurePoints[i];
        final isFirst = i == 0;
        final isLast = i == _measurePoints.length - 1 && _measurePoints.length > 1;

        markers.add(
          Marker(
            point: pt,
            width: 34,
            height: 34,
            child: Container(
              decoration: BoxDecoration(
                color: isFirst ? const Color(0xFF16A34A) : (isLast ? const Color(0xFFEA580C) : _brandBlue),
                shape: BoxShape.circle,
                border: Border.all(color: Colors.white, width: 2.5),
                boxShadow: const [
                  BoxShadow(color: Colors.black26, blurRadius: 5, offset: Offset(0, 2)),
                ],
              ),
              child: Center(
                child: Text(
                  isFirst ? 'A' : (isLast ? 'B' : '${i + 1}'),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 12),
                ),
              ),
            ),
          ),
        );
      }
    }

    return markers;
  }

  void _addMeasurePoint(LatLng point) {
    setState(() {
      _measurePoints.add(point);
    });
  }

  void _undoMeasurePoint() {
    if (_measurePoints.isNotEmpty) {
      setState(() {
        _measurePoints.removeLast();
      });
    }
  }

  void _clearMeasure() {
    setState(() {
      _measurePoints.clear();
    });
  }

  void _toggleMeasureMode() {
    setState(() {
      _isMeasuring = !_isMeasuring;
      if (!_isMeasuring) {
        _measurePoints.clear();
      }
    });

    if (_isMeasuring) {
      ScaffoldMessenger.of(context).hideCurrentSnackBar();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Row(
            children: [
              Icon(Icons.straighten_rounded, color: Colors.white, size: 20),
              SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Mode Ukur Jarak Aktif: Ketuk pada peta atau node untuk mengukur jarak.',
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
                ),
              ),
            ],
          ),
          backgroundColor: Color(0xFF001B3A),
          behavior: SnackBarBehavior.floating,
          duration: Duration(seconds: 3),
        ),
      );
    }
  }

  // ───────────────────────────── SEARCHED COORDINATE SHEET ─────────────────────────────
  void _showSearchedCoordinateSheet(LatLng coord) {
    // Cari 3 ODP / Node terdekat dari koordinat ini
    final sortedNodes = List<_GisNode>.from(_parsedNodes)
      ..sort((a, b) {
        final distA = _distanceCalculator.as(LengthUnit.Meter, coord, a.latLng);
        final distB = _distanceCalculator.as(LengthUnit.Meter, coord, b.latLng);
        return distA.compareTo(distB);
      });

    final nearest = sortedNodes.take(3).toList();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4.5,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Title
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFDC2626).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.location_pin, color: Color(0xFFDC2626), size: 20),
                ),
                const SizedBox(width: 10),
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Titik Koordinat Lokasi',
                        style: TextStyle(color: _textDark, fontSize: 16, fontWeight: FontWeight.w800),
                      ),
                      Text(
                        'Ditemukan dari pencarian koordinat GPS',
                        style: TextStyle(color: _textMuted, fontSize: 11.5),
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: _textMuted),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),

            const SizedBox(height: 12),
            const Divider(color: _border),
            const SizedBox(height: 8),

            // Koordinat Card
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _border),
              ),
              child: Row(
                children: [
                  const Icon(Icons.gps_fixed_rounded, color: _brandBlue, size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Koordinat Latitude, Longitude', style: TextStyle(color: _textMuted, fontSize: 10.5, fontWeight: FontWeight.w600)),
                        Text(
                          '${coord.latitude}, ${coord.longitude}',
                          style: const TextStyle(color: _textDark, fontSize: 13, fontWeight: FontWeight.w800),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, color: _brandBlue, size: 18),
                    tooltip: 'Salin',
                    onPressed: () => _copyToClipboard('${coord.latitude}, ${coord.longitude}', 'Koordinat GPS'),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 14),

            // Node ODP Terdekat Section
            if (nearest.isNotEmpty) ...[
              const Text(
                'Infrastruktur ODP / Node Terdekat:',
                style: TextStyle(color: _textDark, fontSize: 12.5, fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 8),
              ...nearest.map((node) {
                final dist = _distanceCalculator.as(LengthUnit.Meter, coord, node.latLng);
                return InkWell(
                  onTap: () {
                    Navigator.pop(ctx);
                    _focusNodeById(node.id);
                  },
                  borderRadius: BorderRadius.circular(10),
                  child: Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: _border),
                    ),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: _getNodeTypeColor(node.type).withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: Icon(Icons.grid_view_rounded, size: 14, color: _getNodeTypeColor(node.type)),
                        ),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            node.name,
                            style: const TextStyle(color: _textDark, fontWeight: FontWeight.w700, fontSize: 12.5),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            _formatDistance(dist),
                            style: const TextStyle(color: _brandBlue, fontSize: 11, fontWeight: FontWeight.w800),
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Icon(Icons.chevron_right_rounded, color: _textMuted, size: 18),
                      ],
                    ),
                  ),
                );
              }),
            ],

            const SizedBox(height: 16),

            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: _cyan,
                      side: const BorderSide(color: _cyan, width: 1.2),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _openGoogleMaps(coord.latitude, coord.longitude);
                    },
                    icon: const Icon(Icons.near_me_rounded, size: 16),
                    label: const Text('Rute Maps', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF16A34A),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _openStreetView(coord.latitude, coord.longitude);
                    },
                    icon: const Icon(Icons.streetview_rounded, size: 16),
                    label: const Text('Street View', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5)),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ───────────────────────────── DETAIL MODAL SHEET ─────────────────────────────
  void _showNodeDetailSheet(_GisNode node) {
    final Color statusColor = _getStatusColor(node.status, hasLoss: node.hasLoss, isLossTotal: node.isLossTotal);
    final String statusLabel = _getStatusLabel(node.status, hasLoss: node.hasLoss, isLossTotal: node.isLossTotal);

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      useSafeArea: true,
      builder: (ctx) => DraggableScrollableSheet(
        initialChildSize: 0.85,
        minChildSize: 0.5,
        maxChildSize: 0.95,
        builder: (ctx, scrollController) => Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Top Drag Handle
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  margin: const EdgeInsets.only(top: 12, bottom: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),

              // Header Title
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 14),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                      decoration: BoxDecoration(
                        color: _brandBlue.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        node.type,
                        style: const TextStyle(
                          color: _brandBlue,
                          fontWeight: FontWeight.w800,
                          fontSize: 12,
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        node.name,
                        style: const TextStyle(
                          color: _textDark,
                          fontSize: 16.5,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: statusColor.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            width: 6,
                            height: 6,
                            decoration: BoxDecoration(color: statusColor, shape: BoxShape.circle),
                          ),
                          const SizedBox(width: 5),
                          Text(
                            statusLabel,
                            style: TextStyle(
                              color: statusColor,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const Divider(color: _border, height: 1),

              // Scrollable Body
              Expanded(
                child: ListView(
                  controller: scrollController,
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
                  children: [
                    // Section 1: Lokasi & Alamat + Street View Banner
                    _buildSectionHeader(Icons.location_on_rounded, 'Lokasi & Alamat'),
                    _buildDetailCard([
                      _buildDetailRow('Alamat', node.address),
                      _buildDetailRow(
                        'Koordinat GPS',
                        '${node.latLng.latitude}, ${node.latLng.longitude}',
                        actionWidget: IconButton(
                          constraints: const BoxConstraints(),
                          padding: EdgeInsets.zero,
                          icon: const Icon(Icons.copy_rounded, size: 15, color: _brandBlue),
                          tooltip: 'Salin Koordinat',
                          onPressed: () => _copyToClipboard('${node.latLng.latitude}, ${node.latLng.longitude}', 'Koordinat GPS'),
                        ),
                      ),
                    ]),

                    const SizedBox(height: 12),

                    // Street View Quick Card Action
                    InkWell(
                      onTap: () {
                        Navigator.pop(ctx);
                        _openStreetView(node.latLng.latitude, node.latLng.longitude);
                      },
                      borderRadius: BorderRadius.circular(14),
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(color: const Color(0xFFBBF7D0)),
                        ),
                        child: Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Color(0xFF16A34A),
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.streetview_rounded, color: Colors.white, size: 18),
                            ),
                            const SizedBox(width: 12),
                            const Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Buka Google Street View 360°',
                                    style: TextStyle(
                                      color: Color(0xFF166534),
                                      fontWeight: FontWeight.w800,
                                      fontSize: 13,
                                    ),
                                  ),
                                  SizedBox(height: 2),
                                  Text(
                                    'Lihat panorama visual tiang & lokasi langsung di lapangan',
                                    style: TextStyle(
                                      color: Color(0xFF15803D),
                                      fontSize: 11,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const Icon(Icons.chevron_right_rounded, color: Color(0xFF16A34A), size: 20),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 16),

                    // Section 2: OLT & Jalur Distribusi
                    _buildSectionHeader(Icons.router_rounded, 'Uplink & Distribusi OLT'),
                    _buildDetailCard([
                      _buildDetailRow('Perangkat OLT', node.oltName),
                      _buildDetailRow('Interface PON', node.interfaceRef, isAccent: true),
                      if (node.parentName != null) _buildDetailRow('Parent Node', node.parentName!),
                      if (node.splitterName != null && node.splitterName != '-')
                        _buildDetailRow('Splitter Ratio', node.splitterName!),
                    ]),

                    const SizedBox(height: 16),

                    // Section 3: Serat Optik & Redaman
                    _buildSectionHeader(Icons.cable_rounded, 'Serat Optik & Redaman'),
                    _buildDetailCard([
                      _buildDetailRow('Tube & Core', '${node.tube} • ${node.core}'),
                      if (node.corePower != null && node.corePower!.isNotEmpty)
                        _buildDetailRow('Core Power (Input)', '${node.corePower} dBm'),
                      if (node.rxRange.isNotEmpty)
                        _buildDetailRow('Redaman Pelanggan', node.rxRange, isAccent: true),
                    ]),

                    const SizedBox(height: 16),

                    // Section 4: Kapasitas & Utilisasi Port
                    _buildSectionHeader(Icons.grid_view_rounded, 'Kapasitas & Utilisasi Port'),
                    _buildDetailCard([
                      _buildDetailRow('Port Terisi', '${node.usedPorts} dari ${node.totalPorts} Port (${node.percentage}%)'),
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(4),
                          child: LinearProgressIndicator(
                            value: node.totalPorts > 0 ? (node.usedPorts / node.totalPorts).clamp(0.0, 1.0) : 0,
                            backgroundColor: _border,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              node.percentage > 85 ? AppColors.danger : _brandBlue,
                            ),
                            minHeight: 6,
                          ),
                        ),
                      ),
                      if (node.totalClients != null && node.totalClients != '0')
                        _buildDetailRow(
                          'Pelanggan Terhubung',
                          '${node.onlineClients ?? '0'} / ${node.totalClients} Online',
                        ),
                    ]),

                    if (node.notes.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      _buildSectionHeader(Icons.notes_rounded, 'Catatan / Konfigurasi'),
                      Container(
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _border),
                        ),
                        child: Text(
                          node.notes,
                          style: const TextStyle(
                            color: _textDark,
                            fontSize: 13,
                            height: 1.45,
                          ),
                        ),
                      ),
                    ],

                    const SizedBox(height: 24),
                  ],
                ),
              ),

              // Bottom Persistent Actions
              Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                decoration: const BoxDecoration(
                  color: Colors.white,
                  border: Border(top: BorderSide(color: _border)),
                ),
                child: Row(
                  children: [
                    // Tombol Rute Maps
                    Expanded(
                      flex: 1,
                      child: OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          foregroundColor: _cyan,
                          side: const BorderSide(color: _cyan, width: 1.2),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: () {
                          Navigator.pop(ctx);
                          _openGoogleMaps(node.latLng.latitude, node.latLng.longitude);
                        },
                        icon: const Icon(Icons.near_me_rounded, size: 16),
                        label: const Text(
                          'Rute',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Tombol Street View
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF16A34A),
                        side: const BorderSide(color: Color(0xFF16A34A), width: 1.2),
                        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        _openStreetView(node.latLng.latitude, node.latLng.longitude);
                      },
                      icon: const Icon(Icons.streetview_rounded, size: 16),
                      label: const Text(
                        'Street View',
                        style: TextStyle(fontWeight: FontWeight.w700, fontSize: 12.5),
                      ),
                    ),
                    const SizedBox(width: 8),

                    // Shortcut Ukur OPM
                    IconButton(
                      tooltip: 'Ukur OPM Log',
                      style: IconButton.styleFrom(
                        backgroundColor: const Color(0xFFF1F5F9),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        padding: const EdgeInsets.all(12),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => OdpFormScreen(
                              prefilledOdpCode: node.code,
                              prefilledOdpName: node.name,
                              prefilledOdpNodeId: node.id,
                            ),
                          ),
                        );
                      },
                      icon: const Icon(Icons.edit_note_rounded, color: _textBody, size: 20),
                    ),

                    if (node.type == 'ODP') ...[
                      const SizedBox(width: 8),
                      Expanded(
                        flex: 2,
                        child: ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _brandBlue,
                            foregroundColor: Colors.white,
                            elevation: 0,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          onPressed: () {
                            Navigator.pop(ctx);
                            OdpPortMonitoringSheet.show(
                              context,
                              nodeId: node.id,
                              nodeName: node.name,
                              nodeType: node.type,
                              totalPorts: node.totalPorts,
                              oltName: node.oltName != '-' ? node.oltName : null,
                              interfaceRef: node.interfaceRef != '-' ? node.interfaceRef : null,
                            );
                          },
                          icon: const Icon(Icons.speed_rounded, size: 16),
                          label: const Text(
                            'Cek Port',
                            style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13),
                          ),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(IconData icon, String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          Icon(icon, size: 16, color: _brandBlue),
          const SizedBox(width: 8),
          Text(
            title,
            style: const TextStyle(
              color: _textDark,
              fontWeight: FontWeight.w800,
              fontSize: 13,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailCard(List<Widget> children) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: _border),
      ),
      child: Column(
        children: children,
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isAccent = false, Widget? actionWidget}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 125,
            child: Text(
              label,
              style: const TextStyle(
                color: _textMuted,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                color: isAccent ? _brandBlue : _textDark,
                fontSize: 12.5,
                fontWeight: isAccent ? FontWeight.w800 : FontWeight.w600,
              ),
            ),
          ),
          if (actionWidget != null) ...[
            const SizedBox(width: 6),
            actionWidget,
          ],
        ],
      ),
    );
  }

  // ───────────────────────────── LAYERS & SETTINGS SHEET ─────────────────────────────
  void _showLayersBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4.5,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Row(
                children: [
                  Icon(Icons.layers_rounded, color: _brandBlue, size: 20),
                  SizedBox(width: 8),
                  Text(
                    'Pengaturan Layer & Tampilan Peta',
                    style: TextStyle(color: _textDark, fontWeight: FontWeight.w800, fontSize: 16),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Tile Style
              const Text(
                'Tipe Base Map:',
                style: TextStyle(color: _textBody, fontSize: 12.5, fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildTileChoice('google_roadmap', 'Standar', Icons.map_rounded, setModalState),
                  const SizedBox(width: 8),
                  _buildTileChoice('satellite', 'Satelit', Icons.satellite_alt_rounded, setModalState),
                  const SizedBox(width: 8),
                  _buildTileChoice('dark', 'Dark Mode', Icons.dark_mode_rounded, setModalState),
                ],
              ),

              const SizedBox(height: 16),
              const Divider(color: _border),

              // Toggles
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tampilkan Jalur Kabel FO', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: _textDark)),
                subtitle: const Text('Garis koneksi kabel fiber antar node', style: TextStyle(fontSize: 11.5, color: _textMuted)),
                value: _showCables,
                activeColor: _brandBlue,
                onChanged: (val) {
                  setModalState(() => _showCables = val);
                  setState(() => _showCables = val);
                },
              ),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tampilkan Label Nama ODP', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w700, color: _textDark)),
                subtitle: const Text('Teks nama di bawah pin marker', style: TextStyle(fontSize: 11.5, color: _textMuted)),
                value: _showLabels,
                activeColor: _brandBlue,
                onChanged: (val) {
                  setModalState(() => _showLabels = val);
                  setState(() => _showLabels = val);
                },
              ),

              if (_availableOlts.length > 1) ...[
                const SizedBox(height: 10),
                const Text('Filter Perangkat OLT:', style: TextStyle(color: _textBody, fontSize: 12.5, fontWeight: FontWeight.w700)),
                const SizedBox(height: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: _border),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<String>(
                      value: _selectedOlt,
                      isExpanded: true,
                      style: const TextStyle(color: _textDark, fontSize: 13, fontWeight: FontWeight.w600),
                      items: _availableOlts
                          .map((olt) => DropdownMenuItem(
                                value: olt,
                                child: Text(olt == 'ALL' ? 'Semua Perangkat OLT' : olt),
                              ))
                          .toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setModalState(() => _selectedOlt = val);
                          setState(() => _selectedOlt = val);
                        }
                      },
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTileChoice(String type, String label, IconData icon, StateSetter setModalState) {
    final isSelected = _currentTileType == type;
    return Expanded(
      child: InkWell(
        onTap: () {
          setModalState(() => _currentTileType = type);
          setState(() => _currentTileType = type);
        },
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 11),
          decoration: BoxDecoration(
            color: isSelected ? _brandBlue.withValues(alpha: 0.1) : const Color(0xFFF8FAFC),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? _brandBlue : _border,
              width: isSelected ? 1.8 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? _brandBlue : _textBody, size: 20),
              const SizedBox(height: 5),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? _brandBlue : _textBody,
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final filteredNodes = _parsedNodes.where((n) {
      // Filter Type
      if (_selectedFilter == 'ODP' && n.type != 'ODP') return false;
      if (_selectedFilter == 'ODC' && n.type != 'ODC') return false;
      if (_selectedFilter == 'POP' && n.type != 'POP') return false;
      if (_selectedFilter == 'LOSS' && !n.isLossTotal && !n.hasLoss) return false;

      // Filter OLT
      if (_selectedOlt != 'ALL' && n.oltName != _selectedOlt) return false;

      // Search Query
      if (_searchQuery.isNotEmpty) {
        if (!n.searchIndex.contains(_searchQuery)) return false;
      }

      return true;
    }).toList();

    final odpCount = _parsedNodes.where((n) => n.type == 'ODP').length;
    final odcCount = _parsedNodes.where((n) => n.type == 'ODC').length;
    final popCount = _parsedNodes.where((n) => n.type == 'POP').length;
    final lossCount = _parsedNodes.where((n) => n.isLossTotal || n.hasLoss).length;

    final totalMeasureDistance = _calculateTotalMeasureDistance();

    return Scaffold(
      backgroundColor: _bg,
      body: Stack(
        children: [
          // ── 1. MAIN INTERACTIVE FLUTTER MAP ──
          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(_brandBlue),
                  ),
                )
              : _errorMessage != null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 48),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, style: const TextStyle(color: _textBody)),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: _brandBlue,
                              foregroundColor: Colors.white,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                            onPressed: _fetchGisData,
                            child: const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.w700)),
                          ),
                        ],
                      ),
                    )
                  : FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: const LatLng(-0.789275, 100.65345), // Default Solok
                        initialZoom: 14.5,
                        minZoom: 3.0,
                        maxZoom: 19.0,
                        onTap: (tapPosition, point) {
                          if (_isMeasuring) {
                            _addMeasurePoint(point);
                          }
                        },
                        onPositionChanged: (pos, hasGesture) {
                          final newZoom = pos.zoom;
                          final newBounds = pos.visibleBounds;
                          if ((newZoom - _currentZoom).abs() > 0.4 || _visibleBounds == null) {
                            _debounceTimer?.cancel();
                            _debounceTimer = Timer(const Duration(milliseconds: 100), () {
                              if (mounted) {
                                setState(() {
                                  _currentZoom = newZoom;
                                  _visibleBounds = newBounds;
                                });
                              }
                            });
                          }
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: _tileLayers[_currentTileType] ?? _tileLayers['google_roadmap']!,
                          userAgentPackageName: 'com.fiberunms.app',
                          keepBuffer: 3,
                          panBuffer: 1,
                        ),
                        if (_showCables) PolylineLayer(polylines: _cachedPolylines),

                        // Layer Polylines Pengukuran Jarak
                        if (_isMeasuring && _measurePoints.length >= 2)
                          PolylineLayer(
                            polylines: [
                              Polyline(
                                points: _measurePoints,
                                color: const Color(0xFFEA580C),
                                strokeWidth: 3.5,
                                pattern: StrokePattern.dashed(segments: const [8, 4]),
                                borderColor: Colors.white,
                                borderStrokeWidth: 1.0,
                              ),
                            ],
                          ),

                        MarkerLayer(markers: _buildOptimizedMarkers(filteredNodes)),

                        if (_currentPosition != null)
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                                width: 28,
                                height: 28,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: _brandBlue,
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.white, width: 2.5),
                                    boxShadow: const [
                                      BoxShadow(color: Colors.black26, blurRadius: 6, offset: Offset(0, 2)),
                                    ],
                                  ),
                                  child: const Icon(Icons.my_location_rounded, color: Colors.white, size: 14),
                                ),
                              ),
                            ],
                          ),
                      ],
                    ),

          // ── 2. TOP FLOATING SEARCH & CONTROLS / MEASURE BANNER ──
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Jika Mode Ukur Jarak Aktif, tampilkan Top Banner Pengukuran
                  if (_isMeasuring)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: _navyDeep,
                        borderRadius: BorderRadius.circular(16),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.25),
                            blurRadius: 14,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: const Color(0xFFEA580C).withValues(alpha: 0.25),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.straighten_rounded, color: Color(0xFFFB923C), size: 20),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'PENGUKURAN JARAK',
                                  style: TextStyle(color: Color(0xFF94A3B8), fontSize: 9.5, fontWeight: FontWeight.w700),
                                ),
                                const SizedBox(height: 1),
                                Text(
                                  _measurePoints.length < 2
                                      ? 'Ketuk peta (${_measurePoints.length} Titik)'
                                      : _formatDistance(totalMeasureDistance),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.w800,
                                    letterSpacing: -0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          if (_measurePoints.isNotEmpty) ...[
                            IconButton(
                              icon: const Icon(Icons.undo_rounded, color: Colors.white, size: 20),
                              tooltip: 'Undo Titik Terakhir',
                              onPressed: _undoMeasurePoint,
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline_rounded, color: Color(0xFFF87171), size: 20),
                              tooltip: 'Reset',
                              onPressed: _clearMeasure,
                            ),
                          ],
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: Colors.white, size: 22),
                            tooltip: 'Keluar Mode Ukur',
                            onPressed: _toggleMeasureMode,
                          ),
                        ],
                      ),
                    )
                  else ...[
                    // Search Bar Card Normal
                    Container(
                      height: 48,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: _border),
                        boxShadow: [
                          BoxShadow(
                            color: _navyDeep.withValues(alpha: 0.1),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          if (Navigator.canPop(context))
                            IconButton(
                              icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
                              onPressed: () => Navigator.pop(context),
                            )
                          else
                            const Padding(
                              padding: EdgeInsets.only(left: 14, right: 8),
                              child: Icon(Icons.explore_rounded, color: _brandBlue, size: 22),
                            ),
                          Expanded(
                            child: TextField(
                              controller: _searchCtrl,
                              onChanged: _onSearchInputChanged,
                              style: const TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w600),
                              decoration: const InputDecoration(
                                hintText: 'Cari nama, OLT, atau koordinat (lat, lng)...',
                                hintStyle: TextStyle(color: _textMuted, fontSize: 12),
                                border: InputBorder.none,
                                contentPadding: EdgeInsets.symmetric(vertical: 13),
                              ),
                            ),
                          ),
                          if (_searchCtrl.text.isNotEmpty)
                            IconButton(
                              icon: const Icon(Icons.clear_rounded, color: _textMuted, size: 18),
                              onPressed: () {
                                _searchCtrl.clear();
                                setState(() {
                                  _searchQuery = '';
                                  _searchedCoordinate = null;
                                });
                              },
                            ),
                          IconButton(
                            icon: const Icon(Icons.refresh_rounded, color: _brandBlue),
                            tooltip: 'Refresh GIS',
                            onPressed: _fetchGisData,
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 8),

                    // Quick Filter Pill Bar
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      physics: const BouncingScrollPhysics(),
                      child: Row(
                        children: [
                          _buildFilterPill('Semua (${_parsedNodes.length})', 'ALL', _brandBlue),
                          const SizedBox(width: 6),
                          _buildFilterPill('ODP ($odpCount)', 'ODP', const Color(0xFF059669)),
                          const SizedBox(width: 6),
                          _buildFilterPill('ODC ($odcCount)', 'ODC', _cyan),
                          const SizedBox(width: 6),
                          _buildFilterPill('POP ($popCount)', 'POP', const Color(0xFF4F46E5)),
                          const SizedBox(width: 6),
                          _buildFilterPill('Loss / Gangguan ($lossCount)', 'LOSS', const Color(0xFFDC2626)),
                          if (_selectedOlt != 'ALL') ...[
                            const SizedBox(width: 6),
                            ActionChip(
                              avatar: const Icon(Icons.router_rounded, size: 14, color: _brandBlue),
                              label: Text('OLT: $_selectedOlt', style: const TextStyle(color: _brandBlue, fontSize: 11, fontWeight: FontWeight.w800)),
                              backgroundColor: _brandBlue.withValues(alpha: 0.1),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20), side: const BorderSide(color: _brandBlue)),
                              onPressed: _showLayersBottomSheet,
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),

          // ── 3. RIGHT FLOATING MAP TOOLS ──
          Positioned(
            right: 14,
            bottom: 30,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Tombol Mode Ukur Jarak
                _buildFloatingToolButton(
                  icon: Icons.straighten_rounded,
                  tooltip: _isMeasuring ? 'Matikan Ukur Jarak' : 'Ukur Jarak Antar Titik',
                  isActive: _isMeasuring,
                  activeColor: const Color(0xFFEA580C),
                  iconColor: _isMeasuring ? Colors.white : const Color(0xFFEA580C),
                  onTap: _toggleMeasureMode,
                ),
                const SizedBox(height: 10),
                _buildFloatingToolButton(
                  icon: Icons.layers_rounded,
                  tooltip: 'Layer & Tampilan',
                  onTap: _showLayersBottomSheet,
                ),
                const SizedBox(height: 10),
                _buildFloatingToolButton(
                  icon: Icons.filter_center_focus_rounded,
                  tooltip: 'Fit Semua Node',
                  onTap: _fitAllNodes,
                ),
                const SizedBox(height: 10),
                _buildFloatingToolButton(
                  icon: Icons.my_location_rounded,
                  tooltip: 'Lokasi Saya (GPS)',
                  iconColor: _brandBlue,
                  onTap: _locateUser,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildFilterPill(String label, String key, Color color) {
    final isSelected = _selectedFilter == key;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => setState(() => _selectedFilter = key),
        borderRadius: BorderRadius.circular(20),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? color : Colors.white.withValues(alpha: 0.95),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected ? color : _border,
            ),
            boxShadow: [
              BoxShadow(
                color: _navyDeep.withValues(alpha: 0.08),
                blurRadius: 4,
                offset: const Offset(0, 1),
              ),
            ],
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : _textDark,
              fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
              fontSize: 11.5,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFloatingToolButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback onTap,
    Color iconColor = _textDark,
    bool isActive = false,
    Color activeColor = _brandBlue,
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: isActive ? activeColor : Colors.white,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: isActive ? activeColor : _border),
            boxShadow: [
              BoxShadow(
                color: isActive ? activeColor.withValues(alpha: 0.35) : _navyDeep.withValues(alpha: 0.12),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
          child: Icon(icon, color: iconColor, size: 20),
        ),
      ),
    );
  }
}

/// Pre-parsed lightweight Node data class for high-performance rendering & searching
class _GisNode {
  final Map<String, dynamic> raw;
  final int id;
  final String name;
  final String code;
  final String type; // 'ODP', 'ODC', 'POP'
  final String status;
  final String address;
  final LatLng latLng;
  final String oltName;
  final String interfaceRef;
  final String tube;
  final String core;
  final String? corePower;
  final String? parentName;
  final String? splitterName;
  final int totalPorts;
  final int usedPorts;
  final int percentage;
  final String rxRange;
  final bool isLossTotal;
  final bool hasLoss;
  final String notes;
  final String? totalClients;
  final String? onlineClients;
  final String searchIndex;

  _GisNode({
    required this.raw,
    required this.id,
    required this.name,
    required this.code,
    required this.type,
    required this.status,
    required this.address,
    required this.latLng,
    required this.oltName,
    required this.interfaceRef,
    required this.tube,
    required this.core,
    this.corePower,
    this.parentName,
    this.splitterName,
    required this.totalPorts,
    required this.usedPorts,
    required this.percentage,
    required this.rxRange,
    required this.isLossTotal,
    required this.hasLoss,
    required this.notes,
    this.totalClients,
    this.onlineClients,
    required this.searchIndex,
  });

  factory _GisNode.fromMap(Map<String, dynamic> n) {
    final rawId = n['id'];
    final id = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '0') ?? 0;
    final name = (n['name'] ?? 'Node').toString();
    final code = (n['code'] ?? '').toString();
    final type = (n['node_type'] ?? 'ODP').toString().toUpperCase();
    final status = (n['status'] ?? 'active').toString().toLowerCase();
    final address = (n['address'] ?? '-').toString();

    final lat = double.tryParse(n['latitude']?.toString() ?? '') ?? 0.0;
    final lng = double.tryParse(n['longitude']?.toString() ?? '') ?? 0.0;

    final oltName = n['olt_name']?.toString() ??
        (n['olt_device'] is Map ? n['olt_device']['name']?.toString() : null) ??
        '-';
    final interfaceRef = (n['olt_port_ref'] ??
            n['interface_ref'] ??
            n['olt_interface'] ??
            n['interface'] ??
            '-')
        .toString();

    final tube = (n['tube_info'] ?? n['tube'] ?? '-').toString();
    final core = (n['core_color'] ?? n['core'] ?? '-').toString();
    final corePower = n['core_power']?.toString();
    final parentName = n['parent_node_name']?.toString() ??
        (n['parent_node'] is Map ? n['parent_node']['name']?.toString() : null);
    final splitterName = n['splitter_ratio']?.toString() ??
        (n['splitter'] is Map ? n['splitter']['ratio']?.toString() : null);

    final rawCap = n['total_ports'] ?? n['capacity'];
    final totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;

    int usedPorts = 0;
    if (n['used_ports'] is int) {
      usedPorts = n['used_ports'];
    } else if (n['ports_used'] is int) {
      usedPorts = n['ports_used'];
    } else if (n['active_ports'] is int) {
      usedPorts = n['active_ports'];
    } else if (n['ports'] is List) {
      usedPorts = (n['ports'] as List)
          .where((p) =>
              (p['status'] ?? '').toString().toLowerCase() == 'active' ||
              p['customer_name'] != null ||
              p['customer_id'] != null)
          .length;
    } else if (n['used_ports'] != null) {
      usedPorts = int.tryParse(n['used_ports'].toString()) ?? 0;
    }

    final percentage = totalPorts > 0 ? ((usedPorts / totalPorts) * 100).round() : 0;
    final rxRange = (n['rx_power_range'] ?? '').toString();
    final isLossTotal = n['is_loss_total'] == true || rxRange.toLowerCase().contains('loss total');
    final hasLoss = n['loss_clients'] != null && (int.tryParse(n['loss_clients'].toString()) ?? 0) > 0;
    final notes = (n['notes'] ?? n['description'] ?? '').toString().trim();
    final totalClients = n['total_clients']?.toString();
    final onlineClients = n['online_clients']?.toString();

    final searchIndex = '$name $code $address $oltName $interfaceRef'.toLowerCase();

    return _GisNode(
      raw: n,
      id: id,
      name: name,
      code: code,
      type: type,
      status: status,
      address: address,
      latLng: LatLng(lat, lng),
      oltName: oltName,
      interfaceRef: interfaceRef,
      tube: tube,
      core: core,
      corePower: corePower,
      parentName: parentName,
      splitterName: splitterName,
      totalPorts: totalPorts,
      usedPorts: usedPorts,
      percentage: percentage,
      rxRange: rxRange,
      isLossTotal: isLossTotal,
      hasLoss: hasLoss,
      notes: notes,
      totalClients: totalClients,
      onlineClients: onlineClients,
      searchIndex: searchIndex,
    );
  }
}
