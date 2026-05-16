/**
 * Tarayıcı acil düdük — internet gerekmez (Web Audio + ekran flaşı).
 */

let audioCtx = null;
let oscillators = [];
let gainNode = null;
let flashTimer = null;
let wakeLock = null;
let active = false;

function startWhistle() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) throw new Error('Tarayıcı ses API desteklemiyor');

  audioCtx = new Ctx();
  gainNode = audioCtx.createGain();
  gainNode.gain.value = 1;
  gainNode.connect(audioCtx.destination);

  const playTone = (freq) => {
    const osc = audioCtx.createOscillator();
    osc.type = 'square';
    osc.frequency.value = freq;
    const g = audioCtx.createGain();
    g.gain.value = 0.35;
    osc.connect(g);
    g.connect(gainNode);
    osc.start();
    oscillators.push(osc);
  };

  playTone(2400);
  playTone(3100);

  let alt = false;
  flashTimer = setInterval(() => {
    alt = !alt;
    oscillators.forEach((o) => o.stop());
    oscillators = [];
    playTone(alt ? 2400 : 3100);
  }, 420);
}

async function requestWake() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    /* */
  }
}

export function isEmergencySirenActive() {
  return active;
}

export async function startEmergencySiren() {
  if (active) return;
  active = true;
  startWhistle();
  await requestWake();
}

export async function stopEmergencySiren() {
  if (!active) return;
  active = false;

  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }

  oscillators.forEach((o) => {
    try {
      o.stop();
    } catch {
      /* */
    }
  });
  oscillators = [];

  if (audioCtx) {
    try {
      await audioCtx.close();
    } catch {
      /* */
    }
    audioCtx = null;
  }

  if (wakeLock) {
    try {
      await wakeLock.release();
    } catch {
      /* */
    }
    wakeLock = null;
  }
}

export async function toggleEmergencySiren() {
  if (active) await stopEmergencySiren();
  else await startEmergencySiren();
  return active;
}
