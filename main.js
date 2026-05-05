function buildBuffers(){
  const sr = ctx.sampleRate, secs = 2.0, len = Math.ceil(sr * secs);

  // Metallophone-like inharmonic modes
  const ratios = [1.00, 2.67, 4.05, 5.40, 6.80, 8.10];
  const gains  = [1.00, 0.38, 0.25, 0.16, 0.12, 0.09];   // tamed highs
  const taus   = [1.20, 0.95, 0.75, 0.60, 0.50, 0.45];   // seconds

  const nyquist = sr / 2;
  const attackSec = 0.005, releaseSec = 0.020;           // anti-click
  const attackSamples = Math.floor(attackSec * sr);
  const releaseSamples = Math.floor(releaseSec * sr);

  const softClip = (x, drive=0.75) => Math.tanh(x * drive);

  for (const [name, freq] of Object.entries(NOTES)){
    const buf = ctx.createBuffer(1, len, sr);
    const out = buf.getChannelData(0);

    // Subtle per-note detune for naturalness (±2 cents)
    const detuneCents = (Math.random() * 2 - 1) * 2;
    const detune = Math.pow(2, detuneCents / 1200);

    // Synthesize
    for (let n = 0; n < len; n++){
      const t = n / sr;
      let s = 0;

      for (let i = 0; i < ratios.length; i++){
        const f = freq * detune * ratios[i];
        if (f >= nyquist * 0.98) continue;              // band-limit with margin
        const tau = taus[i];

        // Tiny glide removes initial tick
        const glide = t < 0.006 ? (1 + 0.01 * (1 - t / 0.006)) : 1.0;
        const phase = 2 * Math.PI * f * glide * t + (i * 1.0472); // 60° offsets

        s += gains[i] * Math.sin(phase) * Math.exp(-t / tau);
      }

      out[n] = softClip(s, 0.75);
    }

    // Fade-in (attack)
    for (let i = 0; i < attackSamples && i < len; i++){
      const w = i / attackSamples;              // 0..1
      const smooth = w * w * (3 - 2 * w);       // smoothstep
      out[i] *= smooth;
    }
    // Fade-out (short tail)
    for (let i = 0; i < releaseSamples; i++){
      const idx = len - 1 - i;
      if (idx < 0) break;
      const w = i / r
