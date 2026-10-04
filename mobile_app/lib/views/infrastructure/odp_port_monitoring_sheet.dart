import 'dart:io';
import 'dart:ui' as ui;
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:intl/intl.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';

class OdpPortMonitoringSheet extends StatefulWidget {
  final int nodeId;
  final String nodeName;
  final String nodeType;
  final int totalPorts;
  final String? oltName;
  final String? interfaceRef;
  final String? splitterRatio;

  const OdpPortMonitoringSheet({
    super.key,
    required this.nodeId,
    required this.nodeName,
    this.nodeType = 'ODP',
    this.totalPorts = 8,
    this.oltName,
    this.interfaceRef,
    this.splitterRatio,
  });

  static void show(
    BuildContext context, {
    required int nodeId,
    required String nodeName,
    String nodeType = 'ODP',
    int totalPorts = 8,
    String? oltName,
    String? interfaceRef,
    String? splitterRatio,
  }) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => OdpPortMonitoringSheet(
        nodeId: nodeId,
        nodeName: nodeName,
        nodeType: nodeType,
        totalPorts: totalPorts,
        oltName: oltName,
        interfaceRef: interfaceRef,
        splitterRatio: splitterRatio,
      ),
    );
  }

  @override
  State<OdpPortMonitoringSheet> createState() => _OdpPortMonitoringSheetState();
}

class _OdpPortMonitoringSheetState extends State<OdpPortMonitoringSheet> {
  // Palette selaras dengan Login, Home, Data Pelanggan, dan Data Node
  static const Color _navyDeep = Color(0xFF001B3A);
  static const Color _navy = Color(0xFF003875);
  static const Color _brandBlue = Color(0xFF005BAA);
  static const Color _cyan = Color(0xFF008ED6);
  static const Color _neon = Color(0xFF00E5FF);
  static const Color _bg = Color(0xFFF4F6F9);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textBody = Color(0xFF475569);
  static const Color _textMuted = Color(0xFF94A3B8);
  static const Color _border = Color(0xFFE2E8F0);

  bool _isLoading = true;
  bool _isProbingLive = false;
  String? _errorMessage;
  List<dynamic> _ports = [];
  Map<String, dynamic>? _nodeData;
  Map<String, dynamic>? _statsData;
  Map<String, dynamic>? _oltInfoData;

  @override
  void initState() {
    super.initState();
    _fetchPortDetail(isRefresh: false);
  }

  Future<void> _fetchPortDetail({bool isRefresh = false}) async {
    setState(() {
      if (isRefresh) {
        _isProbingLive = true;
      } else {
        _isLoading = true;
      }
      _errorMessage = null;
    });

    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointNodePortDetail(widget.nodeId),
        queryParameters: isRefresh ? {'refresh': 'true', 'live': 'true'} : null,
      );

