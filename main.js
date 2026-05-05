const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

function play(freq){
 const o = ctx.createOscillator();
 const g = ctx.createGain();
 o.frequency.value = freq;
 o.connect(g);
 g.connect(ctx.destination);
 o.start();
 g.gain.setValueAtTime(1, ctx.currentTime);
 g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
 o.stop(ctx.currentTime + 1);
}

const notes = {
 "C4":261.63,"C#4":277.18,"D4":293.66,"D#4":311.13,
 "E4":329.63,"F4":349.23,"F#4":369.99,"G4":392.00,
 "G#4":415.30,"A4":440.00,"A#4":466.16,"B4":493.88,
 "C5":523.25
};

document.querySelectorAll(".pad").forEach(btn=>{
 btn.addEventListener("click",()=>{
   if(ctx.state==="suspended") ctx.resume();
   play(notes[btn.dataset.note]);
 });
});
