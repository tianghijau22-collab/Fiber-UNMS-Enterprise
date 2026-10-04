import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../constants/api_constants.dart';
import '../../models/user_model.dart';

class StorageService {
  static final StorageService _instance = StorageService._internal();
  factory StorageService() => _instance;
  StorageService._internal();

  final FlutterSecureStorage _secureStorage = const FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const String keyRememberedUser = 'fona_remembered_username';
  static const String keyBiometricUser = 'fona_biometric_username';
  static const String keyBiometricPass = 'fona_biometric_password';
  static const String keyBiometricEnabled = 'fona_biometric_enabled';

  // --- Server Base URL ---
  Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(ApiConstants.keyServerUrl);
    if (saved == null || saved.isEmpty || (saved.contains('103.89.6.125') && !saved.contains('sslip.io'))) {
      return ApiConstants.defaultBaseUrl;
    }
    return saved;
  }

  Future<void> setServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConstants.keyServerUrl, url.trim());
  }

  // --- Remember Me ---
  Future<String?> getRememberedUsername() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyRememberedUser);
  }

  Future<void> setRememberedUsername(String? username) async {
    final prefs = await SharedPreferences.getInstance();
    if (username != null && username.isNotEmpty) {
      await prefs.setString(keyRememberedUser, username);
    } else {
      await prefs.remove(keyRememberedUser);
    }
  }

  // --- Biometric Authentication Credentials ---
  Future<void> saveBiometricCredentials(String username, String password) async {
    await _secureStorage.write(key: keyBiometricUser, value: username);
    await _secureStorage.write(key: keyBiometricPass, value: password);
    await _secureStorage.write(key: keyBiometricEnabled, value: 'true');
  }

  Future<Map<String, String>?> getBiometricCredentials() async {
    final isEnabled = await _secureStorage.read(key: keyBiometricEnabled);
    if (isEnabled != 'true') return null;

    final user = await _secureStorage.read(key: keyBiometricUser);
    final pass = await _secureStorage.read(key: keyBiometricPass);

    if (user != null && pass != null && user.isNotEmpty && pass.isNotEmpty) {
      return {'username': user, 'password': pass};
    }
    return null;
  }

  Future<void> clearBiometricCredentials() async {
    await _secureStorage.delete(key: keyBiometricUser);
    await _secureStorage.delete(key: keyBiometricPass);
    await _secureStorage.delete(key: keyBiometricEnabled);
  }

  // --- Auth Token ---
  Future<String?> getToken() async {
    return await _secureStorage.read(key: ApiConstants.keyAuthToken);
  }

  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: ApiConstants.keyAuthToken, value: token);
  }

  static const String keyLastSavedUser = 'fona_last_saved_user';

  // --- User Profile ---
  Future<UserModel?> getUser() async {
    final userJson = await _secureStorage.read(key: ApiConstants.keyUserData);
    if (userJson == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(userJson));
    } catch (_) {
      return null;
    }
  }

  Future<void> saveUser(UserModel user) async {
    await _secureStorage.write(
      key: ApiConstants.keyUserData,
      value: jsonEncode(user.toJson()),
    );
    await saveLastSavedUser(user);
  }

  // --- Last Saved User for Quick Switch ---
  Future<UserModel?> getLastSavedUser() async {
    final userJson = await _secureStorage.read(key: keyLastSavedUser);
    if (userJson == null) return null;
    try {
      return UserModel.fromJson(jsonDecode(userJson));
    } catch (_) {
      return null;
    }
  }

  Future<void> saveLastSavedUser(UserModel user) async {
    await _secureStorage.write(
      key: keyLastSavedUser,
      value: jsonEncode(user.toJson()),
    );
  }

  Future<void> clearLastSavedUser() async {
    await _secureStorage.delete(key: keyLastSavedUser);
  }

  // --- Clear Session ---
  Future<void> clearSession() async {
    await _secureStorage.delete(key: ApiConstants.keyAuthToken);
    await _secureStorage.delete(key: ApiConstants.keyUserData);
  }
}