      if (response.data != null && mounted) {
        final data = response.data is Map ? response.data : {};
        setState(() {
          _ports = data['ports'] is List ? data['ports'] : [];
          _nodeData = data['node'] is Map ? Map<String, dynamic>.from(data['node']) : null;
          _statsData = data['stats'] is Map ? Map<String, dynamic>.from(data['stats']) : null;
          _oltInfoData = data['olt_info'] is Map ? Map<String, dynamic>.from(data['olt_info']) : null;
          _isLoading = false;
          _isProbingLive = false;
        });
      }
    } on DioException catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.response?.data?['message'] ?? 'Gagal memuat detail port & monitoring redaman.';
          _isLoading = false;
          _isProbingLive = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Terjadi kesalahan: $e';
          _isLoading = false;
          _isProbingLive = false;
        });
      }
    }
  }

  void _captureFullDocumentScreenshot() {
    if (_isLoading) return;
    _openFullReportModal();
  }

  void _showInModalAlert(
    BuildContext ctx, {
    required String title,
    required String message,
    required bool isSuccess,
  }) {
    showDialog(
      context: ctx,
      builder: (dialogCtx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        backgroundColor: Colors.white,
        title: Row(
          children: [
            Icon(
              isSuccess ? Icons.check_circle_rounded : Icons.error_outline_rounded,
              color: isSuccess ? AppColors.success : AppColors.danger,
              size: 24,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text(
                title,
                style: const TextStyle(
                  color: _textDark,
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ],
        ),
        content: Text(
          message,
          style: const TextStyle(
            color: _textBody,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isSuccess ? _brandBlue : AppColors.danger,
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () => Navigator.pop(dialogCtx),
            child: const Text('OK', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Future<void> _shareImage(Uint8List pngBytes, BuildContext modalCtx) async {
    final cleanNodeName = widget.nodeName.replaceAll(RegExp(r'[^\w\s\-]'), '_');
    final fileName = 'Monitoring_Redaman_${cleanNodeName}_${DateTime.now().millisecondsSinceEpoch}.png';

    try {
      final xFile = XFile.fromData(
        pngBytes,
        name: fileName,
        mimeType: 'image/png',
      );

      await SharePlus.instance.share(
        ShareParams(
          files: [xFile],
          text: 'Laporan Monitoring Redaman ${widget.nodeName} (${widget.nodeType}) — FONA Mobile',
        ),
      );
    } catch (e) {
      if (modalCtx.mounted) {
        _showInModalAlert(
          modalCtx,
          title: 'Info Berbagi Gambar',
          message: 'Silakan jalankan ulang aplikasi agar plugin share native aktif.\nDetail: $e',
          isSuccess: false,
        );
      }
    }
  }

  Future<void> _downloadOrSaveImage(Uint8List pngBytes, BuildContext modalCtx) async {
    final cleanNodeName = widget.nodeName.replaceAll(RegExp(r'[^\w\s\-]'), '_');
    final fileName = 'Laporan_Redaman_${cleanNodeName}_${DateFormat('yyyyMMdd_HHmm').format(DateTime.now())}.png';

    try {
      if (kIsWeb) {
        try {
          final xFile = XFile.fromData(pngBytes, name: fileName, mimeType: 'image/png');
          await xFile.saveTo(fileName);
        } catch (_) {
          final uri = Uri.dataFromBytes(pngBytes, mimeType: 'image/png');
          await launchUrl(uri);
        }

        if (modalCtx.mounted) {
          _showInModalAlert(
            modalCtx,
            title: 'Unduhan Berhasil',
            message: 'Berkas laporan "$fileName" telah diunduh oleh browser Anda.',
            isSuccess: true,
          );
        }
        return;
      }

      Directory? targetDir;
      if (defaultTargetPlatform == TargetPlatform.android) {
        final downloadDir = Directory('/storage/emulated/0/Download');
        if (await downloadDir.exists()) {
          targetDir = downloadDir;
        } else {
          targetDir = await getExternalStorageDirectory() ?? await getApplicationDocumentsDirectory();
        }
      } else if (defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.linux ||
          defaultTargetPlatform == TargetPlatform.macOS) {
        targetDir = await getDownloadsDirectory() ?? await getApplicationDocumentsDirectory();
      } else {
        targetDir = await getApplicationDocumentsDirectory();
      }

      final savePath = '${targetDir.path}/$fileName';
      final file = File(savePath);
      await file.writeAsBytes(pngBytes);

      if (modalCtx.mounted) {
        _showInModalAlert(
          modalCtx,
          title: 'Gambar Berhasil Disimpan',
          message: 'Berkas laporan telah tersimpan di:\n$savePath',
          isSuccess: true,
        );
      }
    } catch (e) {
      if (modalCtx.mounted) {
        _showInModalAlert(
          modalCtx,
          title: 'Gagal Menyimpan Gambar',
          message: 'Terjadi kesalahan: $e',
          isSuccess: false,
        );
      }
    }
  }

  void _openFullReportModal() {
    final effectiveOltName = _oltInfoData?['device_name'] ??
        _nodeData?['olt_device']?['name'] ??
        widget.oltName ??
        'OLT Utama';

    final effectiveInterface = _oltInfoData?['auto_port_ref'] ??
        _nodeData?['olt_port_ref'] ??
        _nodeData?['auto_detected_port_ref'] ??
        widget.interfaceRef ??
        '—';

    final effectiveRatio = _nodeData?['splitter_type']?['ratio'] ??
        _nodeData?['splitter_type']?['name'] ??
        widget.splitterRatio ??
        '1:${widget.totalPorts}';

    final totalPortsCount = _nodeData?['total_ports'] ?? widget.totalPorts;
    final modalReportKey = GlobalKey();
    bool isProcessing = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          Future<Uint8List> capturePng() async {
            final boundary = modalReportKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
            if (boundary == null) {
              throw Exception('Komponen laporan belum siap.');
            }
            final ui.Image image = await boundary.toImage(pixelRatio: kIsWeb ? 2.0 : 2.5);
            final ByteData? byteData = await image.toByteData(format: ui.ImageByteFormat.png);
            if (byteData == null) {
              throw Exception('Gagal membuat berkas gambar.');
            }
            return byteData.buffer.asUint8List();
          }

          return Container(
            height: MediaQuery.of(modalCtx).size.height * 0.94,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 38,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.photo_camera_rounded, color: _brandBlue, size: 20),
                        SizedBox(width: 8),
                        Text(
                          'Laporan Lengkap Port',
                          style: TextStyle(
                            color: _textDark,
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ],
                    ),
                    IconButton(
                      icon: const Icon(Icons.close_rounded, color: _textMuted, size: 22),
                      onPressed: () => Navigator.pop(modalCtx),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Expanded(
                  child: Container(
                    decoration: BoxDecoration(
                      color: _bg,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: _border),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(14),
                      child: SingleChildScrollView(
                        padding: const EdgeInsets.all(8),
                        child: Center(
                          child: RepaintBoundary(
                            key: modalReportKey,
                            child: _buildFullReportCanvas(
                              effectiveOltName,
                              effectiveInterface,
                              effectiveRatio,
                              totalPortsCount,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      flex: 2,
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          side: const BorderSide(color: _border),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: isProcessing ? null : () => Navigator.pop(modalCtx),
                        child: const Text('Tutup', style: TextStyle(color: _textBody, fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 3,
                      child: OutlinedButton.icon(
                        icon: isProcessing
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: _brandBlue))
                            : const Icon(Icons.download_rounded, size: 18, color: _brandBlue),
                        label: const Text('Unduh', style: TextStyle(color: _brandBlue, fontWeight: FontWeight.w800)),
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          backgroundColor: _brandBlue.withValues(alpha: 0.08),
                          side: BorderSide(color: _brandBlue.withValues(alpha: 0.2)),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: isProcessing
                            ? null
                            : () async {
                                setModalState(() => isProcessing = true);
                                try {
                                  final pngBytes = await capturePng();
                                  if (modalCtx.mounted) {
                                    await _downloadOrSaveImage(pngBytes, modalCtx);
                                  }
                                } catch (e) {
                                  if (modalCtx.mounted) {
                                    _showInModalAlert(modalCtx, title: 'Gagal Mengunduh', message: '$e', isSuccess: false);
                                  }
                                } finally {
                                  if (modalCtx.mounted) {
                                    setModalState(() => isProcessing = false);
                                  }
                                }
                              },
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      flex: 4,
                      child: ElevatedButton.icon(
                        icon: isProcessing
                            ? const SizedBox(width: 14, height: 14, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                            : const Icon(Icons.share_rounded, size: 18, color: Colors.white),
                        label: const Text('Bagikan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _brandBlue,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          elevation: 0,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        onPressed: isProcessing
                            ? null
                            : () async {
                                setModalState(() => isProcessing = true);
                                try {
                                  final pngBytes = await capturePng();
                                  if (modalCtx.mounted) {
                                    await _shareImage(pngBytes, modalCtx);
                                  }
                                } catch (e) {
                                  if (modalCtx.mounted) {
                                    _showInModalAlert(modalCtx, title: 'Gagal Berbagi', message: '$e', isSuccess: false);
                                  }
                                } finally {
                                  if (modalCtx.mounted) {
                                    setModalState(() => isProcessing = false);
                                  }
                                }
                              },
                      ),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Color _getRxTextColor(dynamic rxVal) {
    if (rxVal == null) return AppColors.danger;
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null || numVal < -38.0) return AppColors.danger;
    if (numVal >= -24.0) return const Color(0xFF059669);
    if (numVal >= -27.0) return const Color(0xFFD97706);
    return const Color(0xFFDC2626);
  }

  Color _getRxBgColor(dynamic rxVal) {
    if (rxVal == null) return const Color(0xFFFEF2F2);
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null || numVal < -38.0) return const Color(0xFFFEF2F2);
    if (numVal >= -24.0) return const Color(0xFFECFDF5);
    if (numVal >= -27.0) return const Color(0xFFFFFBEB);
    return const Color(0xFFFEF2F2);
  }

  Color _getRxBorderColor(dynamic rxVal) {
    if (rxVal == null) return const Color(0xFFFECACA);
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null || numVal < -38.0) return const Color(0xFFFECACA);
    if (numVal >= -24.0) return const Color(0xFFA7F3D0);
    if (numVal >= -27.0) return const Color(0xFFFDE68A);
    return const Color(0xFFFECACA);
  }

  String _formatRxPower(dynamic rxVal) {
    if (rxVal == null) return 'Loss (-∞ dBm)';
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null || numVal < -38.0) return 'Loss (-∞ dBm)';
    return '${numVal.toStringAsFixed(2)} dBm';
  }

  @override
  Widget build(BuildContext context) {
    final effectiveOltName = _oltInfoData?['device_name'] ??
        _nodeData?['olt_device']?['name'] ??
        widget.oltName ??
        'OLT Utama';

    final effectiveInterface = _oltInfoData?['auto_port_ref'] ??
        _nodeData?['olt_port_ref'] ??
        _nodeData?['auto_detected_port_ref'] ??
        widget.interfaceRef ??
        '—';

    final effectiveRatio = _nodeData?['splitter_type']?['ratio'] ??
        _nodeData?['splitter_type']?['name'] ??
        widget.splitterRatio ??
        '1:${widget.totalPorts}';

    final totalPortsCount = _nodeData?['total_ports'] ?? widget.totalPorts;

    // Hitung statistik port terisi
    final portMap = <int, Map<String, dynamic>>{};
    for (final p in _ports) {
      if (p is Map) {
        final portNum = int.tryParse(p['port_number']?.toString() ?? '') ?? 0;
        if (portNum > 0) {
          portMap[portNum] = Map<String, dynamic>.from(p);
        }
      }
    }
    final usedCount = portMap.values.where((port) {
      return port['customer_name'] != null ||
          port['customer_id'] != null ||
          port['customer_service_id'] != null ||
          port['customer_name_cache'] != null ||
          (port['onu_serial'] != null && port['onu_serial'].toString().isNotEmpty) ||
          port['status'] == 'used';
    }).length;

    return Container(
      height: MediaQuery.of(context).size.height * 0.92,
      decoration: const BoxDecoration(
        color: _bg,
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      child: Column(
        children: [
          // ── Header Gradient Banner ──
          Container(
            padding: const EdgeInsets.fromLTRB(20, 12, 16, 16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [_navyDeep, _navy, _brandBlue, _cyan],
                stops: [0.0, 0.35, 0.75, 1.0],
              ),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    margin: const EdgeInsets.only(bottom: 12),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                Row(
                  children: [
                    Container(
                      width: 42,
                      height: 42,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
                      ),
                      child: const Icon(Icons.hub_rounded, color: Colors.white, size: 22),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            widget.nodeName,
                            style: const TextStyle(
                              color: Colors.white,
                              fontWeight: FontWeight.w800,
                              fontSize: 17,
                              letterSpacing: 0.2,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 2),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1.5),
                                decoration: BoxDecoration(
                                  color: _neon.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  '$effectiveRatio ($usedCount/$totalPortsCount Terisi)',
                                  style: const TextStyle(color: _neon, fontSize: 10.5, fontWeight: FontWeight.w700),
                                ),
                              ),
                              const SizedBox(width: 6),
                              Expanded(
                                child: Text(
                                  effectiveInterface,
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize: 11,
                                    fontWeight: FontWeight.w600,
                                  ),
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    _glassHeaderButton(
                      icon: Icons.photo_camera_rounded,
                      tooltip: 'Screenshot',
                      onTap: _isLoading ? null : _captureFullDocumentScreenshot,
                    ),
                    const SizedBox(width: 6),
                    _glassHeaderButton(
                      icon: _isProbingLive ? Icons.hourglass_top_rounded : Icons.refresh_rounded,
                      tooltip: 'Refresh',
                      onTap: _isProbingLive ? null : () => _fetchPortDetail(isRefresh: true),
                    ),
                    const SizedBox(width: 6),
                    _glassHeaderButton(
                      icon: Icons.close_rounded,
                      tooltip: 'Tutup',
                      onTap: () => Navigator.pop(context),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // ── Body Content ──
          Expanded(
            child: _isLoading
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        CircularProgressIndicator(color: _brandBlue),
                        SizedBox(height: 16),
                        Text(
                          'Mengambil data port & telemetri redaman...',
                          style: TextStyle(color: _textBody, fontSize: 13, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 48),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: _textBody, fontSize: 13),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: _brandBlue,
                                  foregroundColor: Colors.white,
                                  elevation: 0,
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                                onPressed: () => _fetchPortDetail(isRefresh: false),
                                child: const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.w700)),
                              ),
                            ],
                          ),
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                        children: [
                          // OLT Connection Banner Card
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: _border),
                              boxShadow: [
                                BoxShadow(color: _navyDeep.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3)),
                              ],
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: _brandBlue.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(10),
                                  ),
                                  child: const Icon(Icons.router_rounded, color: _brandBlue, size: 20),
                                ),
                                const SizedBox(width: 12),
                                Expanded(
                                  flex: 6,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'OLT TERHUBUNG',
                                        style: TextStyle(
                                          color: _textMuted,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        effectiveOltName,
                                        style: const TextStyle(
                                          color: _textDark,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 13,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                                Container(
                                  width: 1,
                                  height: 28,
                                  color: _border,
                                  margin: const EdgeInsets.symmetric(horizontal: 10),
                                ),
                                Expanded(
                                  flex: 5,
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      const Text(
                                        'INTERFACE PON',
                                        style: TextStyle(
                                          color: _textMuted,
                                          fontSize: 9.5,
                                          fontWeight: FontWeight.w700,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        effectiveInterface,
                                        style: const TextStyle(
                                          color: _brandBlue,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 12,
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),

                          // Optical Statistics Bar
                          if (_statsData != null && _statsData?['avg_rx_power'] != null) ...[
                            const SizedBox(height: 10),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(12),
                                border: Border.all(color: _border),
                                boxShadow: [
                                  BoxShadow(color: _navyDeep.withValues(alpha: 0.03), blurRadius: 8, offset: const Offset(0, 2)),
                                ],
                              ),
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceAround,
                                children: [
                                  _buildStatItem('Min (Terkecil)', '${_statsData?['min_rx_power'] ?? '—'} dBm', const Color(0xFFDC2626)),
                                  Container(width: 1, height: 24, color: _border),
                                  _buildStatItem('Rata-rata', '${_statsData?['avg_rx_power'] ?? '—'} dBm', _brandBlue),
                                  Container(width: 1, height: 24, color: _border),
                                  _buildStatItem('Max (Tertinggi)', '${_statsData?['max_rx_power'] ?? '—'} dBm', const Color(0xFF059669)),
                                ],
                              ),
                            ),
                          ],
                          const SizedBox(height: 16),

                          // Section Title
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Row(
                                children: [
                                  const Text(
                                    'Daftar Port ODP',
                                    style: TextStyle(
                                      color: _textDark,
                                      fontWeight: FontWeight.w800,
                                      fontSize: 14.5,
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: _brandBlue.withValues(alpha: 0.1),
                                      borderRadius: BorderRadius.circular(20),
                                    ),
                                    child: Text(
                                      '$totalPortsCount Port',
                                      style: const TextStyle(
                                        color: _brandBlue,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              if (_isProbingLive)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: AppColors.success.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: const Row(
                                    children: [
                                      SizedBox(
                                        width: 10,
                                        height: 10,
                                        child: CircularProgressIndicator(strokeWidth: 1.5, color: AppColors.success),
                                      ),
                                      SizedBox(width: 5),
                                      Text(
                                        'Merefresh data...',
                                        style: TextStyle(color: AppColors.success, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                    ],
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 10),

                          // Ports Grid
                          _buildPortsGrid(totalPortsCount, effectiveInterface),
                        ],
                      ),
          ),

          // ── Bottom Footer Bar ──
          Container(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 14),
            decoration: const BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: _border)),
            ),
            child: SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF1F5F9),
                  foregroundColor: _textDark,
                  elevation: 0,
                  side: const BorderSide(color: _border),
                  padding: const EdgeInsets.symmetric(vertical: 12),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                onPressed: () => Navigator.pop(context),
                child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13.5)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _glassHeaderButton({
    required IconData icon,
    required String tooltip,
    required VoidCallback? onTap,
  }) {
    return Material(
      color: Colors.white.withValues(alpha: 0.15),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(10),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.2)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(10),
        onTap: onTap,
        child: SizedBox(
          width: 34,
          height: 34,
          child: Icon(icon, color: Colors.white, size: 17),
        ),
      ),
    );
  }

  Widget _buildPortsGrid(int totalPortsCount, String defaultInterface) {
    final portMap = <int, Map<String, dynamic>>{};
    for (final p in _ports) {
      if (p is Map) {
        final portNum = int.tryParse(p['port_number']?.toString() ?? '') ?? 0;
        if (portNum > 0) {
          portMap[portNum] = Map<String, dynamic>.from(p);
        }
      }
    }

    final numPortsToRender = totalPortsCount > 0 ? totalPortsCount : (portMap.keys.isNotEmpty ? portMap.keys.reduce((a, b) => a > b ? a : b) : 8);

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        mainAxisExtent: 185,
      ),
      itemCount: numPortsToRender,
      itemBuilder: (ctx, idx) {
        final portNum = idx + 1;
        final port = portMap[portNum];
        final isOccupied = port != null &&
            (port['customer_name'] != null ||
                port['customer_id'] != null ||
                port['customer_service_id'] != null ||
                port['customer_name_cache'] != null ||
                (port['onu_serial'] != null && port['onu_serial'].toString().isNotEmpty) ||
                port['status'] == 'used');

        if (isOccupied) {
          return _buildOccupiedPortCard(portNum, port, defaultInterface);
        } else {
          return _buildAvailablePortCard(portNum);
        }
      },
    );
  }

  Widget _buildOccupiedPortCard(int portNum, Map<String, dynamic> port, String defaultInterface) {
    final custName = port['customer_name'] ?? port['customer_name_cache'] ?? 'Pelanggan Port $portNum';
    final sn = port['onu_serial'] ?? '-';
    final iface = port['olt_port_name'] ?? defaultInterface;
    final rxVal = port['rx_power'];
    final status = (port['sobok_service_status'] ?? port['service_status'] ?? 'OPEN').toString().toUpperCase();
    final isBlocked = status == 'BLOKIR' || status == 'ISOLIR' || status == 'SUSPEND';

    final rxTextColor = _getRxTextColor(rxVal);
    final rxBgColor = _getRxBgColor(rxVal);
    final rxBorderColor = _getRxBorderColor(rxVal);

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
        boxShadow: [
          BoxShadow(color: _navyDeep.withValues(alpha: 0.04), blurRadius: 10, offset: const Offset(0, 3)),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top Row: P1 • Terisi & Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: _brandBlue.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'Port $portNum',
                  style: const TextStyle(color: _brandBlue, fontWeight: FontWeight.w800, fontSize: 11),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: isBlocked ? AppColors.danger.withValues(alpha: 0.1) : AppColors.success.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Container(
                      width: 5,
                      height: 5,
                      decoration: BoxDecoration(
                        color: isBlocked ? AppColors.danger : AppColors.success,
                        shape: BoxShape.circle,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      status,
                      style: TextStyle(
                        color: isBlocked ? AppColors.danger : AppColors.success,
                        fontWeight: FontWeight.w800,
                        fontSize: 9.5,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),

          // Customer Name
          Text(
            custName,
            style: const TextStyle(
              color: _textDark,
              fontWeight: FontWeight.w800,
              fontSize: 13,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),

          // SN & IF
          Row(
            children: [
              const Text('SN: ', style: TextStyle(color: _textMuted, fontSize: 9.5, fontWeight: FontWeight.w600)),
              Expanded(
                child: Text(
                  sn,
                  style: const TextStyle(color: _textBody, fontSize: 9.5, fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Row(
            children: [
              const Text('IF: ', style: TextStyle(color: _textMuted, fontSize: 9.5, fontWeight: FontWeight.w600)),
              Expanded(
                child: Text(
                  iface,
                  style: const TextStyle(
                    color: _brandBlue,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          // Redaman Rx Container
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color: rxBgColor,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: rxBorderColor),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Redaman Rx:',
                  style: TextStyle(color: _textBody, fontSize: 9.5, fontWeight: FontWeight.w500),
                ),
                Text(
                  _formatRxPower(rxVal),
                  style: TextStyle(color: rxTextColor, fontWeight: FontWeight.w800, fontSize: 10.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvailablePortCard(int portNum) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: _border),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: _border),
                ),
                child: Text(
                  'Port $portNum',
                  style: const TextStyle(color: _textMuted, fontWeight: FontWeight.w700, fontSize: 10.5),
                ),
              ),
              const Text(
                'SC-APC',
                style: TextStyle(color: _textMuted, fontWeight: FontWeight.w600, fontSize: 9.5),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
              border: Border.all(color: _border),
            ),
            child: const Icon(Icons.add_rounded, color: _textMuted, size: 18),
          ),
          const SizedBox(height: 6),
          const Text(
            'Port Tersedia',
            style: TextStyle(color: _textBody, fontSize: 11, fontWeight: FontWeight.w600),
          ),
          const Spacer(),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: _textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(color: valueColor, fontSize: 12, fontWeight: FontWeight.w800)),
      ],
    );
  }

  /// Builds the full, unclipped document layout for High-Resolution Screenshot export
  Widget _buildFullReportCanvas(
    String effectiveOltName,
    String effectiveInterface,
    String effectiveRatio,
    int totalPortsCount,
  ) {
    final nowFormatted = DateFormat('dd MMM yyyy, HH:mm').format(DateTime.now());

    return Container(
      width: 520,
      padding: const EdgeInsets.all(24),
      decoration: const BoxDecoration(
        color: _bg,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: _border),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _brandBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.hub_rounded, color: _brandBlue, size: 26),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          const Text(
                            'FONA MOBILE',
                            style: TextStyle(
                              color: _brandBlue,
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Text(
                            nowFormatted,
                            style: const TextStyle(color: _textMuted, fontSize: 10.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Laporan Redaman — ${widget.nodeName}',
                        style: const TextStyle(
                          color: _textDark,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Kapasitas: $effectiveRatio ($totalPortsCount Port) · IF: $effectiveInterface',
                        style: const TextStyle(color: _textBody, fontSize: 11.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: _border),
            ),
            child: Row(
              children: [
                const Icon(Icons.router_rounded, color: _brandBlue, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('OLT INDUK', style: TextStyle(color: _textMuted, fontSize: 9.5, fontWeight: FontWeight.w700)),
                      Text(effectiveOltName, style: const TextStyle(color: _textDark, fontWeight: FontWeight.w800, fontSize: 13)),
                    ],
                  ),
                ),
                Container(width: 1, height: 28, color: _border, margin: const EdgeInsets.symmetric(horizontal: 10)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('INTERFACE OLT', style: TextStyle(color: _textMuted, fontSize: 9.5, fontWeight: FontWeight.w700)),
                      Text(effectiveInterface, style: const TextStyle(color: _brandBlue, fontWeight: FontWeight.w800, fontSize: 12.5)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          if (_statsData != null && _statsData?['avg_rx_power'] != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: _border),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem('Min (Terkecil)', '${_statsData?['min_rx_power'] ?? '—'} dBm', const Color(0xFFDC2626)),
                  Container(width: 1, height: 24, color: _border),
                  _buildStatItem('Rata-rata', '${_statsData?['avg_rx_power'] ?? '—'} dBm', _brandBlue),
                  Container(width: 1, height: 24, color: _border),
                  _buildStatItem('Max (Tertinggi)', '${_statsData?['max_rx_power'] ?? '—'} dBm', const Color(0xFF059669)),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          Row(
            children: [
              const Text(
                'STATUS SELURUH PORT',
                style: TextStyle(color: _textDark, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 0.5),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: _brandBlue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(6)),
                child: Text('$totalPortsCount Port Total', style: const TextStyle(color: _brandBlue, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          _buildPortsGrid(totalPortsCount, effectiveInterface),

          const SizedBox(height: 16),
          Center(
            child: Text(
              'Dokumen telemetri resmi ini digenerate oleh FONA Mobile · Tanggal: $nowFormatted',
              style: const TextStyle(color: _textMuted, fontSize: 10, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }
}
