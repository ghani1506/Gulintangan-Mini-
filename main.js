// === Notes ===
const NOTES = {
  'C4':261.63, 'C#4':277.18, 'D4':293.66, 'D#4':311.13, 'E4':329.63,
  'F4':349.23, 'F#4':369.99, 'G4':392.00, 'G#4':415.30, 'A4':440.00,
  'A#4':466.16, 'B4':493.88, 'C5':523.25
};

const statusEl = document.getElementById('status');
const frameEl  = document.getElementById('frame');

let ctx, master, unlocked = false;
const buffers = {};

// === Improved gamelan synthesis (clean, no distortion) ===
function buildBuffers(){
  const sr = ctx.sampleRate, secs = 2.4, len = Math.ceil(sr * secs);

  // Gamelan-like inharmonic bronze modes
  const ratios = [1.00, 2.41, 3.88, 5.33, 6.77, 8.21, 9.65];
  const gains  = [1.00, 0.55, 0.36, 0.22, 0.14, 0.09, 0.055];
  const taus   = [1.60, 1.05, 0.78, 0.58, 0.42, 0.32, 0.24];

  const nyquist = sr / 2;

  const attackSamples = Math.floor(0.004 * sr);
  const releaseSamples = Math.floor(0.030 * sr);

  const softClip = (x, drive = 0.6) => Math.tanh(x * drive);

  for (const [name, freq] of Object.entries(NOTES)){
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    // Characteristic gamelan "beating"
    const beatCents = 5;
    const detuneA = Math.pow(2, -beatCents / 1200);
    const detuneB = Math.pow(2,  beatCents / 1200);

    for (let n = 0; n < len; n++){
      const t = n / sr;
      let s = 0;

      for (let i = 0; i < ratios.length; i++){
        const baseF = freq * ratios[i];
        if (baseF >= nyquist * 0.95) continue;

        const env = Math.exp(-t / taus[i]);
        const phase = i * 0.9;

        const f1 = baseF * detuneA;
        const f2 = baseF * detuneB;

        if (f1 < nyquist)
          s += gains[i] * 0.5 * Math.sin(2 * Math.PI * f1 * t + phase) * env;

        if (f2 < nyquist)
          s += gains[i] * 0.5 * Math.sin(2 * Math.PI * f2 * t + phase + 0.6) * env;
      }

      // Softer mallet attack (removes "broken speaker" click)
      const strike = Math.exp(-t / 0.015) * Math.sin(2 * Math.PI * 1600 * t);
      s += 0.035 * strike;

      out[n] = softClip(s, 0.6);
    }

    // Smooth fade-in
    for (let i = 0; i < attackSamples && i < len; i++){
      const w = i / attackSamples;
      out[i] *= w * w * (3 - 2 * w);
    }

    // Smooth fade-out
    for (let i = 0; i < releaseSamples; i++){
      const idx = len - 1 - i;
      if (idx < 0) break;
      const w = i / releaseSamples;
      out[idx] *= 1 - (w * w * (3 - 2 * w));
    }

    // Normalize to prevent distortion (important)
    let peak = 0;
    for (let i = 0; i < len; i++){
      peak = Math.max(peak, Math.abs(out[i]));
    }

    if (peak > 0){
      const target = Math.pow(10, -7 / 20); // -7 dB
      const g = target / peak;
      for (let i = 0; i < len; i++){
        out[i] *= g;
      }
    }

    buffers[name] = buf;
  }
}

// === Init ===
function init(){
  if (unlocked) return;

  ctx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive'
  });

  master = ctx.createGain();
  master.gain.value = 0.75; // lower = cleaner when playing chords
  master.connect(ctx.destination);

  buildBuffers();

  unlocked = true;
  statusEl.textContent = 'Selamat Mencuba!';
}
