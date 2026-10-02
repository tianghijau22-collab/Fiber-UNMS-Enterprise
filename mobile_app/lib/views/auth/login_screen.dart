import 'package:flutter/material.dart';
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
  bool _obscurePassword = true;
  bool _rememberMe = false;
  bool _agreedToTerms = true;
  bool _isRedirecting = false;

  late AnimationController _pulseController;

  @override
  void initState() {
    super.initState();
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2400),
    )..repeat();
  }

  @override
  void dispose() {
    _pulseController.dispose();
    _usernameController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  void _handleLogin() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Silakan centang persetujuan syarat & ketentuan terlebih dahulu.'),
          backgroundColor: AppColors.warning,
        ),
      );
      return;
    }

    final authProvider = Provider.of<AuthProvider>(context, listen: false);
    final success = await authProvider.login(
      _usernameController.text.trim(),
      _passwordController.text,
    );

    if (success && mounted) {
      setState(() => _isRedirecting = true);
      await Future.delayed(const Duration(milliseconds: 650));
      if (!mounted) return;

      Navigator.of(context).pushReplacement(
        PageRouteBuilder(
          transitionDuration: const Duration(milliseconds: 700),
          pageBuilder: (context, animation, secondaryAnimation) => const MainNavigationShell(),
          transitionsBuilder: (context, animation, secondaryAnimation, child) {
            final curved = CurvedAnimation(parent: animation, curve: Curves.easeOutQuart);
            return FadeTransition(
              opacity: Tween<double>(begin: 0.0, end: 1.0).animate(curved),
              child: SlideTransition(
                position: Tween<Offset>(begin: const Offset(0, 0.05), end: Offset.zero).animate(curved),
                child: child,
              ),
            );
          },
        ),
      );
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
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Row(
          children: [
            Icon(Icons.dns_rounded, color: Color(0xFF00AAE0), size: 22),
            SizedBox(width: 8),
            Text(
              'Konfigurasi Server URL',
              style: TextStyle(color: Color(0xFF0F172A), fontSize: 17, fontWeight: FontWeight.bold),
            ),
          ],
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Masukkan alamat API backend server FONA:',
              style: TextStyle(color: Color(0xFF64748B), fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: urlController,
              style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14),
              decoration: InputDecoration(
                hintText: 'http://103.89.6.125/api',
                hintStyle: const TextStyle(color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Batal', style: TextStyle(color: Color(0xFF64748B))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF00AAE0),
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
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
                    content: Text('Server URL diubah: ${DioClient().dio.options.baseUrl}'),
                    backgroundColor: AppColors.success,
                  ),
                );
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

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        actions: [
          IconButton(
            icon: Container(
              padding: const EdgeInsets.all(7),
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: const Icon(Icons.settings_outlined, color: Color(0xFF64748B), size: 19),
            ),
            tooltip: 'Server Setting',
            onPressed: _showServerSettingsDialog,
          ),
          const SizedBox(width: 14),
        ],
      ),
      body: Stack(
        children: [
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 4.0),
                child: Form(
                  key: _formKey,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // ── Network Topology Card (OLT ➔ ODC ➔ ODP ➔ ONT) ──
                      _buildNetworkTopologyCard(),

                      const SizedBox(height: 18),

                      // ── Official FONA Brand Logo Header ──
                      Center(
                        child: Container(
                          constraints: const BoxConstraints(maxWidth: 290),
                          child: Image.asset(
                            'assets/images/fona_brand_v2.png',
                            height: 135,
                            fit: BoxFit.contain,
                            filterQuality: FilterQuality.high,
                            errorBuilder: (ctx, err, stack) => Image.asset(
                              'assets/images/fona_logo.png',
                              height: 135,
                              fit: BoxFit.contain,
                              errorBuilder: (c, e, s) => const Icon(
                                Icons.hub_rounded,
                                size: 68,
                                color: Color(0xFF00AAE0),
                              ),
                            ),
                          ),
                        ),
                      ),

                      const SizedBox(height: 16),

                      // ── Greeting Title: Hai, Sobat FONA! 👋 ──
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            'Hai, Sobat FONA!',
                            style: TextStyle(
                              color: Color(0xFF0F172A),
                              fontSize: 19,
                              fontWeight: FontWeight.w800,
                              letterSpacing: -0.2,
                            ),
                          ),
                          SizedBox(width: 6),
                          Text('👋', style: TextStyle(fontSize: 19)),
                        ],
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Masuk ke portal operasional FONA Mobile',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          color: Color(0xFF64748B),
                          fontSize: 12.5,
                          fontWeight: FontWeight.w500,
                        ),
                      ),

                      const SizedBox(height: 22),

                      // Error Banner
                      if (auth.errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.dangerLight,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.error_outline_rounded, color: AppColors.danger, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  auth.errorMessage!,
                                  style: const TextStyle(color: AppColors.danger, fontSize: 12.5, fontWeight: FontWeight.w600),
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // ── Username Field ──
                      const Text(
                        'Username',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _usernameController,
                        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w600),
                        decoration: InputDecoration(
                          hintText: 'Username Petugas',
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13.5),
                          prefixIcon: const Icon(Icons.person_outline_rounded, color: Color(0xFF94A3B8), size: 20),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        ),
                        validator: (v) => (v == null || v.trim().isEmpty) ? 'Masukkan username Anda' : null,
                      ),

                      const SizedBox(height: 14),

                      // ── Password Field ──
                      const Text(
                        'Kata Sandi',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: const TextStyle(color: Color(0xFF0F172A), fontSize: 14, fontWeight: FontWeight.w600),
                        decoration: InputDecoration(
                          hintText: 'Masukkan kata sandi',
                          hintStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 13.5),
                          prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF94A3B8), size: 20),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                              color: const Color(0xFF94A3B8),
                              size: 20,
                            ),
                            onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                          ),
                          filled: true,
                          fillColor: const Color(0xFFF8FAFC),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFFE2E8F0)),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF00AAE0), width: 1.5),
                          ),
                          contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                        ),
                        validator: (v) => (v == null || v.isEmpty) ? 'Masukkan kata sandi Anda' : null,
                      ),

                      const SizedBox(height: 12),

                      // ── Remember Me & Forgot Password Row ──
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          InkWell(
                            onTap: () => setState(() => _rememberMe = !_rememberMe),
                            child: Row(
                              children: [
                                SizedBox(
                                  height: 20,
                                  width: 20,
                                  child: Checkbox(
                                    value: _rememberMe,
                                    onChanged: (val) => setState(() => _rememberMe = val ?? false),
                                    activeColor: const Color(0xFF00AAE0),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                  ),
                                ),
                                const SizedBox(width: 8),
                                const Text(
                                  'Ingat Saya',
                                  style: TextStyle(color: Color(0xFF64748B), fontSize: 12.5, fontWeight: FontWeight.w500),
                                ),
                              ],
                            ),
                          ),
                          TextButton(
                            onPressed: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('Silakan hubungi Administrator untuk reset kata sandi.'),
                                  backgroundColor: Color(0xFF00AAE0),
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
                                color: Color(0xFF00AAE0),
                                fontSize: 12.5,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 14),

                      // ── Terms & Conditions Checkbox ──
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SizedBox(
                            height: 20,
                            width: 20,
                            child: Checkbox(
                              value: _agreedToTerms,
                              onChanged: (val) => setState(() => _agreedToTerms = val ?? true),
                              activeColor: const Color(0xFF00AAE0),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: RichText(
                              text: const TextSpan(
                                style: TextStyle(color: Color(0xFF64748B), fontSize: 11, height: 1.3),
                                children: [
                                  TextSpan(text: 'Dengan masuk ke sistem, Anda menyetujui '),
                                  TextSpan(
                                    text: 'Syarat & Ketentuan',
                                    style: TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.w600),
                                  ),
                                  TextSpan(text: ' serta '),
                                  TextSpan(
                                    text: 'Kebijakan Keamanan Jaringan',
                                    style: TextStyle(color: Color(0xFF00AAE0), fontWeight: FontWeight.w600),
                                  ),
                                  TextSpan(text: ' FONA.'),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),

                      const SizedBox(height: 20),

                      // ── Solid Main Action Button (#00AAE0) ──
                      ElevatedButton(
                        onPressed: (auth.isLoading || _isRedirecting) ? null : _handleLogin,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF00AAE0),
                          disabledBackgroundColor: const Color(0xFF00AAE0).withValues(alpha: 0.6),
                          elevation: 0,
                          shadowColor: Colors.transparent,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: auth.isLoading
                            ? const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  SizedBox(
                                    height: 18,
                                    width: 18,
                                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.0),
                                  ),
                                  SizedBox(width: 10),
                                  Text(
                                    'Memverifikasi...',
                                    style: TextStyle(color: Colors.white, fontSize: 14.5, fontWeight: FontWeight.w700),
                                  ),
                                ],
                              )
                            : const Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  Text(
                                    'Masuk ke Sistem',
                                    style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 15,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Icon(Icons.arrow_forward_rounded, color: Colors.white, size: 18),
                                ],
                              ),
                      ),

                      const SizedBox(height: 12),

                      // ── Biometric Login Secondary Button ──
                      OutlinedButton(
                        onPressed: () {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Autentikasi Biometrik siap digunakan setelah login pertama kali.'),
                              backgroundColor: Color(0xFF00AAE0),
                            ),
                          );
                        },
                        style: OutlinedButton.styleFrom(
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          side: const BorderSide(color: Color(0xFFE2E8F0)),
                          backgroundColor: Colors.white,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                        ),
                        child: const Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.fingerprint_rounded, color: Color(0xFF00AAE0), size: 20),
                            SizedBox(width: 8),
                            Text(
                              'Masuk dengan Sidik Jari / Face ID',
                              style: TextStyle(
                                color: Color(0xFF0F172A),
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: 20),
                      const Divider(color: Color(0xFFE2E8F0), height: 1),
                      const SizedBox(height: 14),

                      // ── Footer: Version & 256-Bit SSL ──
                      const Text(
                        'FONA Mobile Enterprise • v2.4.0 (Build 2026)',
                        textAlign: TextAlign.center,
                        style: TextStyle(color: Color(0xFF64748B), fontSize: 11, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 4),
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.lock_rounded, color: Color(0xFF10B981), size: 12),
                          SizedBox(width: 4),
                          Text(
                            '256-Bit SSL End-to-End Encrypted',
                            style: TextStyle(color: Color(0xFF94A3B8), fontSize: 10.5, fontWeight: FontWeight.w500),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),
                    ],
                  ),
                ),
              ),
            ),
          ),

          // ── Full-Screen Loading Transition Overlay ──
          if (_isRedirecting)
            Positioned.fill(
              child: Container(
                color: Colors.white.withValues(alpha: 0.94),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE0F7FE),
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFFBAE6FD)),
                        ),
                        child: const Icon(
                          Icons.check_circle_rounded,
                          size: 48,
                          color: Color(0xFF00AAE0),
                        ),
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'Autentikasi Berhasil',
                        style: TextStyle(
                          color: Color(0xFF0F172A),
                          fontSize: 16,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Mempersiapkan dasbor operasional...',
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
                            valueColor: AlwaysStoppedAnimation<Color>(Color(0xFF00AAE0)),
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

  /// ── Network Topology Card Builder (OLT ➔ ODC ➔ ODP ➔ ONT) ──
  Widget _buildNetworkTopologyCard() {
    return Container(
      width: double.infinity,
      height: 140,
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4).withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE0F2FE)),
        gradient: LinearGradient(
          colors: [
            const Color(0xFFE0F7FE).withValues(alpha: 0.4),
            const Color(0xFFF8FAFC),
            const Color(0xFFE0F7FE).withValues(alpha: 0.3),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Animated Stream Canvas with Dot Grid Background
          AnimatedBuilder(
            animation: _pulseController,
            builder: (context, child) {
              return CustomPaint(
                size: const Size(double.infinity, 140),
                painter: _TopologicalTransmissionPainter(
                  progress: _pulseController.value,
                ),
              );
            },
          ),

          // Foreground 4 Interactive Network Topology Nodes
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Node 1: OLT (Rack Server)
                _buildNodeWidget(
                  label: 'OLT',
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(10),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0F172A).withValues(alpha: 0.2),
                          blurRadius: 5,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(width: 3.5, height: 3.5, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                            const SizedBox(width: 2.5),
                            Container(width: 3.5, height: 3.5, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                            const SizedBox(width: 2.5),
                            Container(width: 3.5, height: 3.5, decoration: const BoxDecoration(color: Color(0xFF00AAE0), shape: BoxShape.circle)),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Container(width: 24, height: 2, color: const Color(0xFF334155)),
                        const SizedBox(height: 2.5),
                        Container(width: 24, height: 2, color: const Color(0xFF334155)),
                      ],
                    ),
                  ),
                ),

                // Node 2: ODC (Outdoor Cabinet Pillar)
                _buildNodeWidget(
                  label: 'ODC',
                  child: Container(
                    width: 42,
                    height: 42,
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF0284C7), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF0284C7).withValues(alpha: 0.15),
                          blurRadius: 5,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 22,
                          height: 4,
                          decoration: BoxDecoration(
                            color: const Color(0xFF38BDF8),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFF38BDF8), shape: BoxShape.circle)),
                            const SizedBox(width: 2),
                            Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                            const SizedBox(width: 2),
                            Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFFF59E0B), shape: BoxShape.circle)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // Node 3: ODP (Distribution Closure Box)
                _buildNodeWidget(
                  label: 'ODP',
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFF00AAE0), width: 1.8),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00AAE0).withValues(alpha: 0.15),
                          blurRadius: 6,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          width: 26,
                          height: 14,
                          decoration: BoxDecoration(
                            color: const Color(0xFF0F172A),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFF00AAE0), shape: BoxShape.circle)),
                              const SizedBox(width: 5),
                              Container(width: 3, height: 3, decoration: const BoxDecoration(color: Color(0xFF00AAE0), shape: BoxShape.circle)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 3),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(width: 2.5, height: 2.5, decoration: const BoxDecoration(color: Color(0xFF10B981), shape: BoxShape.circle)),
                            const SizedBox(width: 1.5),
                            Container(width: 2.5, height: 2.5, decoration: const BoxDecoration(color: Color(0xFF00AAE0), shape: BoxShape.circle)),
                            const SizedBox(width: 1.5),
                            Container(width: 2.5, height: 2.5, decoration: const BoxDecoration(color: Color(0xFF00AAE0), shape: BoxShape.circle)),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // Node 4: ONT (Customer Optical Modem)
                _buildNodeWidget(
                  label: 'ONT',
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF00AAE0), width: 1.4),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF00AAE0).withValues(alpha: 0.1),
                          blurRadius: 5,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        Positioned(
                          top: -2,
                          child: Container(
                            width: 12,
                            height: 4,
                            decoration: const BoxDecoration(
                              color: Color(0xFF00AAE0),
                              borderRadius: BorderRadius.vertical(top: Radius.circular(6)),
                            ),
                          ),
                        ),
                        const Icon(Icons.wifi_rounded, color: Color(0xFF00AAE0), size: 20),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNodeWidget({required String label, required Widget child}) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        child,
        const SizedBox(height: 5),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF00AAE0),
            fontSize: 9.5,
            fontWeight: FontWeight.w800,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

