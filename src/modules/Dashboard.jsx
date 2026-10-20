import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

function Dashboard({ data, go }) {
  const spendMonth = data.finance.txns
    .filter((t) => monthKey(t.date) === thisMonth())
    .reduce((s, t) => s + t.amount, 0);
  const invCur = data.investments.reduce((s, x) => s + x.current, 0);
  const watching = data.anime.filter((a) => a.status === "watching").length;
  const cards = [
    { k: "Spent this month", v: inr(spendMonth), id: "finance" },
    { k: "Portfolio value", v: inr(invCur), id: "investments" },
    {
      k: "Anime",
      v: data.anime.length,
      s: watching + " watching",
      id: "anime",
    },
    {
      k: "Manga",
      v: data.manga.length,
      s: data.manga.filter((x) => x.status === "Reading").length + " reading",
      id: "manga",
    },
    {
      k: "Open to-dos",
      v: data.todos.filter((t) => !t.done).length,
      s: data.todos.length + " total",
      id: "todos",
    },
    { k: "Ideas", v: data.ideas.length, s: "captured", id: "ideas" },
  ];
  return (
    <div>
      <Head title="Dashboard" sub="Everything you track, in one place." />
      <div className="statgrid">
        {cards.map((c) => (
          <article
            className="card stat"
            key={c.k}
            onClick={() => go(c.id)}
            style={{ cursor: "pointer" }}
          >
            <div className="k">{c.k}</div>
            <div className="v">
              {c.v} {c.s && <small>{c.s}</small>}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export { Dashboard };
