import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';
import '../../core/constants/app_colors.dart';

class InAppStreetViewScreen extends StatefulWidget {
  final double latitude;
  final double longitude;
  final String? nodeName;
  final String? nodeType;
  final String? address;

  const InAppStreetViewScreen({
    super.key,
    required this.latitude,
    required this.longitude,
    this.nodeName,
    this.nodeType,
    this.address,
  });

  static Future<void> show(
    BuildContext context, {
    required double latitude,
    required double longitude,
    String? nodeName,
    String? nodeType,
    String? address,
  }) {
    return Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => InAppStreetViewScreen(
          latitude: latitude,
          longitude: longitude,
          nodeName: nodeName,
          nodeType: nodeType,
          address: address,
        ),
      ),
    );
  }

  @override
  State<InAppStreetViewScreen> createState() => _InAppStreetViewScreenState();
}

class _InAppStreetViewScreenState extends State<InAppStreetViewScreen> {
  static const Color _navyDeep = Color(0xFF001B3A);
  static const Color _brandBlue = Color(0xFF005BAA);
  static const Color _cyan = Color(0xFF008ED6);
  static const Color _border = Color(0xFFE2E8F0);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textMuted = Color(0xFF94A3B8);

  late final WebViewController _webViewController;
  bool _isLoading = true;
  int _loadingProgress = 0;
  bool _hasError = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _initWebView();
  }

  void _initWebView() {
    final streetViewUrl = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${widget.latitude},${widget.longitude}';

    _webViewController = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0F172A))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (int progress) {
            if (mounted) {
              setState(() {
                _loadingProgress = progress;
                if (progress >= 90) {
                  _isLoading = false;
                }
              });
            }
          },
          onPageStarted: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _hasError = false;
              });
            }
          },
          onPageFinished: (String url) {
            if (mounted) {
              setState(() {
                _isLoading = false;
              });
            }
          },
          onWebResourceError: (WebResourceError error) {
            if (mounted && error.isForMainFrame == true) {
              setState(() {
                _isLoading = false;
                _hasError = true;
                _errorMessage = error.description;
              });
            }
          },
        ),
      )
      ..setUserAgent('Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36')
      ..loadRequest(Uri.parse(streetViewUrl));
  }

  void _openInExternalMaps() async {
    final url = 'https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${widget.latitude},${widget.longitude}';
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  void _copyCoordinates() {
    final text = '${widget.latitude}, ${widget.longitude}';
    Clipboard.setData(ClipboardData(text: text));
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Koordinat GPS berhasil disalin'),
        behavior: SnackBarBehavior.floating,
        duration: Duration(seconds: 2),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final displayName = widget.nodeName ?? 'Titik Koordinat Lokasi';
    final displayType = widget.nodeType ?? 'GIS';

    return Scaffold(
      backgroundColor: _navyDeep,
      appBar: AppBar(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        titleSpacing: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded, color: _textDark),
          onPressed: () => Navigator.pop(context),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: _brandBlue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    displayType,
                    style: const TextStyle(
                      color: _brandBlue,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    displayName,
                    style: const TextStyle(
                      color: _textDark,
                      fontSize: 15,
                      fontWeight: FontWeight.w800,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 1),
            Text(
              '${widget.latitude}, ${widget.longitude}',
              style: const TextStyle(color: _textMuted, fontSize: 11, fontWeight: FontWeight.w500),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded, color: _brandBlue, size: 22),
            tooltip: 'Muat Ulang Street View',
            onPressed: () {
              setState(() {
                _isLoading = true;
                _hasError = false;
              });
              _webViewController.reload();
            },
          ),
          IconButton(
            icon: const Icon(Icons.open_in_new_rounded, color: _textDark, size: 20),
            tooltip: 'Buka di Aplikasi Maps Eksternal',
            onPressed: _openInExternalMaps,
          ),
          const SizedBox(width: 4),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(1),
          child: Container(color: _border, height: 1),
        ),
      ),
      body: Stack(
        children: [
          // ── 1. EMBEDDED STREET VIEW WEBVIEW ──
          if (!_hasError)
            WebViewWidget(controller: _webViewController)
          else
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.streetview_rounded, color: AppColors.danger, size: 56),
                    const SizedBox(height: 16),
                    const Text(
                      'Gagal Memuat Street View',
                      style: TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _errorMessage ?? 'Pastikan koneksi internet aktif dan koordinat memiliki cakupan Google Street View.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                    ),
                    const SizedBox(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: const BorderSide(color: Colors.white38),
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: () {
                            setState(() {
                              _isLoading = true;
                              _hasError = false;
                            });
                            _webViewController.reload();
                          },
                          icon: const Icon(Icons.refresh_rounded, size: 18),
                          label: const Text('Coba Lagi'),
                        ),
                        const SizedBox(width: 10),
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: _brandBlue,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          onPressed: _openInExternalMaps,
                          icon: const Icon(Icons.open_in_new_rounded, size: 18),
                          label: const Text('Buka di Maps'),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),

          // ── 2. LOADING PROGRESS OVERLAY ──
          if (_isLoading)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: LinearProgressIndicator(
                value: _loadingProgress > 0 ? _loadingProgress / 100.0 : null,
                backgroundColor: Colors.transparent,
                valueColor: const AlwaysStoppedAnimation<Color>(_cyan),
                minHeight: 3,
              ),
            ),

          // ── 3. BOTTOM FLOATING INFO OVERLAY ──
          Positioned(
            left: 14,
            right: 14,
            bottom: 24,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.95),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: _border),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.2),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withValues(alpha: 0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.streetview_rounded, color: Color(0xFF16A34A), size: 20),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const Text(
                          'Street View 360° Internal',
                          style: TextStyle(color: _textDark, fontWeight: FontWeight.w800, fontSize: 12.5),
                        ),
                        if (widget.address != null && widget.address!.isNotEmpty && widget.address != '-')
                          Text(
                            widget.address!,
                            style: const TextStyle(color: Color(0xFF64748B), fontSize: 11),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          )
                        else
                          const Text(
                            'Geser dan putar layar untuk melihat panorama 360°',
                            style: TextStyle(color: Color(0xFF64748B), fontSize: 11),
                          ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.copy_rounded, color: _brandBlue, size: 18),
                    tooltip: 'Salin Koordinat',
                    onPressed: _copyCoordinates,
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
