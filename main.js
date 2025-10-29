// main.js — Uniform-size keys with stacked sharps + real-image pads.
const WHITES = [
  {name:'C4',  freq:261.63, key:'Z'},
  {name:'D4',  freq:293.66, key:'X'},
  {name:'E4',  freq:329.63, key:'C'},
  {name:'F4',  freq:349.23, key:'V'},
  {name:'G4',  freq:392.00, key:'B'},
  {name:'A4',  freq:440.00, key:'N'},
  {name:'B4',  freq:493.88, key:'M'},
  {name:'C5',  freq:523.25, key:','},
];
const BLACKS = [
  {name:'C#4', freq:277.18, key:'S', cls:'k-cs'},
  {name:'D#4', freq:311.13, key:'D', cls:'k-ds'},
  {name:'F#4', freq:369.99, key:'G', cls:'k-fs'},
  {name:'G#4', freq:415.30, key:'H', cls:'k-gs'},
  {name:'A#4', freq:466.16, key:'J', cls:'k-as'},
];

const whitesEl = document.getElementById('whites');
const blacksEl = document.getElementById('blacks');
const statusEl = document.getElementById('status');
const unlockBtn = document.getElementById('unlock');
const muteBtn = document.getElementById('mute');
const gainEl = document.getElementById('gain');
const decayEl = document.getElementById('decay');
const dampEl = document.getElementById('damp');
const imgEl = document.getElementById('img');

let ctx;
let master, limiter;
let buffers = new Map();
let unlocked = false;
let isMuted = false;

// Build UI keys (all same size)
for (const n of WHITES){
  const pad = document.createElement('button');
  pad.className = 'pad white';
  pad.setAttribute('data-note', n.name);
  pad.setAttribute('data-freq', n.freq);
  pad.innerHTML = `<div class="kbd">${n.key}</div><div class="note">${n.name.replace('4','').replace('5','')}</div>`;
  whitesEl.appendChild(pad);
}
for (const n of BLACKS){
  const pad = document.createElement('button');
  pad.className = `pad black ${n.cls}`;
  pad.setAttribute('data-note', n.name);
  pad.setAttribute('data-freq', n.freq);
  pad.innerHTML = `<div class="kbd">${n.key}</div><div class="note">${n.name.replace('4','')}</div>`;
  blacksEl.appendChild(pad);
}

// Image upload -> CSS var --padImage
imgEl.addEventListener('change', () => {
  const file = imgEl.files && imgEl.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.documentElement.style.setProperty('--padImage', `url('${url}')`);
  statusEl.textContent = 'Custom image applied to pads.';
});

// Audio
const now = () => (ctx ? ctx.currentTime : 0);
const ALL = [...WHITES, ...BLACKS];

function initAudio(){
  if (unlocked) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive'
  });
  master = ctx.createGain();
  master.gain.value = parseFloat(gainEl.value);
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10;
  limiter.knee.value = 20;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.001;
  limiter.release.value = 0.05;
  master.connect(limiter).connect(ctx.destination);
  unlocked = true;
  statusEl.textContent = 'Audio is ready — play with keys or tap the bars.';
}

unlockBtn.addEventListener('click', async () => {
  initAudio();
  await ctx.resume();
  await prerenderAll();
});

async function prerenderAll(){
  statusEl.textContent = 'Pre-rendering tones for zero-lag strikes...';
  const promises = ALL.map(n => renderModalBuffer(n.freq));
  const bufs = await Promise.all(promises);
  bufs.forEach((b, i) => buffers.set(ALL[i].name, b));
  statusEl.textContent = 'Ready. (Keyboard: Z S X D C V G B H N J M ,)';
}

async function renderModalBuffer(freq){
  const sr = ctx.sampleRate;
  const duration = 2.0;
  const offline = new OfflineAudioContext(1, Math.ceil(duration*sr), sr);
  const out = offline.createGain();
  out.connect(offline.destination);

  const ratios = [1.00, 2.02, 3.95, 5.40, 6.80];
  const decays = [1.6, 1.2, 0.9, 0.7, 0.6];
  const gains  = [1.0, 0.45, 0.32, 0.22, 0.18];

  const globalStart = 0.0;
  for (let i=0;i<ratios.length;i++){
    const osc = offline.createOscillator();
    osc.type = 'sine';
    const base = freq * ratios[i];
    osc.frequency.setValueAtTime(base*1.02, globalStart);
    osc.frequency.exponentialRampToValueAtTime(base, globalStart + 0.02);

    const g = offline.createGain();
    const atk = 0.002;
    const t0 = globalStart + 0.000;
    const d = decays[i];
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gains[i], t0 + atk);
    g.gain.setTargetAtTime(0, t0 + atk, d * 0.35);

    const lp = offline.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(10000, t0);
    lp.frequency.exponentialRampToValueAtTime(parseFloat(dampEl.value), t0 + 0.35);

    osc.connect(g).connect(lp).connect(out);
    osc.start(globalStart);
    osc.stop(duration);
  }
  return await offline.startRendering();
}

function play(noteName){
  if (!unlocked || isMuted) return;
  const buf = buffers.get(noteName);
  if (!buf){ liveFallback(noteName); return; }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const t = now();
  const decay = parseFloat(decayEl.value);
  g.gain.setValueAtTime(1, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(g).connect(master);
  src.start(t);
  src.stop(t + decay + 0.05);
}

function liveFallback(noteName){
  const freq = ALL.find(n => n.name === noteName)?.freq || 440;
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

// Pointer + keyboard
function handleDown(e){
  const pad = e.target.closest('.pad');
  if (!pad) return;
  pad.classList.add('active');
  play(pad.dataset.note);
  e.preventDefault();
}
function handleUp(e){
  const pad = e.target.closest('.pad');
  if (pad) pad.classList.remove('active');
}
document.getElementById('kb').addEventListener('pointerdown', handleDown, {passive:false});
document.getElementById('kb').addEventListener('pointerup', handleUp);
document.getElementById('kb').addEventListener('pointerleave', handleUp);

document.addEventListener('keydown', (e)=>{
  const k = e.key.toUpperCase();
  const n = ALL.find(n => n.key.toUpperCase() === k);
  if (n){
    const pad = [...document.querySelectorAll('.pad')].find(p => p.dataset.note === n.name);
    if (pad) pad.classList.add('active');
    play(n.name);
  }
});
document.addEventListener('keyup', (e)=>{
  const k = e.key.toUpperCase();
  const n = ALL.find(n => n.key.toUpperCase() === k);
  if (n){
    const pad = [...document.querySelectorAll('.pad')].find(p => p.dataset.note === n.name);
    if (pad) pad.classList.remove('active');
  }
});

// Controls
gainEl.addEventListener('input', ()=> { if (master) master.gain.value = parseFloat(gainEl.value); });
muteBtn.addEventListener('click', ()=>{
  isMuted = !isMuted;
  muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
});

['pointerdown','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, async () => {
    if (!unlocked){
      initAudio();
      await ctx.resume();
      prerenderAll();
    }
  }, {once:true, passive:true});
});
