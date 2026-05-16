import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../services/emergency_siren_service.dart';
import '../services/permissions_service.dart';

/// Tam ekran acil düdük / flaşör — internetsiz.
class EmergencySirenScreen extends StatefulWidget {
  const EmergencySirenScreen({super.key});

  @override
  State<EmergencySirenScreen> createState() => _EmergencySirenScreenState();
}

class _EmergencySirenScreenState extends State<EmergencySirenScreen>
    with SingleTickerProviderStateMixin {
  final _service = EmergencySirenService.instance;
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..repeat(reverse: true);
    _service.addListener(_onService);
    _boot();
  }

  Future<void> _boot() async {
    await requestTorchPermission();
    await _service.start();
    if (mounted) setState(() {});
  }

  void _onService() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    _service.removeListener(_onService);
    _pulse.dispose();
    super.dispose();
  }

  Future<void> _stop() async {
    HapticFeedback.heavyImpact();
    await _service.stop();
    if (mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _stop();
      },
      child: Scaffold(
        backgroundColor: const Color(0xFF7f1d1d),
        body: SafeArea(
          child: AnimatedBuilder(
            animation: _pulse,
            builder: (context, child) {
              final glow = 0.35 + _pulse.value * 0.25;
              return Container(
                decoration: BoxDecoration(
                  gradient: RadialGradient(
                    colors: [
                      Color.lerp(
                        const Color(0xFFfef08a),
                        const Color(0xFF7f1d1d),
                        1 - glow,
                      )!,
                      const Color(0xFF450a0a),
                    ],
                    radius: 1.2,
                  ),
                ),
                child: child,
              );
            },
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                children: [
                  const Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      'ACİL MOD · İNTERNETSİZ',
                      style: TextStyle(
                        color: Colors.white70,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 1.2,
                      ),
                    ),
                  ),
                  const Spacer(),
                  const Icon(Icons.warning_amber_rounded,
                      size: 72, color: Colors.amber),
                  const SizedBox(height: 16),
                  const Text(
                    'ENKAZ ALTINDA ARAMA',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 26,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Flaş ve düdük aktif\nYardım çağrısı için ses çıkarılıyor',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 16),
                  ),
                  const Spacer(),
                  SizedBox(
                    width: double.infinity,
                    height: 72,
                    child: FilledButton(
                      onPressed: _stop,
                      style: FilledButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF7f1d1d),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16),
                        ),
                      ),
                      child: const Text(
                        'DURDUR',
                        style: TextStyle(
                          fontSize: 22,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text(
                    _service.isActive ? '● Ses + flaşör çalışıyor' : 'Durduruluyor…',
                    style: const TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
