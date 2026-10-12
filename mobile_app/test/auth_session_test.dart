import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:fiber_unms_mobile/core/constants/api_constants.dart';
import 'package:fiber_unms_mobile/core/network/dio_client.dart';
import 'package:fiber_unms_mobile/core/storage/secure_storage_service.dart';
import 'package:fiber_unms_mobile/models/user_model.dart';
import 'package:fiber_unms_mobile/providers/auth_provider.dart';

class StubApi implements HttpClientAdapter {
  StubApi(this.reply);
  final Future<ResponseBody> Function(RequestOptions) reply;
  @override
  Future<ResponseBody> fetch(RequestOptions options,
      Stream<Uint8List>? requestStream, Future<void>? cancelFuture) => reply(options);
  @override
  void close({bool force = false}) {}
}

ResponseBody jsonReply(int status, Map<String, dynamic> data) =>
    ResponseBody.fromString(jsonEncode(data), status,
        headers: {Headers.contentTypeHeader: [Headers.jsonContentType]});

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  final serverUser = {'id': 7, 'name': 'Verified User', 'email': 'verified@example.test',
    'role': 'Teknisi Jointer', 'division': 'Test', 'status': 'Active'};

  setUp(() async {
    SharedPreferences.setMockInitialValues({ApiConstants.keyServerUrl: 'https://fona.example.test/api'});
    FlutterSecureStorage.setMockInitialValues({});
    await DioClient().init();
  });

  test('legacy server addresses migrate to the valid FONA HTTPS domain', () async {
    await StorageService().setServerUrl('https://fiber-monitoring.103.89.6.125.sslip.io/api');
    expect(await StorageService().getServerUrl(), ApiConstants.defaultBaseUrl);
    await StorageService().setServerUrl('103.89.6.125/api');
    expect(await StorageService().getServerUrl(), ApiConstants.defaultBaseUrl);
    expect(ApiConstants.defaultBaseUrl, 'https://fona.jasenardian.online/api');
    expect(DioClient.sanitizeUrl('other.example.test'), 'https://other.example.test/api');
    expect(DioClient.sanitizeUrl('http://other.example.test/api'), 'https://other.example.test/api');
    expect(DioClient().dio.options.followRedirects, false);
  });

  test('an accidental HTTP request is rejected before its credentials leave the client', () async {
    var sent = false;
    DioClient().dio.httpClientAdapter = StubApi((_) async {
      sent = true;
      return jsonReply(200, {});
    });
    await StorageService().saveToken('7|secret');
    await expectLater(DioClient().dio.get('http://unsafe.example.test/api/customers'),
        throwsA(isA<DioException>().having((e) => e.type, 'type', DioExceptionType.badCertificate)));
    await expectLater(DioClient().dio.get('https://foreign.example.test/api/customers'),
        throwsA(isA<DioException>()));
    expect(sent, false);
  });

  test('startup verifies the token and replaces the cached identity', () async {
    await StorageService().saveToken('7|valid-token');
    await StorageService().saveUser(UserModel.fromJson({...serverUser, 'name': 'Stale Admin', 'role': 'Super Administrator'}));
    var calls = 0;
    DioClient().dio.httpClientAdapter = StubApi((options) async {
      calls++;
      expect(options.path, ApiConstants.endpointMe);
      expect(options.headers['Authorization'], 'Bearer 7|valid-token');
      return jsonReply(200, {'user': serverUser});
    });
    final auth = AuthProvider();
    addTearDown(auth.dispose);
    await auth.initAuth();
    expect(calls, 1);
    expect(auth.currentUser?.name, 'Verified User');
    expect(auth.currentUser?.role, 'Teknisi Jointer');
  });

  test('an invalid stored token cannot authenticate using the cached profile', () async {
    await StorageService().saveToken('session_fake');
    await StorageService().saveUser(UserModel.fromJson(serverUser));
    DioClient().dio.httpClientAdapter = StubApi((_) async => jsonReply(401, {'message': 'Unauthenticated'}));
    final auth = AuthProvider();
    addTearDown(auth.dispose);
    await auth.initAuth();
    expect(auth.isAuthenticated, false);
    expect(await StorageService().getToken(), null);
  });

  test('connection failure does not promote cached identity or delete a valid token', () async {
    await StorageService().saveToken('7|valid-token');
    await StorageService().saveUser(UserModel.fromJson(serverUser));
    DioClient().dio.httpClientAdapter = StubApi((options) async =>
        throw DioException(requestOptions: options, type: DioExceptionType.connectionTimeout));
    final auth = AuthProvider();
    addTearDown(auth.dispose);
    await auth.initAuth();
    expect(auth.isAuthenticated, false);
    expect(await StorageService().getToken(), '7|valid-token');
  });

  test('protected request failure clears an authenticated session', () async {
    DioClient().dio.httpClientAdapter = StubApi((options) async =>
        options.path == ApiConstants.endpointLogin
            ? jsonReply(200, {'user': serverUser, 'token': '7|valid-token'})
            : jsonReply(401, {'message': 'Unauthenticated'}));
    final auth = AuthProvider();
    addTearDown(auth.dispose);
    expect(await auth.login('verified', 'secret123'), true);
    expect(auth.isAuthenticated, true);
    await expectLater(DioClient().dio.get('/customers'), throwsA(isA<DioException>()));
    expect(auth.isAuthenticated, false);
    expect(await StorageService().getToken(), null);
  });

  test('ordinary forbidden action preserves login but an inactive account expires it', () async {
    DioClient().dio.httpClientAdapter = StubApi((options) async {
      if (options.path == ApiConstants.endpointLogin) return jsonReply(200, {'user': serverUser, 'token': '7|valid-token'});
      return jsonReply(403, options.path == '/inactive'
          ? {'code': 'ACCOUNT_INACTIVE'} : {'message': 'Forbidden'});
    });
    final auth = AuthProvider();
    addTearDown(auth.dispose);
    await auth.login('verified', 'secret123');
    await expectLater(DioClient().dio.get('/users'), throwsA(isA<DioException>()));
    expect(auth.isAuthenticated, true);
    await expectLater(DioClient().dio.get('/inactive'), throwsA(isA<DioException>()));
    expect(auth.isAuthenticated, false);
  });
}
