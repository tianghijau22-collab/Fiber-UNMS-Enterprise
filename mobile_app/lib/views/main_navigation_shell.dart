import 'package:flutter/material.dart';
import 'dashboard/home_dashboard_screen.dart';
import 'alerts/system_alert_screen.dart';
import 'customers/customer_list_screen.dart';
import 'profile/profile_screen.dart';
import 'odp/odp_form_screen.dart';
import 'ont/ont_scan_screen.dart';

class MainNavigationShell extends StatefulWidget {
  const MainNavigationShell({super.key});

  @override
  State<MainNavigationShell> createState() => _MainNavigationShellState();
}

class _MainNavigationShellState extends State<MainNavigationShell> {
  int _currentIndex = 0;

  final List<Widget> _screens = const [
    HomeDashboardScreen(),
    SystemAlertScreen(),
    CustomerListScreen(),
    ProfileScreen(),
  ];

  void _showQuickActionSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.transparent,
      isScrollControlled: true,
      builder: (ctx) => Container(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 28),
        decoration: const BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                margin: const EdgeInsets.only(bottom: 16),
                decoration: BoxDecoration(
                  color: const Color(0xFFE2E8F0),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            const Text(
              'Aksi Cepat Teknisi',
              style: TextStyle(
                color: Color(0xFF0F172A),
                fontWeight: FontWeight.bold,
                fontSize: 17,
              ),
            ),
            const SizedBox(height: 4),
            const Text(
              'Pilih utilitas pengukuran atau pemindaian perangkat lapangan:',
              style: TextStyle(
                color: Color(0xFF64748B),
                fontSize: 13,
              ),
            ),
            const SizedBox(height: 18),
            _buildActionItem(
              icon: Icons.bolt_rounded,
              iconColor: const Color(0xFF0284C7),
              bgColor: const Color(0xFFE0F2FE),
              title: 'Ukur Redaman ODP',
              description: 'Validasi & input daya optik (dBm) pada port ODP',
              onTap: () {
                Navigator.pop(ctx);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const OdpFormScreen()));
              },
            ),
            const SizedBox(height: 12),
            _buildActionItem(
              icon: Icons.qr_code_scanner_rounded,
              iconColor: const Color(0xFF7C3AED),
              bgColor: const Color(0xFFF3E8FF),
              title: 'Scan Barcode ONU',
              description: 'Pindai barcode/SN untuk provisioning & aktivasi modem',
              onTap: () {
                Navigator.pop(ctx);
                Navigator.push(context, MaterialPageRoute(builder: (_) => const OntScanScreen()));
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildActionItem({
    required IconData icon,
    required Color iconColor,
    required Color bgColor,
    required String title,
    required String description,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Row(
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: bgColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Center(
                child: Icon(icon, color: iconColor, size: 24),
              ),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: const TextStyle(
                      color: Color(0xFF0F172A),
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    description,
                    style: const TextStyle(
                      color: Color(0xFF64748B),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_right_rounded, color: Color(0xFF94A3B8)),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: IndexedStack(
        index: _currentIndex,
        children: _screens,
      ),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          border: const Border(top: BorderSide(color: Color(0xFFE2E8F0), width: 1)),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 10,
              offset: const Offset(0, -2),
            ),
          ],
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: [
                _buildNavItem(
                  index: 0,
                  icon: Icons.home_outlined,
                  activeIcon: Icons.home_rounded,
                  label: 'Home',
                ),
                _buildNavItem(
                  index: 1,
                  icon: Icons.notifications_none_rounded,
                  activeIcon: Icons.notifications_rounded,
                  label: 'Alert',
                  hasBadgeDot: true,
                ),
                // Floating Center QRIS-Style Button
                _buildCenterActionButton(),
                _buildNavItem(
                  index: 2,
                  icon: Icons.people_outline_rounded,
                  activeIcon: Icons.people_alt_rounded,
                  label: 'Pelanggan',
                ),
                _buildNavItem(
                  index: 3,
                  icon: Icons.person_outline_rounded,
                  activeIcon: Icons.person_rounded,
                  label: 'Profil',
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNavItem({
    required int index,
    required IconData icon,
    required IconData activeIcon,
    required String label,
    bool hasBadgeDot = false,
  }) {
    final isSelected = _currentIndex == index;
    final color = isSelected ? const Color(0xFF005BAA) : const Color(0xFF64748B);

    return InkWell(
      onTap: () => setState(() => _currentIndex = index),
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Stack(
              clipBehavior: Clip.none,
              children: [
                Icon(
                  isSelected ? activeIcon : icon,
                  color: color,
                  size: 24,
                ),
                if (hasBadgeDot)
                  Positioned(
                    top: 1,
                    right: 0,
                    child: Container(
                      width: 6.5,
                      height: 6.5,
                      decoration: const BoxDecoration(
                        color: Color(0xFFEF4444),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(height: 3),
            Text(
              label,
              style: TextStyle(
                color: color,
                fontSize: 10.5,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCenterActionButton() {
    return GestureDetector(
      onTap: _showQuickActionSheet,
      child: Container(
        width: 54,
        height: 54,
        decoration: const BoxDecoration(
          color: Color(0xFFD6EEFD),
          shape: BoxShape.circle,
        ),
        padding: const EdgeInsets.all(4.5),
        child: Container(
          decoration: const BoxDecoration(
            gradient: LinearGradient(
              colors: [Color(0xFF0075D8), Color(0xFF005BAA)],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            shape: BoxShape.circle,
          ),
          child: const Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  Icons.qr_code_scanner_rounded,
                  color: Colors.white,
                  size: 20,
                ),
                Text(
                  'SCAN',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 7.5,
                    fontWeight: FontWeight.w900,
                    letterSpacing: 0.4,
                    height: 1.1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
