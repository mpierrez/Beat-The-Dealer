# Beat The Dealer

*Buckshot Roulette, but it's math.* A browser game recreating an Instagram reel.

Each shell plays one of the reel's formula riffs:

- `n² mod 8`
- `(5x+3) mod 8`
- `T_n mod 7`
- a Reese bass
- a mirrored arpeggio
- 3 against 4
- a Shepard tone
- the final shell, which plays the magazine

Call **LIVE** or **BLANK** before the trigger. Then `f_out = f·2^s`:

| Shell | `s` | What happens |
|---|---|---|
| **LIVE** | −2 | The riff drops two octaves into a distorted 808 |
| **BLANK** | +1 | The riff rises one octave into glass bells |

Modes: Classic, Survival and VS Dealer (your personal best is saved locally).

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test
npm run build    # production build in dist/
```

## Code layout

React handles the screens. The game engine is a TypeScript port of `legacy/` (the original vanilla version).

| Path | Contents |
|---|---|
| `src/engine/core.ts` | Constants, persistence, timing, graph geometry, randomness, music theory |
| `src/engine/audio.ts` | Web Audio chain and every synth voice (with the phone / anti-crackle settings) |
| `src/engine/riffs.ts` | The reel's 8 shells, with random variations each game |
| `src/engine/layers.ts` | Notes for picture and sound, scheduling, drums |
| `src/engine/game.ts` | Modes, title music, run logic, math HUD |
| `src/engine/render.ts` | Canvas drawing and the per-frame loop |
| `src/ui/store.ts` | What the screens display (written by the engine) |
| `src/ui/screens.tsx`, `Stage.tsx`, `Tex.tsx` | React screens, using the same markup and CSS as legacy |
| `src/styles/style.css` | The legacy stylesheet |

## Deploy

`.github/workflows/pages.yml` tests, builds and publishes `dist/` to GitHub Pages on every push to `main`. To enable it, go to **Settings → Pages → Source** and choose **GitHub Actions**.
