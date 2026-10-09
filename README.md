# Beat The Dealer

*Buckshot Roulette, but it's math.* A browser arcade game: each shell plays a generated riff at 120 BPM. Call LIVE or BLANK before the trigger.

- **LIVE**: the riff drops two octaves into a distorted 808.
- **BLANK**: the riff turns into glass bells.

Modes: Classic, Survival, VS Dealer, Daily Dealer. There is a local Hall of Fame for each mode.

## Play locally

Open `index.html` in a browser. KaTeX and the fonts load from a CDN.

The game runs on desktop and mobile. On a wide screen the stage stretches to the full width (same height, wider scope); on a phone it keeps the 9:16 reel frame. `F` toggles fullscreen.

## Code layout

The scripts are plain `<script>` files loaded in order. There is no build step, so the game also works over `file://`.

| File | Contents |
|---|---|
| `index.html` | Markup for the stage and every screen |
| `css/style.css` | Styles |
| `js/core.js` | Layout, persistence, timing, seeded RNG, music theory, riff generators |
| `js/audio.js` | Web Audio engine: master chain, routes, synth voices |
| `js/layers.js` | Note layers shared by picture and sound, scheduling, drums, KaTeX helpers |
| `js/game.js` | State, modes, difficulty, leaderboard, title theme, screens, run logic, math HUD |
| `js/render.js` | Canvas drawing: shells, scope, traces, intro animation |
| `js/main.js` | Main loop, input, auto-pause |

## Deploy to GitHub Pages

The workflow `.github/workflows/pages.yml` publishes the site on every push to `main`. One-time setup:

1. Create an empty repository on GitHub, for example `beat-the-dealer`.
2. Connect it and push:
   ```bash
   git remote add origin https://github.com/<you>/beat-the-dealer.git
   git push -u origin main
   ```
3. On GitHub, go to **Settings → Pages → Source** and choose **GitHub Actions**.

The game is then served at `https://<you>.github.io/beat-the-dealer/`.

## Controls

| Key | Action |
|---|---|
| `L` / `←` | LIVE |
| `B` / `→` | BLANK |
| `Esc` / `P` | Pause |
| `F` | Fullscreen (menus) |
