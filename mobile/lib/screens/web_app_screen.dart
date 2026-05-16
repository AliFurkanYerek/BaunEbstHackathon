import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:webview_flutter_android/webview_flutter_android.dart';

import '../config/app_config.dart';
import '../services/permissions_service.dart';
import '../widgets/emergency_siren_bar.dart';
import 'emergency_siren_screen.dart';
import 'url_settings_sheet.dart';

class WebAppScreen extends StatefulWidget {
  const WebAppScreen({super.key});

  @override
  State<WebAppScreen> createState() => _WebAppScreenState();
}

class _WebAppScreenState extends State<WebAppScreen> {
  WebViewController? _controller;
  String _currentUrl = '';
  bool _loading = true;
  bool _hasError = false;
  String? _errorMessage;
  int _progress = 0;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  Future<void> _bootstrap() async {
    await requestWebAppPermissions();
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(AppConfig.prefsKeyWebUrl);
    final url = AppConfig.resolveInitialUrl(saved);
    if (!mounted) return;
    setState(() => _currentUrl = url);
    await _initController(url);
  }

  Future<void> _initController(String url) async {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(const Color(0xFF0f172a))
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (p) {
            if (!mounted) return;
            setState(() {
              _progress = p;
              _loading = p < 100;
            });
          },
          onPageStarted: (_) {
            if (!mounted) return;
            setState(() {
              _loading = true;
              _hasError = false;
              _errorMessage = null;
            });
          },
          onPageFinished: (_) {
            if (!mounted) return;
            setState(() => _loading = false);
          },
          onWebResourceError: (err) {
            if (!mounted) return;
            setState(() {
              _hasError = true;
              _loading = false;
              _errorMessage = err.description;
            });
          },
        ),
      );

    final platform = controller.platform;
    if (platform is AndroidWebViewController) {
      await platform.setMediaPlaybackRequiresUserGesture(false);
      await platform.setOnShowFileSelector(_androidFilePicker);
    }

    await controller.loadRequest(Uri.parse(url));

    if (!mounted) return;
    setState(() {
      _controller = controller;
      _currentUrl = url;
      _hasError = false;
    });
  }

  Future<void> _reloadWithUrl(String url) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConfig.prefsKeyWebUrl, url);
    setState(() {
      _controller = null;
      _currentUrl = url;
      _hasError = false;
      _loading = true;
    });
    await _initController(url);
  }

  Future<List<String>> _androidFilePicker(FileSelectorParams params) async {
    final allowMultiple = params.mode == FileSelectorMode.openMultiple;
    final result = await FilePicker.platform.pickFiles(
      allowMultiple: allowMultiple,
      type: FileType.image,
    );
    if (result == null || result.files.isEmpty) return [];
    return result.files
        .where((f) => f.path != null)
        .map((f) => Uri.file(f.path!).toString())
        .toList();
  }

  Future<void> _openSettings() async {
    final next = await showUrlSettingsSheet(context, currentUrl: _currentUrl);
    if (next != null && next != _currentUrl) {
      await _reloadWithUrl(next);
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = _controller;

    return Scaffold(
      appBar: AppBar(
        title: const Text('AfetKoordinasyon AI'),
        backgroundColor: const Color(0xFF1e293b),
        foregroundColor: Colors.white,
        actions: [
          IconButton(
            tooltip: 'Yenile',
            onPressed: controller == null
                ? null
                : () => controller.reload(),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Acil ses / düdük (internetsiz)',
            onPressed: () {
              Navigator.of(context).push(
                MaterialPageRoute<void>(
                  builder: (_) => const EmergencySirenScreen(),
                  fullscreenDialog: true,
                ),
              );
            },
            icon: const Icon(Icons.campaign, color: Colors.amber),
          ),
          IconButton(
            tooltip: 'Sunucu adresi',
            onPressed: _openSettings,
            icon: const Icon(Icons.settings),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: SafeArea(
              bottom: false,
              child: controller == null
                  ? const Center(child: CircularProgressIndicator())
                  : Stack(
                      children: [
                        WebViewWidget(controller: controller),
                        if (_loading && _progress < 100)
                          LinearProgressIndicator(
                            value: _progress / 100,
                            minHeight: 3,
                            backgroundColor: Colors.transparent,
                          ),
                        if (_hasError)
                          _ErrorOverlay(
                            message: _errorMessage,
                            url: _currentUrl,
                            onRetry: () => controller.reload(),
                            onSettings: _openSettings,
                          ),
                      ],
                    ),
            ),
          ),
          const EmergencySirenBar(),
        ],
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({
    required this.url,
    required this.onRetry,
    required this.onSettings,
    this.message,
  });

  final String url;
  final String? message;
  final VoidCallback onRetry;
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: const Color(0xFF0f172a),
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off, size: 48, color: Colors.white70),
              const SizedBox(height: 16),
              Text(
                'Web uygulamasına bağlanılamadı',
                style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                message ?? 'Sunucunun çalıştığından ve adresin doğru olduğundan emin olun.',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white70,
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                url,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white54,
                      fontFamily: 'monospace',
                    ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 24),
              FilledButton.icon(
                onPressed: onRetry,
                icon: const Icon(Icons.refresh),
                label: const Text('Tekrar dene'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: onSettings,
                child: const Text('Sunucu adresini değiştir'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
