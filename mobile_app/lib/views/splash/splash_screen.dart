import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../providers/auth_provider.dart';
import '../auth/login_screen.dart';
import '../main_navigation_shell.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with TickerProviderStateMixin {
  late AnimationController _mainController;
  late AnimationController _particleController;
  late AnimationController _glowController;
  late AnimationController _gleamController;

  late Animation<double> _logoScale;
  late Animation<double> _logoOpacity;
  late Animation<double> _contentSlide;
  late Animation<double> _progressValue;
  late Animation<double> _glowAnimation;

  String _statusText = 'Menginisialisasi modul FONA Core...';

  @override
  void initState() {
    super.initState();

    // 1. Main timeline controller (2.5s)
    _mainController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2500),
    );

    // 2. Ambient network particle rotation
    _particleController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 14),
    )..repeat();

    // 3. Glowing optical aura pulsation controller
    _glowController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1400),
    )..repeat(reverse: true);

    _glowAnimation = Tween<double>(begin: 0.90, end: 1.18).animate(
      CurvedAnimation(parent: _glowController, curve: Curves.easeInOut),
    );

    // 4. Gleaming light shine sweep controller across the logo
    _gleamController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    // Main entrance animations setup
    _logoScale = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.0, 0.45, curve: Curves.easeOutBack),
      ),
    );

    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.0, 0.35, curve: Curves.easeIn),
      ),
    );

    _contentSlide = Tween<double>(begin: 24.0, end: 0.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.15, 0.55, curve: Curves.easeOutCubic),
      ),
    );

    _progressValue = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _mainController,
        curve: const Interval(0.10, 0.95, curve: Curves.easeInOutCubic),
      ),
    );

    _mainController.addListener(() {
      final val = _mainController.value;
      if (val > 0.65 && _statusText != 'Mempersiapkan dasbor operasional...') {
        setState(() => _statusText = 'Mempersiapkan dasbor operasional...');
      } else if (val > 0.35 && val <= 0.65 && _statusText != 'Menghubungkan ke secure node gateway...') {
        setState(() => _statusText = 'Menghubungkan ke secure node gateway...');
      }
    });

    _startAppFlow();
  }

  void _startAppFlow() async {
    await _mainController.forward();
    if (!mounted) return;

    final auth = Provider.of<AuthProvider>(context, listen: false);

    // Ultra-smooth flagship page transition (Fade + Subtle Scale + Slide Up)
    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        transitionDuration: const Duration(milliseconds: 750),
        reverseTransitionDuration: const Duration(milliseconds: 600),
        pageBuilder: (context, animation, secondaryAnimation) {
          return auth.isAuthenticated ? const MainNavigationShell() : const LoginScreen();
        },
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          final curvedAnim = CurvedAnimation(parent: animation, curve: Curves.easeOutQuart);
          
          return FadeTransition(
            opacity: Tween<double>(begin: 0.0, end: 1.0).animate(
              CurvedAnimation(parent: animation, curve: const Interval(0.0, 0.85, curve: Curves.easeInOut)),
            ),
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0, 0.05),
                end: Offset.zero,
              ).animate(curvedAnim),
              child: ScaleTransition(
                scale: Tween<double>(begin: 0.98, end: 1.0).animate(curvedAnim),
                child: child,
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  void dispose() {
    _mainController.dispose();
    _particleController.dispose();
    _glowController.dispose();
    _gleamController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Stack(
        children: [
          // ── 1. Animated Fiber Geometric Background ──
          Positioned.fill(
            child: AnimatedBuilder(
              animation: _particleController,
              builder: (context, child) {
                return CustomPaint(
                  painter: _OpticalNetworkPainter(
                    progress: _particleController.value,
                  ),
                );
              },
            ),
          ),

          // ── 2. Center Branding & Gleaming Logo ──
          SafeArea(
            child: Center(
              child: AnimatedBuilder(
                animation: _mainController,
                builder: (context, child) {
                  return Opacity(
                    opacity: _logoOpacity.value,
                    child: Transform.translate(
                      offset: Offset(0, _contentSlide.value),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Spacer(flex: 3),

                          // Logo with Optical Glowing Halo & Metallic Light Gleam
                          Stack(
                            alignment: Alignment.center,
                            children: [
                              // 1. Breathing optical light aura halo behind logo
                              AnimatedBuilder(
                                animation: _glowAnimation,
                                builder: (context, child) {
                                  return Transform.scale(
                                    scale: _glowAnimation.value,
                                    child: Container(
                                      width: 250,
                                      height: 155,
                                      decoration: BoxDecoration(
                                        borderRadius: BorderRadius.circular(100),
                                        gradient: RadialGradient(
                                          colors: [
                                            const Color(0xFF00AAE0).withValues(alpha: 0.38),
                                            const Color(0xFF0284C7).withValues(alpha: 0.18),
                                            const Color(0xFF38BDF8).withValues(alpha: 0.05),
                                            Colors.transparent,
                                          ],
                                          stops: const [0.0, 0.45, 0.75, 1.0],
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),

                              // 2. Crystal-Clear FONA Logo (100% Original Colors) with Moving Light Flare
                              Transform.scale(
                                scale: _logoScale.value,
                                child: Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 16),
                                  child: Stack(
                                    alignment: Alignment.center,
                                    children: [
                                      // Base Sharp & Vibrant Logo (100% Original Colors)
                                      Image.asset(
                                        'assets/images/fona_logo.png',
                                        height: 120,
                                        fit: BoxFit.contain,
                                        errorBuilder: (ctx, err, stack) => const Center(
                                          child: Icon(
                                            Icons.hub_rounded,
                                            size: 80,
                                            color: AppColors.primary,
                                          ),
                                        ),
                                      ),

                                      // Moving Specular Light Flare Bar (Non-destructive overlay)
                                      Positioned.fill(
                                        child: ClipRRect(
                                          borderRadius: BorderRadius.circular(16),
                                          child: AnimatedBuilder(
                                            animation: _gleamController,
                                            builder: (context, child) {
                                              final prog = _gleamController.value;
                                              return Transform.translate(
                                                offset: Offset(-180 + (prog * 360), 0),
                                                child: Transform.rotate(
                                                  angle: 0.45,
                                                  child: Container(
                                                    width: 50,
                                                    height: 180,
                                                    decoration: BoxDecoration(
                                                      gradient: LinearGradient(
                                                        colors: [
                                                          Colors.transparent,
                                                          Colors.white.withValues(alpha: 0.35),
                                                          const Color(0xFF38BDF8).withValues(alpha: 0.20),
                                                          Colors.transparent,
                                                        ],
                                                        stops: const [0.0, 0.45, 0.65, 1.0],
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                              );
                                            },
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 18),

                          // Enterprise Badge
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                            decoration: BoxDecoration(
                              color: const Color(0xFFE0F2FE),
                              borderRadius: BorderRadius.circular(30),
                              border: Border.all(color: const Color(0xFFBAE6FD)),
                              boxShadow: [
                                BoxShadow(
                                  color: const Color(0xFF0284C7).withValues(alpha: 0.08),
                                  blurRadius: 10,
                                  offset: const Offset(0, 3),
                                ),
                              ],
                            ),
                            child: const Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                CircleAvatar(radius: 3.5, backgroundColor: Color(0xFF0284C7)),
                                SizedBox(width: 6),
                                Text(
                                  'ENTERPRISE FIELD UNMS',
                                  style: TextStyle(
                                    color: Color(0xFF0369A1),
                                    fontSize: 10.5,
                                    fontWeight: FontWeight.w700,
                                    letterSpacing: 1.0,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 8),

                          // Subtitle Description
                          const Text(
                            'Fiber Optic Network Analysis & Automation',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 13,
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.3,
                            ),
                          ),

                          const Spacer(flex: 2),

                          // ── 3. Dynamic Status & Progress Bar ──
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 48),
                            child: Column(
                              children: [
                                // Status Text with smooth fade
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        _statusText,
                                        style: const TextStyle(
                                          color: Color(0xFF475569),
                                          fontSize: 11.5,
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                    ),
                                    Text(
                                      '${(_progressValue.value * 100).toInt()}%',
                                      style: const TextStyle(
                                        color: Color(0xFF0284C7),
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 8),

                                // Modern Gradient Progress Bar
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(6),
                                  child: Container(
                                    height: 4.5,
                                    width: double.infinity,
                                    color: const Color(0xFFE2E8F0),
                                    child: FractionallySizedBox(
                                      alignment: Alignment.centerLeft,
                                      widthFactor: _progressValue.value,
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          gradient: LinearGradient(
                                            colors: [
                                              Color(0xFF00AAE0), // Electric Cyan
                                              Color(0xFF0284C7), // Ocean Blue
                                            ],
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),

                          const Spacer(flex: 1),

                          // ── 4. Security & Compliance Footer ──
                          Padding(
                            padding: const EdgeInsets.only(bottom: 24),
                            child: Row(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.shield_outlined, size: 14, color: Colors.blueGrey.shade400),
                                const SizedBox(width: 6),
                                Text(
                                  'Enkripsi TLS 256-Bit • FONA Core v1.0',
                                  style: TextStyle(
                                    color: Colors.blueGrey.shade400,
                                    fontSize: 11,
                                    fontWeight: FontWeight.w500,
                                    letterSpacing: 0.2,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Custom painter for sleek animated optical fiber topology lines in the background
class _OpticalNetworkPainter extends CustomPainter {
  final double progress;

  _OpticalNetworkPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paintLine = Paint()
      ..color = const Color(0xFF0284C7).withValues(alpha: 0.06)
      ..strokeWidth = 1.2
      ..style = PaintingStyle.stroke;

    final paintNode = Paint()
      ..color = const Color(0xFF00AAE0).withValues(alpha: 0.12)
      ..style = PaintingStyle.fill;

    final cx = size.width / 2;
    final cy = size.height / 2;

    // Draw connecting geometric fiber nodes
    final nodes = [
      Offset(cx - 130 + math.sin(progress * 2 * math.pi) * 8, cy - 200),
      Offset(cx + 120 + math.cos(progress * 2 * math.pi) * 8, cy - 170),
      Offset(cx - 140, cy + 180 + math.cos(progress * 2 * math.pi) * 6),
      Offset(cx + 130, cy + 190 + math.sin(progress * 2 * math.pi) * 6),
      Offset(cx - 60, cy - 280),
      Offset(cx + 70, cy + 290),
    ];

    for (int i = 0; i < nodes.length; i++) {
      canvas.drawCircle(nodes[i], 4.0, paintNode);
      for (int j = i + 1; j < nodes.length; j++) {
        if ((nodes[i] - nodes[j]).distance < 360) {
          canvas.drawLine(nodes[i], nodes[j], paintLine);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _OpticalNetworkPainter oldDelegate) {
    return oldDelegate.progress != progress;
  }
}
