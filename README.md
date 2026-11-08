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

## FACT. (`/fact/`)
A debating platform: pick a side, label every point fact (with a source) or opinion, and the side that changes the most minds wins.
- `fact/index.html` — the page. `fact/core.mjs` — the debate rules, shared by the page and the server.
- `netlify/functions/fact-api.mjs` — the shared backend at `/api/fact`, storing debates in Netlify Blobs (store `fact`). `package.json` exists only so Netlify installs `@netlify/blobs`.
- **Moderation:** set `FACT_ADMIN_KEY` in Netlify → Site configuration → Environment variables (any long random string). Then open `/fact/#/mod`, enter it, and that browser can delete any debate, point or rebuttal.
- The four sample debates are added automatically the first time the live site is visited, with no votes.
- If the API can't be reached (e.g. opening the file locally), the page runs as an offline demo saved in that browser.
