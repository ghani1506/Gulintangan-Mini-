const NOTES = {
  'C4':261.63, 'C#4':277.18, 'D4':293.66, 'D#4':311.13, 'E4':329.63,
  'F4':349.23, 'F#4':369.99, 'G4':392.00, 'G#4':415.30, 'A4':440.00,
  'A#4':466.16, 'B4':493.88, 'C5':523.25
};

const statusEl = document.getElementById('status');
const frameEl  = document.getElementById('frame');

let ctx, master, unlocked = false;
const buffers = {};

// 🔊 CAKLEMPONG SOUND ENGINE
function buildBuffers(){
  const sr = ctx.sampleRate;
  const secs = 3.0;
  const len = Math.ceil(sr * secs);

  const ratios = [1.00, 2.71, 3.92, 5.38, 6.82, 8.45];
  const gains  = [1.00, 0.50, 0.34, 0.23, 0.15, 0.10];
  const taus   = [1.70, 0.65, 0.48, 0.34, 0.24, 0.18];

  for (const [name, freq] of Object.entries(NOTES)){
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    for (let n = 0; n < len; n++){
      const t = n / sr;

      // sharp strike (mallet hit)
      const attack = Math.min(1, t / 0.004);
      const strike = (Math.random()*2 - 1) * Math.exp(-t/0.01) * 0.35;

      let s = strike;

      // metallic inharmonic partials
      for (let i = 0; i < ratios.length; i++){
        const wobble = 1 + 0.002 * Math.sin(2 * Math.PI * 4.5 * t);
        s += gains[i] *
          Math.sin(2 * Math.PI * freq * ratios[i] * wobble * t) *
          Math.exp(-t / taus[i]);
      }

      // soft saturation → bronze tone
      out[n] = Math.tanh(s * attack * 1.25) * 0.75;
    }

    buffers[name] = buf;
  }
}

// 🔓 INIT AUDIO
function init(){
  if (unlocked) return;

  ctx = new (window.AudioContext || window.webkitAudioContext)({
    latencyHint: 'interactive'
  });

  master = ctx.createGain();
  master.gain.value = 0.9;
  master.connect(ctx.destination);

  buildBuffers();

  unlocked = true;
  statusEl.textContent = 'Sedia — pukul!';
}

// unlock audio on first interaction
['pointerdown','keydown','touchstart'].forEach(evt=>{
  window.addEventListener(evt, ()=>{
    if (!unlocked) init();
  }, { once:true, passive:true });
});

// 🥁 PLAY NOTE
function hit(name){
  if (!unlocked) return;

  const buf = buffers[name];
  if (!buf) return;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const g = ctx.createGain();
  const t = ctx.currentTime;

  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.005);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.2);

  src.connect(g).connect(master);
  src.start(t);
  src.stop(t + 2.4);
}

// 🎯 POINTER EVENTS
function down(e){
  const p = e.target.closest('.pad');
  if (!p) return;

  p.classList.add('active');
  hit(p.dataset.note);
  e.preventDefault();
}

function up(e){
  const p = e.target.closest('.pad');
  if (p) p.classList.remove('active');
}

frameEl.addEventListener('pointerdown', down, { passive:false });
frameEl.addEventListener('pointerup', up);
frameEl.addEventListener('pointercancel', up);
frameEl.addEventListener('pointerleave', up);

// ⌨️ KEYBOARD SUPPORT
const KEYMAP = {
  'Z':'C4','S':'C#4','X':'D4','D':'D#4','C':'E4',
  'V':'F4','G':'F#4','B':'G4','H':'G#4',
  'N':'A4','J':'A#4','M':'B4',',':'C5'
};

document.addEventListener('keydown', (e)=>{
  const n = KEYMAP[e.key.toUpperCase()];
  if (!n) return;

  const pad = [...document.querySelectorAll('.pad')]
    .find(p => p.dataset.note === n);

  if (pad) pad.classList.add('active');
  hit(n);
});

document.addEventListener('keyup', (e)=>{
  const n = KEYMAP[e.key.toUpperCase()];
  if (!n) return;

  const pad = [...document.querySelectorAll('.pad')]
    .find(p => p.dataset.note === n);

  if (pad) pad.classList.remove('active');
});