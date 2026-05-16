import 'dart:io' show Platform;

import 'package:flutter/foundation.dart' show kIsWeb;

/// Web uygulamasının yükleneceği adres.
/// Derleme: --dart-define=WEB_APP_URL=http://192.168.1.10:5173
/// Boş bırakılırsa platform varsayılanı + SharedPreferences kaydı kullanılır.
class AppConfig {
  static const String webAppUrlFromDefine = String.fromEnvironment(
    'WEB_APP_URL',
    defaultValue: '',
  );

  static const String prefsKeyWebUrl = 'web_app_url';

  static String defaultDevUrl() {
    if (kIsWeb) return 'http://localhost:5173';
    if (!kIsWeb && Platform.isAndroid) return 'http://10.0.2.2:5173';
    if (!kIsWeb && Platform.isIOS) return 'http://127.0.0.1:5173';
    return 'http://localhost:5173';
  }

  static String resolveInitialUrl(String? savedUrl) {
    if (webAppUrlFromDefine.isNotEmpty) return webAppUrlFromDefine;
    if (savedUrl != null && savedUrl.trim().isNotEmpty) return savedUrl.trim();
    return defaultDevUrl();
  }
}
