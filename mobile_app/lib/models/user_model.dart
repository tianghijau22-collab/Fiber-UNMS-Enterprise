class UserModel {
  final int id;
  final String name;
  final String? username;
  final String email;
  final String role;
  final String division;
  final String? phone;
  final String status;
  final String? lastLoginAt;

  UserModel({
    required this.id,
    required this.name,
    this.username,
    required this.email,
    required this.role,
    required this.division,
    this.phone,
    required this.status,
    this.lastLoginAt,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      name: json['name'] ?? '',
      username: json['username'],
      email: json['email'] ?? '',
      role: json['role'] ?? 'Teknisi Lapangan',
      division: json['division'] ?? 'Field Operations',
      phone: json['phone'],
      status: json['status'] ?? 'Active',
      lastLoginAt: json['last_login_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'username': username,
      'email': email,
      'role': role,
      'division': division,
      'phone': phone,
      'status': status,
      'last_login_at': lastLoginAt,
    };
  }

  bool get isSuperAdmin => role.toLowerCase().contains('super');
  bool get isNoc => role.toLowerCase().contains('noc') || division.toLowerCase().contains('noc');
  bool get isTechnician => role.toLowerCase().contains('teknisi') || role.toLowerCase().contains('field');
}
