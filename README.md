# Atlas

A personal "life OS" web app: one place to log and manage the anime, manga,
movies and games you consume, plus finance, investments, to-dos, ideas and your
ML-research progress. Local-first, data stored as a single JSON blob.

## Design

- **One shell, pluggable modules.** The sidebar lists Library modules (Anime,
  Manga, Movies, Games) and Life modules (Finance, Investments, To-do, Ideas,
  ML Research). Each is a self-contained React component; adding one does not
  touch the others.
- **Local-first JSON.** All state lives in one object in `localStorage`
  (`atlas.data.v1`) and can be exported / imported as a `.json` file. No server,
  no account, no cloud.
- **UI.** Semantic HTML styled by **oat** (knadh/oat, vendored in `vendor/`),
  light theme by default with a dark toggle and a violet accent, in
  `theme.css`. On phones the sidebar folds into an off-canvas drawer
  (hamburger + backdrop) for an app-like layout; desktop keeps the
  collapsible sidebar.
- **Build.** Vite + React. `npm run build` emits a self-contained static bundle
  to `dist/` (hashed, minified, no CDN) with relative asset paths, so it serves
  from any folder on the SD card.
- **Auto metadata.** Adding a title pulls cover art, score, year, counts and
  synopsis automatically: anime/manga from **AniList** (GraphQL, no key),
  movies from **TMDB**, games from **RAWG**. These run in the browser and only
  need internet at the moment you search.

## Develop & build

Vite + React project. Requires Node (built with Node 26 / npm 11).

```sh
cd Atlas
npm install        # one time
npm run dev        # local dev server with hot reload -> http://localhost:5173
npm run build      # production bundle -> dist/
npm run preview    # serve the built dist/ to sanity-check
```

`npm run build` is the artifact. Everything in `dist/` is static and
self-contained (React is bundled in, oat and theme are inlined, asset URLs are
relative), so it needs no server logic and no internet to load.

## ESP32 / Cardputer (SD card)

The device just serves files, so deploying is a copy:

1. `npm run build`
2. Copy the **contents of `dist/`** into the Nexus sites folder for Atlas
   (e.g. `sd_root/sites/atlas/`) and let the LocalServe host serve it.

Still browser-only: the anime/manga metadata lookups (Jikan) and the planned
Movies (TMDB) / Games (RAWG) need internet *at search time*; everything else,
including all finance maths, runs offline.

**Data persistence.** Today state lives in `localStorage` with JSON
export/import. The on-device step is to write the JSON back to the card via
LocalServe's save API (`PUT /api/save/atlas.json`) so it survives a browser wipe.

## Status

Built: the shell (light/dark oat UI, collapsible sidebar, mobile off-canvas
drawer) and **every module** - Dashboard, Anime, Manga, Movies, Games,
Finance, Investments, To-do, Ideas and ML Research - plus JSON export/import.
Anime/manga metadata comes from AniList, movies from TMDB, games from RAWG.
The full **Finance** module:

- **Expenses** - log amount / category / note / date; monthly total, all-time
  total and a this-month by-category breakdown.
- **SIP** - monthly-investment future value, invested vs gains, and the
  inflation-adjusted (today's-money) worth.
- **Compound** - lump-sum maturity with yearly/half-yearly/quarterly/monthly
  compounding, interest earned, real value.
- **Loan / EMI** - monthly EMI, total interest and total payment for any
  amount (e.g. the price of something you want to buy on credit).
- **Goal planner** - enter a cost today and a horizon; get the inflation-
  adjusted future cost and the monthly SIP (or one lump sum) needed to reach it.

Plus **Investments**: add holdings (invested vs current), per-holding and
portfolio-wide profit/loss and return %.

All finance maths run locally in the browser; INR is formatted with
`Intl.NumberFormat('en-IN')`.

Next: persist the JSON blob to the SD card via LocalServe's save API
(`PUT /api/save/atlas.json`) so it survives a browser wipe.
