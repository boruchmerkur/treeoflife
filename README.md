# thetreeoflifebooks.com

Live site for The Tree of Life books — deployed via Netlify from this repo (branch: `main`). Every push to `main` auto-deploys.

## What's here
- `index.html`, `about.html`, `gallery.html`, `newsletter.html`, etc. — the site pages
- `assets/` — covers, gallery art, previews, `newsletter/` PDFs + `manifest.json`
- `games/` — Garden of Tanya, Geula Quest, Geulah Protocol
- `netlify.toml` + `netlify/` — config, `lily-edge` (edge analytics) and `lily-collect` (same-origin collector at `/api/lily`)

## Weekly newsletter update (the routine edit)
1. Upload the new PDF to `assets/newsletter/` (name it `issue-NN-parsha.pdf`).
2. Replace `assets/newsletter/current.pdf` with the same PDF.
3. Add the issue to the top of `assets/newsletter/manifest.json`.
Commit — Netlify redeploys automatically. rabbiboruch.com reads `current.pdf` and the manifest from here, so it updates too.

## Rules
- Cross-site links always use full domains: `https://rabbiboruch.com/`, `https://brandonrussell.art/`.
- Never link sister sites by folder path (`/rabbiboruch/...`) — those folders don't exist in this deploy.
