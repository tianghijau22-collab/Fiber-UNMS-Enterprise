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
  });

  factory CustomerModel.fromJson(Map<String, dynamic> json) {
    return CustomerModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      customerNumber: json['customer_number'] ?? '',
      name: json['name'] ?? '',
      phone: json['phone'],
      email: json['email'],
      address: json['address'],
      latitude: json['latitude'] != null ? double.tryParse(json['latitude'].toString()) : null,
      longitude: json['longitude'] != null ? double.tryParse(json['longitude'].toString()) : null,
      status: json['status'] is Map ? json['status']['value'] ?? 'active' : json['status']?.toString() ?? 'active',
      onuSn: json['onu_sn'] ?? json['sn'],
      onuMac: json['onu_mac'] ?? json['mac'],
      rxPowerDbm: json['rx_power_dbm'] != null ? double.tryParse(json['rx_power_dbm'].toString()) : null,
    );
  }

  bool get isActive => status.toLowerCase() == 'active';
  bool get isIsolated => status.toLowerCase() == 'isolated' || status.toLowerCase() == 'suspend';
}
