// Ненавязчивые звуковые эффекты на Web Audio API (без внешних файлов).
let ctx = null, muted = false;
export const setMuted = m => { muted = m; };
export const isMuted = () => muted;

function beep(freq, dur = 0.12, type = 'sine', vol = 0.15, delay = 0) {
  if (muted) return;
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur);
  } catch { /* звук не критичен */ }
}

export const sfx = {
  count: () => beep(520, 0.12),
  go: () => { beep(660, 0.1); beep(880, 0.2, 'sine', 0.15, 0.1); },
  tick: () => beep(1000, 0.05, 'square', 0.05),
  end: () => { beep(440, 0.25, 'sawtooth', 0.1); beep(330, 0.4, 'sawtooth', 0.1, 0.25); },
  guess: () => beep(740, 0.08, 'triangle'),
  round: () => [523, 659, 784, 1047].forEach((f, i) => beep(f, 0.2, 'triangle', 0.15, i * 0.15)),
};
