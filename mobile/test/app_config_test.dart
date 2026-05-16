import 'package:afet_koordinasyon_mobile/config/app_config.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  test('Kayıtlı URL önceliklidir', () {
    expect(
      AppConfig.resolveInitialUrl('http://192.168.1.5:5173'),
      'http://192.168.1.5:5173',
    );
  });

  test('Kayıt yoksa varsayılan dev URL döner', () {
    final url = AppConfig.resolveInitialUrl(null);
    expect(url, isNotEmpty);
    expect(url.startsWith('http://'), isTrue);
  });
}
