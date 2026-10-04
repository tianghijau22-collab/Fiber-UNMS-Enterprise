import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../../core/constants/api_constants.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import '../../models/customer_model.dart';

class OntPowerCheckScreen extends StatefulWidget {
  final String serialNumber;

  /// Data pelanggan opsional (dari Data Pelanggan) — dipakai untuk menentukan OLT/port
  /// dan sebagai fallback bila query live ke OLT gagal.
  final CustomerModel? customer;

  const OntPowerCheckScreen({super.key, required this.serialNumber, this.customer});

  @override
  State<OntPowerCheckScreen> createState() => _OntPowerCheckScreenState();
}

class _OntPowerCheckScreenState extends State<OntPowerCheckScreen> {
  // Palette selaras Login & Home
  static const Color _navyDeep = Color(0xFF001B3A);
  static const Color _navy = Color(0xFF003875);
  static const Color _brandBlue = Color(0xFF005BAA);
  static const Color _cyan = Color(0xFF008ED6);
  static const Color _bg = Color(0xFFF4F6F9);
  static const Color _textDark = Color(0xFF0F172A);
  static const Color _textBody = Color(0xFF475569);
  static const Color _textMuted = Color(0xFF94A3B8);
  static const Color _border = Color(0xFFE2E8F0);

  bool _isLoading = true;
  String? _errorMessage;
  Map<String, dynamic>? _data;

  @override
  void initState() {
    super.initState();
    _fetchOpticalPower();
  }

  // ───────────────────────────── DATA ─────────────────────────────
  Future<void> _fetchOpticalPower() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final cust = widget.customer;
    final params = <String, dynamic>{};
    if (cust?.oltId != null) params['device_id'] = cust!.oltId;
    if (cust?.gponInterface != null) params['port'] = cust!.gponInterface;

