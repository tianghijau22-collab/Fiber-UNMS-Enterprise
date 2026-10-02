import 'package:flutter/material.dart';

class AppColors {
  // Brand Colors - FONA Enterprise (Vibrant Cyan #00AAE0)
  static const Color primary = Color(0xFF00AAE0); // User Requested Primary Cyan
  static const Color primaryDark = Color(0xFF008BB8); // Deep Cyan
  static const Color primaryLight = Color(0xFFE0F7FE); // Soft Cyan Ice
  
  static const Color secondary = Color(0xFF0284C7); // Ocean Sky Blue
  static const Color secondaryLight = Color(0xFFE0F2FE); // Soft Sky Ice
  static const Color accent = Color(0xFF6366F1); // Modern Indigo
  static const Color accentLight = Color(0xFFEEF2FF); // Soft Indigo Ice

  // Modern Clean Professional Theme Backgrounds (PLN Mobile Style)
  static const Color background = Color(0xFFF8FAFC); // Clean Canvas Slate 50
  static const Color surface = Color(0xFFFFFFFF); // Pure White Card
  static const Color surfaceLight = Color(0xFFF1F5F9); // Light Gray Slate 100
  static const Color surfaceBorder = Color(0xFFE2E8F0); // Subtle Border Slate 200

  // Status Colors
  static const Color success = Color(0xFF10B981); // Emerald Green 500
  static const Color successLight = Color(0xFFECFDF5); // Soft Green
  static const Color warning = Color(0xFFF59E0B); // Amber 500
  static const Color warningLight = Color(0xFFFFFBEB); // Soft Amber
  static const Color danger = Color(0xFFEF4444); // Red 500
  static const Color dangerLight = Color(0xFFFEF2F2); // Soft Red
  static const Color info = Color(0xFF0284C7); // Sky 600
  static const Color infoLight = Color(0xFFF0F9FF); // Soft Blue

  // Text Colors
  static const Color textPrimary = Color(0xFF0F172A); // Slate 900 (High Contrast)
  static const Color textSecondary = Color(0xFF475569); // Slate 600
  static const Color textMuted = Color(0xFF94A3B8); // Slate 400

  // Optical Power Level Colors (Redaman dBm)
  static Color getOpticalColor(double? dbm) {
    if (dbm == null) return textMuted;
    if (dbm >= -24.0 && dbm <= -14.0) return success; // Good
    if (dbm > -27.0 && dbm < -24.0) return warning; // Warning
    return danger; // Critical (< -27 dBm or > -14 dBm)
  }

  // Modern Soft Box Shadow
  static List<BoxShadow> get cardShadow => [
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.04),
      blurRadius: 12,
      offset: const Offset(0, 4),
    ),
    BoxShadow(
      color: const Color(0xFF0F172A).withValues(alpha: 0.02),
      blurRadius: 4,
      offset: const Offset(0, 1),
    ),
  ];

  static List<BoxShadow> get elevatedShadow => [
    BoxShadow(
      color: primary.withValues(alpha: 0.25),
      blurRadius: 16,
      offset: const Offset(0, 6),
    ),
  ];
}
