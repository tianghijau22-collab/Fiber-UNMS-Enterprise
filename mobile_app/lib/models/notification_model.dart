import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import '../core/constants/api_constants.dart';
import '../core/constants/app_colors.dart';

class NotificationModel {
  final int id;
  final int? userId;
  final String type;
  final String title;
  final String body;
  final String? url;
  final String? icon;
  final String? imageUrl;
  final bool isRead;
  final DateTime? readAt;
  final DateTime createdAt;

  NotificationModel({
    required this.id,
    this.userId,
    required this.type,
    required this.title,
    required this.body,
    this.url,
    this.icon,
    this.imageUrl,
    required this.isRead,
    this.readAt,
    required this.createdAt,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    DateTime parseDate(dynamic date) {
      if (date == null) return DateTime.now();
      try {
        return DateTime.parse(date.toString()).toLocal();
      } catch (_) {
        return DateTime.now();
      }
    }

    return NotificationModel(
      id: json['id'] is int ? json['id'] : int.tryParse(json['id']?.toString() ?? '0') ?? 0,
      userId: json['user_id'] is int ? json['user_id'] : int.tryParse(json['user_id']?.toString() ?? ''),
      type: (json['type'] ?? 'NOC').toString().toUpperCase(),
      title: json['title'] ?? 'Pemberitahuan Sistem',
      body: json['body'] ?? '',
      url: json['url']?.toString(),
      icon: json['icon']?.toString(),
      imageUrl: json['image_url']?.toString(),
      isRead: json['is_read'] == true || json['is_read'] == 1,
      readAt: json['read_at'] != null ? parseDate(json['read_at']) : null,
      createdAt: parseDate(json['created_at']),
    );
  }

  String? get fullImageUrl {
    if (imageUrl == null || imageUrl!.trim().isEmpty) return null;
    final clean = imageUrl!.trim();
    if (clean.startsWith('http://') || clean.startsWith('https://')) {
      return clean;
    }
    // ApiConstants.defaultBaseUrl is typically 'https://.../api'
    final host = ApiConstants.defaultBaseUrl.replaceAll('/api', '');
    return '$host${clean.startsWith('/') ? '' : '/'}$clean';
  }

  String get cleanTitle {
    var t = title
        .replaceAll(RegExp(r'</?(b|strong|i|em|code|pre|small)[^>]*>', caseSensitive: false), '')
        .replaceAll('&bull;', '•')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .trim();
    return t.isEmpty ? title : t;
  }

  String get cleanBody {
    if (body.isEmpty) return '';
    var text = body
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), '\n')
        .replaceAll(RegExp(r'</?(b|strong|i|em|code|pre|small|p|div|span)[^>]*>', caseSensitive: false), '')
        .replaceAll('&bull;', '•')
        .replaceAll('&nbsp;', ' ')
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&#39;', "'")
        .replaceAll('────────────────────────────', '')
        .trim();

    return text.replaceAll(RegExp(r'\n{3,}'), '\n\n');
  }

  String get formattedTime {
    return DateFormat('dd MMM yyyy, HH:mm').format(createdAt);
  }

  String get timeAgo {
    final diff = DateTime.now().difference(createdAt);
    if (diff.inMinutes < 1) return 'Baru saja';
    if (diff.inMinutes < 60) return '${diff.inMinutes} mnt lalu';
    if (diff.inHours < 24) return '${diff.inHours} jam lalu';
    if (diff.inDays < 7) return '${diff.inDays} hari lalu';
    return DateFormat('dd/MM/yyyy').format(createdAt);
  }

  Color get typeColor {
    switch (type) {
      case 'NOC':
      case 'ALARM':
      case 'OUTAGE':
        return AppColors.danger;
      case 'MAINTENANCE':
      case 'WARNING':
        return AppColors.warning;
      case 'BROADCAST':
      case 'INFO':
        return AppColors.primary;
      case 'TICKET':
      case 'PROVISIONING':
        return AppColors.success;
      case 'SECURITY':
        return const Color(0xFF8B5CF6); // Purple
      default:
        return AppColors.secondary;
    }
  }

  Color get typeLightColor {
    switch (type) {
      case 'NOC':
      case 'ALARM':
      case 'OUTAGE':
        return AppColors.dangerLight;
      case 'MAINTENANCE':
      case 'WARNING':
        return AppColors.warningLight;
      case 'BROADCAST':
      case 'INFO':
        return AppColors.primaryLight;
      case 'TICKET':
      case 'PROVISIONING':
        return AppColors.successLight;
      case 'SECURITY':
        return const Color(0xFFEDE9FE);
      default:
        return AppColors.surfaceLight;
    }
  }

  IconData get typeIcon {
    switch (type) {
      case 'NOC':
      case 'ALARM':
      case 'OUTAGE':
        return Icons.crisis_alert_rounded;
      case 'MAINTENANCE':
        return Icons.construction_rounded;
      case 'BROADCAST':
      case 'INFO':
        return Icons.campaign_rounded;
      case 'TICKET':
        return Icons.confirmation_number_rounded;
      case 'PROVISIONING':
        return Icons.router_rounded;
      case 'SECURITY':
        return Icons.shield_rounded;
      default:
        return Icons.notifications_active_rounded;
    }
  }
}
