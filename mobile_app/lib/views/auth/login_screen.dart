import 'dart:math' as math;
import 'dart:ui' as ui;
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage_service.dart';
import '../../models/user_model.dart';
import '../../providers/auth_provider.dart';
import '../main_navigation_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with TickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final LocalAuthentication _localAuth = LocalAuthentication();

  // Floating Alert Banner Animation (Frosted Red Glassmorphism)
  late AnimationController _alertController;
  late Animation<Offset> _alertSlideAnimation;
  late Animation<double> _alertFadeAnimation;
  String? _lastDismissedError;
  String? _currentDisplayedError;

  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isRedirecting = false;
  bool _hasBiometricSaved = false;

  // Saved Account & Quick Switch State
  bool _isQuickSwitchMode = false;
  UserModel? _savedUser;
  String? _rememberedUsername;

  // Dynamic Background Banner from Web Admin
  String? _customBannerUrl;
  String _bannerFit = 'cover';
  double _bannerAlignX = 0.0;
  double _bannerAlignY = 0.0;
  double _bannerScale = 1.0;
  double _bannerOverlayOpacity = 0.0;

  BoxFit _getBannerBoxFit(String fit) {
    switch (fit) {
      case 'contain':
        return BoxFit.contain;
      case 'fitWidth':
        return BoxFit.fitWidth;
      case 'fill':
        return BoxFit.fill;
      case 'cover':
      default:
        return BoxFit.cover;
    }
  }

  // BRImo Signature Corporate Palette
  static const Color briPrimary = Color(0xFF0060AF);      // Royal Blue Utama
  static const Color briDeepNavy = Color(0xFF003870);     // Deep Navy Blue
  static const Color briElectric = Color(0xFF007EC5);     // Electric Blue Highlight
  static const Color briOrange = Color(0xFFF37021);       // BRI Accent Orange
  static const Color briCardBg = Color(0xFFF8FAFC);       // Soft Clean Fill

  late AnimationController _floatController;

  @override
  void initState() {
    super.initState();
    _floatController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2600),
    )..repeat(reverse: true);

    _alertController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 380),
    );
    _alertSlideAnimation = Tween<Offset>(
      begin: const Offset(0, -0.65),
      end: Offset.zero,
    ).animate(CurvedAnimation(
      parent: _alertController,
      curve: Curves.easeOutCubic,
      reverseCurve: Curves.easeInCubic,
    ));
    _alertFadeAnimation = Tween<double>(
      begin: 0.0,
      end: 1.0,
    ).animate(CurvedAnimation(
      parent: _alertController,
      curve: Curves.easeOut,
    ));

    _loadSavedState();
    _fetchLoginBanner();
  }

  @override
  void dispose() {
    _alertController.dispose();
    _floatController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _dismissAlert() {
    _alertController.reverse().then((_) {
      if (mounted) {
        setState(() {
          _lastDismissedError = _currentDisplayedError;
          _currentDisplayedError = null;
        });
      }
    });
  }

  Future<void> _loadSavedState() async {
    final storage = StorageService();
    final remembered = await storage.getRememberedUsername();
    final bioCreds = await storage.getBiometricCredentials();
    final savedUser = await storage.getLastSavedUser();

    if (mounted) {
      setState(() {
        _savedUser = savedUser;
        _rememberedUsername = (remembered != null && remembered.isNotEmpty)
            ? remembered
            : (savedUser?.username ?? savedUser?.email);

        if (_rememberedUsername != null && _rememberedUsername!.isNotEmpty) {
          _usernameController.text = _rememberedUsername!;
          _rememberMe = true;
          _isQuickSwitchMode = true;
        } else {
          _isQuickSwitchMode = false;
        }
        _hasBiometricSaved = (bioCreds != null);
      });
    }
  }

  Future<void> _fetchLoginBanner() async {
    try {
      final res = await DioClient().dio.get('/app-testing/login-banner');
      if (res.data != null && res.data['status'] == 'success') {
        final data = res.data['data'];
        if (data != null && data['is_custom'] == true && data['banner_url'] != null) {
          String bannerUrl = data['banner_url'].toString();
          // Ensure banner URL matches configured host/protocol if server returns different scheme
          final serverBase = DioClient().dio.options.baseUrl;
          final serverUri = Uri.tryParse(serverBase);
          final bannerUri = Uri.tryParse(bannerUrl);
          if (serverUri != null && bannerUri != null) {
            bannerUrl = bannerUri.replace(
              scheme: serverUri.scheme,
              host: serverUri.host,
              port: serverUri.hasPort ? serverUri.port : null,
            ).toString();
          }

          final config = data['config'] as Map<String, dynamic>?;

          if (mounted) {
            setState(() {
              _customBannerUrl = bannerUrl;
              if (config != null) {
                _bannerFit = config['fit']?.toString() ?? 'cover';
                _bannerAlignX = double.tryParse(config['alignment_x']?.toString() ?? '0') ?? 0.0;
                _bannerAlignY = double.tryParse(config['alignment_y']?.toString() ?? '0') ?? 0.0;
                _bannerScale = double.tryParse(config['scale']?.toString() ?? '1.0') ?? 1.0;
                _bannerOverlayOpacity = double.tryParse(config['overlay_opacity']?.toString() ?? '0.0') ?? 0.0;
              }
            });
          }
        } else {
          if (mounted && _customBannerUrl != null) {
            setState(() {
              _customBannerUrl = null;
            });
          }
        }
      }
    } catch (_) {
      // Gracefully fallback to default illustration
    }
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final username = _usernameController.text.trim();
    if (username.isEmpty) {
      setState(() => _isQuickSwitchMode = false);
      _showModernSnackBar(
        title: 'Username Kosong',
        message: 'Silakan masukkan username Anda.',
        icon: Icons.person_outline_rounded,
        iconColor: const Color(0xFFEF4444),
        badgeBgColor: const Color(0x26EF4444),
      );
      return;
    }
    final password = _passwordController.text;

    setState(() {
      _lastDismissedError = null;
    });

    final success = await authProvider.login(username, password);

    if (success && mounted) {
      final storage = StorageService();
      // 1. Handle Remember Me
      if (_rememberMe) {
        await storage.setRememberedUsername(username);
      } else {
        await storage.setRememberedUsername(null);
        await storage.clearLastSavedUser();
      }

      // 2. Save Credentials for Biometric Quick Access
      await storage.saveBiometricCredentials(username, password);

      setState(() => _isRedirecting = true);
      await Future.delayed(const Duration(milliseconds: 600));
      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 600),
          pageBuilder: (context, animation, secondaryAnimation) => const MainNavigationShell(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutQuart);
            return FadeTransition(
              opacity: Tween<double>(begin: 0.0, end: 1.0).animate(curved),
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(curved),
                child: child,
              ),
            );
          },
        ),
      );
    }
  }

  Future<void> _handleBiometricLogin() async {
    final storage = StorageService();
    final creds = await storage.getBiometricCredentials();

    if (creds == null) {
      if (mounted) {
        showDialog(
          context: context,
          builder: (ctx) => AlertDialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
            title: const Row(
              children: [
                Icon(Icons.fingerprint_rounded, color: briPrimary, size: 24),
                SizedBox(width: 8),
                Text(
                  'Biometrik Belum Aktif',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
              ],
            ),
            content: const Text(
              'Silakan login menggunakan Username dan Kata Sandi satu kali untuk mengaktifkan login cepat Biometrik / Sidik Jari.',
              style: TextStyle(fontSize: 13, color: Color(0xFF64748B), height: 1.4),
            ),
            actions: [
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: briPrimary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                ),
                onPressed: () => Navigator.pop(ctx),
                child: const Text('Mengerti', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
      return;
    }

    try {
      final canCheck = await _localAuth.canCheckBiometrics || await _localAuth.isDeviceSupported();
      if (!canCheck) {
        if (mounted) {
          _showModernSnackBar(
            title: 'Biometrik Tidak Tersedia',
            message: 'Perangkat tidak mendukung sensor biometrik/sidik jari.',
            icon: Icons.fingerprint_rounded,
            iconColor: const Color(0xFFEF4444),
            badgeBgColor: const Color(0x26EF4444),
          );
        }
        return;
      }

      final didAuthenticate = await _localAuth.authenticate(
        localizedReason: 'Pindai Sidik Jari atau Wajah untuk masuk ke akun FONA',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: false,
        ),
      );

      if (didAuthenticate && mounted) {
        final authProvider = Provider.of<AuthProvider>(context, listen: false);
        final success = await authProvider.login(creds['username']!, creds['password']!);

        if (success && mounted) {
          setState(() => _isRedirecting = true);
          await Future.delayed(const Duration(milliseconds: 600));
          if (!mounted) return;

          Navigator.of(context).pushReplacement(
            PageRouteBuilder(
              transitionDuration: const Duration(milliseconds: 600),
              pageBuilder: (context, animation, secondaryAnimation) => const MainNavigationShell(),
              transitionsBuilder: (context, animation, secondaryAnimation, child) {
                final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutQuart);
                return FadeTransition(
                  opacity: Tween<double>(begin: 0.0, end: 1.0).animate(curved),
                  child: SlideTransition(
                    position: Tween<Offset>(begin: const Offset(0, 0.04), end: Offset.zero).animate(curved),
                    child: child,
                  ),
                );
              },
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        final errorStr = e.toString().toLowerCase();
        // Ignore normal user dismiss / cancellation
        if (!errorStr.contains('cancel') && !errorStr.contains('user_cancel')) {
          _showModernSnackBar(
            title: 'Kendala Biometrik',
            message: 'Autentikasi biometrik tidak dapat diselesaikan ($e).',
            icon: Icons.error_outline_rounded,
            iconColor: const Color(0xFFEF4444),
            badgeBgColor: const Color(0x26EF4444),
          );
        }
      }
    }
  }

  // ── Modern Floating Capsule Toast / SnackBar ──
  void _showModernSnackBar({
    required String message,
    String? title,
    IconData icon = Icons.info_outline_rounded,
    Color iconColor = const Color(0xFF38BDF8),
    Color badgeBgColor = const Color(0x2638BDF8),
    Duration duration = const Duration(seconds: 4),
  }) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).hideCurrentSnackBar();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        behavior: SnackBarBehavior.floating,
        margin: const EdgeInsets.fromLTRB(16, 0, 16, 20),
        padding: EdgeInsets.zero,
        backgroundColor: Colors.transparent,
        elevation: 0,
        duration: duration,
        content: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.12),
              width: 1.2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.35),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: badgeBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, color: iconColor, size: 20),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    if (title != null) ...[
                      Text(
                        title,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 13,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                      ),
                      const SizedBox(height: 2),
                    ],
                    Text(
                      message,
                      style: const TextStyle(
                        color: Color(0xFFE2E8F0),
                        fontSize: 12,
                        height: 1.35,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // ── Contact Administrator Action BottomSheet ──
  void _showContactAdminSheet({required bool isResetPassword}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFE0F2FE),
                        borderRadius: BorderRadius.circular(14),
                      ),
                      child: Icon(
                        isResetPassword ? Icons.lock_reset_rounded : Icons.support_agent_rounded,
                        color: briPrimary,
                        size: 26,
                      ),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isResetPassword ? 'Reset Kata Sandi' : 'Pendaftaran Akun Baru',
                            style: const TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 16.5,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Text(
                            'Hubungi Administrator Resmi FONA',
                            style: TextStyle(
                              color: Color(0xFF64748B),
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 18),
                Text(
                  isResetPassword
                      ? 'Untuk keamanan operasional, permohonan reset sandi diverifikasi langsung oleh System Administrator:'
                      : 'Untuk aktivasi akun baru, silakan ajukan ke Administrator jaringan:',
                  style: const TextStyle(
                    color: Color(0xFF475569),
                    fontSize: 13,
                    height: 1.45,
                  ),
                ),
                const SizedBox(height: 16),

                // Admin Contact Card
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: briCardBg,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 42,
                        height: 42,
                        decoration: const BoxDecoration(
                          color: Color(0xFF0284C7),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.send_rounded, color: Colors.white, size: 20),
                      ),
                      const SizedBox(width: 12),
                      const Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              '@jasenardian',
                              style: TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 15,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            SizedBox(height: 2),
                            Text(
                              'Telegram Admin • Fast Response',
                              style: TextStyle(
                                color: Color(0xFF64748B),
                                fontSize: 11.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        tooltip: 'Salin Username',
                        onPressed: () {
                          Clipboard.setData(const ClipboardData(text: '@jasenardian'));
                          Navigator.pop(ctx);
                          _showModernSnackBar(
                            title: 'Tersalin',
                            message: 'Username @jasenardian telah disalin ke clipboard.',
                            icon: Icons.check_circle_rounded,
                            iconColor: const Color(0xFF10B981),
                            badgeBgColor: const Color(0x2610B981),
                          );
                        },
                        icon: const Icon(Icons.copy_rounded, color: briPrimary, size: 20),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                // Action Buttons
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          side: const BorderSide(color: Color(0xFFCBD5E1)),
                        ),
                        onPressed: () => Navigator.pop(ctx),
                        child: const Text('Tutup', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w700)),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: briPrimary,
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        onPressed: () async {
                          final uri = Uri.parse('https://t.me/jasenardian');
                          if (await canLaunchUrl(uri)) {
                            await launchUrl(uri, mode: LaunchMode.externalApplication);
                          }
                          if (ctx.mounted) Navigator.pop(ctx);
                        },
                        icon: const Icon(Icons.open_in_new_rounded, color: Colors.white, size: 16),
                        label: const Text(
                          'Buka Telegram',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w800, fontSize: 13.5),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _showServerSettingsDialog() async {
    final storage = StorageService();
    final currentUrl = await storage.getServerUrl();
    final urlController = TextEditingController(text: currentUrl);

    if (!mounted) return;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: const BoxDecoration(
                color: Color(0xFFE0F2FE),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.dns_rounded, color: briPrimary, size: 20),
            ),
            const SizedBox(width: 10),
            const Text(
              'Server Endpoint URL',
              style: TextStyle(color: Color(0xFF0F172A), fontSize: 16, fontWeight: FontWeight.w800),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Alamat API backend server:',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlController,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13.5, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'https://fiber-monitoring.103.89.6.125.sslip.io/api',
                hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                filled: true,
                fillColor: briCardBg,
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: briPrimary, width: 1.5)),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B), fontWeight: FontWeight.w600)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: briPrimary,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
            ),
            onPressed: () async {
              final newUrl = urlController.text.trim();
              await storage.setServerUrl(newUrl);
              DioClient().updateBaseUrl(newUrl);
              if (ctx.mounted) {
                Navigator.pop(ctx);
              }
              if (mounted) {
                _showModernSnackBar(
                  title: 'Server Diperbarui',
                  message: 'Endpoint berhasil diubah ke: ${DioClient().dio.options.baseUrl}',
                  icon: Icons.check_circle_rounded,
                  iconColor: const Color(0xFF10B981),
                  badgeBgColor: const Color(0x2610B981),
                );
                _fetchLoginBanner();
              }
            },
            child: const Text('Simpan', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final topPadding = MediaQuery.of(context).padding.top;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final screenHeight = MediaQuery.of(context).size.height;

    // Synchronize alert error state with AuthProvider
    if (auth.errorMessage != null && auth.errorMessage != _lastDismissedError) {
      if (_currentDisplayedError != auth.errorMessage) {
        _currentDisplayedError = auth.errorMessage;
        _alertController.forward(from: 0.0);
      }
    } else if (auth.errorMessage == null && _currentDisplayedError != null) {
      _currentDisplayedError = null;
      _alertController.reverse();
    }

    return Scaffold(
      backgroundColor: Colors.white,
      body: Stack(
        children: [
          // ── Scrollable Body ──
          SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── 1. Top Section with Arc Curve (Dynamic Banner or Default Mascot) ──
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Royal Blue Gradient Area with Bottom Curved Arc
                    ClipPath(
                      clipper: _BriMoCurvedArcClipper(),
                      child: Container(
                        height: math.max(screenHeight * 0.44, 310.0),
                        width: double.infinity,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              briDeepNavy,
                              briPrimary,
                              Color(0xFF0075D8),
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                        child: Stack(
                          fit: StackFit.expand,
                          children: [
                            // ── 1. Base Layer: Ambient Radial Glow & Default Mascot Hero ──
                            Positioned(
                              top: -60,
                              right: -60,
                              child: Container(
                                width: 240,
                                height: 240,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: Colors.white.withValues(alpha: 0.08),
                                ),
                              ),
                            ),
                            Positioned(
                              top: 100,
                              left: -60,
                              child: Container(
                                width: 180,
                                height: 180,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: briElectric.withValues(alpha: 0.16),
                                ),
                              ),
                            ),
                            _buildDefaultHeroIllustration(topPadding),

                            // ── 2. Custom Banner from Web Admin (Rendered dynamically on top) ──
                            if (_customBannerUrl != null) ...[
                              Positioned.fill(
                                child: ClipRect(
                                  child: Transform.scale(
                                    scale: _bannerScale,
                                    alignment: Alignment(_bannerAlignX, _bannerAlignY),
                                    child: CachedNetworkImage(
                                      imageUrl: _customBannerUrl!,
                                      fit: _getBannerBoxFit(_bannerFit),
                                      alignment: Alignment(_bannerAlignX, _bannerAlignY),
                                      width: double.infinity,
                                      height: double.infinity,
                                      fadeInDuration: const Duration(milliseconds: 300),
                                      placeholder: (ctx, url) => const SizedBox.shrink(),
                                      errorWidget: (ctx, err, stack) => const SizedBox.shrink(),
                                    ),
                                  ),
                                ),
                              ),
                              if (_bannerOverlayOpacity > 0.0)
                                Positioned.fill(
                                  child: Container(
                                    color: Colors.black.withValues(alpha: _bannerOverlayOpacity.clamp(0.0, 0.9)),
                                  ),
                                ),
                            ],
                          ],
                        ),
                      ),
                    ),
                  ],
                ),

                // ── 2. Direct Inline Login Form (White Section) ──
                Padding(
                  padding: const EdgeInsets.fromLTRB(24, 8, 24, 20),
                  child: Form(
                    key: _formKey,
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Title & Subtitle
                        Text(
                          _isQuickSwitchMode ? 'Selamat datang kembali!' : 'Silahkan login',
                          style: const TextStyle(
                            color: Color(0xFF0F172A),
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 3),
                        Text(
                          _isQuickSwitchMode
                              ? 'Masuk ke akun Anda untuk melanjutkan'
                              : 'Gunakan username & kata sandi Anda',
                          style: const TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12.5,
                          ),
                        ),

                        const SizedBox(height: 18),

                        // ── Quick Switch Profile Card OR Username Field ──
                        if (_isQuickSwitchMode) ...[
                          _buildQuickSwitchProfileCard(),
                        ] else ...[
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              const Text(
                                'Username',
                                style: TextStyle(color: Color(0xFF1E293B), fontSize: 12.5, fontWeight: FontWeight.w700),
                              ),
                              if (_rememberedUsername != null && _rememberedUsername!.isNotEmpty)
                                TextButton.icon(
                                  onPressed: () {
                                    setState(() {
                                      _isQuickSwitchMode = true;
                                      _usernameController.text = _rememberedUsername!;
                                    });
                                  },
                                  style: TextButton.styleFrom(
                                    padding: EdgeInsets.zero,
                                    minimumSize: Size.zero,
                                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                  ),
                                  icon: const Icon(Icons.account_circle_rounded, size: 14, color: briPrimary),
                                  label: Text(
                                    'Gunakan ${_savedUser?.name ?? _rememberedUsername}',
                                    style: const TextStyle(color: briPrimary, fontSize: 11, fontWeight: FontWeight.w700),
                                  ),
                                ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          TextFormField(
                            controller: _usernameController,
                            style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w600),
                            decoration: InputDecoration(
                              hintText: 'Masukkan username',
                              hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                              prefixIcon: const Icon(Icons.person_outline_rounded, color: briPrimary, size: 20),
                              filled: true,
                              fillColor: briCardBg,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                              ),
                              focusedBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(14),
                                borderSide: const BorderSide(color: briPrimary, width: 1.8),
                              ),
                              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                            ),
                            validator: (v) => (v == null || v.trim().isEmpty) ? 'Username tidak boleh kosong' : null,
                          ),
                          const SizedBox(height: 14),
                        ],

                        // ── Password Input Field ──
                        const Text(
                          'Kata Sandi',
                          style: TextStyle(color: Color(0xFF1E293B), fontSize: 12.5, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _passwordController,
                          obscureText: _obscurePassword,
                          style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w600),
                          decoration: InputDecoration(
                            hintText: 'Masukkan kata sandi',
                            hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13),
                            prefixIcon: const Icon(Icons.lock_outline_rounded, color: briPrimary, size: 20),
                            suffixIcon: IconButton(
                              icon: Icon(
                                _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                color: const Color(0xFF94A3B8),
                                size: 20,
                              ),
                              onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                            ),
                            filled: true,
                            fillColor: briCardBg,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: briPrimary, width: 1.8),
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                          ),
                          validator: (v) => (v == null || v.isEmpty) ? 'Kata sandi tidak boleh kosong' : null,
                        ),

                        const SizedBox(height: 10),

                        // ── Remember Me & Forgot Password ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            InkWell(
                              onTap: () => setState(() => _rememberMe = !_rememberMe),
                              borderRadius: BorderRadius.circular(6),
                              child: Row(
                                children: [
                                  SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: Checkbox(
                                      value: _rememberMe,
                                      onChanged: (val) => setState(() => _rememberMe = val ?? false),
                                      activeColor: briPrimary,
                                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                    ),
                                  ),
                                  const SizedBox(width: 8),
                                  const Text(
                                    'Ingat Saya',
                                    style: TextStyle(color: Color(0xFF475569), fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ],
                              ),
                            ),
                            TextButton(
                              onPressed: () => _showContactAdminSheet(isResetPassword: true),
                              style: TextButton.styleFrom(
                                padding: EdgeInsets.zero,
                                minimumSize: Size.zero,
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              ),
                              child: const Text(
                                'Lupa Sandi?',
                                style: TextStyle(
                                  color: briPrimary,
                                  fontSize: 12.5,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // ── BRImo Style Action Row: Login Button + Biometric Button ──
                        Row(
                          children: [
                            // Expanded Primary Login Button
                            Expanded(
                              child: SizedBox(
                                height: 52,
                                child: ElevatedButton(
                                  onPressed: (auth.isLoading || _isRedirecting) ? null : _handleLogin,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: briPrimary,
                                    elevation: 0,
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(14),
                                    ),
                                  ),
                                  child: auth.isLoading
                                      ? const Row(
                                          mainAxisAlignment: MainAxisAlignment.center,
                                          children: [
                                            SizedBox(
                                              height: 18,
                                              width: 18,
                                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.2),
                                            ),
                                            SizedBox(width: 10),
                                            Text(
                                              'Memverifikasi...',
                                              style: TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w700),
                                            ),
                                          ],
                                        )
                                      : const Text(
                                          'Login',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 16,
                                            fontWeight: FontWeight.w800,
                                            letterSpacing: 0.4,
                                          ),
                                        ),
                                ),
                              ),
                            ),

                            const SizedBox(width: 12),

                            // Biometric Quick Access Button (Functional)
                            Tooltip(
                              message: _hasBiometricSaved ? 'Login Cepat Biometrik' : 'Aktifkan Biometrik setelah login',
                              child: Container(
                                height: 52,
                                width: 52,
                                decoration: BoxDecoration(
                                  color: briPrimary,
                                  borderRadius: BorderRadius.circular(14),
                                ),
                                child: IconButton(
                                  onPressed: (auth.isLoading || _isRedirecting) ? null : _handleBiometricLogin,
                                  icon: const Icon(
                                    Icons.fingerprint_rounded,
                                    color: Colors.white,
                                    size: 28,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 20),

                        // ── Help Link & Footer ──
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Text(
                              'Belum punya akun ? ',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            ),
                            InkWell(
                              onTap: () => _showContactAdminSheet(isResetPassword: false),
                              child: const Text(
                                'Hubungi admin',
                                style: TextStyle(
                                  color: briOrange,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(height: 14),
                        const Divider(color: Color(0xFFE2E8F0), height: 1),
                        const SizedBox(height: 12),

                        // SSL Security Footnote (Hidden developer access to Server Settings via long-press)
                        GestureDetector(
                          onLongPress: _showServerSettingsDialog,
                          behavior: HitTestBehavior.opaque,
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.lock_outline_rounded, color: Color(0xFF10B981), size: 12),
                              SizedBox(width: 4),
                              Text(
                                'FONA Enterprise v1.0.5 • 256-Bit Encrypted',
                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5, fontWeight: FontWeight.w600),
                              ),
                            ],
                          ),
                        ),

                        SizedBox(height: bottomPadding + 10),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // ── Full-Screen Loading Transition Overlay ──
          if (_isRedirecting)
            Positioned.fill(
              child: Container(
                color: Colors.white.withValues(alpha: 0.95),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F2FE),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFBAE6FD)),
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          size: 46,
                          color: briPrimary,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Autentikasi Berhasil',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Membuka dasbor operasional...',
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 12.5,
                        ),
                      ),
                      const SizedBox(height: 16),
                      const SizedBox(
                        width: 140,
                        child: ClipRRect(
                          borderRadius: BorderRadius.all(Radius.circular(4)),
                          child: LinearProgressIndicator(
                            minHeight: 3.5,
                            backgroundColor: Color(0xFFE2E8F0),
                            valueColor: AlwaysStoppedAnimation<Color>(briPrimary),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),

          // ── Top Floating Frosted Red Error Alert Banner ──
          if (_currentDisplayedError != null)
            _buildFloatingErrorBanner(topPadding),
        ],
      ),
    );
  }

  // ── Floating Frosted Red Error Alert Banner (Glassmorphism) ──
  Widget _buildFloatingErrorBanner(double topPadding) {
    return Positioned(
      top: topPadding + 8,
      left: 16,
      right: 16,
      child: SlideTransition(
        position: _alertSlideAnimation,
        child: FadeTransition(
          opacity: _alertFadeAnimation,
          child: Material(
            color: Colors.transparent,
            child: ClipRRect(
              borderRadius: BorderRadius.circular(20),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 14, sigmaY: 14),
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        const Color(0xFF7F1D1D).withValues(alpha: 0.90), // Deep Ruby Frost
                        const Color(0xFFDC2626).withValues(alpha: 0.84), // Glowing Coral Frost
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.28),
                      width: 1.2,
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: const Color(0xFF7F1D1D).withValues(alpha: 0.40),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Glowing Red Circle Badge
                      Container(
                        padding: const EdgeInsets.all(7),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.18),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.35),
                            width: 1,
                          ),
                        ),
                        child: const Icon(
                          Icons.error_outline_rounded,
                          color: Colors.white,
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),

                      // Text: Title & Error Message
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Text(
                              'Gagal Masuk',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 13.5,
                                fontWeight: FontWeight.w800,
                                letterSpacing: -0.2,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _currentDisplayedError ?? '',
                              style: TextStyle(
                                color: Colors.white.withValues(alpha: 0.95),
                                fontSize: 12,
                                height: 1.35,
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(width: 8),

                      // Dismiss Close Button (X)
                      InkWell(
                        onTap: _dismissAlert,
                        borderRadius: BorderRadius.circular(20),
                        child: Container(
                          padding: const EdgeInsets.all(5),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.18),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(
                            Icons.close_rounded,
                            color: Colors.white,
                            size: 16,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ── Quick Switch Profile Card Widget ──
  Widget _buildQuickSwitchProfileCard() {
    final displayName = (_savedUser?.name != null && _savedUser!.name.isNotEmpty)
        ? _savedUser!.name
        : (_rememberedUsername ?? 'Pengguna FONA');
    final roleText = (_savedUser?.role != null && _savedUser!.role.isNotEmpty)
        ? _savedUser!.role
        : 'Akun Tersimpan';
    final usernameText = _savedUser?.username ?? _rememberedUsername ?? '';

    // Generate Initials
    String initials = '';
    final trimmedName = displayName.trim();
    if (trimmedName.isNotEmpty) {
      final parts = trimmedName.split(RegExp(r'\s+'));
      if (parts.length > 1 && parts[0].isNotEmpty && parts[1].isNotEmpty) {
        initials = '${parts[0][0]}${parts[1][0]}'.toUpperCase();
      } else {
        initials = trimmedName.substring(0, math.min(2, trimmedName.length)).toUpperCase();
      }
    } else {
      initials = 'FN';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: briCardBg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFCBD5E1), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        children: [
          // Avatar circle with corporate gradient and initials
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [briPrimary, briElectric],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: briPrimary.withValues(alpha: 0.25),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ],
            ),
            child: Center(
              child: Text(
                initials,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 15,
                  letterSpacing: 0.5,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // User Display Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(
                        displayName,
                        style: const TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          letterSpacing: -0.2,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 4),
                    const Icon(Icons.verified_rounded, color: briElectric, size: 14),
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  usernameText.isNotEmpty ? '@$usernameText • $roleText' : roleText,
                  style: const TextStyle(
                    color: Color(0xFF64748B),
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),

          const SizedBox(width: 8),

          // "Ganti Akun" action button
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: _showSwitchAccountSheet,
              borderRadius: BorderRadius.circular(10),
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: const Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.swap_horiz_rounded, color: briPrimary, size: 16),
                    SizedBox(width: 4),
                    Text(
                      'Ganti',
                      style: TextStyle(
                        color: briPrimary,
                        fontSize: 11.5,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── Switch Account Options BottomSheet ──
  void _showSwitchAccountSheet() {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return SafeArea(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: const Color(0xFFCBD5E1),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Kelola Akun Tersimpan',
                  style: TextStyle(
                    color: Color(0xFF0F172A),
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Akun aktif: ${_savedUser?.name ?? _rememberedUsername ?? "Pengguna"}',
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
                ),
                const SizedBox(height: 16),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFE0F2FE),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.switch_account_rounded, color: briPrimary),
                  ),
                  title: const Text(
                    'Masuk dengan Akun Lain',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                  ),
                  subtitle: const Text(
                    'Ketik username dan kata sandi baru secara manual',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  onTap: () {
                    Navigator.pop(ctx);
                    setState(() {
                      _isQuickSwitchMode = false;
                      _usernameController.clear();
                      _passwordController.clear();
                    });
                  },
                ),
                const Divider(height: 1, color: Color(0xFFF1F5F9)),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFEE2E2),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.delete_outline_rounded, color: Color(0xFFEF4444)),
                  ),
                  title: const Text(
                    'Hapus Akun dari Perangkat',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFFEF4444)),
                  ),
                  subtitle: const Text(
                    'Hapus profil tersimpan dan kredensial biometrik',
                    style: TextStyle(fontSize: 12, color: Color(0xFF64748B)),
                  ),
                  onTap: () async {
                    Navigator.pop(ctx);
                    final storage = StorageService();
                    await storage.setRememberedUsername(null);
                    await storage.clearLastSavedUser();
                    await storage.clearBiometricCredentials();
                    if (mounted) {
                      setState(() {
                        _savedUser = null;
                        _rememberedUsername = null;
                        _isQuickSwitchMode = false;
                        _hasBiometricSaved = false;
                        _usernameController.clear();
                        _passwordController.clear();
                      });
                      _showModernSnackBar(
                        title: 'Akun Dihapus',
                        message: 'Akun tersimpan telah dihapus dari perangkat ini.',
                        icon: Icons.delete_outline_rounded,
                        iconColor: const Color(0xFFEF4444),
                        badgeBgColor: const Color(0x26EF4444),
                      );
                    }
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // Default Mascot Hero Illustration
  Widget _buildDefaultHeroIllustration(double topPadding) {
    return Positioned(
      top: topPadding + 70,
      left: 0,
      right: 0,
      bottom: 6,
      child: AnimatedBuilder(
        animation: _floatController,
        builder: (context, _) {
          final floatOffset = math.sin(_floatController.value * math.pi) * 3.5;
          return Stack(
            alignment: Alignment.center,
            children: [
              // Central Mascot / Illustration
              Transform.translate(
                offset: Offset(0, floatOffset * 0.5),
                child: Image.asset(
                  'assets/images/fona_mascot_transparent.png',
                  height: 185,
                  fit: BoxFit.contain,
                  errorBuilder: (ctx, err, stack) => Image.asset(
                    'assets/images/fona_mascot.png',
                    height: 185,
                    fit: BoxFit.contain,
                    errorBuilder: (c, e, s) => Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        color: Colors.white.withValues(alpha: 0.15),
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(Icons.hub_rounded, size: 60, color: Colors.white),
                    ),
                  ),
                ),
              ),

              // Floating Squircle Badge 1: OLT / Redaman (Top-Left)
              Positioned(
                top: 16 - floatOffset,
                left: 32,
                child: _buildFloatingBadge(
                  icon: Icons.cell_tower_rounded,
                  iconColor: const Color(0xFF0284C7),
                  label: 'OLT',
                ),
              ),

              // Floating Squircle Badge 2: Ping / Speed (Top-Center-Left)
              Positioned(
                top: 2 + floatOffset,
                left: 105,
                child: _buildFloatingBadge(
                  icon: Icons.speed_rounded,
                  iconColor: const Color(0xFF2563EB),
                  label: 'Speed',
                ),
              ),

              // Floating Squircle Badge 3: Ticket / Gangguan (Top-Center-Right)
              Positioned(
                top: 4 - floatOffset,
                right: 100,
                child: _buildFloatingBadge(
                  icon: Icons.confirmation_number_rounded,
                  iconColor: const Color(0xFFEC4899),
                  label: 'Tiket',
                ),
              ),

              // Floating Squircle Badge 4: ODP / Map (Top-Right)
              Positioned(
                top: 20 + floatOffset,
                right: 28,
                child: _buildFloatingBadge(
                  icon: Icons.share_location_rounded,
                  iconColor: const Color(0xFF10B981),
                  label: 'ODP',
                ),
              ),

              // Floating Squircle Badge 5: Server Status (Bottom-Left)
              Positioned(
                bottom: 32 - floatOffset,
                left: 20,
                child: _buildFloatingBadge(
                  icon: Icons.dns_rounded,
                  iconColor: const Color(0xFF8B5CF6),
                  label: 'Server',
                ),
              ),

              // Floating Sparkles / Stars
              const Positioned(
                top: 38,
                right: 75,
                child: Text('✦', style: TextStyle(color: Colors.white, fontSize: 15)),
              ),
              const Positioned(
                top: 60,
                left: 85,
                child: Text('✦', style: TextStyle(color: Colors.white70, fontSize: 11)),
              ),
              const Positioned(
                bottom: 44,
                right: 36,
                child: Text('✦', style: TextStyle(color: Colors.white, fontSize: 13)),
              ),
            ],
          );
        },
      ),
    );
  }

  // Floating Squircle Badge Builder
  Widget _buildFloatingBadge({
    required IconData icon,
    required Color iconColor,
    required String label,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withValues(alpha: 0.8), width: 1.2),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF002758).withValues(alpha: 0.22),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: iconColor, size: 16),
          const SizedBox(width: 4),
          Text(
            label,
            style: const TextStyle(
              color: Color(0xFF0F172A),
              fontSize: 10.5,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }
}

/// ── BRImo Smooth Arc Curve Clipper ──
class _BriMoCurvedArcClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 40);

    // Smooth convex curve dipping gently down in the middle
    final firstControlPoint = Offset(size.width / 2, size.height + 20);
    final firstEndPoint = Offset(size.width, size.height - 40);

    path.quadraticBezierTo(
      firstControlPoint.dx,
      firstControlPoint.dy,
      firstEndPoint.dx,
      firstEndPoint.dy,
    );

    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(covariant CustomClipper<Path> oldClipper) => false;
}
