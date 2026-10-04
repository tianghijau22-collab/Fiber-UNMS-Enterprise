import 'package:flutter/material.dart';
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

  final List<Widget> _screens = const [
    HomeDashboardScreen(),
    GisMapScreen(),
    ProfileScreen(),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: SizedBox(
          height: 70,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              // 1. Curved Background with concave scoop notch & top border
              Positioned.fill(
                child: CustomPaint(
                  painter: _CurvedNavBarPainter(),
                ),
              ),

              // 2. Navigation Items (Home, Center Tap Area, Profil)
              Positioned.fill(
                child: Row(
                  children: [
                    // Home
                    Expanded(
                      child: _buildSideNavItem(
                        index: 0,
                        icon: Icons.home_outlined,
                        activeIcon: Icons.home_rounded,
                        label: 'Home',
                      ),
                    ),

                    // Center Placeholder for Maps
                    Expanded(
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _currentIndex = 1),
                        child: Container(
                          alignment: Alignment.bottomCenter,
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Text(
                            'Maps',
                            style: TextStyle(
                              color: _currentIndex == 1 ? const Color(0xFF005BAA) : const Color(0xFF64748B),
                              fontSize: 11,
                              fontWeight: _currentIndex == 1 ? FontWeight.w700 : FontWeight.w500,
                            ),
                          ),
                        ),
                      ),
                    ),

                    // Profil
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

              // 3. Floating Elevated Center Button (Maps)
              Align(
                alignment: Alignment.topCenter,
                child: Transform.translate(
                  offset: const Offset(0, -20),
                  child: GestureDetector(
                    onTap: () => setState(() => _currentIndex = 1),
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                        border: Border.all(
                          color: _currentIndex == 1 ? const Color(0xFF005BAA) : const Color(0xFFCBD5E1),
                          width: _currentIndex == 1 ? 2.0 : 1.5,
                        ),
                        boxShadow: [
                          BoxShadow(
                            color: _currentIndex == 1
                                ? const Color(0xFF005BAA).withValues(alpha: 0.25)
                                : Colors.black.withValues(alpha: 0.10),
                            blurRadius: _currentIndex == 1 ? 12 : 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: Center(
                        child: Icon(
                          _currentIndex == 1 ? Icons.map_rounded : Icons.map_outlined,
                          color: _currentIndex == 1 ? const Color(0xFF005BAA) : const Color(0xFF64748B),
                          size: 24,
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
          Icon(
            isSelected ? activeIcon : icon,
            color: color,
            size: 24,
          ),
          const SizedBox(height: 4),
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

    const scoopWidth = 46.0;
    const scoopDrop = 32.0;

    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(centerX - scoopWidth, 0)
      ..cubicTo(
        centerX - scoopWidth * 0.5, 0,
        centerX - scoopWidth * 0.5, scoopDrop,
        centerX, scoopDrop,
      )
      ..cubicTo(
        centerX + scoopWidth * 0.5, scoopDrop,
        centerX + scoopWidth * 0.5, 0,
        centerX + scoopWidth, 0,
      )
      ..lineTo(w, 0)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    // Soft drop shadow
    canvas.drawShadow(
      path,
      const Color(0xFF0F172A).withValues(alpha: 0.10),
      8.0,
      true,
    );

    // Solid white fill
    final fillPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.fill;
    canvas.drawPath(path, fillPaint);

    // Top border outline following the curve
    final borderPath = Path()
      ..moveTo(0, 0)
      ..lineTo(centerX - scoopWidth, 0)
      ..cubicTo(
        centerX - scoopWidth * 0.5, 0,
        centerX - scoopWidth * 0.5, scoopDrop,
        centerX, scoopDrop,
      )
      ..cubicTo(
        centerX + scoopWidth * 0.5, scoopDrop,
        centerX + scoopWidth * 0.5, 0,
        centerX + scoopWidth, 0,
      )
      ..lineTo(w, 0);

    final borderPaint = Paint()
      ..color = const Color(0xFFE2E8F0)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;
    canvas.drawPath(borderPath, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