    try {
      final response = await DioClient().dio.get(
        ApiConstants.endpointOntOpticalPower(Uri.encodeComponent(widget.serialNumber.trim())),
        queryParameters: params.isEmpty ? null : params,
      );

      Map<String, dynamic>? parsed;
      final raw = response.data;
      if (raw is Map<String, dynamic>) {
        parsed = raw['data'] is Map<String, dynamic> && raw['rx_power_dbm'] == null && raw['rx_power'] == null
            ? raw['data'] as Map<String, dynamic>
            : raw;
      }

      if (!mounted) return;
      setState(() {
        _data = parsed;
        _isLoading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.response?.data is Map
            ? (e.response?.data['message']?.toString() ?? 'Modem tidak ditemukan di OLT atau sedang offline.')
            : 'Tidak dapat terhubung ke server telemetri OLT.';
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'Terjadi kesalahan: $e';
        _isLoading = false;
      });
    }
  }

  static String? _clean(dynamic v) {
    if (v == null) return null;
    final s = v.toString().trim();
    if (s.isEmpty || s == '—' || s == 'â€”' || s == '-' || s.toLowerCase() == 'null' || s.toLowerCase() == 'none') return null;
    return s;
  }

  static double? _num(dynamic v) => v == null ? null : double.tryParse(v.toString());

  Map<String, dynamic>? _sub(String key) => _data?[key] is Map<String, dynamic> ? _data![key] as Map<String, dynamic> : null;

  /// RX power: live API → (rx_power legacy key) → data pelanggan.
  double? get _rx {
    var v = _num(_data?['rx_power_dbm']) ?? _num(_data?['rx_power']);
    if (v != null && v <= -40.0) v = null; // placeholder LOS dari backend
    return v ?? widget.customer?.rxPower;
  }

  double? get _tx {
    final v = _num(_data?['tx_power_dbm']) ?? _num(_data?['tx_power']) ?? widget.customer?.txPowerDbm;
    return (v != null && v != 0) ? v : null;
  }

  bool get _usingFallback =>
      (_num(_data?['rx_power_dbm']) == null && _num(_data?['rx_power']) == null) && widget.customer?.rxPower != null;

  String get _source {
    if (_usingFallback) return 'Data Pelanggan (cache)';
    switch (_data?['_source']) {
      case 'live_snmp':
        return 'Live SNMP OLT';
      case 'snapshot':
        return 'Snapshot Telemetri OLT';
      case 'database':
        return 'Database UNMS';
      default:
        return _data == null ? 'Data Pelanggan (cache)' : 'Server';
    }
  }

  bool get _isOnline {
    if (_data?['is_online'] is bool) return _data!['is_online'] as bool;
    if (_rx != null) return true;
    return widget.customer?.isOnline ?? false;
  }

  String _qualityLabel(double? dbm) {
    if (dbm == null) return 'TIDAK ADA SINYAL';
    if (dbm >= -24.0 && dbm <= -14.0) return 'SINYAL BAIK';
    if (dbm > -14.0) return 'TERLALU KUAT';
    if (dbm > -27.0) return 'WASPADA';
    return 'KRITIS';
  }

  String _qualityHint(double? dbm) {
    if (dbm == null) return 'ONT tidak terbaca (LOS / mati). Periksa power modem, kabel drop, dan konektor.';
    if (dbm >= -24.0 && dbm <= -14.0) return 'Redaman dalam batas standar. Tidak perlu tindakan.';
    if (dbm > -14.0) return 'Daya terlalu tinggi, pertimbangkan pemasangan attenuator.';
    if (dbm > -27.0) return 'Mendekati batas. Cek konektor, bending kabel, dan kebersihan patchcord.';
    return 'Redaman melebihi batas. Periksa splice, konektor ODP, dan kabel drop.';
  }

  // ───────────────────────────── UI ─────────────────────────────
  @override
  Widget build(BuildContext context) {
    final hasAnyData = _data != null || widget.customer != null;

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: SystemUiOverlayStyle.light,
      child: Scaffold(
        backgroundColor: _bg,
        body: RefreshIndicator(
          onRefresh: _fetchOpticalPower,
          color: _brandBlue,
          edgeOffset: 120,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
            slivers: [
              SliverToBoxAdapter(child: _buildHeader()),
              if (_isLoading && _data == null)
                SliverToBoxAdapter(child: _buildLoading())
              else if (_errorMessage != null && !hasAnyData)
                SliverToBoxAdapter(child: _buildError())
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 40),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      if (_isLoading)
                        const Padding(
                          padding: EdgeInsets.only(bottom: 10),
                          child: LinearProgressIndicator(minHeight: 2, color: _brandBlue, backgroundColor: Colors.transparent),
                        ),
                      if (_errorMessage != null || _usingFallback) _buildFallbackBanner(),
                      _buildGaugeCard(),
                      const SizedBox(height: 14),
                      _buildMetricGrid(),
                      const SizedBox(height: 14),
                      _buildDetailCard(),
                      const SizedBox(height: 14),
                      _buildReferenceCard(),
                    ]),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final topPad = MediaQuery.of(context).padding.top;
    final cust = widget.customer;
    final custData = _sub('customer');
    final name = cust?.name ?? _clean(custData?['name']);
    final sn = _clean(_data?['serial_number']) ?? widget.serialNumber;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: EdgeInsets.fromLTRB(16, topPad + 8, 16, 22),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [_navyDeep, _navy, _brandBlue, _cyan],
          stops: [0.0, 0.35, 0.75, 1.0],
        ),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(28)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _glassButton(Icons.arrow_back_ios_new_rounded, () => Navigator.of(context).maybePop()),
              const SizedBox(width: 12),
              const Expanded(
                child: Text(
                  'Diagnostik Sinyal ONT',
                  style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800),
                ),
              ),
              _glassButton(Icons.refresh_rounded, _isLoading ? null : _fetchOpticalPower),
            ],
          ),
          const SizedBox(height: 18),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.10),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.white.withValues(alpha: 0.16)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.14),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.router_rounded, color: Colors.white, size: 22),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (name != null)
                        Text(
                          name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w800),
                        ),
                      const SizedBox(height: 2),
                      Row(
                        children: [
                          const Text('SN ', style: TextStyle(color: Color(0xFFB9D7F2), fontSize: 12)),
                          Flexible(
                            child: Text(
                              sn,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                          const SizedBox(width: 4),
                          GestureDetector(
                            onTap: () {
                              Clipboard.setData(ClipboardData(text: sn));
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Serial number disalin'),
                                  behavior: SnackBarBehavior.floating,
                                  backgroundColor: _navy,
                                  duration: Duration(seconds: 1),
                                ),
                              );
                            },
                            child: const Icon(Icons.copy_rounded, size: 13, color: Color(0xFFB9D7F2)),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                _statusPill(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _statusPill() {
    final online = _isOnline;
    final c = online ? const Color(0xFF34D399) : const Color(0xFFF87171);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: c.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: c.withValues(alpha: 0.5)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(width: 6, height: 6, decoration: BoxDecoration(color: c, shape: BoxShape.circle)),
          const SizedBox(width: 5),
          Text(
            online ? 'ONLINE' : 'OFFLINE',
            style: TextStyle(color: c, fontSize: 10.5, fontWeight: FontWeight.w800, letterSpacing: 0.4),
          ),
        ],
      ),
    );
  }

  Widget _glassButton(IconData icon, VoidCallback? onTap) {
    return Material(
      color: Colors.white.withValues(alpha: 0.14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.white.withValues(alpha: 0.18)),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: SizedBox(width: 40, height: 40, child: Icon(icon, color: Colors.white, size: 18)),
      ),
    );
  }

  Widget _buildLoading() {
    return const Padding(
      padding: EdgeInsets.only(top: 80),
      child: Column(
        children: [
          SizedBox(width: 36, height: 36, child: CircularProgressIndicator(color: _brandBlue, strokeWidth: 3)),
          SizedBox(height: 16),
          Text('Membaca telemetri optik dari OLT...', style: TextStyle(color: _textBody, fontSize: 13)),
        ],
      ),
    );
  }

  Widget _buildError() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(32, 48, 32, 0),
      child: Column(
        children: [
          Container(
            width: 84,
            height: 84,
            decoration: BoxDecoration(color: AppColors.danger.withValues(alpha: 0.08), shape: BoxShape.circle),
            child: const Icon(Icons.portable_wifi_off_rounded, size: 40, color: AppColors.danger),
          ),
          const SizedBox(height: 16),
          const Text('Gagal membaca ONT', style: TextStyle(color: _textDark, fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: _textBody, fontSize: 13, height: 1.4)),
          const SizedBox(height: 18),
          ElevatedButton.icon(
            onPressed: _fetchOpticalPower,
            style: ElevatedButton.styleFrom(
              backgroundColor: _brandBlue,
              foregroundColor: Colors.white,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            icon: const Icon(Icons.refresh_rounded, size: 18),
            label: const Text('Coba Lagi', style: TextStyle(fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  Widget _buildFallbackBanner() {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.warningLight,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.warning.withValues(alpha: 0.35)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded, color: AppColors.warning, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              _errorMessage != null
                  ? 'Query live ke OLT gagal. Menampilkan data terakhir yang tersimpan.'
                  : 'OLT tidak mengembalikan nilai live. Menampilkan data terakhir yang tersimpan.',
              style: const TextStyle(color: Color(0xFF92400E), fontSize: 12, height: 1.35, fontWeight: FontWeight.w600),
            ),
          ),
        ],
      ),
    );
  }

  Widget _card({required Widget child, EdgeInsets padding = const EdgeInsets.all(16)}) {
    return Container(
      padding: padding,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        boxShadow: [BoxShadow(color: _navyDeep.withValues(alpha: 0.05), blurRadius: 14, offset: const Offset(0, 4))],
      ),
      child: child,
    );
  }

  Widget _buildGaugeCard() {
    final rx = _rx;
    final color = AppColors.getOpticalColor(rx);

    return _card(
      padding: const EdgeInsets.fromLTRB(16, 18, 16, 18),
      child: Column(
        children: [
          Row(
            children: [
              const Icon(Icons.settings_input_antenna_rounded, size: 16, color: _brandBlue),
              const SizedBox(width: 6),
              const Text('Rx Optical Power', style: TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w800)),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(color: _bg, borderRadius: BorderRadius.circular(6)),
                child: Text(_source, style: const TextStyle(color: _textBody, fontSize: 10, fontWeight: FontWeight.w700)),
              ),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 150,
            child: Stack(
              alignment: Alignment.bottomCenter,
              children: [
                Positioned.fill(child: CustomPaint(painter: _GaugePainter(rx))),
                Padding(
                  padding: const EdgeInsets.only(bottom: 6),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        rx != null ? rx.toStringAsFixed(2) : '--',
                        style: TextStyle(color: color, fontSize: 38, fontWeight: FontWeight.w900, height: 1),
                      ),
                      const SizedBox(height: 2),
                      const Text('dBm', style: TextStyle(color: _textMuted, fontSize: 12, fontWeight: FontWeight.w700)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('-35', style: TextStyle(color: _textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
                Text('-8', style: TextStyle(color: _textMuted, fontSize: 10, fontWeight: FontWeight.w600)),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(color: color.withValues(alpha: 0.12), borderRadius: BorderRadius.circular(20)),
            child: Text(
              _qualityLabel(rx),
              style: TextStyle(color: color, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 0.6),
            ),
          ),
          const SizedBox(height: 10),
          Text(
            _qualityHint(rx),
            textAlign: TextAlign.center,
            style: const TextStyle(color: _textBody, fontSize: 12.5, height: 1.4),
          ),
        ],
      ),
    );
  }

  Widget _buildMetricGrid() {
    final tx = _tx;
    final oltRx = _num(_data?['olt_rx_power_dbm']);
    final distance = _num(_data?['distance_meters']) ?? widget.customer?.distanceMeters?.toDouble();
    final temp = _num(_data?['temperature_c']);
    final volt = _num(_data?['voltage_v']);
    final bias = _num(_data?['bias_current_ma']);

    String fmt(double? v, String unit, {int digits = 2}) => v == null ? '-' : '${v.toStringAsFixed(digits)} $unit';
    String fmtDist(double? m) {
      if (m == null || m <= 0) return '-';
      return m >= 1000 ? '${(m / 1000).toStringAsFixed(2)} km' : '${m.toStringAsFixed(0)} m';
    }

    final items = [
      _Metric(Icons.upload_rounded, 'Tx Power', fmt(tx, 'dBm'), const Color(0xFF0284C7)),
      _Metric(Icons.download_rounded, 'OLT Rx', fmt(oltRx, 'dBm'), AppColors.getOpticalColor(oltRx)),
      _Metric(Icons.straighten_rounded, 'Jarak Fiber', fmtDist(distance), const Color(0xFF7C3AED)),
      _Metric(Icons.thermostat_rounded, 'Suhu', fmt(temp, '°C', digits: 1), const Color(0xFFD97706)),
      _Metric(Icons.bolt_rounded, 'Tegangan', fmt(volt, 'V'), const Color(0xFF16A34A)),
      _Metric(Icons.electric_meter_rounded, 'Bias Current', fmt(bias, 'mA', digits: 1), const Color(0xFFDB2777)),
    ];

    return GridView.builder(
      shrinkWrap: true,
      padding: EdgeInsets.zero,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: items.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        mainAxisSpacing: 10,
        crossAxisSpacing: 10,
        childAspectRatio: 0.98,
      ),
      itemBuilder: (_, i) {
        final m = items[i];
        return _card(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(6),
                decoration: BoxDecoration(color: m.color.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(9)),
                child: Icon(m.icon, size: 15, color: m.color),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(m.value, style: const TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(height: 2),
                  Text(m.label, style: const TextStyle(color: _textMuted, fontSize: 10.5, fontWeight: FontWeight.w600)),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildDetailCard() {
    final cust = widget.customer;
    final olt = _sub('olt');
    final dist = _sub('distribution');

    final oltName = _clean(olt?['name']) ?? cust?.oltName ?? '-';
    final port = _clean(_data?['port']) ?? cust?.gponInterface ?? '-';
    final onuId = _clean(_data?['onu_id']);
    final model = _clean(_data?['vendor_model']) ?? cust?.onuType ?? '-';
    final mac = _clean(_data?['mac_address']) ?? cust?.onuMac;
    final odp = _clean(dist?['odp_name']) ?? cust?.odpName;
    final odpPort = _clean(dist?['odp_port']) ?? cust?.odpPort;
    final status = _clean(_data?['status']) ?? (_isOnline ? 'Online' : 'Offline');

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Informasi Perangkat', style: TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 6),
          _infoRow(Icons.dns_rounded, 'Perangkat OLT', oltName),
          _infoRow(Icons.lan_rounded, 'Port PON', onuId != null ? '$port : $onuId' : port),
          _infoRow(Icons.hub_rounded, 'ODP / Port', odp != null ? '$odp${odpPort != null ? ' • Port $odpPort' : ''}' : 'Belum terpetakan'),
          _infoRow(Icons.router_outlined, 'Model ONT', model),
          if (mac != null) _infoRow(Icons.memory_rounded, 'MAC Address', mac),
          _infoRow(
            Icons.wifi_tethering_rounded,
            'Status Koneksi',
            status,
            valueColor: _isOnline ? AppColors.success : AppColors.danger,
            isLast: true,
          ),
        ],
      ),
    );
  }

  Widget _infoRow(IconData icon, String label, String value, {Color? valueColor, bool isLast = false}) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10),
      decoration: BoxDecoration(
        border: isLast ? null : const Border(bottom: BorderSide(color: Color(0xFFF1F5F9))),
      ),
      child: Row(
        children: [
          Icon(icon, size: 16, color: _textMuted),
          const SizedBox(width: 10),
          Text(label, style: const TextStyle(color: _textBody, fontSize: 12.5)),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              value,
              textAlign: TextAlign.right,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(color: valueColor ?? _textDark, fontSize: 12.5, fontWeight: FontWeight.w800),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildReferenceCard() {
    Widget row(Color c, String range, String label) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Container(width: 10, height: 10, decoration: BoxDecoration(color: c, borderRadius: BorderRadius.circular(3))),
              const SizedBox(width: 10),
              Expanded(child: Text(range, style: const TextStyle(color: _textDark, fontSize: 12, fontWeight: FontWeight.w700))),
              Text(label, style: TextStyle(color: c, fontSize: 11.5, fontWeight: FontWeight.w800)),
            ],
          ),
        );

    return _card(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Standar Redaman GPON', style: TextStyle(color: _textDark, fontSize: 13.5, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          row(AppColors.success, '-14 s/d -24 dBm', 'Baik'),
          row(AppColors.warning, '-24 s/d -27 dBm', 'Waspada'),
          row(AppColors.danger, '< -27 dBm / > -14 dBm', 'Kritis'),
          const SizedBox(height: 4),
          const Divider(color: _border, height: 16),
          const Text(
            'Tarik layar ke bawah untuk memperbarui pembacaan.',
            style: TextStyle(color: _textMuted, fontSize: 11),
          ),
        ],
      ),
    );
  }
}