/// Dynamic Topological Path & Light Stream Laser Pulse Painter (OLT ➔ ODC ➔ ODP ➔ ONT)
class _TopologicalTransmissionPainter extends CustomPainter {
  final double progress;

  _TopologicalTransmissionPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    // 1. Draw subtle background dot grid
    final dotPaint = Paint()
      ..color = const Color(0xFF94A3B8).withValues(alpha: 0.18)
      ..style = PaintingStyle.fill;

    for (double x = 14; x < w; x += 14) {
      for (double y = 12; y < h; y += 12) {
        canvas.drawCircle(Offset(x, y), 0.85, dotPaint);
      }
    }

    // 2. Optical Fiber Connecting Cable Path (4 Nodes: 12%, 37%, 63%, 88%)
    final p1 = Offset(w * 0.12, h * 0.40);
    final p2 = Offset(w * 0.37, h * 0.40);
    final p3 = Offset(w * 0.63, h * 0.40);
    final p4 = Offset(w * 0.88, h * 0.40);

    final linePaint = Paint()
      ..color = const Color(0xFFCBD5E1)
      ..strokeWidth = 2.0
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final path = Path()
      ..moveTo(p1.dx, p1.dy)
      ..cubicTo(w * 0.22, h * 0.35, w * 0.27, h * 0.45, p2.dx, p2.dy)
      ..cubicTo(w * 0.48, h * 0.35, w * 0.52, h * 0.45, p3.dx, p3.dy)
      ..cubicTo(w * 0.73, h * 0.35, w * 0.78, h * 0.45, p4.dx, p4.dy);

