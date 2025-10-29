# Interactive Gamelan (C4→C5) — Ultra‑Low Latency

A browser‑based **chromatic gamelan** you can play by tapping/clicking pads or using the keyboard.
It uses **WebAudio** with `latencyHint: "interactive"` and **pre‑rendered AudioBuffers** for **instant attack** when you hit a note.

## Notes (13)

C4, C#4, D4, D#4, E4, F4, F#4, G4, G#4, A4, A#4, B4, C5

Keyboard mapping (US layout): `Z S X D C V G B H N J M ,` (black notes on S, D, G, H, J).

## Files

- `index.html` — UI + controls
- `main.js` — audio engine (modal synthesis, pre‑rendered buffers, limiter, pointer/keyboard handlers)
- `idea.html` — concept page
- `README.md` — this file

## Run locally

Open `index.html` in a modern browser (desktop or mobile). On first tap, click **Enable Sound** to unlock audio, then play.

## Deploy on GitHub Pages

1. Put all files in the repository **root**.
2. Push to GitHub.
3. Settings → Pages → **Source: Deploy from a branch**; Branch: `main` (or `master`); Folder: `/ (root)`.
4. Open your Pages URL. If you update, hard‑refresh (Cmd‑Shift‑R).

## Latency Tips

- Close background tabs/apps that use audio.
- Use wired headphones/speakers (Bluetooth can add delay).
- Keep your device on **Performance/High‑Power** mode if available.
- This app pre‑renders samples and avoids heavy processing in the strike path.
