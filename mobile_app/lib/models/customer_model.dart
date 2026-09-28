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
  final String? onuSn;
  final String? onuMac;
  final double? rxPowerDbm;
  final String? odpName;
  final String? odpPort;

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
    this.onuSn,
    this.onuMac,
    this.rxPowerDbm,
    this.odpName,
    this.odpPort,
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      customerNumber: json['customer_number'] ?? json['customer_id'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
      latitude: json['latitude'] != null ? double.tryParse(json['latitude'].toString()) : null,
      longitude: json['longitude'] != null ? double.tryParse(json['longitude'].toString()) : null,
      status: json['status'] is Map ? json['status']['value'] ?? 'active' : json['status']?.toString() ?? 'active',
      onuSn: json['onu_sn'] ?? json['sn'] ?? json['serial_number'],
      onuMac: json['onu_mac'] ?? json['mac'] ?? json['mac_address'],
      rxPowerDbm: json['rx_power_dbm'] != null
          ? double.tryParse(json['rx_power_dbm'].toString())
          : (json['rx_power'] != null ? double.tryParse(json['rx_power'].toString()) : null),
      odpName: json['odp_name'] ?? json['node_name'],
      odpPort: json['odp_port']?.toString() ?? json['port_number']?.toString(),
    );
  }

  bool get isOnline => status.toLowerCase() == 'active' || status.toLowerCase() == 'online';
  bool get isActive => isOnline;
  bool get isIsolated => status.toLowerCase() == 'isolated' || status.toLowerCase() == 'suspend';
  double? get rxPower => rxPowerDbm;
  String? get onuSerial => onuSn;
}