class _Metric {
  final IconData icon;
  final String label;
  final String value;
  final Color color;
  const _Metric(this.icon, this.label, this.value, this.color);
}

/// Gauge setengah lingkaran: -35 dBm (kiri) → -8 dBm (kanan).
class _GaugePainter extends CustomPainter {
  final double? rx;
  _GaugePainter(this.rx);

  static const double _min = -35;
  static const double _max = -8;

  double _t(double v) => ((v - _min) / (_max - _min)).clamp(0.0, 1.0);

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 14.0;
    final radius = math.min(size.width / 2, size.height) - stroke;
    final center = Offset(size.width / 2, size.height - 4);
    final rect = Rect.fromCircle(center: center, radius: radius);

    // Track
    final track = Paint()
      ..color = const Color(0xFFEFF3F8)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi, false, track);

    // Zona warna: kritis (-35..-27), waspada (-27..-24), baik (-24..-14), terlalu kuat (-14..-8)
    void zone(double from, double to, Color c) {
      final p = Paint()
        ..color = c.withValues(alpha: 0.28)
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke;
      final s = math.pi + math.pi * _t(from);
      final sweep = math.pi * (_t(to) - _t(from));
      canvas.drawArc(rect, s, sweep, false, p);
    }

    zone(-35, -27, AppColors.danger);
    zone(-27, -24, AppColors.warning);
    zone(-24, -14, AppColors.success);
    zone(-14, -8, AppColors.danger);

    if (rx == null) return;

    final color = AppColors.getOpticalColor(rx);
    final t = _t(rx!);

    // Progress
    final prog = Paint()
      ..shader = SweepGradient(
        startAngle: math.pi,
        endAngle: 2 * math.pi,
        colors: [color.withValues(alpha: 0.55), color],
      ).createShader(rect)
      ..style = PaintingStyle.stroke
      ..strokeWidth = stroke
      ..strokeCap = StrokeCap.round;
    canvas.drawArc(rect, math.pi, math.pi * t, false, prog);

    // Penanda
    final angle = math.pi + math.pi * t;
    final knob = Offset(center.dx + radius * math.cos(angle), center.dy + radius * math.sin(angle));
    canvas.drawCircle(knob, stroke / 2 + 4, Paint()..color = Colors.white);
    canvas.drawCircle(knob, stroke / 2 + 1, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _GaugePainter old) => old.rx != rx;
}
