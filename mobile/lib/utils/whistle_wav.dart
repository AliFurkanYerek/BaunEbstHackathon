import 'dart:math';
import 'dart:typed_data';

/// İnternetsiz çalınacak enkaz arama düdüğü — kısa döngü WAV (PCM 16-bit mono).
Uint8List buildWhistleWavLoop({int durationMs = 3000}) {
  const sampleRate = 22050;
  const channels = 1;
  const bitsPerSample = 16;
  final sampleCount = (sampleRate * durationMs / 1000).floor();
  final pcm = ByteData(sampleCount * 2);

  for (var i = 0; i < sampleCount; i++) {
    final t = i / sampleRate;
    final ms = (t * 1000) % 600;
    final on = ms < 420;
    final alt = ((t * 1.8).floor() % 2) == 0;
    final freq = alt ? 2400.0 : 3100.0;
    var amp = 0.0;
    if (on) {
      amp = sin(2 * pi * freq * t) * 0.92;
      if (ms < 30 || ms > 390) {
        amp *= ms < 30 ? ms / 30 : (420 - ms) / 30;
      }
    }
    final sample = (amp * 32767).round().clamp(-32768, 32767);
    pcm.setInt16(i * 2, sample, Endian.little);
  }

  return _wrapWav(pcm.buffer.asUint8List(), sampleRate, channels, bitsPerSample);
}

Uint8List _wrapWav(
  Uint8List pcmData,
  int sampleRate,
  int channels,
  int bitsPerSample,
) {
  final byteRate = sampleRate * channels * bitsPerSample ~/ 8;
  final blockAlign = channels * bitsPerSample ~/ 8;
  final dataSize = pcmData.length;
  final header = ByteData(44);

  void writeStr(int offset, String s) {
    for (var i = 0; i < s.length; i++) {
      header.setUint8(offset + i, s.codeUnitAt(i));
    }
  }

  writeStr(0, 'RIFF');
  header.setUint32(4, 36 + dataSize, Endian.little);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  header.setUint32(16, 16, Endian.little);
  header.setUint16(20, 1, Endian.little);
  header.setUint16(22, channels, Endian.little);
  header.setUint32(24, sampleRate, Endian.little);
  header.setUint32(28, byteRate, Endian.little);
  header.setUint16(32, blockAlign, Endian.little);
  header.setUint16(34, bitsPerSample, Endian.little);
  writeStr(36, 'data');
  header.setUint32(40, dataSize, Endian.little);

  final out = Uint8List(44 + dataSize);
  out.setRange(0, 44, header.buffer.asUint8List());
  out.setRange(44, 44 + dataSize, pcmData);
  return out;
}
