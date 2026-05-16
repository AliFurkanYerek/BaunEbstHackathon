import 'dart:async';
import 'dart:io';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/foundation.dart';
import 'package:path_provider/path_provider.dart';
import 'package:screen_brightness/screen_brightness.dart';
import 'package:torch_light/torch_light.dart';
import 'package:wakelock_plus/wakelock_plus.dart';

import '../utils/whistle_wav.dart';

/// İnternet gerektirmez: flaşör, parlaklık, düdük sesi.
class EmergencySirenService extends ChangeNotifier {
  EmergencySirenService._();
  static final EmergencySirenService instance = EmergencySirenService._();

  bool _active = false;
  Timer? _flashTimer;
  AudioPlayer? _player;
  double? _savedBrightness;
  bool _torchAvailable = false;

  bool get isActive => _active;

  Future<File> _whistleFile() async {
    final dir = await getTemporaryDirectory();
    final file = File('${dir.path}/afet_whistle_loop.wav');
    if (!await file.exists()) {
      await file.writeAsBytes(buildWhistleWavLoop(), flush: true);
    }
    return file;
  }

  Future<bool> _checkTorch() async {
    try {
      return await TorchLight.isTorchAvailable();
    } catch (_) {
      return false;
    }
  }

  Future<void> start() async {
    if (_active) return;

    _torchAvailable = await _checkTorch();
    _active = true;
    notifyListeners();

    await WakelockPlus.enable();

    try {
      final brightness = ScreenBrightness();
      _savedBrightness = await brightness.application;
      await brightness.setApplicationScreenBrightness(1.0);
    } catch (e) {
      debugPrint('Parlaklık: $e');
    }

    try {
      final file = await _whistleFile();
      _player = AudioPlayer();
      await _player!.setReleaseMode(ReleaseMode.loop);
      await _player!.setVolume(1.0);
      await _player!.play(DeviceFileSource(file.path));
    } catch (e) {
      debugPrint('Ses: $e');
    }

    if (_torchAvailable) {
      var on = false;
      _flashTimer = Timer.periodic(const Duration(milliseconds: 140), (_) async {
        if (!_active) return;
        try {
          on = !on;
          if (on) {
            await TorchLight.enableTorch();
          } else {
            await TorchLight.disableTorch();
          }
        } catch (_) {}
      });
    }
  }

  Future<void> stop() async {
    if (!_active) return;
    _active = false;
    notifyListeners();

    _flashTimer?.cancel();
    _flashTimer = null;

    try {
      await _player?.stop();
      await _player?.dispose();
    } catch (_) {}
    _player = null;

    if (_torchAvailable) {
      try {
        await TorchLight.disableTorch();
      } catch (_) {}
    }

    try {
      final brightness = ScreenBrightness();
      final restore = _savedBrightness ?? 0.5;
      await brightness.setApplicationScreenBrightness(restore);
    } catch (_) {}
    _savedBrightness = null;

    await WakelockPlus.disable();
  }

  Future<void> toggle() async {
    if (_active) {
      await stop();
    } else {
      await start();
    }
  }
}
