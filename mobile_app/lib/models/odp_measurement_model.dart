class OdpMeasurementModel {
  final int id;
  final int? odpNodeId;
  final String odpCode;
  final String? odpName;
  final String technicianName;
  final double powerMeasurementDbm;
  final String powerStatus; // 'good', 'warning', 'critical'
  final String portNumber;
  final String odpCondition;
  final double? latitude;
  final double? longitude;
  final String? addressLocation;
  final String? odpPhotoUrl;
  final String? opmPhotoUrl;
  final String? notes;
  final String? createdAt;

  OdpMeasurementModel({
    required this.id,
    this.odpNodeId,
    required this.odpCode,
    this.odpName,
    required this.technicianName,
    required this.powerMeasurementDbm,
    required this.powerStatus,
    required this.portNumber,
    required this.odpCondition,
    this.latitude,
    this.longitude,
    this.addressLocation,
    this.odpPhotoUrl,
    this.opmPhotoUrl,
    this.notes,
    this.createdAt,
  });

  factory OdpMeasurementModel.fromJson(Map<String, dynamic> json) {
    return OdpMeasurementModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      odpNodeId: json['odp_node_id'] != null ? int.tryParse(json['odp_node_id'].toString()) : null,
      odpCode: json['odp_code'] ?? '',
      odpName: json['odp_name'],
      technicianName: json['technician_name'] ?? 'Teknisi',
      powerMeasurementDbm: double.tryParse(json['power_measurement_dbm'].toString()) ?? 0.0,
      powerStatus: json['power_status'] ?? 'good',
      portNumber: json['port_number']?.toString() ?? '1',
      odpCondition: json['odp_condition'] ?? 'Bagus',
      latitude: json['latitude'] != null ? double.tryParse(json['latitude'].toString()) : null,
      longitude: json['longitude'] != null ? double.tryParse(json['longitude'].toString()) : null,
      addressLocation: json['address_location'],
      odpPhotoUrl: json['odp_photo_url'],
      opmPhotoUrl: json['opm_photo_url'],
      notes: json['notes'],
      createdAt: json['created_at'],
    );
  }

  bool get isGood => powerStatus.toLowerCase() == 'good';
  bool get isWarning => powerStatus.toLowerCase() == 'warning';
  bool get isCritical => powerStatus.toLowerCase() == 'critical';
}
