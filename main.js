function buildBuffers(){
  const sr = ctx.sampleRate;
  const secs = 3.2;
  const len = Math.ceil(sr * secs);

  // Caklempong-like struck bronze pot gong:
  // bright metallic attack, inharmonic overtones, quick initial decay,
  // warm resonant tail.
  const partials = [
    { ratio: 1.00, gain: 1.00, tau: 1.65 },
    { ratio: 2.72, gain: 0.48, tau: 0.55 },
    { ratio: 3.83, gain: 0.34, tau: 0.42 },
    { ratio: 5.41, gain: 0.22, tau: 0.30 },
    { ratio: 7.05, gain: 0.15, tau: 0.22 },
    { ratio: 8.76, gain: 0.10, tau: 0.16 }
  ];

  for (const [name, freq] of Object.entries(NOTES)){
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    for (let n = 0; n < len; n++){
      const t = n / sr;

      // sharp mallet click + bronze resonance
      const attack = Math.min(1, t / 0.004);
      const strikeNoise = (Math.random() * 2 - 1) * Math.exp(-t / 0.012) * 0.28;

      let s = strikeNoise;

      for (const p of partials){
        const detune = 1 + 0.0025 * Math.sin(2 * Math.PI * 5.5 * t);
        s += p.gain *
             Math.sin(2 * Math.PI * freq * p.ratio * detune * t) *
             Math.exp(-t / p.tau);
      }

      // gentle saturation to make it gong-like, not pure sine
      out[n] = Math.tanh(s * attack * 1.15) * 0.75;
    }

    buffers[name] = buf;
  }
}

function hit(name){
  if (!unlocked) return;

  const buf = buffers[name];
  if (!buf) return;

  const src = ctx.createBufferSource();
  src.buffer = buf;

  const g = ctx.createGain();
  const t = ctx.currentTime;

  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(1.0, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.001, t + 2.4);

  src.connect(g).connect(master);
  src.start(t);
  src.stop(t + 2.6);
}