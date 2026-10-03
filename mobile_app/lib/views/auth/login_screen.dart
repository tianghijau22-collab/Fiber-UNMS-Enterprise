import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:local_auth/local_auth.dart';
import 'package:provider/provider.dart';
import '../../core/constants/app_colors.dart';
import '../../core/network/dio_client.dart';
import '../../core/storage/secure_storage_service.dart';
import '../../providers/auth_provider.dart';
import '../main_navigation_shell.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> with SingleTickerProviderStateMixin {
  final _formKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final LocalAuthentication _localAuth = LocalAuthentication();

  bool _obscurePassword = true;
  bool _rememberMe = true;
  bool _isRedirecting = false;
  bool _hasBiometricSaved = false;

  // Dynamic Background Banner from Web Admin
  String? _customBannerUrl;

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

    _loadSavedState();
    _fetchLoginBanner();
  }

  @override
  void dispose() {
    _floatController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _loadSavedState() async {
    final storage = StorageService();
    final remembered = await storage.getRememberedUsername();
    final bioCreds = await storage.getBiometricCredentials();

    if (mounted) {
      setState(() {
        if (remembered != null && remembered.isNotEmpty) {
          _usernameController.text = remembered;
          _rememberMe = true;
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
          if (mounted) {
            setState(() {
              _customBannerUrl = data['banner_url'].toString();
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
    final password = _passwordController.text;

    final success = await authProvider.login(username, password);

    if (success && mounted) {
      final storage = StorageService();
      // 1. Handle Remember Me
      if (_rememberMe) {
        await storage.setRememberedUsername(username);
      } else {
        await storage.setRememberedUsername(null);
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
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Perangkat tidak mendukung sensor biometrik/sidik jari.'),
              backgroundColor: Color(0xFFEF4444),
            ),
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
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Autentikasi biometrik dibatalkan: $e'),
            backgroundColor: const Color(0xFFEF4444),
          ),
        );
      }
    }
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
              'Alamat API backend server Fiber-UNMS:',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlController,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 13.5, fontWeight: FontWeight.w600),
              decoration: InputDecoration(
                hintText: 'http://103.89.6.125/api',
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
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Server URL berhasil diubah: ${DioClient().dio.options.baseUrl}'),
                    backgroundColor: const Color(0xFF10B981),
                  ),
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
                            // If Custom Banner is Set from Web Admin, render it
                            if (_customBannerUrl != null) ...[
                              Image.network(
                                _customBannerUrl!,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                height: double.infinity,
                                errorBuilder: (ctx, err, stack) => _buildDefaultHeroIllustration(topPadding),
                              ),
                              // Subtle dark overlay to ensure top text readability
                              Container(
                                decoration: BoxDecoration(
                                  gradient: LinearGradient(
                                    colors: [
                                      Colors.black.withValues(alpha: 0.5),
                                      Colors.black.withValues(alpha: 0.15),
                                      Colors.black.withValues(alpha: 0.45),
                                    ],
                                    begin: Alignment.topCenter,
                                    end: Alignment.bottomCenter,
                                  ),
                                ),
                              ),
                            ] else ...[
                              // Ambient Radial Glow Circles
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
                            ],

                            // Header Controls (Server Endpoint Setting)
                            Positioned(
                              top: topPadding + 6,
                              right: 18,
                              child: Material(
                                color: Colors.transparent,
                                child: InkWell(
                                  onTap: _showServerSettingsDialog,
                                  borderRadius: BorderRadius.circular(20),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: Colors.white.withValues(alpha: 0.22),
                                      borderRadius: BorderRadius.circular(20),
                                      border: Border.all(color: Colors.white.withValues(alpha: 0.35)),
                                    ),
                                    child: const Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.tune_rounded, color: Colors.white, size: 14),
                                        SizedBox(width: 5),
                                        Text(
                                          'Server',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 11,
                                            fontWeight: FontWeight.w700,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),

                            // Top Brand & "Halo !" Greeting
                            Positioned(
                              top: topPadding + 10,
                              left: 0,
                              right: 0,
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  // FONA Wordmark Brand Logo
                                  Image.asset(
                                    'assets/images/fona_wordmark_light.png',
                                    height: 32,
                                    fit: BoxFit.contain,
                                    errorBuilder: (ctx, err, stack) => Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Image.asset('assets/images/fona_brand_v2.png', height: 26, errorBuilder: (c, e, s) => const SizedBox()),
                                        const SizedBox(width: 6),
                                        const Text(
                                          'FONA',
                                          style: TextStyle(
                                            color: Colors.white,
                                            fontSize: 20,
                                            fontWeight: FontWeight.w900,
                                            letterSpacing: 1.2,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  const Text(
                                    'Halo !',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 24,
                                      fontWeight: FontWeight.w900,
                                      letterSpacing: -0.4,
                                    ),
                                  ),
                                ],
                              ),
                            ),
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
                        const Text(
                          'Masuk ke Akun Petugas',
                          style: TextStyle(
                            color: Color(0xFF0F172A),
                            fontSize: 18,
                            fontWeight: FontWeight.w800,
                            letterSpacing: -0.3,
                          ),
                        ),
                        const SizedBox(height: 3),
                        const Text(
                          'Gunakan username & kata sandi UNMS Anda',
                          style: TextStyle(
                            color: Color(0xFF64748B),
                            fontSize: 12.5,
                          ),
                        ),

                        const SizedBox(height: 18),

                        // Error Banner
                        if (auth.errorMessage != null) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                            decoration: BoxDecoration(
                              color: const Color(0xFFFEF2F2),
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: const Color(0xFFFCA5A5)),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 18),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    auth.errorMessage!,
                                    style: const TextStyle(color: AppColors.danger, fontSize: 12, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 14),
                        ],

                        // ── Username Input Field ──
                        const Text(
                          'Username',
                          style: TextStyle(color: Color(0xFF1E293B), fontSize: 12.5, fontWeight: FontWeight.w700),
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
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Silakan hubungi Superadmin NOC untuk mereset kata sandi.'),
                                    backgroundColor: briPrimary,
                                  ),
                                );
                              },
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
                              'Butuh bantuan akses? ',
                              style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                            ),
                            InkWell(
                              onTap: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Hubungi Tim NOC Pusat atau IT Support.'),
                                    backgroundColor: briPrimary,
                                  ),
                                );
                              },
                              child: const Text(
                                'Hubungi NOC',
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

                        // SSL Security Footnote
                        const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.lock_outline_rounded, color: Color(0xFF10B981), size: 12),
                            SizedBox(width: 4),
                            Text(
                              'FONA Enterprise v1.0.4 • 256-Bit Encrypted',
                              style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5, fontWeight: FontWeight.w600),
                            ),
                          ],
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
        ],
      ),
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
