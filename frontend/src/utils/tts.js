/** Web Speech API — Türkçe TTS */

let preferredVoice = null;

function pickTurkishVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null;
  const voices = window.speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === 'tr-TR') ||
    voices.find((v) => v.lang?.startsWith('tr')) ||
    voices[0] ||
    null
  );
}

export function isTtsSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function speakTurkish(text, { onEnd } = {}) {
  if (!isTtsSupported() || !text?.trim()) return () => {};
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text.trim());
  utter.lang = 'tr-TR';
  utter.rate = 0.92;
  utter.pitch = 1;
  if (!preferredVoice) preferredVoice = pickTurkishVoice();
  if (preferredVoice) utter.voice = preferredVoice;
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
  return () => window.speechSynthesis.cancel();
}

export function stopSpeaking() {
  if (isTtsSupported()) window.speechSynthesis.cancel();
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    preferredVoice = pickTurkishVoice();
  };
}
