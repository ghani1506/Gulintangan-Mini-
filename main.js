const NOTES = {
  'C4':261.63, 'C#4':277.18, 'D4':293.66, 'D#4':311.13, 'E4':329.63,
  'F4':349.23, 'F#4':369.99, 'G4':392.00, 'G#4':415.30, 'A4':440.00,
  'A#4':466.16, 'B4':493.88, 'C5':523.25
};

const AUDIO_FILES = {
  'C4':'C4.wav', 'C#4':'Cs4.wav', 'D4':'D4.wav', 'D#4':'Ds4.wav', 'E4':'E4.wav',
  'F4':'F4.wav', 'F#4':'Fs4.wav', 'G4':'G4.wav', 'G#4':'Gs4.wav', 'A4':'A4.wav',
  'A#4':'As4.wav', 'B4':'B4.wav', 'C5':'C5.wav'
};

const statusEl = document.getElementById('status');
const frameEl  = document.getElementById('frame');

let unlocked = false;
const audioMap = {};

// 🔊 ORIGINAL AUDIO FILE PLAYER
// To use your own caklempong recordings, replace the .wav files in assets/audio/
// Keep the same filenames listed in AUDIO_FILES above.
function loadAudioFiles(){
  for (const [note, filename] of Object.entries(AUDIO_FILES)) {
    const audio = new Audio(`./assets/audio/${filename}`);
    audio.preload = 'auto';
    audioMap[note] = audio;
  }
}

// 🔓 INIT AUDIO
function init(){
  if (unlocked) return;
  loadAudioFiles();
  unlocked = true;
  statusEl.textContent = 'Sedia — bunyi caklempong dimuatkan!';
}

// unlock audio on first interaction
['pointerdown','keydown','touchstart'].forEach(evt=>{
  window.addEventListener(evt, ()=>{
    if (!unlocked) init();
  }, { once:true, passive:true });
});

// 🥁 PLAY NOTE
function hit(name){
  if (!unlocked) init();

  const audio = audioMap[name];
  if (!audio) return;

  // Clone allows repeated and simultaneous strikes without cutting off previous notes.
  const clone = audio.cloneNode(true);
  clone.currentTime = 0;
  clone.volume = 1.0;
  clone.play().catch(() => {
    statusEl.textContent = 'Klik / tekan sekali lagi untuk aktifkan bunyi.';
  });
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
