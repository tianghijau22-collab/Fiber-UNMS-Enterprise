class CustomerModel {
  final int id;
  final String customerNumber;
  final String name;
  final String? phone;
  final String? email;
  final String? address;
  final double? latitude;
  final double? longitude;
  final String status;
  final bool? isOnlineFlag;
  final String? onuSn;
  final String? onuMac;
  final String? onuType;
  final double? rxPowerDbm;
  final double? txPowerDbm;
  final int? distanceMeters;
  final String? odpName;
  final String? odpPort;
  final int? oltId;
  final String? oltName;
  final String? gponInterface;
  final String? packageName;

  CustomerModel({
    required this.id,
    required this.customerNumber,
    required this.name,
    this.phone,
    this.email,
    this.address,
    this.latitude,
    this.longitude,
    required this.status,
    this.isOnlineFlag,
    this.onuSn,
    this.onuMac,
    this.onuType,
    this.rxPowerDbm,
    this.txPowerDbm,
    this.distanceMeters,
    this.odpName,
    this.odpPort,
    this.oltId,
    this.oltName,
    this.gponInterface,
    this.packageName,
  });

  /// Membersihkan placeholder kosong dari backend ('—', 'â€”', '-', 'none').
  static String? _clean(dynamic v) {
    if (v == null) return null;
    final s = v.toString().trim();
    if (s.isEmpty || s == '—' || s == 'â€”' || s == '-' || s.toLowerCase() == 'none' || s.toLowerCase() == 'null') {
      return null;
    }
    return s;
  }

  static double? _toDouble(dynamic v) => v == null ? null : double.tryParse(v.toString());

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    final isOnlineFlag = json['is_online'] is bool ? json['is_online'] as bool : null;
    double? rx = _toDouble(json['rx_power_dbm']) ?? _toDouble(json['rx_power']);
    // Backend memberi -40.00 sebagai placeholder untuk modem offline / LOS.
    if (rx != null && rx <= -40.0) rx = null;

    return CustomerModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      customerNumber: json['customer_number'] ?? json['customer_id'] ?? '',
      name: json['name'] ?? '',
      phone: _clean(json['phone']),
      email: _clean(json['email']),
      address: _clean(json['address']),
      latitude: _toDouble(json['latitude']),
      longitude: _toDouble(json['longitude']),
      status: json['status'] is Map ? json['status']['value'] ?? 'active' : json['status']?.toString() ?? 'active',
      isOnlineFlag: isOnlineFlag,
      onuSn: _clean(json['onu_serial'] ?? json['onu_sn'] ?? json['sn'] ?? json['serial_number']),
      onuMac: _clean(json['onu_mac'] ?? json['mac'] ?? json['mac_address']),
      onuType: _clean(json['onu_type']),
      rxPowerDbm: rx,
      txPowerDbm: _toDouble(json['tx_power_dbm']) ?? _toDouble(json['tx_power']),
      distanceMeters: json['distance_meters'] != null ? int.tryParse(json['distance_meters'].toString()) : null,
      odpName: _clean(json['odp_name'] ?? json['node_name']),
      odpPort: _clean(json['odp_port'] ?? json['odp_port_number'] ?? json['port_number']),
      oltId: json['olt_id'] != null ? int.tryParse(json['olt_id'].toString()) : null,
      oltName: _clean(json['olt_name']),
      gponInterface: _clean(json['gpon_interface']),
      packageName: _clean(json['package_name']),
    );
  }

  bool get isOnline {
    if (isOnlineFlag != null) return isOnlineFlag!;
    final s = status.toLowerCase();
    return s == 'active' || s == 'online';
  }

  bool get isActive => isOnline;
  bool get isIsolated => status.toLowerCase() == 'isolated' || status.toLowerCase() == 'suspend';
  double? get rxPower => rxPowerDbm;
  String? get onuSerial => onuSn;
}