    canvas.drawPath(path, linePaint);

    // 3. Moving Laser Pulse Photons (Cyan Light Beams)
    final metrics = path.computeMetrics().toList();
    if (metrics.isNotEmpty) {
      final metric = metrics.first;
      final totalLength = metric.length;

      for (int i = 0; i < 3; i++) {
        final curProgress = (progress + (i * 0.33)) % 1.0;
        final dist = curProgress * totalLength;
        final tangent = metric.getTangentForOffset(dist);

        if (tangent != null) {
          final pos = tangent.position;

          // Glowing Aura
          final auraPaint = Paint()
            ..color = const Color(0xFF00AAE0).withValues(alpha: 0.40)
            ..style = PaintingStyle.fill;
          canvas.drawCircle(pos, 7.5, auraPaint);

          // Solid Photon Beam
          final beamPaint = Paint()
            ..color = const Color(0xFF00AAE0)
            ..style = PaintingStyle.fill;
          canvas.drawCircle(pos, 3.8, beamPaint);

          // Pure White Hot Center
          final centerSpark = Paint()
            ..color = Colors.white
            ..style = PaintingStyle.fill;
          canvas.drawCircle(pos, 1.6, centerSpark);
        }
      }
    }
  }

  @override
  bool shouldRepaint(covariant _TopologicalTransmissionPainter oldDelegate) =>
      oldDelegate.progress != progress;
}
