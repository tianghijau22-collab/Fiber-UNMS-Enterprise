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

  // --- Server Base URL ---
  Future<String> getServerUrl() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(ApiConstants.keyServerUrl) ?? ApiConstants.defaultBaseUrl;
  }

  Future<void> setServerUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(ApiConstants.keyServerUrl, url.trim());
  }

  // --- Auth Token ---
  Future<String?> getToken() async {
    return await _secureStorage.read(key: ApiConstants.keyAuthToken);
  }

  Future<void> saveToken(String token) async {
    await _secureStorage.write(key: ApiConstants.keyAuthToken, value: token);
  }

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
  }

  // --- Clear Session ---
  Future<void> clearSession() async {
    await _secureStorage.delete(key: ApiConstants.keyAuthToken);
    await _secureStorage.delete(key: ApiConstants.keyUserData);
  }
}
