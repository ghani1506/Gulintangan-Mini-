// main.js — Two-row layout with naturals C→C and sharps in-between. No labels on pads.
const NATURALS = [
  {name:'C4', freq:261.63, key:'Z'},
  {name:'D4', freq:293.66, key:'X'},
  {name:'E4', freq:329.63, key:'C'},
  {name:'F4', freq:349.23, key:'V'},
  {name:'G4', freq:392.00, key:'B'},
  {name:'A4', freq:440.00, key:'N'},
  {name:'B4', freq:493.88, key:'M'},
  {name:'C5', freq:523.25, key:','},
];
const SHARPS = [
  {name:'C#4', freq:277.18, key:'S'},
  {name:'D#4', freq:311.13, key:'D'},
  {name:'F#4', freq:369.99, key:'G'},
  {name:'G#4', freq:415.30, key:'H'},
  {name:'A#4', freq:466.16, key:'J'},
];

const frameEl = document.getElementById('frame');
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

// Image upload → CSS var
imgEl?.addEventListener('change', () => {
  const f = imgEl.files && imgEl.files[0];
  if (!f) return;
  const url = URL.createObjectURL(f);
  document.documentElement.style.setProperty('--padImage', `url('${url}')`);
  statusEl.textContent = 'Custom image applied to pads.';
});

// Audio
const now = () => (ctx ? ctx.currentTime : 0);
const ALL = [...NATURALS, ...SHARPS];

function initAudio(){
  if (unlocked) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
  master = ctx.createGain(); master.gain.value = parseFloat(gainEl.value);
  limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -10; limiter.knee.value = 20; limiter.ratio.value = 12;
  limiter.attack.value = 0.001; limiter.release.value = 0.05;
  master.connect(limiter).connect(ctx.destination);
  unlocked = true;
  statusEl.textContent = 'Audio is ready — play the gongs.';
}

unlockBtn.addEventListener('click', async () => {
  initAudio();
  await ctx.resume();
  await prerenderAll();
});

async function prerenderAll(){
  statusEl.textContent = 'Pre-rendering tones for zero-lag strikes...';
  const bufs = await Promise.all(ALL.map(n => renderModalBuffer(n.freq)));
  bufs.forEach((b, i) => buffers.set(ALL[i].name, b));
  statusEl.textContent = 'Ready.';
}

async function renderModalBuffer(freq){
  const sr = ctx.sampleRate, duration = 2.0;
  const offline = new OfflineAudioContext(1, Math.ceil(duration*sr), sr);
  const out = offline.createGain(); out.connect(offline.destination);
  const ratios = [1.00, 2.02, 3.95, 5.40, 6.80];
  const decays = [1.6, 1.2, 0.9, 0.7, 0.6];
  const gains  = [1.0, 0.45, 0.32, 0.22, 0.18];
  const t0 = 0.0;
  for (let i=0;i<ratios.length;i++){
    const osc = offline.createOscillator(); osc.type='sine';
    const base = freq * ratios[i];
    osc.frequency.setValueAtTime(base*1.02, t0);
    osc.frequency.exponentialRampToValueAtTime(base, t0 + 0.02);
    const g = offline.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gains[i], t0 + 0.002);
    g.gain.setTargetAtTime(0, t0 + 0.002, decays[i]*0.35);
    const lp = offline.createBiquadFilter(); lp.type='lowpass';
    lp.frequency.setValueAtTime(10000, t0);
    lp.frequency.exponentialRampToValueAtTime(parseFloat(dampEl.value), t0 + 0.35);
    osc.connect(g).connect(lp).connect(out);
    osc.start(t0); osc.stop(duration);
  }
  return await offline.startRendering();
}

function play(noteName){
  if (!unlocked || isMuted) return;
  const buf = buffers.get(noteName);
  if (!buf){ liveFallback(noteName); return; }
  const src = ctx.createBufferSource(); src.buffer = buf;
  const g = ctx.createGain(); const t = now(); const d = parseFloat(decayEl.value);
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + d);
  src.connect(g).connect(master); src.start(t); src.stop(t + d + 0.05);
}
function liveFallback(noteName){
  const freq = ALL.find(n => n.name === noteName)?.freq || 440;
  const o = ctx.createOscillator(); o.type='sine'; o.frequency.value=freq;
  const g = ctx.createGain(); const t = now();
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
  o.connect(g).connect(master); o.start(t); o.stop(t + 0.65);
}

// Pointer
function down(e){ const p=e.target.closest('.pad'); if(!p)return; p.classList.add('active'); play(p.dataset.note); e.preventDefault(); }
function up(e){ const p=e.target.closest('.pad'); if(p) p.classList.remove('active'); }
frameEl.addEventListener('pointerdown', down, {passive:false});
frameEl.addEventListener('pointerup', up); frameEl.addEventListener('pointerleave', up);

// Optional keyboard shortcuts (kept but not displayed on pads)
const KEYMAP = {
  'Z':'C4','X':'D4','C':'E4','V':'F4','B':'G4','N':'A4','M':'B4', ',':'C5',
  'S':'C#4','D':'D#4','G':'F#4','H':'G#4','J':'A#4'
};
document.addEventListener('keydown', (e)=>{
  const name = KEYMAP[e.key.toUpperCase()]; if(!name) return;
  const pad = [...document.querySelectorAll('.pad')].find(p => p.dataset.note === name);
  if (pad) pad.classList.add('active'); play(name);
});
document.addEventListener('keyup', (e)=>{
  const name = KEYMAP[e.key.toUpperCase()]; if(!name) return;
  const pad = [...document.querySelectorAll('.pad')].find(p => p.dataset.note === name);
  if (pad) pad.classList.remove('active');
});

// Controls
gainEl.addEventListener('input', ()=> { if (master) master.gain.value = parseFloat(gainEl.value); });
muteBtn.addEventListener('click', ()=>{ isMuted=!isMuted; muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; });

['pointerdown','keydown','touchstart'].forEach(evt => {
  window.addEventListener(evt, async () => {
    if (!unlocked){ initAudio(); await ctx.resume(); prerenderAll(); }
  }, {once:true, passive:true});
});
