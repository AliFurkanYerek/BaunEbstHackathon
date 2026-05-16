import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'screens/web_app_screen.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  runApp(const AfetKoordinasyonApp());
}

class AfetKoordinasyonApp extends StatelessWidget {
  const AfetKoordinasyonApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'sahAI',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF4f46e5),
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
      ),
      home: const WebAppScreen(),
    );
  }
}
