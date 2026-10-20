import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

function SettingsModule({ data, update, setData, theme, setTheme }) {
  const s = data.settings;
  const set = (k, v) =>
    update((d) => {
      d.settings[k] = v;
    });
  const [tmdb, setTmdb] = useState(s.tmdbKey || "");
  const [rawg, setRawg] = useState(s.rawgKey || "");
  const [saved, setSaved] = useState(false);
  const saveKeys = () => {
    update((d) => {
      d.settings.tmdbKey = tmdb.trim();
      d.settings.rawgKey = rawg.trim();
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };
  const exportJson = () => {
    const b = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(b);
    a.download = "atlas-" + today() + ".json";
    a.click();
  };
  const importJson = (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        setData({ ...structuredClone(blank), ...JSON.parse(r.result) });
        alert("Imported. Reloading.");
        location.reload();
      } catch (ex) {
        alert("Invalid JSON");
      }
    };
    r.readAsText(f);
  };
  const resetAll = () => {
    if (!confirm("Erase ALL Atlas data on this device? This cannot be undone."))
      return;
    localStorage.removeItem(KEY);
    localStorage.removeItem(OLD_KEY);
    location.reload();
  };
  return (
    <div>
      <Head
        title="Settings"
        sub="Everything is stored on this device. API keys are never uploaded."
      />
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>API keys</h3>
        <div className="sub" style={{ marginBottom: 8 }}>
          TMDB (Movies & TV): sign up at themoviedb.org {DOT} Settings {DOT} API{" "}
          {DOT} copy the <b>API Key (v3 auth)</b>. RAWG (Games): sign up at
          rawg.io/apidocs and copy your key. Paste below and hit{" "}
          <b>Save keys</b>.
        </div>
        <Field label="TMDB API key">
          <input
            value={tmdb}
            placeholder="paste v3 key"
            onChange={(e) => setTmdb(e.target.value)}
          />
        </Field>
        <Field label="RAWG API key">
          <input
            value={rawg}
            placeholder="paste key"
            onChange={(e) => setRawg(e.target.value)}
          />
        </Field>
        <div
          className="row"
          style={{ gap: 10, marginTop: 10, alignItems: "center" }}
        >
          <button onClick={saveKeys}>Save keys</button>
          {saved && <span className="sub">Saved {"\u2713"}</span>}
          {(s.tmdbKey || s.rawgKey) && (
            <span className="sub">
              {[s.tmdbKey && "TMDB set", s.rawgKey && "RAWG set"]
                .filter(Boolean)
                .join(DOT)}
            </span>
          )}
        </div>
      </article>
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Appearance</h3>
        <Field label="Theme" hint="System follows your OS light/dark setting.">
          <select
            value={s.theme}
            onChange={(e) => {
              set("theme", e.target.value);
              setTheme(e.target.value);
            }}
          >
            <option value="light">Light</option>
            <option value="dark">Dark</option>
            <option value="system">System</option>
          </select>
        </Field>
        <Field
          label="Start on"
          hint="Which section opens when you launch Atlas."
        >
          <select
            value={s.startView}
            onChange={(e) => set("startView", e.target.value)}
          >
            {NAV.flatMap((g) => g.items).map((it) => (
              <option key={it.id} value={it.id}>
                {it.name}
              </option>
            ))}
          </select>
        </Field>
      </article>
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Browsing</h3>
        <Field
          label="Anime title language"
          hint="Which title AniList shows for anime."
        >
          <select
            value={s.titleLang}
            onChange={(e) => set("titleLang", e.target.value)}
          >
            <option value="romaji">Romaji (Shingeki no Kyojin)</option>
            <option value="english">English (Attack on Titan)</option>
          </select>
        </Field>
        <label
          data-field
          className="row"
          style={{ gap: 8, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={!!s.confirmRemove}
            onChange={(e) => set("confirmRemove", e.target.checked)}
            style={{ width: "auto" }}
          />
          <span>Ask before removing an item from a library</span>
        </label>
      </article>
      <article className="card" style={{ marginBottom: 16 }}>
        <h3 style={{ marginTop: 0 }}>Device sync</h3>
        <div className="sub" style={{ marginBottom: 8 }}>
          When on, Atlas also saves a copy to the host at{" "}
          <code>/data/atlas.json</code> (via the LocalServe{" "}
          <code>/api/save</code> endpoint) and loads it on startup, so the same
          library follows you across browsers on this host. Off = this browser
          only.
        </div>
        <label
          data-field
          className="row"
          style={{ gap: 8, alignItems: "center" }}
        >
          <input
            type="checkbox"
            checked={!!s.sdSync}
            onChange={(e) => set("sdSync", e.target.checked)}
            style={{ width: "auto" }}
          />
          <span>Sync to host storage</span>
        </label>
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Your data</h3>
        <div className="sub" style={{ marginBottom: 10 }}>
          Anime & manga use <b>AniList</b> (no key). Movies & TV use <b>TMDB</b>
          . Games use <b>RAWG</b>. Finance, to-do, ideas and ML research are
          fully local to this browser.
        </div>
        <div className="row" style={{ gap: 10, flexWrap: "wrap" }}>
          <button className="outline small" onClick={exportJson}>
            {"\u2193"} Export JSON
          </button>
          <label className="button outline small" style={{ cursor: "pointer" }}>
            {"\u2191"} Import JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={importJson}
            />
          </label>
          <button className="outline small ghost" onClick={resetAll}>
            Erase all data
          </button>
        </div>
      </article>
    </div>
  );
}

/* ================= app shell ================= */

export { SettingsModule };
