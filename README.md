# Beat The Dealer

*Buckshot Roulette, but it's math.* A browser arcade game: each shell plays a generated riff at 120 BPM. Call LIVE or BLANK before the trigger.

- **LIVE**: the riff drops two octaves into a distorted 808.
- **BLANK**: the riff turns into glass bells.

Modes: Classic, Survival, VS Dealer, Daily Dealer. There is a local Hall of Fame for each mode.

## Play locally

Open `index.html` in a browser. KaTeX and the fonts load from a CDN.

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
