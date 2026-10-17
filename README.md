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
  dark theme with a violet accent in `theme.css`. No build step, no framework CSS.
- **Auto metadata.** Adding anime/manga searches **Jikan** (the free MyAnimeList
  API, no key) and pulls cover art, score, year, episode/chapter count and
  synopsis. Movies will use **TMDB**, games **RAWG** (both free). These run in
  the browser and only need internet at the moment you search.

## Run it

Any static server works (the app is plain static files):

```sh
cd Atlas
python -m http.server 8000
# open http://localhost:8000/
```

## ESP32 / Cardputer note

The app is static files, so it can be served off a microSD by the Nexus
LocalServe host. Two things to finish for true on-device use:

1. **Vendor the libraries.** The prototype loads React + Babel from a CDN
   (`index.html`), which needs internet the first time. The ship build will
   either (a) run a Vite production build and serve the vendored bundle, or
   (b) switch to Preact + htm (~10 KB, no build step) placed in `vendor/`.
2. **Persist to the card.** Instead of only `localStorage`, write the JSON back
   to the SD through LocalServe's save API (`PUT /api/save/atlas.json`) so the
   data lives on the card and survives a browser wipe.

## Status

Built: shell, dark oat UI, Dashboard, Anime + Manga (search, metadata, add,
status, filter, remove), JSON export/import, and the full **Finance** module:

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

Next: Movies (TMDB), Games (RAWG), To-do/planner, Ideas, ML-research log;
persist JSON to SD via LocalServe.
