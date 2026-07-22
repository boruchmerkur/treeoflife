# Handoff — embedding the "Simanei Moshiach" cards on moshiach101.com

Paste this whole file into the Claude chat that manages **moshiach101.com**. It is a complete
spec for embedding a self-contained catalog of interactive Talmud "sign" cards that already
lives, hosted, at a fixed base URL. You do **not** build the cards — they exist. You only place
and configure the embeds.

---

## What already exists (do not rebuild)

A static folder is hosted on GitHub Pages at:

```
BASE = https://boruchmerkur.github.io/treeoflife/cards/
```

It contains:

- **17 self-contained card pages** — each one file, no external dependencies (React + fonts +
  all Hebrew/commentary text are inlined). Each renders one "sign of the era of Moshiach" with
  live controls: a Text toggle (עברית / English / Both), a Reveal toggle (one-by-one / open-all),
  and collapsible classical commentary. They cross-link to each other (Prev / Next / All signs).
- **`index.html`** — the full catalog landing (all 13 signs + 2 readings + 2 sugyot).
- **`random.html`** — a loader that shows ONE random card, with a floating "Another sign" button.
- **`manifest.json`** — the machine-readable index of every card (schema below).

Everything is driven by `manifest.json`. New cards appear automatically once added there —
no code change needed on moshiach101.com.

---

## `manifest.json` schema

```json
{
  "signs":    [ { "file": "card-08-insolence-swells.html", "sign": 1, "he": "חוצפא יסגא", "en": "Insolence is the last growth industry.", "src": "Mishnah Sotah 9:15" }, ... 13 total ],
  "readings": [ { "file": "reading-01-maharal.html", "he": "נצח ישראל · פרק לה", "en": "The ruin a new world requires", "src": "Maharal, Netzach Yisrael 35" }, ... ],
  "sugyot":   [ { "file": "reading-03-sanhedrin-97b.html", "he": "סנהדרין צז ע״ב", "en": "When will he come — and can we know?", "src": "Sanhedrin 97b" }, ... ]
}
```

Fields per entry: `file` (relative to BASE), `he` (Hebrew label), `en` (English one-liner),
`src` (citation), and on signs only, `sign` (1–13, the Talmud's order). Fetch it at
`BASE + "manifest.json"` to build your own menus/dropdowns if you want a custom picker.

---

## `random.html` — the loader you embed (URL parameters)

- `?pool=all` (default) — draw from all 17.
- `?pool=signs` — the 13 signs only (these are short; best for a fixed-height landing slot).
- `?pool=readings` / `?pool=sugyot` — the long-form pieces only.
- `?card=<file>` — pin one specific card (deep-link), e.g.
  `random.html?card=card-09-face-of-the-dog.html`.

The loader avoids repeating the same card twice in a row and fades each one in.

---

## Recipe 1 — a random sign in a page (recommended for the landing)

Signs are compact; 900px is a good fixed height with no inner scrollbar.

```html
<iframe src="https://boruchmerkur.github.io/treeoflife/cards/random.html?pool=signs"
        style="width:100%;height:900px;border:0;display:block;margin:0 auto;max-width:1040px"
        loading="lazy" title="A sign of the era of Moshiach"></iframe>
```

Drop `?pool=signs` to include the (taller) readings and sugyot; they scroll inside the frame.

## Recipe 2 — embed one specific card

```html
<iframe src="https://boruchmerkur.github.io/treeoflife/cards/card-09-face-of-the-dog.html"
        style="width:100%;height:900px;border:0" loading="lazy"></iframe>
```

## Recipe 3 — the whole browsable catalog

```html
<iframe src="https://boruchmerkur.github.io/treeoflife/cards/index.html"
        style="width:100%;height:1200px;border:0" loading="lazy"></iframe>
```

---

## Recipe 4 — your own card picker (a real dropdown on moshiach101.com)

If you want a native `<select>` on the site that swaps the embedded card, read the manifest and
build it. Self-contained snippet — paste into any page/post that allows raw HTML/JS:

```html
<div style="max-width:1040px;margin:0 auto">
  <label style="font:600 13px/1 system-ui,sans-serif;color:#5a5346;display:block;margin:0 0 8px">
    Choose a sign
    <select id="sim-pick"
            style="margin-left:8px;font:500 14px system-ui,sans-serif;padding:6px 10px;
                   border:1px solid #b8801a;border-radius:6px;background:#f7f4ee;color:#100f0d">
      <option value="">Loading…</option>
    </select>
  </label>
  <iframe id="sim-frame"
          style="width:100%;height:900px;border:0;margin-top:12px;display:block"
          loading="lazy" title="Simanei Moshiach card"></iframe>
</div>

<script>
(function () {
  var BASE   = "https://boruchmerkur.github.io/treeoflife/cards/";
  var sel    = document.getElementById("sim-pick");
  var frame  = document.getElementById("sim-frame");

  fetch(BASE + "manifest.json").then(function (r) { return r.json(); }).then(function (m) {
    sel.innerHTML = "";
    function group(label, arr) {
      if (!arr || !arr.length) return;
      var og = document.createElement("optgroup"); og.label = label;
      arr.forEach(function (e) {
        var o = document.createElement("option");
        o.value = e.file;
        o.textContent = (e.sign ? e.sign + ". " : "") + e.en + "  —  " + e.he;
        og.appendChild(o);
      });
      sel.appendChild(og);
    }
    group("The thirteen signs", m.signs);
    group("The readings",       m.readings);
    group("The sugya continues", m.sugyot);

    // start on a random sign
    var start = m.signs[Math.floor(Math.random() * m.signs.length)];
    sel.value = start.file;
    frame.src = BASE + start.file;
  });

  sel.addEventListener("change", function () {
    if (sel.value) frame.src = BASE + sel.value;
  });
})();
</script>
```

---

## Notes / gotchas

- **HTTPS only** — BASE is https; embed on https pages so nothing is mixed-content-blocked.
- **Height is fixed** in an iframe (iframes don't auto-size to content across origins). Pick a
  height per recipe above. If you must auto-resize, that needs a postMessage handshake the cards
  don't currently send — ask for it and it can be added.
- **New cards** — when a card is added to the folder + `manifest.json`, every embed above picks
  it up automatically. No edit needed here.
- **Fonts load from Google Fonts** at runtime (Frank Ruhl Libre, Inter, Source Serif 4); the rest
  is inlined and works offline.
