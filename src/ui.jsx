import React, { useState, useEffect, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "./core.jsx";

function Head({ title, sub, children }) {
  return (
    <div className="pagehead">
      <div>
        <h1>{title}</h1>
        {sub && <div className="sub">{sub}</div>}
      </div>
      <div className="grow" />
      {children}
    </div>
  );
}
function Field({ label, hint, children }) {
  return (
    <label data-field>
      {label}
      {children}
      {hint && <small data-hint>{hint}</small>}
    </label>
  );
}
function NumIn({ label, hint, value, set }) {
  return (
    <Field label={label} hint={hint}>
      <input
        type="number"
        inputMode="decimal"
        step="any"
        value={value}
        onChange={(e) =>
          set(e.target.value === "" ? "" : Number(e.target.value))
        }
      />
    </Field>
  );
}
function Out({ rows }) {
  return (
    <div className="out">
      {rows.map((r, i) => (
        <div className={"outrow" + (r.big ? " big" : "")} key={i}>
          <span className="lbl">{r.lbl}</span>
          <span className="num">{r.num}</span>
        </div>
      ))}
    </div>
  );
}
function Tabs({ tabs, tab, set }) {
  return (
    <div className="chips">
      {tabs.map(([id, name]) => (
        <button
          key={id}
          className={"small" + (tab === id ? "" : " outline")}
          onClick={() => set(id)}
        >
          {name}
        </button>
      ))}
    </div>
  );
}

/* ================= ANIME ================= */
function Soon({ label, note }) {
  return (
    <div>
      <Head title={label} sub="Module scaffolded, logic coming next." />
      <div className="empty">{note}</div>
    </div>
  );
}

/* ================= MOVIES & TV (TMDB) ================= */
function useBackClose(onClose) {
  useEffect(() => {
    history.pushState({ atlas: 1 }, "");
    const h = () => onClose();
    window.addEventListener("popstate", h);
    return () => window.removeEventListener("popstate", h);
  }, []);
  return () => history.back();
}
function DetailPage({ title, onClose, children }) {
  return (
    <div className="detailpage">
      <div className="dpbar">
        <button className="outline small" onClick={onClose}>
          {"\u2190"} Back
        </button>
        <span className="grow" />
      </div>
      {children}
    </div>
  );
}
function Stepper({ stages, item, onSet }) {
  const order = stages.map((x) => x[0]);
  const cur = item ? item.status : null;
  const ci = cur ? order.indexOf(cur) : -1;
  return (
    <div className="stepper">
      {stages.map(([s, label], i) => (
        <button
          key={s}
          className={
            "step" +
            (ci >= 0 && i <= ci ? " done" : "") +
            (s === cur ? " on" : "")
          }
          onClick={() => onSet(s)}
          title={"Set to " + label}
        >
          <span className="dot">{ci >= 0 && i < ci ? "\u2713" : i + 1}</span>
          <span className="slabel">{label}</span>
        </button>
      ))}
    </div>
  );
}

export { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper };
