import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

function Investments({ data, update }) {
  const list = data.investments;
  const TYPES = [
    "Stock",
    "Mutual fund",
    "FD",
    "Gold",
    "Crypto",
    "Real estate",
    "Other",
  ];
  const [f, setF] = useState({
    name: "",
    type: "Stock",
    invested: "",
    current: "",
  });
  const add = (e) => {
    e.preventDefault();
    if (!f.name || !f.invested) return;
    update((d) => {
      d.investments.push({
        id: uid(),
        name: f.name.trim(),
        type: f.type,
        invested: Number(f.invested),
        current: Number(f.current || f.invested),
      });
    });
    setF({ name: "", type: "Stock", invested: "", current: "" });
  };
  const rm = (id) =>
    update((d) => {
      d.investments = d.investments.filter((x) => x.id !== id);
    });
  const tInv = list.reduce((s, x) => s + x.invested, 0),
    tCur = list.reduce((s, x) => s + x.current, 0),
    pl = tCur - tInv;
  return (
    <div>
      <Head title="Investments" sub="Your holdings and overall return." />
      <div className="statgrid" style={{ marginBottom: 20 }}>
        <article className="card stat">
          <div className="k">Invested</div>
          <div className="v">{inr(tInv)}</div>
        </article>
        <article className="card stat">
          <div className="k">Current value</div>
          <div className="v">{inr(tCur)}</div>
        </article>
        <article className="card stat">
          <div className="k">Profit / loss</div>
          <div className="v" style={{ color: pl >= 0 ? "#16a34a" : "#dc2626" }}>
            {inr(pl)} <small>{pct(tInv ? (pl / tInv) * 100 : 0)}</small>
          </div>
        </article>
      </div>
      <div className="calc">
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Add holding</h3>
          <form
            onSubmit={add}
            style={{ display: "flex", flexDirection: "column", gap: 12 }}
          >
            <Field label="Name">
              <input
                value={f.name}
                placeholder="e.g. Nifty 50 Index"
                onChange={(e) => setF({ ...f, name: e.target.value })}
              />
            </Field>
            <Field label="Type">
              <select
                value={f.type}
                onChange={(e) => setF({ ...f, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <NumIn
              label="Invested (\u20B9)"
              value={f.invested}
              set={(v) => setF({ ...f, invested: v })}
            />
            <NumIn
              label="Current value (\u20B9)"
              hint="blank = same as invested"
              value={f.current}
              set={(v) => setF({ ...f, current: v })}
            />
            <button>+ Add</button>
          </form>
        </article>
        <article className="card">
          <h3 style={{ marginTop: 0 }}>Holdings</h3>
          {list.length === 0 ? (
            <div className="empty">No holdings yet.</div>
          ) : (
            <div className="txlist">
              {list.map((x) => {
                const d = x.current - x.invested;
                return (
                  <div className="tx" key={x.id}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{x.name}</div>
                      <div className="cat">
                        {x.type}
                        {DOT}in {inr(x.invested)}
                      </div>
                    </div>
                    <div
                      className="amt"
                      style={{ color: d >= 0 ? "#16a34a" : "#dc2626" }}
                    >
                      {inr(x.current)}
                      <div className="cat" style={{ textAlign: "right" }}>
                        {d >= 0 ? "+" : ""}
                        {pct(x.invested ? (d / x.invested) * 100 : 0)}
                      </div>
                    </div>
                    <span className="tag" onClick={() => rm(x.id)}>
                      remove
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}

/* ================= dashboard ================= */

export { Investments };
