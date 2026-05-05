// Interactive Gulintangan / Caklempong
// This version works on GitHub Pages with no build step and no required audio files.

const NOTES = {
  C4: 261.63, Cs4: 277.18, D4: 293.66, Ds4: 311.13, E4: 329.63,
  F4: 349.23, Fs4: 369.99, G4: 392.00, Gs4: 415.30, A4: 440.00,
  As4: 466.16, B4: 493.88, C5: 523.25
};

const KEYBOARD_MAP = {
  a: 'C4', w: 'Cs4', s: 'D4', e: 'Ds4', d: 'E4',
  f: 'F4', t: 'Fs4', g: 'G4', y: 'Gs4', h: 'A4',
  u: 'As4', j: 'B4', k: 'C5'
};

const statusEl = document.getElementById('status');
const frameEl = document.getElementById('frame');
const buffers = {};
const activeKeys = new Set();

let ctx;
let master;
let unlocked = false;

function setStatus(message) {
  if (statusEl) statusEl.textContent = message;
}

function buildBuffers() {
  const sampleRate = ctx.sampleRate;
  const seconds = 2.4;
  const length = Math.ceil(sampleRate * seconds);
  const nyquist = sampleRate / 2;

  const ratios = [1.00, 2.41, 3.88, 5.33, 6.77, 8.21, 9.65];
  const gains = [1.00, 0.55, 0.36, 0.22, 0.14, 0.09, 0.055];
  const taus = [1.60, 1.05, 0.78, 0.58, 0.42, 0.32, 0.24];
  const attackSamples = Math.floor(0.004 * sampleRate);
  const releaseSamples = Math.floor(0.030 * sampleRate);
  const softClip = (x, drive = 0.6) => Math.tanh(x * drive);

  for (const [name, freq] of Object.entries(NOTES)) {
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const out = buffer.getChannelData(0);
    const detuneA = Math.pow(2, -5 / 1200);
    const detuneB = Math.pow(2, 5 / 1200);

    for (let n = 0; n < length; n += 1) {
      const time = n / sampleRate;
      let sample = 0;

      for (let i = 0; i < ratios.length; i += 1) {
        const baseFreq = freq * ratios[i];
        if (baseFreq >= nyquist * 0.95) continue;

        const envelope = Math.exp(-time / taus[i]);
        const phase = i * 0.9;
        const f1 = baseFreq * detuneA;
        const f2 = baseFreq * detuneB;

        if (f1 < nyquist) sample += gains[i] * 0.5 * Math.sin(2 * Math.PI * f1 * time + phase) * envelope;
        if (f2 < nyquist) sample += gains[i] * 0.5 * Math.sin(2 * Math.PI * f2 * time + phase + 0.6) * envelope;
      }

      const strike = Math.exp(-time / 0.015) * Math.sin(2 * Math.PI * 1600 * time);
      sample += 0.035 * strike;
      out[n] = softClip(sample, 0.6);
    }

    for (let i = 0; i < attackSamples && i < length; i += 1) {
      const w = i / attackSamples;
      out[i] *= w * w * (3 - 2 * w);
    }

    for (let i = 0; i < releaseSamples; i += 1) {
      const index = length - 1 - i;
      if (index < 0) break;
      const w = i / releaseSamples;
      out[index] *= 1 - (w * w * (3 - 2 * w));
    }

    let peak = 0;
    for (let i = 0; i < length; i += 1) peak = Math.max(peak, Math.abs(out[i]));

    if (peak > 0) {
      const target = Math.pow(10, -7 / 20);
      const gain = target / peak;
      for (let i = 0; i < length; i += 1) out[i] *= gain;
    }

    buffers[name] = buffer;
  }
}

function initAudio() {
  if (unlocked) return true;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) {
    setStatus('Sorry, this browser does not support Web Audio.');
    return false;
  }

  ctx = new AudioContextClass({ latencyHint: 'interactive' });
  master = ctx.createGain();
  master.gain.value = 0.75;
  master.connect(ctx.destination);
  buildBuffers();
  unlocked = true;
  setStatus('Selamat mencuba! Keyboard: A W S E D F T G Y H U J K');
  return true;
}

async function resumeAudioIfNeeded() {
  if (!ctx) return;
  if (ctx.state === 'suspended') await ctx.resume();
}

async function playNote(note, button) {
  if (!NOTES[note]) return;
  if (!initAudio()) return;
  await resumeAudioIfNeeded();

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  source.buffer = buffers[note];
  gain.gain.setValueAtTime(0.95, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.35);
  source.connect(gain).connect(master);
  source.start();
  source.stop(ctx.currentTime + 2.4);

  if (button) {
    button.classList.add('active');
    window.setTimeout(() => button.classList.remove('active'), 120);
  }
}

function getButtonForNote(note) {
  return frameEl?.querySelector(`[data-note="${note}"]`);
}

frameEl?.addEventListener('pointerdown', (event) => {
  const button = event.target.closest('button[data-note]');
  if (!button) return;
  event.preventDefault();
  playNote(button.dataset.note, button);
});

frameEl?.addEventListener('contextmenu', (event) => event.preventDefault());

window.addEventListener('keydown', (event) => {
  const note = KEYBOARD_MAP[event.key.toLowerCase()];
  if (!note || activeKeys.has(event.key)) return;
  activeKeys.add(event.key);
  playNote(note, getButtonForNote(note));
});

window.addEventListener('keyup', (event) => {
  activeKeys.delete(event.key);
});
