import 'package:flutter/material.dart';
import '../core/services/notification_service.dart';
import 'dashboard/home_dashboard_screen.dart';
import 'gis/gis_map_screen.dart';
import 'profile/profile_screen.dart';

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      NotificationService().consumePendingNotification(context);
    });
  }

  final List<Widget> _screens = const [
    HomeDashboardScreen(), // Index 0: Home
    GisMapScreen(),        // Index 1: Maps
    ProfileScreen(),       // Index 2: Profil
  ];

  @override
  Widget build(BuildContext context) {
    final isHomeActive = _currentIndex == 0;

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: SizedBox(
          height: 76,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. Curved Background with wide flared scoop notch & rounded top shoulders
              Positioned.fill(
                child: CustomPaint(
                  painter: _CurvedNavBarPainter(),
                ),
              ),

              // 2. Navigation Items (Maps on Left, Center Home Tap Area, Profil on Right)
              Positioned.fill(
                child: Row(
                  children: [
                    // Left Item: Maps
                    Expanded(
                      child: _buildSideNavItem(
                        index: 1,
                        icon: Icons.map_outlined,
                        activeIcon: Icons.map_rounded,
                        label: 'Maps',
                      ),
                    ),

                    // Center Item Tap Area: Home
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _currentIndex = 0),
                        child: Container(
                          alignment: Alignment.bottomCenter,
                          padding: const EdgeInsets.only(bottom: 11),
                          child: Text(
                            'Home',
                            style: TextStyle(
                              color: isHomeActive ? const Color(0xFF005BAA) : const Color(0xFF64748B),
                              fontSize: 11,
                              fontWeight: isHomeActive ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Right Item: Profil
                    Expanded(
                      child: _buildSideNavItem(
                        index: 2,
                        icon: Icons.person_outline_rounded,
                        activeIcon: Icons.person_rounded,
                        label: 'Profil',
                      ),
                    ),
                  ],
                ),
              ),

              // 3. Floating Hero Center Button: Home
              Align(
                alignment: Alignment.topCenter,
                child: Transform.translate(
                  offset: const Offset(0, -22),
                  child: GestureDetector(
                    onTap: () => setState(() => _currentIndex = 0),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        gradient: isHomeActive
                            ? const LinearGradient(
                                colors: [Color(0xFF0284C7), Color(0xFF005BAA)],
                                begin: Alignment.topLeft,
                                end: Alignment.bottomRight,
                              )
                            : null,
                        color: isHomeActive ? null : Colors.white,
                        border: Border.all(
                          color: isHomeActive ? const Color(0xFF005BAA) : const Color(0xFFCBD5E1),
                          width: isHomeActive ? 2.0 : 1.5,
                        ),
                        boxShadow: [
                          if (isHomeActive) ...[
                            BoxShadow(
                              color: const Color(0xFF005BAA).withValues(alpha: 0.38),
                              blurRadius: 14,
                              offset: const Offset(0, 5),
                            ),
                            BoxShadow(
                              color: const Color(0xFF0284C7).withValues(alpha: 0.20),
                              blurRadius: 6,
                              offset: const Offset(0, 2),
                            ),
                          ] else
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.08),
                              blurRadius: 8,
                              offset: const Offset(0, 3),
                            ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          isHomeActive ? Icons.home_rounded : Icons.home_outlined,
                          color: isHomeActive ? Colors.white : const Color(0xFF64748B),
                          size: 26,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSideNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
  }) {
    final isSelected = _currentIndex == index;
    final color = isSelected ? const Color(0xFF005BAA) : const Color(0xFF64748B);

    return InkWell(
      onTap: () => setState(() => _currentIndex = index),
      splashColor: Colors.transparent,
      highlightColor: Colors.transparent,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFFE0F2FE) : Colors.transparent,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              isSelected ? activeIcon : icon,
              color: color,
              size: 24,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            label,
            style: TextStyle(
              color: color,
              fontSize: 11,
              fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}

class _CurvedNavBarPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;
    final centerX = w / 2;

    const cornerRadius = 20.0;
    const scoopWidth = 58.0;
    const scoopDrop = 34.0;

    final path = Path()
      ..moveTo(0, cornerRadius)
      ..quadraticBezierTo(0, 0, cornerRadius, 0)
      ..lineTo(centerX - scoopWidth, 0)
      ..cubicTo(
        centerX - 38, 0,
        centerX - 34, scoopDrop,
        centerX, scoopDrop,
      )
      ..cubicTo(
        centerX + 34, scoopDrop,
        centerX + 38, 0,
        centerX + scoopWidth, 0,
      )
      ..lineTo(w - cornerRadius, 0)
      ..quadraticBezierTo(w, 0, w, cornerRadius)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    // Soft drop shadow
    canvas.drawShadow(
      path,
      const Color(0xFF0F172A).withValues(alpha: 0.10),
      10.0,
      true,
    );

    // Solid white fill
    final fillPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // Top border outline following the curve & rounded shoulders
    final borderPath = Path()
      ..moveTo(0, cornerRadius)
      ..quadraticBezierTo(0, 0, cornerRadius, 0)
      ..lineTo(centerX - scoopWidth, 0)
      ..cubicTo(
        centerX - 38, 0,
        centerX - 34, scoopDrop,
        centerX, scoopDrop,
      )
      ..cubicTo(
        centerX + 34, scoopDrop,
        centerX + 38, 0,
        centerX + scoopWidth, 0,
      )
      ..lineTo(w - cornerRadius, 0)
      ..quadraticBezierTo(w, 0, w, cornerRadius);

    final borderPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawPath(borderPath, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
