import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../screens/emergency_siren_screen.dart';
import '../services/emergency_siren_service.dart';

/// Ana ekranda kocaman "SES ÇIKAR" — internetsiz acil düdük.
class EmergencySirenBar extends StatelessWidget {
  const EmergencySirenBar({super.key});

  Future<void> _openSiren(BuildContext context) async {
    HapticFeedback.mediumImpact();
    await Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => const EmergencySirenScreen(),
        fullscreenDialog: true,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final active = EmergencySirenService.instance.isActive;

    return Material(
      color: const Color(0xFF1e293b),
      elevation: 8,
      child: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.wifi_off,
                    size: 16,
                    color: active ? Colors.amber : Colors.white38,
                  ),
                  const SizedBox(width: 6),
                  const Expanded(
                    child: Text(
                      'Şebeke / internet gerekmez · Donanım flaş + ses',
                      style: TextStyle(color: Colors.white54, fontSize: 11),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                height: 64,
                child: FilledButton.icon(
                  onPressed: active
                      ? null
                      : () => _openSiren(context),
                  icon: const Icon(Icons.campaign, size: 32),
                  label: const Text(
                    'SES ÇIKAR',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1.5,
                    ),
                  ),
                  style: FilledButton.styleFrom(
                    backgroundColor: const Color(0xFFdc2626),
                    disabledBackgroundColor: const Color(0xFF991b1b),
                    foregroundColor: Colors.white,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
