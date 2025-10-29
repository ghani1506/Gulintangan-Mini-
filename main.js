// Ultra-fast, polyphonic WebAudio. Prebuilt AudioBuffers; immediate .start(). No labels, fixed image.
const NOTES = {
  'C4':261.63, 'C#4':277.18, 'D4':293.66, 'D#4':311.13, 'E4':329.63,
  'F4':349.23, 'F#4':369.99, 'G4':392.00, 'G#4':415.30, 'A4':440.00,
  'A#4':466.16, 'B4':493.88, 'C5':523.25
};

const statusEl = document.getElementById('status');
const frameEl  = document.getElementById('frame');
let ctx, master, unlocked=false;
const buffers = {};

function buildBuffers(){
  const sr = ctx.sampleRate, secs = 2.0, len = Math.ceil(sr*secs);
  const ratios=[1.00,2.02,3.95,5.40,6.80], gains=[1.0,0.42,0.30,0.20,0.16], taus=[1.2,0.9,0.7,0.55,0.45];
  for (const [name,freq] of Object.entries(NOTES)){
    const buf = ctx.createBuffer(1,len,sr); const out = buf.getChannelData(0);
    for (let n=0;n<len;n++){ const t=n/sr; let s=0;
      for (let i=0;i<ratios.length;i++){ const f=freq*ratios[i]; const glide=(t<0.02)?(1.02-(t/0.02)*0.02):1.0;
        s += gains[i]*Math.sin(2*Math.PI*f*glide*t)*Math.exp(-t/taus[i]); }
      out[n]=s;
    }
    buffers[name]=buf;
  }
}

function init(){
  if (unlocked) return;
  ctx = new (window.AudioContext||window.webkitAudioContext)({latencyHint:'interactive'});
  master = ctx.createGain(); master.gain.value=0.9; master.connect(ctx.destination);
  buildBuffers();
  unlocked=true; statusEl.textContent='Ready — play!';
}

['pointerdown','keydown','touchstart'].forEach(evt=>{
  window.addEventListener(evt, ()=>{ if(!unlocked) init(); }, {once:true, passive:true});
});

function hit(name){
  if (!unlocked) return;
  const buf=buffers[name]; if(!buf) return;
  const src=ctx.createBufferSource(); src.buffer=buf;
  const g=ctx.createGain(); const t=ctx.currentTime, d=1.2;
  g.gain.setValueAtTime(1,t); g.gain.exponentialRampToValueAtTime(0.001,t+d);
  src.connect(g).connect(master);
  src.start(t); src.stop(t+d+0.05);
}

function down(e){ const p=e.target.closest('.pad'); if(!p) return; p.classList.add('active'); hit(p.dataset.note); e.preventDefault(); }
function up(e){ const p=e.target.closest('.pad'); if(p) p.classList.remove('active'); }

frameEl.addEventListener('pointerdown', down, {passive:false});
frameEl.addEventListener('pointerup', up);
frameEl.addEventListener('pointercancel', up);
frameEl.addEventListener('pointerleave', up);

// Keyboard chords
const KEYMAP={'Z':'C4','S':'C#4','X':'D4','D':'D#4','C':'E4','V':'F4','G':'F#4','B':'G4','H':'G#4','N':'A4','J':'A#4','M':'B4',',':'C5'};
document.addEventListener('keydown',(e)=>{ const n=KEYMAP[e.key.toUpperCase()]; if(!n) return; const pad=[...document.querySelectorAll('.pad')].find(p=>p.dataset.note===n); if(pad) pad.classList.add('active'); hit(n); });
document.addEventListener('keyup',(e)=>{ const n=KEYMAP[e.key.toUpperCase()]; if(!n) return; const pad=[...document.querySelectorAll('.pad')].find(p=>p.dataset.note===n); if(pad) pad.classList.remove('active'); });
