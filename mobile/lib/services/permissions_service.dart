import 'package:permission_handler/permission_handler.dart';

/// Harita, konum ve fotoğraf yükleme için WebView izinleri.
Future<void> requestWebAppPermissions() async {
  await [
    Permission.locationWhenInUse,
    Permission.camera,
    Permission.photos,
  ].request();
}
