// main.js — WebAudio chromatic gamelan with pre-rendered buffers for instant attack.
// Design goals: minimal startup, no GC in hot path, ultra-low latency on strike.

const NOTES = [
  {name:'C4',  freq:261.63, key:'Z'},
  {name:'C#4', freq:277.18, key:'S'},
  {name:'D4',  freq:293.66, key:'X'},
  {name:'D#4', freq:311.13, key:'D'},
  {name:'E4',  freq:329.63, key:'C'},
  {name:'F4',  freq:349.23, key:'V'},
  {name:'F#4', freq:369.99, key:'G'},
  {name:'G4',  freq:392.00, key:'B'},
  {name:'G#4', freq:415.30, key:'H'},
  {name:'A4',  freq:440.00, key:'N'},
  {name:'A#4', freq:466.16, key:'J'},
  {name:'B4',  freq:493.88, key:'M'},
  {name:'C5',  freq:523.25, key:','},
];

const grid = document.getElementById('grid');
const statusEl = document.getElementById('status');
const unlockBtn = document.getElementById('unlock');
const muteBtn = document.getElementById('mute');
const gainEl = document.getElementById('gain');
const decayEl = document.getElementById('decay');
const dampEl = document.getElementById('damp');

let ctx;
let master, limiter;
let buffers = new Map();
let unlocked = false;
let isMuted = false;

// Build UI pads
for (const n of NOTES){
  const pad = document.createElement('button');
  pad.className = 'pad';
  pad.setAttribute('data-note', n.name);
  pad.setAttribute('data-freq', n.freq);
  pad.innerHTML = `<div class="note">${n.name.replace('4','').replace('5','')}</div><div class="kbd">${n.key}</div>`;
  grid.appendChild(pad);
}

// Helpers
const now = () => (ctx ? ctx.currentTime : 0);

function initAudio(){
  if (unlocked) return;
  // interactive latency hint and small hardware buffer if possible
  ctx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive'
  });
  // master gain + gentle limiter to avoid clipping on fast rolls
  master = ctx.createGain();
  master.gain.value = parseFloat(gainEl.value);
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; // dB
  limiter.knee.value = 20;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  master.connect(limiter).connect(ctx.destination);
  unlocked = true;
  statusEl.textContent = 'Audio is ready — play with keys or tap the pads.';
}

unlockBtn.addEventListener('click', async () => {
  initAudio();
  await ctx.resume();
  await prerenderAll();
});

// Pre-render percussive metallic samples (modal synthesis) into AudioBuffers
async function prerenderAll(){
  statusEl.textContent = 'Pre-rendering tones for zero-lag strikes...';
  const promises = NOTES.map(n => renderModalBuffer(n.freq));
  const bufs = await Promise.all(promises);
  bufs.forEach((b, i) => buffers.set(NOTES[i].name, b));
  statusEl.textContent = 'Ready. (Tip: use Z S X D C V G B H N J M , on keyboard)';
}

// Modal synthesis: inharmonic partials typical for metal bars/gongs.
// We render offline to guarantee instant .start()
async function renderModalBuffer(freq){
  const sr = ctx.sampleRate;
  const duration = 2.0; // seconds (natural decay, we’ll gate on playback)
  const offline = new OfflineAudioContext(1, Math.ceil(duration*sr), sr);

  const out = offline.createGain();
  out.connect(offline.destination);

  // Simple modal model: 5 inharmonic modes with different decays
  const ratios = [1.00, 2.02, 3.95, 5.40, 6.80];
  const decays = [1.6, 1.2, 0.9, 0.7, 0.6]; // seconds
  const gains  = [1.0, 0.45, 0.32, 0.22, 0.18];

  const globalStart = 0.0;
  for (let i=0;i<ratios.length;i++){
    const osc = offline.createOscillator();
    // Sine is fine; inharmonicity gives metallic character
    osc.type = 'sine';
    // slight transient pitch rise for harder strike feel
    const base = freq * ratios[i];
    osc.frequency.setValueAtTime(base*1.02, globalStart);
    osc.frequency.exponentialRampToValueAtTime(base, globalStart + 0.02);

    const g = offline.createGain();
    const atk = 0.002;
    const t0 = globalStart + 0.000;
    const d = decays[i];
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gains[i], t0 + atk);
    // exponential decay
    g.gain.setTargetAtTime(0, t0 + atk, d * 0.35);

    // bright -> damped lowpass over time to tame highs
    const lp = offline.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(10000, t0);
    lp.frequency.exponentialRampToValueAtTime(parseFloat(dampEl.value), t0 + 0.35);

    osc.connect(g).connect(lp).connect(out);
    osc.start(globalStart);
    osc.stop(duration);
  }

  const rendered = await offline.startRendering();
  return rendered;
}

// Playback a buffer immediately with separate short envelope (for gating)
function play(noteName){
  if (!unlocked || isMuted) return;
  const buf = buffers.get(noteName);
  if (!buf){
    // If pre-render not finished yet, fall back to a live osc (still low latency)
    liveFallback(noteName);
    return;
  }
  // Use small per-voice gain for quick stop/velocity-ish control
  const src = ctx.createBufferSource();
  src.buffer = buf;

  const g = ctx.createGain();
  const t = now();
  const decay = parseFloat(decayEl.value);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);

  src.connect(g).connect(master);
  src.start(t);
  // stop earlier than buffer end based on decay
  src.stop(t + decay + 0.05);
}

function liveFallback(noteName){
  const freq = NOTES.find(n => n.name === noteName)?.freq || 440;
  const o = ctx.createOscillator();
  o.type = 'sine';
  o.frequency.value = freq;
  const g = ctx.createGain();
  const t = now();
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + 0.65);
}

// UI: pointer + keyboard
grid.addEventListener('pointerdown', (e) => {
  const pad = e.target.closest('.pad');
  if (!pad) return;
  pad.classList.add('active');
  play(pad.dataset.note);
  e.preventDefault();
}, {passive:false});

grid.addEventListener('pointerup', (e)=>{
  const pad = e.target.closest('.pad');
  if (pad) pad.classList.remove('active');
});

grid.addEventListener('pointerleave', (e)=>{
  const pad = e.target.closest('.pad');
  if (pad) pad.classList.remove('active');
});

document.addEventListener('keydown', (e)=>{
  const key = e.key.toUpperCase();
  const note = NOTES.find(n => n.key.toUpperCase() === key);
  if (note){
    const pad = [...grid.children][NOTES.indexOf(note)];
    pad.classList.add('active');
    play(note.name);
  }
});
document.addEventListener('keyup', (e)=>{
  const key = e.key.toUpperCase();
  const note = NOTES.find(n => n.key.toUpperCase() === key);
  if (note){
    const pad = [...grid.children][NOTES.indexOf(note)];
    pad.classList.remove('active');
  }
});

// Controls
gainEl.addEventListener('input', ()=> { if (master) master.gain.value = parseFloat(gainEl.value); });
muteBtn.addEventListener('click', ()=>{
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
});

// Auto-unlock on first user gesture anywhere
['pointerdown','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, async () => {
    if (!unlocked){
      initAudio();
      await ctx.resume();
      prerenderAll();
    }
  }, {once:true, passive:true});
});
