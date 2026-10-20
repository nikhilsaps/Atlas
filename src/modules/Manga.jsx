import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const M_STATUS = ["Reading", "Completed", "Plan", "Dropped"];
function MangaModule({ data, update }) {
  const list = data.manga;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("All");
  const shown =
    filter === "All" ? list : list.filter((x) => x.status === filter);
  const removeIt = (id) =>
    update((d) => {
      d.manga = d.manga.filter((x) => x.id !== id);
    });
  const cycle = (id) =>
    update((d) => {
      const it = d.manga.find((x) => x.id === id);
      it.status = M_STATUS[(M_STATUS.indexOf(it.status) + 1) % M_STATUS.length];
    });
  return (
    <div>
      <Head title="Manga" sub={list.length + " in your library"}>
        <button onClick={() => setOpen(true)}>+ Add manga</button>
      </Head>
      <div className="chips">
        {["All", ...M_STATUS].map((s) => (
          <button
            key={s}
            className={"small" + (filter === s ? "" : " outline")}
            onClick={() => setFilter(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty">
          Nothing here yet. Hit <b>+ Add manga</b> to search and pull in cover
          art and details.
        </div>
      ) : (
        <div className="media">
          {shown.map((x) => (
            <div className="mcard" key={x.id} title={x.synopsis || ""}>
              <div
                className="cover"
                style={{ backgroundImage: `url(${x.cover || ""})` }}
              >
                <span className="st" onClick={() => cycle(x.id)}>
                  {x.status}
                </span>
                {x.score ? (
                  <span className="sc">{"\u2605 " + x.score}</span>
                ) : null}
              </div>
              <div className="b">
                <div className="t">{x.title}</div>
                <div className="m">
                  {[x.year, x.count && x.count + " ch"]
                    .filter(Boolean)
                    .join(DOT)}
                </div>
                <div style={{ marginTop: 6 }}>
                  <span className="tag" onClick={() => cycle(x.id)}>
                    status
                  </span>
                  <span className="tag" onClick={() => removeIt(x.id)}>
                    remove
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <MangaSearch
          onClose={() => setOpen(false)}
          onAdd={(it) =>
            update((d) => {
              if (!d.manga.some((e) => e.mal === it.mal))
                d.manga.push({
                  ...it,
                  id: uid(),
                  status: "Plan",
                  added: Date.now(),
                });
            })
          }
        />
      )}
    </div>
  );
}
function MangaSearch({ onClose, onAdd }) {
  const [q, setQ] = useState("");
  const [res, setRes] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async (e) => {
    e && e.preventDefault();
    if (!q.trim()) return;
    setBusy(true);
    setErr("");
    try {
      setRes(await searchManga(q));
    } catch (ex) {
      setErr("Lookup failed (offline?).");
    }
    setBusy(false);
  };
  return (
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <b>Add manga</b>
          <div className="grow" />
          <button className="ghost small" onClick={onClose}>
            close
          </button>
        </div>
        <div className="mc">
          <form className="row" onSubmit={run}>
            <input
              style={{ flex: 1 }}
              autoFocus
              placeholder="Search manga by title..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <button disabled={busy}>{busy ? "Searching..." : "Search"}</button>
          </form>
          <div className="sub" style={{ margin: "10px 2px" }}>
            Metadata from AniList.
            {err && (
              <span style={{ color: "var(--destructive,#f87171)" }}>
                {" "}
                {err}
              </span>
            )}
          </div>
          {res.map((x) => (
            <div className="sr" key={x.mal}>
              <img src={x.cover} alt="" />
              <div>
                <div style={{ fontWeight: 600 }}>{x.title}</div>
                <div className="sub">
                  {[x.year, x.type, x.score && "\u2605 " + x.score]
                    .filter(Boolean)
                    .join(DOT)}
                </div>
                <div>
                  {x.genres.map((g) => (
                    <span className="tag" key={g}>
                      {g}
                    </span>
                  ))}
                </div>
              </div>
              <button
                className="small"
                onClick={() => {
                  onAdd(x);
                  onClose();
                }}
              >
                Add
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ================= FINANCE ================= */

export { MangaModule };
