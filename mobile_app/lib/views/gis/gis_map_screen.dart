import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
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
  final MapController _mapController = MapController();
  List<dynamic> _nodes = [];
  List<dynamic> _cables = [];
  bool _isLoading = true;
  String? _errorMessage;

  // Filters & Toggles
  String _selectedFilter = 'ALL'; // 'ALL', 'ODP', 'ODC', 'POP', 'LOSS'
  String _selectedOlt = 'ALL';
  List<String> _availableOlts = ['ALL'];
  final TextEditingController _searchCtrl = TextEditingController();
  String _searchQuery = '';

  bool _showCables = true;
  bool _showLabels = true;
  String _currentTileType = 'google_roadmap'; // 'google_roadmap', 'satellite', 'osm', 'dark'
  Position? _currentPosition;
  Map<String, dynamic>? _selectedNode;

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

        final oltsSet = <String>{'ALL'};
        for (var n in rawNodes) {
          final olt = n['olt_name'] ?? (n['olt_device'] is Map ? n['olt_device']['name'] : null);
          if (olt != null && olt.toString().isNotEmpty) {
            oltsSet.add(olt.toString());
          }
        }

        if (mounted) {
          setState(() {
            _nodes = rawNodes;
            _cables = rawCables;
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

  void _focusNodeById(int id) {
    final target = _nodes.firstWhere(
      (n) => n['id'] == id,
      orElse: () => null,
    );
    if (target != null) {
      final lat = double.tryParse(target['latitude']?.toString() ?? '');
      final lng = double.tryParse(target['longitude']?.toString() ?? '');
      if (lat != null && lng != null) {
        _mapController.move(LatLng(lat, lng), 17.0);
        _showNodeDetailSheet(target as Map<String, dynamic>);
      }
    }
  }

  void _fitAllNodes() {
    final validNodes = _nodes.where((n) {
      final lat = double.tryParse(n['latitude']?.toString() ?? '');
      final lng = double.tryParse(n['longitude']?.toString() ?? '');
      return lat != null && lng != null && lat != 0 && lng != 0;
    }).toList();

    if (validNodes.isEmpty) return;

    final points = validNodes.map((n) {
      final lat = double.parse(n['latitude'].toString());
      final lng = double.parse(n['longitude'].toString());
      return LatLng(lat, lng);
    }).toList();

    if (points.length == 1) {
      _mapController.move(points.first, 16.0);
      return;
    }

    final bounds = LatLngBounds.fromPoints(points);
    _mapController.fitCamera(
      CameraFit.bounds(
        bounds: bounds,
        padding: const EdgeInsets.all(45),
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

  void _openGoogleMaps(dynamic lat, dynamic lng) async {
    if (lat == null || lng == null) return;
    final url = 'https://www.google.com/maps/search/?api=1&query=$lat,$lng';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  List<Polyline> _buildCablePolylines() {
    if (!_showCables) return [];
    final polylines = <Polyline>[];

    // 1. From explicit cables array
    for (var c in _cables) {
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

      // If no route coordinates, link from_node to to_node
      if (points.length < 2 && c['from_node_id'] != null && c['to_node_id'] != null) {
        final fromNode = _nodes.firstWhere((n) => n['id'] == c['from_node_id'], orElse: () => null);
        final toNode = _nodes.firstWhere((n) => n['id'] == c['to_node_id'], orElse: () => null);
        if (fromNode != null && toNode != null) {
          final fLat = double.tryParse(fromNode['latitude']?.toString() ?? '');
          final fLng = double.tryParse(fromNode['longitude']?.toString() ?? '');
          final tLat = double.tryParse(toNode['latitude']?.toString() ?? '');
          final tLng = double.tryParse(toNode['longitude']?.toString() ?? '');
          if (fLat != null && fLng != null && tLat != null && tLng != null) {
            points = [LatLng(fLat, fLng), LatLng(tLat, tLng)];
          }
        }
      }

      if (points.length >= 2) {
        final rawColor = (c['cable_color'] ?? '').toString().toLowerCase();
        Color lineColor = const Color(0xFF0284C7);
        if (rawColor.contains('biru') || rawColor.contains('blue')) {
          lineColor = const Color(0xFF0284C7);
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
            strokeWidth: 3.5,
          ),
        );
      }
    }

    // 2. Fallback parent-child links if no explicit cables
    if (polylines.isEmpty) {
      final nodeMap = {for (var n in _nodes) n['id']: n};
      for (var n in _nodes) {
        final parentId = n['parent_node_id'];
        if (parentId != null && nodeMap.containsKey(parentId)) {
          final parent = nodeMap[parentId];
          final cLat = double.tryParse(n['latitude']?.toString() ?? '');
          final cLng = double.tryParse(n['longitude']?.toString() ?? '');
          final pLat = double.tryParse(parent['latitude']?.toString() ?? '');
          final pLng = double.tryParse(parent['longitude']?.toString() ?? '');

          if (cLat != null && cLng != null && pLat != null && pLng != null) {
            polylines.add(
              Polyline(
                points: [LatLng(pLat, pLng), LatLng(cLat, cLng)],
                color: const Color(0xFF00AAE0).withValues(alpha: 0.7),
                strokeWidth: 2.5,
              ),
            );
          }
        }
      }
    }

    return polylines;
  }

  List<Marker> _buildMarkers(List<dynamic> filteredNodes) {
    final markers = <Marker>[];

    for (var n in filteredNodes) {
      final lat = double.tryParse(n['latitude']?.toString() ?? '');
      final lng = double.tryParse(n['longitude']?.toString() ?? '');
      if (lat == null || lng == null || lat == 0 || lng == 0) continue;

      final type = (n['node_type'] ?? 'ODP').toString().toUpperCase();
      final status = (n['status'] ?? 'active').toString().toLowerCase();
      final name = (n['name'] ?? '-').toString();
      final isSelected = _selectedNode != null && _selectedNode!['id'] == n['id'];

      final rxRange = (n['rx_power_range'] ?? '').toString();
      final isLossTotal = n['is_loss_total'] == true || rxRange.toLowerCase().contains('loss total');
      final hasLoss = n['loss_clients'] != null && (int.tryParse(n['loss_clients'].toString()) ?? 0) > 0;

      // Color Coding (Matching Web Enterprise System)
      Color pinColor = const Color(0xFF059669); // Emerald Green
      IconData pinIcon = Icons.grid_view_rounded;

      if (type == 'POP') {
        pinColor = const Color(0xFF4F46E5); // Indigo
        pinIcon = Icons.dns_rounded;
      } else if (type == 'ODC') {
        pinColor = const Color(0xFF0284C7); // Sky Blue
        pinIcon = Icons.account_tree_rounded;
      } else if (type == 'ODP') {
        if (isLossTotal) {
          pinColor = const Color(0xFFEF4444); // Red Alert Loss
          pinIcon = Icons.warning_amber_rounded;
        } else if (hasLoss) {
          pinColor = const Color(0xFFF59E0B); // Amber Warning
          pinIcon = Icons.sensors_rounded;
        } else if (status == 'maintenance') {
          pinColor = const Color(0xFFD97706);
          pinIcon = Icons.settings_rounded;
        } else if (status == 'inactive') {
          pinColor = const Color(0xFF64748B);
          pinIcon = Icons.power_off_rounded;
        }
      }

      markers.add(
        Marker(
          point: LatLng(lat, lng),
          width: _showLabels ? 100 : 36,
          height: _showLabels ? 56 : 36,
          alignment: Alignment.topCenter,
          child: GestureDetector(
            onTap: () {
              setState(() => _selectedNode = n as Map<String, dynamic>);
              _showNodeDetailSheet(n as Map<String, dynamic>);
            },
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                // Pin Bubble
                Container(
                  width: isSelected ? 36 : 30,
                  height: isSelected ? 36 : 30,
                  decoration: BoxDecoration(
                    color: pinColor,
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white,
                      width: isSelected ? 3 : 2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: pinColor.withValues(alpha: isSelected ? 0.6 : 0.35),
                        blurRadius: isSelected ? 10 : 5,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Icon(pinIcon, color: Colors.white, size: isSelected ? 18 : 15),
                ),
                // Text Label Pill
                if (_showLabels)
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.95),
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: pinColor.withValues(alpha: 0.5), width: 0.8),
                      boxShadow: const [
                        BoxShadow(color: Colors.black12, blurRadius: 3, offset: Offset(0, 1)),
                      ],
                    ),
                    child: Text(
                      name,
                      style: TextStyle(
                        color: const Color(0xFF0F172A),
                        fontWeight: isSelected ? FontWeight.w800 : FontWeight.w700,
                        fontSize: 9.5,
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

    return markers;
  }

  void _showNodeDetailSheet(Map<String, dynamic> node) {
    final String name = (node['name'] ?? 'ODP').toString();
    final String type = (node['node_type'] ?? 'ODP').toString().toUpperCase();
    final String status = (node['status'] ?? 'active').toString().toLowerCase();
    final bool isActive = status == 'active' || status == 'online';
    final String address = (node['address'] ?? '-').toString();
    final dynamic lat = node['latitude'];
    final dynamic lng = node['longitude'];

    final String oltName = node['olt_name']?.toString() ??
        (node['olt_device'] is Map ? node['olt_device']['name']?.toString() : null) ??
        '-';
    final String interfaceRef = (node['olt_port_ref'] ??
            node['interface_ref'] ??
            node['olt_interface'] ??
            node['interface'] ??
            '-')
        .toString();

    final String tube = (node['tube_info'] ?? node['tube'] ?? '-').toString();
    final String core = (node['core_color'] ?? node['core'] ?? '-').toString();
    
    final rawCap = node['total_ports'] ?? node['capacity'];
    final int totalPorts = (rawCap is int ? rawCap : int.tryParse(rawCap?.toString() ?? '8')) ?? 8;
    
    final rawUsed = node['used_ports'] ?? node['ports_used'];
    final int usedPorts = (rawUsed is int ? rawUsed : int.tryParse(rawUsed?.toString() ?? '0')) ?? 0;
    
    final String? rxRange = node['rx_power_range']?.toString();

    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.all(20),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Grab Handle
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: const Color(0xFFCBD5E1),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const SizedBox(height: 14),

            // Title Row
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                  decoration: BoxDecoration(
                    color: const Color(0xFF00AAE0).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: const Color(0xFF00AAE0).withValues(alpha: 0.3)),
                  ),
                  child: Text(
                    type,
                    style: const TextStyle(
                      color: Color(0xFF00AAE0),
                      fontWeight: FontWeight.w800,
                      fontSize: 11,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    name,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontWeight: FontWeight.w800,
                      fontSize: 16,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                  decoration: BoxDecoration(
                    color: (isActive ? const Color(0xFF10B981) : const Color(0xFFEF4444)).withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isActive ? 'Aktif' : 'Non-Aktif',
                    style: TextStyle(
                      color: isActive ? const Color(0xFF059669) : const Color(0xFFDC2626),
                      fontSize: 10.5,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),

            const SizedBox(height: 10),
            const Divider(color: Color(0xFFE2E8F0)),
            const SizedBox(height: 8),

            // Quick Info Grid
            Row(
              children: [
                Expanded(
                  child: _buildSheetInfoItem('OLT Device', oltName, Icons.router_rounded),
                ),
                Expanded(
                  child: _buildSheetInfoItem('Interface', interfaceRef, Icons.settings_ethernet_rounded),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: _buildSheetInfoItem('Tube & Core', '$tube • $core', Icons.cable_rounded),
                ),
                Expanded(
                  child: _buildSheetInfoItem('Port Terisi', '$usedPorts/$totalPorts Port', Icons.grid_view_rounded),
                ),
              ],
            ),

            if (rxRange != null && rxRange.isNotEmpty) ...[
              const SizedBox(height: 8),
              _buildSheetInfoItem('Redaman Pelanggan', rxRange, Icons.speed_rounded, isAccent: true),
            ],

            if (address.isNotEmpty && address != '-') ...[
              const SizedBox(height: 8),
              _buildSheetInfoItem('Alamat', address, Icons.location_on_outlined),
            ],

            const SizedBox(height: 18),

            // Action Buttons
            Row(
              children: [
                // Maps Directions
                Expanded(
                  flex: 1,
                  child: OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF0284C7),
                      side: const BorderSide(color: Color(0xFFBAE6FD)),
                      backgroundColor: const Color(0xFFF0F9FF),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    onPressed: () {
                      Navigator.pop(ctx);
                      _openGoogleMaps(lat, lng);
                    },
                    icon: const Icon(Icons.near_me_rounded, size: 16),
                    label: const Text('Rute Maps', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12.5)),
                  ),
                ),
                const SizedBox(width: 8),
                // Form Ukur Shortcut
                IconButton(
                  tooltip: 'Ukur OPM Log',
                  style: IconButton.styleFrom(
                    backgroundColor: const Color(0xFFF1F5F9),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                  ),
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => OdpFormScreen(
                          prefilledOdpCode: node['code']?.toString(),
                          prefilledOdpName: name,
                          prefilledOdpNodeId: node['id'],
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.edit_note_rounded, color: Color(0xFF475569)),
                ),
                const SizedBox(width: 8),
                // Port Monitoring
                if (type == 'ODP')
                  Expanded(
                    flex: 1,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF00AAE0),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () {
                        Navigator.pop(ctx);
                        final rawId = node['id'];
                        final nodeId = rawId is int ? rawId : int.tryParse(rawId?.toString() ?? '0') ?? 0;
                        OdpPortMonitoringSheet.show(
                          context,
                          nodeId: nodeId,
                          nodeName: name,
                          nodeType: type,
                          totalPorts: totalPorts,
                          oltName: oltName != '-' ? oltName : null,
                          interfaceRef: interfaceRef != '-' ? interfaceRef : null,
                        );
                      },
                      icon: const Icon(Icons.speed_rounded, color: Colors.white, size: 16),
                      label: const Text('Cek Port', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12.5)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSheetInfoItem(String label, String value, IconData icon, {bool isAccent = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      margin: const EdgeInsets.only(right: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: isAccent ? const Color(0xFF00AAE0) : const Color(0xFF64748B)),
          const SizedBox(width: 6),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5, fontWeight: FontWeight.w500),
                ),
                Text(
                  value,
                  style: TextStyle(
                    color: isAccent ? const Color(0xFF00AAE0) : const Color(0xFF0F172A),
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  void _showLayersBottomSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Container(
          padding: const EdgeInsets.all(20),
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 16),
              const Text(
                'Pengaturan Layer & Tampilan Peta',
                style: TextStyle(color: Color(0xFF0F172A), fontWeight: FontWeight.bold, fontSize: 16),
              ),
              const SizedBox(height: 14),

              // Tile Style
              const Text('Tipe Peta (Base Map):', style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5, fontWeight: FontWeight.w600)),
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
              const Divider(color: Color(0xFFE2E8F0)),

              // Toggles
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tampilkan Jalur Kabel FO', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                subtitle: const Text('Garis koneksi kabel fiber antar node', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                value: _showCables,
                activeColor: const Color(0xFF00AAE0),
                onChanged: (val) {
                  setModalState(() => _showCables = val);
                  setState(() => _showCables = val);
                },
              ),
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                title: const Text('Tampilkan Label Nama ODP', style: TextStyle(fontSize: 13.5, fontWeight: FontWeight.w600)),
                subtitle: const Text('Teks nama di bawah pin marker', style: TextStyle(fontSize: 11.5, color: Color(0xFF64748B))),
                value: _showLabels,
                activeColor: const Color(0xFF00AAE0),
                onChanged: (val) {
                  setModalState(() => _showLabels = val);
                  setState(() => _showLabels = val);
                },
              ),

              if (_availableOlts.length > 1) ...[
                const SizedBox(height: 10),
                const Text('Filter OLT:', style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5, fontWeight: FontWeight.w600)),
                const SizedBox(height: 6),
                DropdownButtonFormField<String>(
                  value: _selectedOlt,
                  decoration: InputDecoration(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  items: _availableOlts
                      .map((olt) => DropdownMenuItem(value: olt, child: Text(olt == 'ALL' ? 'Semua OLT' : olt, style: const TextStyle(fontSize: 13))))
                      .toList(),
                  onChanged: (val) {
                    if (val != null) {
                      setModalState(() => _selectedOlt = val);
                      setState(() => _selectedOlt = val);
                    }
                  },
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
        borderRadius: BorderRadius.circular(10),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF00AAE0).withValues(alpha: 0.12) : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected ? const Color(0xFF00AAE0) : const Color(0xFFCBD5E1),
              width: isSelected ? 1.8 : 1,
            ),
          ),
          child: Column(
            children: [
              Icon(icon, color: isSelected ? const Color(0xFF00AAE0) : const Color(0xFF64748B), size: 20),
              const SizedBox(height: 4),
              Text(
                label,
                style: TextStyle(
                  color: isSelected ? const Color(0xFF00AAE0) : const Color(0xFF475569),
                  fontSize: 11.5,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
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
    final filteredNodes = _nodes.where((n) {
      final type = (n['node_type'] ?? '').toString().toUpperCase();
      final name = (n['name'] ?? '').toString().toLowerCase();
      final code = (n['code'] ?? '').toString().toLowerCase();
      final address = (n['address'] ?? '').toString().toLowerCase();
      final olt = (n['olt_name'] ?? (n['olt_device'] is Map ? n['olt_device']['name'] : '')).toString();

      final rxRange = (n['rx_power_range'] ?? '').toString();
      final isLossTotal = n['is_loss_total'] == true || rxRange.toLowerCase().contains('loss total');
      final hasLoss = n['loss_clients'] != null && (int.tryParse(n['loss_clients'].toString()) ?? 0) > 0;

      // Filter Type
      if (_selectedFilter == 'ODP' && type != 'ODP') return false;
      if (_selectedFilter == 'ODC' && type != 'ODC') return false;
      if (_selectedFilter == 'POP' && type != 'POP') return false;
      if (_selectedFilter == 'LOSS' && !isLossTotal && !hasLoss) return false;

      // Filter OLT
      if (_selectedOlt != 'ALL' && olt != _selectedOlt) return false;

      // Search Query
      if (_searchQuery.isNotEmpty) {
        final q = _searchQuery.toLowerCase().trim();
        final qClean = q.replaceAll(RegExp(r'[^a-z0-9]'), '');
        final nameClean = name.replaceAll(RegExp(r'[^a-z0-9]'), '');
        final codeClean = code.replaceAll(RegExp(r'[^a-z0-9]'), '');

        final directMatch = name.contains(q) || code.contains(q) || address.contains(q);
        final cleanMatch = qClean.isNotEmpty && (nameClean.contains(qClean) || codeClean.contains(qClean));
        if (!directMatch && !cleanMatch) return false;
      }

      return true;
    }).toList();

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // ── 1. MAIN INTERACTIVE FLUTTER MAP ──
          _isLoading
              ? const Center(
                  child: CircularProgressIndicator(
                    valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AAE0)),
                  ),
                )
              : _errorMessage != null
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 48),
                          const SizedBox(height: 12),
                          Text(_errorMessage!, style: const TextStyle(color: Color(0xFF64748B))),
                          const SizedBox(height: 14),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF00AAE0)),
                            onPressed: _fetchGisData,
                            child: const Text('Coba Lagi', style: TextStyle(color: Colors.white)),
                          ),
                        ],
                      ),
                    )
                  : FlutterMap(
                      mapController: _mapController,
                      options: const MapOptions(
                        initialCenter: LatLng(-0.789275, 100.65345), // Default Solok
                        initialZoom: 14.5,
                        minZoom: 3.0,
                        maxZoom: 19.0,
                      ),
                      children: [
                        TileLayer(
                          urlTemplate: _tileLayers[_currentTileType] ?? _tileLayers['google_roadmap']!,
                          userAgentPackageName: 'com.fiberunms.app',
                        ),
                        PolylineLayer(polylines: _buildCablePolylines()),
                        MarkerLayer(markers: _buildMarkers(filteredNodes)),
                        if (_currentPosition != null)
                          MarkerLayer(
                            markers: [
                              Marker(
                                point: LatLng(_currentPosition!.latitude, _currentPosition!.longitude),
                                width: 28,
                                height: 28,
                                child: Container(
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF00AAE0),
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

          // ── 2. TOP FLOATING SEARCH & CONTROLS ──
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 10, 14, 0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Search Bar Card
                  Container(
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.08),
                          blurRadius: 10,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        if (Navigator.canPop(context))
                          IconButton(
                            icon: const Icon(Icons.arrow_back_rounded, color: Color(0xFF475569)),
                            onPressed: () => Navigator.pop(context),
                          )
                        else
                          const Padding(
                            padding: EdgeInsets.only(left: 14, right: 8),
                            child: Icon(Icons.explore_rounded, color: Color(0xFF005BAA), size: 22),
                          ),
                        Expanded(
                          child: TextField(
                            controller: _searchCtrl,
                            onChanged: (val) => setState(() => _searchQuery = val.trim()),
                            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13.5),
                            decoration: const InputDecoration(
                              hintText: 'Cari ODP, ODC, POP, atau Wilayah...',
                              hintStyle: TextStyle(color: Color(0xFF94A3B8), fontSize: 12.5),
                              border: InputBorder.none,
                              contentPadding: EdgeInsets.symmetric(vertical: 13),
                            ),
                          ),
                        ),
                        if (_searchQuery.isNotEmpty)
                          IconButton(
                            icon: const Icon(Icons.clear_rounded, color: Color(0xFF64748B), size: 18),
                            onPressed: () {
                              _searchCtrl.clear();
                              setState(() => _searchQuery = '');
                            },
                          ),
                        IconButton(
                          icon: const Icon(Icons.refresh_rounded, color: Color(0xFF00AAE0)),
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
                    child: Row(
                      children: [
                        _buildFilterPill('Semua (${_nodes.length})', 'ALL', const Color(0xFF0284C7)),
                        const SizedBox(width: 6),
                        _buildFilterPill(
                          'ODP (${_nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODP').length})',
                          'ODP',
                          const Color(0xFF059669),
                        ),
                        const SizedBox(width: 6),
                        _buildFilterPill(
                          'ODC (${_nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'ODC').length})',
                          'ODC',
                          const Color(0xFF0284C7),
                        ),
                        const SizedBox(width: 6),
                        _buildFilterPill(
                          'POP (${_nodes.where((n) => (n['node_type'] ?? '').toString().toUpperCase() == 'POP').length})',
                          'POP',
                          const Color(0xFF4F46E5),
                        ),
                        const SizedBox(width: 6),
                        _buildFilterPill('Gangguan / Loss', 'LOSS', const Color(0xFFEF4444)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── 3. RIGHT FLOATING MAP TOOLS (Locate, Layers, Fit All) ──
          Positioned(
            right: 14,
            bottom: 30,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
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
                  iconColor: const Color(0xFF00AAE0),
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
              color: isSelected ? color : const Color(0xFFCBD5E1),
            ),
            boxShadow: const [
              BoxShadow(color: Colors.black12, blurRadius: 4, offset: Offset(0, 1)),
            ],
          ),
          child: Text(
            label,
            style: TextStyle(
              color: isSelected ? Colors.white : const Color(0xFF334155),
              fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
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
    Color iconColor = const Color(0xFF334155),
  }) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          width: 44,
          height: 44,
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFFE2E8F0)),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.12),
                blurRadius: 8,
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
