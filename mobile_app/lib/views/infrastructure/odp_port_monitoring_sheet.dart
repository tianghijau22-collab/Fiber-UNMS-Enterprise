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
  final GlobalKey _fullReportKey = GlobalKey();
  bool _isLoading = true;
  bool _isProbingLive = false;
  bool _isCapturingScreenshot = false;
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

  Future<void> _captureFullDocumentScreenshot() async {
    if (_isCapturingScreenshot || _isLoading) return;
    setState(() => _isCapturingScreenshot = true);

    try {
      // Delay to ensure the unconstrained offstage report boundary is fully painted
      await Future.delayed(const Duration(milliseconds: 200));

      final boundary = _fullReportKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        throw Exception('Komponen laporan lengkap tidak ditemukan.');
      }

      final ui.Image image = await boundary.toImage(pixelRatio: 2.5);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      if (byteData == null) {
        throw Exception('Gagal membuat berkas gambar.');
      }

      final pngBytes = byteData.buffer.asUint8List();

      if (mounted) {
        setState(() => _isCapturingScreenshot = false);
        _showScreenshotPreviewModal(pngBytes);
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isCapturingScreenshot = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Gagal mengambil screenshot: $e'),
            backgroundColor: AppColors.danger,
          ),
        );
      }
    }
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
                  color: AppColors.textPrimary,
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
            color: AppColors.textSecondary,
            fontSize: 13,
            height: 1.4,
          ),
        ),
        actions: [
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: isSuccess ? AppColors.primary : AppColors.danger,
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
      // Primary method: XFile.fromData (zero dependency on local file system)
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
          message: 'Silakan Stop & Run ulang aplikasi (Full Rebuild) agar plugin share native aktif.\nDetail: $e',
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

      // Mobile / Desktop file saving
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

  void _showScreenshotPreviewModal(Uint8List pngBytes) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (modalCtx) => Container(
        height: MediaQuery.of(modalCtx).size.height * 0.90,
        padding: const EdgeInsets.all(18),
        decoration: const BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          children: [
            // Handle bar
            Center(
              child: Container(
                width: 38,
                height: 4,
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: AppColors.surfaceBorder,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Row(
                  children: [
                    Icon(Icons.photo_camera_rounded, color: AppColors.primary, size: 22),
                    SizedBox(width: 8),
                    Text(
                      'Laporan Lengkap Seluruh Port',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ],
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary, size: 22),
                  onPressed: () => Navigator.pop(modalCtx),
                ),
              ],
            ),
            const SizedBox(height: 8),
            // Image Preview Card (InteractiveViewer supports zoom & pinch)
            Expanded(
              child: Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: InteractiveViewer(
                    maxScale: 5.0,
                    minScale: 0.5,
                    child: Center(
                      child: Image.memory(
                        pngBytes,
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 14),
            // Action Buttons (Download + Share + Close)
            Row(
              children: [
                Expanded(
                  flex: 2,
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      side: const BorderSide(color: AppColors.surfaceBorder),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.pop(modalCtx),
                    child: const Text('Tutup', style: TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700)),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 3,
                  child: OutlinedButton.icon(
                    icon: const Icon(Icons.download_rounded, size: 18, color: AppColors.primary),
                    label: const Text('Unduh', style: TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800)),
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      backgroundColor: AppColors.primaryLight.withValues(alpha: 0.5),
                      side: const BorderSide(color: AppColors.primaryLight),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      await _downloadOrSaveImage(pngBytes, modalCtx);
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  flex: 4,
                  child: ElevatedButton.icon(
                    icon: const Icon(Icons.share_rounded, size: 18, color: Colors.white),
                    label: const Text('Bagikan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () async {
                      await _shareImage(pngBytes, modalCtx);
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
          ],
        ),
      ),
    );
  }

  Color _getRxTextColor(dynamic rxVal) {
    if (rxVal == null) return AppColors.danger;
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null) return AppColors.danger;
    if (numVal >= -24.0) return const Color(0xFF059669); // Emerald
    if (numVal >= -27.0) return const Color(0xFFD97706); // Amber
    return const Color(0xFFDC2626); // Red
  }

  Color _getRxBgColor(dynamic rxVal) {
    if (rxVal == null) return const Color(0xFFFEF2F2);
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null) return const Color(0xFFFEF2F2);
    if (numVal >= -24.0) return const Color(0xFFECFDF5);
    if (numVal >= -27.0) return const Color(0xFFFFFBEB);
    return const Color(0xFFFEF2F2);
  }

  Color _getRxBorderColor(dynamic rxVal) {
    if (rxVal == null) return const Color(0xFFFECACA);
    final numVal = (rxVal is num) ? rxVal.toDouble() : double.tryParse(rxVal.toString());
    if (numVal == null) return const Color(0xFFFECACA);
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

    return Stack(
      children: [
        // 1. Offscreen / Invisible Unconstrained Full Report Canvas (Captures 100% of Ports with normal positive coordinates)
        Positioned(
          left: 0,
          top: 0,
          child: Opacity(
            opacity: 0.001,
            child: IgnorePointer(
              child: RepaintBoundary(
                key: _fullReportKey,
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

        // 2. Main Interactive Modal Bottom Sheet
        Container(
          height: MediaQuery.of(context).size.height * 0.92,
          decoration: const BoxDecoration(
            color: AppColors.background,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          child: Column(
            children: [
              // Header Card Section
              Container(
                padding: const EdgeInsets.only(top: 12, bottom: 12),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
                  border: Border(bottom: BorderSide(color: AppColors.surfaceBorder)),
                ),
                child: Column(
                  children: [
                    // Drag Handle
                    Center(
                      child: Container(
                        width: 38,
                        height: 4,
                        margin: const EdgeInsets.only(bottom: 12),
                        decoration: BoxDecoration(
                          color: AppColors.surfaceBorder,
                          borderRadius: BorderRadius.circular(2),
                        ),
                      ),
                    ),

                    // Header Title & Actions
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.grid_view_rounded, color: AppColors.primary, size: 20),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  widget.nodeName,
                                  style: const TextStyle(
                                    color: AppColors.textPrimary,
                                    fontWeight: FontWeight.w800,
                                    fontSize: 15.5,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                                const SizedBox(height: 2),
                                Row(
                                  children: [
                                    Text(
                                      '$effectiveRatio Port',
                                      style: const TextStyle(
                                        color: AppColors.textSecondary,
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const Text(' · ', style: TextStyle(color: AppColors.textMuted)),
                                    Expanded(
                                      child: Text(
                                        effectiveInterface,
                                        style: const TextStyle(
                                          color: AppColors.secondary,
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w700,
                                          fontFamily: 'monospace',
                                        ),
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                          // Screenshot Action Button
                          IconButton(
                            tooltip: 'Screenshot / Tangkap Layar Laporan Lengkap',
                            icon: _isCapturingScreenshot
                                ? const SizedBox(
                                    width: 16,
                                    height: 16,
                                    child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.primary),
                                  )
                                : const Icon(Icons.photo_camera_rounded, color: AppColors.textSecondary, size: 20),
                            onPressed: (_isLoading || _isCapturingScreenshot) ? null : _captureFullDocumentScreenshot,
                            visualDensity: VisualDensity.compact,
                          ),
                          // Refresh Action Button
                          Material(
                            color: Colors.transparent,
                            child: InkWell(
                              onTap: _isProbingLive ? null : () => _fetchPortDetail(isRefresh: true),
                              borderRadius: BorderRadius.circular(10),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 6.5),
                                decoration: BoxDecoration(
                                  color: _isProbingLive ? AppColors.successLight : AppColors.primaryLight,
                                  borderRadius: BorderRadius.circular(10),
                                  border: Border.all(
                                    color: _isProbingLive ? AppColors.success.withValues(alpha: 0.3) : AppColors.primary.withValues(alpha: 0.3),
                                  ),
                                ),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    _isProbingLive
                                        ? const SizedBox(
                                            width: 12,
                                            height: 12,
                                            child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.success),
                                          )
                                        : const Icon(Icons.refresh_rounded, color: AppColors.primaryDark, size: 15),
                                    const SizedBox(width: 4),
                                    Text(
                                      _isProbingLive ? 'Merefresh...' : 'Refresh',
                                      style: TextStyle(
                                        color: _isProbingLive ? AppColors.success : AppColors.primaryDark,
                                        fontSize: 11,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          IconButton(
                            icon: const Icon(Icons.close_rounded, color: AppColors.textSecondary, size: 21),
                            onPressed: () => Navigator.pop(context),
                            visualDensity: VisualDensity.compact,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              // Body Content
              Expanded(
                child: _isLoading
                    ? const Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            CircularProgressIndicator(color: AppColors.primary),
                            SizedBox(height: 16),
                            Text(
                              'Mengambil data port & telemetri redaman...',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 13),
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
                                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13),
                                  ),
                                  const SizedBox(height: 16),
                                  ElevatedButton(
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppColors.primary,
                                      elevation: 0,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                    ),
                                    onPressed: () => _fetchPortDetail(isRefresh: false),
                                    child: const Text('Coba Lagi', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
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
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: AppColors.surface,
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: AppColors.surfaceBorder),
                                  boxShadow: AppColors.cardShadow,
                                ),
                                child: Row(
                                  children: [
                                    Container(
                                      padding: const EdgeInsets.all(8),
                                      decoration: BoxDecoration(
                                        color: AppColors.surfaceLight,
                                        borderRadius: BorderRadius.circular(10),
                                      ),
                                      child: const Icon(Icons.router_rounded, color: AppColors.secondary, size: 20),
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
                                              color: AppColors.textMuted,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w700,
                                              letterSpacing: 0.5,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            effectiveOltName,
                                            style: const TextStyle(
                                              color: AppColors.textPrimary,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 13.5,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                    Container(
                                      width: 1,
                                      height: 32,
                                      color: AppColors.surfaceBorder,
                                      margin: const EdgeInsets.symmetric(horizontal: 10),
                                    ),
                                    Expanded(
                                      flex: 5,
                                      child: Column(
                                        crossAxisAlignment: CrossAxisAlignment.start,
                                        children: [
                                          const Text(
                                            'Interface OLT:',
                                            style: TextStyle(
                                              color: AppColors.textMuted,
                                              fontSize: 10,
                                              fontWeight: FontWeight.w600,
                                            ),
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            effectiveInterface,
                                            style: const TextStyle(
                                              color: AppColors.secondary,
                                              fontWeight: FontWeight.w800,
                                              fontSize: 12.5,
                                              fontFamily: 'monospace',
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ],
                                      ),
                                    ),
                                  ],
                                ),
                              ),

                              // Optical Statistics Bar (Min / Avg / Max)
                              if (_statsData != null && _statsData!['avg_rx_power'] != null) ...[
                                const SizedBox(height: 10),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  decoration: BoxDecoration(
                                    color: AppColors.surface,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: AppColors.surfaceBorder),
                                    boxShadow: AppColors.cardShadow,
                                  ),
                                  child: Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceAround,
                                    children: [
                                      _buildStatItem('Min (Terkecil)', '${_statsData!['min_rx_power'] ?? '—'} dBm', const Color(0xFFDC2626)),
                                      Container(width: 1, height: 24, color: AppColors.surfaceBorder),
                                      _buildStatItem('Rata-rata', '${_statsData!['avg_rx_power'] ?? '—'} dBm', AppColors.secondary),
                                      Container(width: 1, height: 24, color: AppColors.surfaceBorder),
                                      _buildStatItem('Max (Tertinggi)', '${_statsData!['max_rx_power'] ?? '—'} dBm', const Color(0xFF059669)),
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
                                        'DETAIL PER-PORT',
                                        style: TextStyle(
                                          color: AppColors.textPrimary,
                                          fontWeight: FontWeight.w800,
                                          fontSize: 12.5,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                      const SizedBox(width: 6),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: AppColors.primaryLight,
                                          borderRadius: BorderRadius.circular(10),
                                        ),
                                        child: Text(
                                          '$totalPortsCount Port',
                                          style: const TextStyle(
                                            color: AppColors.primaryDark,
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  if (_isProbingLive)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppColors.successLight,
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

              // Bottom Footer Bar
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: const BoxDecoration(
                  color: AppColors.surface,
                  border: Border(top: BorderSide(color: AppColors.surfaceBorder)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    OutlinedButton.icon(
                      icon: const Icon(Icons.photo_camera_rounded, size: 16, color: AppColors.primary),
                      label: const Text('Screenshot Lengkap', style: TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w700, fontSize: 12.5)),
                      style: OutlinedButton.styleFrom(
                        side: const BorderSide(color: AppColors.primaryLight),
                        backgroundColor: AppColors.primaryLight.withValues(alpha: 0.5),
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: (_isLoading || _isCapturingScreenshot) ? null : _captureFullDocumentScreenshot,
                    ),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.surfaceLight,
                        foregroundColor: AppColors.textPrimary,
                        elevation: 0,
                        side: const BorderSide(color: AppColors.surfaceBorder),
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      onPressed: () => Navigator.pop(context),
                      child: const Text('Tutup', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
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
        color: AppColors.background,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          // Enterprise Header
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.surfaceBorder),
            ),
            child: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.primaryLight,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: const Icon(Icons.grid_view_rounded, color: AppColors.primary, size: 26),
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
                              color: AppColors.primaryDark,
                              fontWeight: FontWeight.w900,
                              fontSize: 11,
                              letterSpacing: 1.2,
                            ),
                          ),
                          Text(
                            nowFormatted,
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 10.5, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Laporan Redaman — ${widget.nodeName}',
                        style: const TextStyle(
                          color: AppColors.textPrimary,
                          fontWeight: FontWeight.w900,
                          fontSize: 16,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Kapasitas: $effectiveRatio ($totalPortsCount Port) · IF: $effectiveInterface',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11.5, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // OLT Info Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: AppColors.surfaceBorder),
            ),
            child: Row(
              children: [
                const Icon(Icons.router_rounded, color: AppColors.secondary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('OLT INDUK', style: TextStyle(color: AppColors.textMuted, fontSize: 9.5, fontWeight: FontWeight.w700)),
                      Text(effectiveOltName, style: const TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800, fontSize: 13)),
                    ],
                  ),
                ),
                Container(width: 1, height: 28, color: AppColors.surfaceBorder, margin: const EdgeInsets.symmetric(horizontal: 10)),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('INTERFACE OLT', style: TextStyle(color: AppColors.textMuted, fontSize: 9.5, fontWeight: FontWeight.w700)),
                      Text(effectiveInterface, style: const TextStyle(color: AppColors.secondary, fontWeight: FontWeight.w800, fontSize: 12.5, fontFamily: 'monospace')),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 10),

          // Optical Statistics Bar
          if (_statsData != null && _statsData!['avg_rx_power'] != null) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildStatItem('Min (Terkecil)', '${_statsData!['min_rx_power'] ?? '—'} dBm', const Color(0xFFDC2626)),
                  Container(width: 1, height: 24, color: AppColors.surfaceBorder),
                  _buildStatItem('Rata-rata', '${_statsData!['avg_rx_power'] ?? '—'} dBm', AppColors.secondary),
                  Container(width: 1, height: 24, color: AppColors.surfaceBorder),
                  _buildStatItem('Max (Tertinggi)', '${_statsData!['max_rx_power'] ?? '—'} dBm', const Color(0xFF059669)),
                ],
              ),
            ),
            const SizedBox(height: 14),
          ],

          // Section Title
          Row(
            children: [
              const Text(
                'STATUS SELURUH PORT',
                style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.w800, fontSize: 12, letterSpacing: 0.5),
              ),
              const SizedBox(width: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: AppColors.primaryLight, borderRadius: BorderRadius.circular(6)),
                child: Text('$totalPortsCount Port Total', style: const TextStyle(color: AppColors.primaryDark, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
          const SizedBox(height: 10),

          // All Ports Grid (Fully rendered without scrollview)
          _buildPortsGrid(totalPortsCount, effectiveInterface),

          const SizedBox(height: 16),
          // Footer watermark
          Center(
            child: Text(
              'Dokumen telemetri resmi ini digenerate oleh FONA Mobile · Tanggal: $nowFormatted',
              style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w500),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPortsGrid(int totalPortsCount, String defaultInterface) {
    // Generate map of existing ports by port_number
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
        mainAxisExtent: 190,
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
    final custNumber = port['customer_number'] ?? port['service_number'] ?? 'CMN${portNum.toString().padLeft(4, '0')}';
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
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceBorder),
        boxShadow: AppColors.cardShadow,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          // Top Row: P1 • Terisi & Status
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      'P$portNum',
                      style: const TextStyle(color: AppColors.primaryDark, fontWeight: FontWeight.w800, fontSize: 11),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Container(
                    width: 4,
                    height: 4,
                    decoration: const BoxDecoration(color: AppColors.success, shape: BoxShape.circle),
                  ),
                  const SizedBox(width: 4),
                  const Text(
                    'Terisi',
                    style: TextStyle(color: AppColors.success, fontWeight: FontWeight.w700, fontSize: 10.5),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: isBlocked ? AppColors.dangerLight : AppColors.successLight,
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      isBlocked ? Icons.close_rounded : Icons.check_rounded,
                      size: 10,
                      color: isBlocked ? AppColors.danger : AppColors.success,
                    ),
                    const SizedBox(width: 2),
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
          const SizedBox(height: 5),

          // Customer ID & Name
          Text(
            custNumber,
            style: const TextStyle(color: AppColors.secondary, fontSize: 10, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 2),
          Text(
            custName,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontWeight: FontWeight.w800,
              fontSize: 12,
              height: 1.2,
            ),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
          ),
          const SizedBox(height: 4),

          // SN & IF
          Row(
            children: [
              const Text('SN: ', style: TextStyle(color: AppColors.textMuted, fontSize: 9.5, fontWeight: FontWeight.w600)),
              Expanded(
                child: Text(
                  sn,
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 9.5, fontWeight: FontWeight.w700),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          Row(
            children: [
              const Text('IF: ', style: TextStyle(color: AppColors.textMuted, fontSize: 9.5, fontWeight: FontWeight.w600)),
              Expanded(
                child: Text(
                  iface,
                  style: const TextStyle(
                    color: AppColors.secondary,
                    fontSize: 9.5,
                    fontWeight: FontWeight.w700,
                    fontFamily: 'monospace',
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ),
          const SizedBox(height: 5),

          // Redaman Rx Container
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3.5),
            decoration: BoxDecoration(
              color: rxBgColor,
              borderRadius: BorderRadius.circular(6),
              border: Border.all(color: rxBorderColor),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Redaman Rx:',
                  style: TextStyle(color: AppColors.textSecondary, fontSize: 9.5, fontWeight: FontWeight.w500),
                ),
                Text(
                  _formatRxPower(rxVal),
                  style: TextStyle(color: rxTextColor, fontWeight: FontWeight.w800, fontSize: 10),
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
        color: AppColors.surfaceLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.surfaceBorder),
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1.5),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: AppColors.surfaceBorder),
                ),
                child: Text(
                  'P$portNum',
                  style: const TextStyle(color: AppColors.textSecondary, fontWeight: FontWeight.w700, fontSize: 10.5),
                ),
              ),
              const Text(
                'SC_APC',
                style: TextStyle(color: AppColors.textMuted, fontWeight: FontWeight.w600, fontSize: 9.5),
              ),
            ],
          ),
          const Spacer(),
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.surface,
              shape: BoxShape.circle,
              border: Border.all(color: AppColors.surfaceBorder),
            ),
            child: const Icon(Icons.add_rounded, color: AppColors.textMuted, size: 16),
          ),
          const SizedBox(height: 6),
          const Text(
            'Port Tersedia',
            style: TextStyle(color: AppColors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600),
          ),
          const Spacer(),
        ],
      ),
    );
  }

  Widget _buildStatItem(String label, String value, Color valueColor) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: AppColors.textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(value, style: TextStyle(color: valueColor, fontSize: 12, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
