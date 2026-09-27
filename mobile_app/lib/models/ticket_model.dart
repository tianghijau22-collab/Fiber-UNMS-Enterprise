class TicketModel {
  final int id;
  final String ticketNumber;
  final String title;
  final String? description;
  final String category;
  final String priority;
  final String status;
  final int? customerId;
  final String? customerName;
  final String? customerPhone;
  final String? customerAddress;
  final String? technicianName;
  final String? dispatchTeam;
  final double? initialPowerDbm;
  final double? finalPowerDbm;
  final List<dynamic>? timelineLogs;
  final String? slaDeadline;
  final bool isSlaBreached;
  final String? resolutionNotes;
  final String? createdAt;
  final String? resolvedAt;

  TicketModel({
    required this.id,
    required this.ticketNumber,
    required this.title,
    this.description,
    required this.category,
    required this.priority,
    required this.status,
    this.customerId,
    this.customerName,
    this.customerPhone,
    this.customerAddress,
    this.technicianName,
    this.dispatchTeam,
    this.initialPowerDbm,
    this.finalPowerDbm,
    this.timelineLogs,
    this.slaDeadline,
    this.isSlaBreached = false,
    this.resolutionNotes,
    this.createdAt,
    this.resolvedAt,
  });

  factory TicketModel.fromJson(Map<String, dynamic> json) {
    // Extract customer details if relationship is included
    final customer = json['customer'] as Map<String, dynamic>?;

    return TicketModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id'].toString()) ?? 0,
      ticketNumber: json['ticket_number'] ?? '',
      title: json['title'] ?? '',
      description: json['description'],
      category: json['category'] ?? 'Gangguan',
      priority: json['priority'] ?? 'Medium',
      status: json['status'] ?? 'Open',
      customerId: json['customer_id'] != null ? int.tryParse(json['customer_id'].toString()) : null,
      customerName: customer?['name'] ?? json['customer_name'],
      customerPhone: customer?['phone'] ?? json['customer_phone'],
      customerAddress: customer?['address'] ?? json['customer_address'],
      technicianName: json['technician_name'],
      dispatchTeam: json['dispatch_team'],
      initialPowerDbm: json['initial_power_dbm'] != null ? double.tryParse(json['initial_power_dbm'].toString()) : null,
      finalPowerDbm: json['final_power_dbm'] != null ? double.tryParse(json['final_power_dbm'].toString()) : null,
      timelineLogs: json['timeline_logs'] is List ? json['timeline_logs'] : null,
      slaDeadline: json['sla_deadline'],
      isSlaBreached: json['is_sla_breached'] == true || json['is_sla_breached'] == 1,
      resolutionNotes: json['resolution_notes'],
      createdAt: json['created_at'],
      resolvedAt: json['resolved_at'],
    );
  }

  bool get isOpen => status.toLowerCase() == 'open';
  bool get isInProgress => status.toLowerCase() == 'in_progress' || status.toLowerCase() == 'in progress';
  bool get isResolved => status.toLowerCase() == 'resolved' || status.toLowerCase() == 'closed';
}
