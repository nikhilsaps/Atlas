import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const G_STATUS = [
  ["toplay", "To play"],
  ["acquire", "Install / Buy"],
  ["playing", "Playing"],
  ["played", "Played"],
];
const gName = (s) => (G_STATUS.find((x) => x[0] === s) || [, "\u2014"])[1];
function GamesModule({ data, update }) {
  const [tab, setTab] = useState("browse");
  const [detail, setDetail] = useState(null);
  const key = data.settings.rawgKey;
  const open = (it) => setDetail(it);
  return (
    <div>
      {detail ? (
        <GameDetail
          item={detail}
          data={data}
          update={update}
          apiKey={key}
          onOpen={open}
          onClose={() => setDetail(null)}
        />
      ) : (
        <>
          <Head
            title="Games"
            sub="Browse games, track your backlog, rate what you play."
          />
          <Tabs
            tabs={[
              ["browse", "Browse"],
              ["library", "My library (" + data.games.length + ")"],
            ]}
            tab={tab}
            set={setTab}
          />
          {!key && (
            <div className="empty">
              Add a free <b>RAWG</b> API key in <b>Settings</b> to browse. Your
              saved library still works without it.
            </div>
          )}
          {tab === "browse" && (
            <GameBrowse data={data} apiKey={key} onOpen={open} />
          )}
          {tab === "library" && <GameLibrary data={data} onOpen={open} />}
        </>
      )}
    </div>
  );
}

function GameBrowse({ data, apiKey, onOpen }) {
  const [q, setQ] = useState("");
  const [cur, setCur] = useState("");
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mbusy, setMbusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (query, pg) => {
    if (!apiKey) {
      setErr("Add a RAWG key in Settings.");
      return;
    }
    const first = pg === 1;
    if (first) {
      setBusy(true);
      setList([]);
      setCur(query);
    } else setMbusy(true);
    setErr("");
    try {
      const base = query
        ? "/games?search=" + encodeURIComponent(query)
        : "/games?ordering=-added&dates=2022-01-01,2026-12-31";
      const d = await rawg(base + "&page_size=24&page=" + pg, apiKey);
      const items = (d.results || []).map(mapGame).filter((x) => x.image);
      setList((prev) =>
        first
          ? items
          : [
              ...prev,
              ...items.filter((x) => !prev.some((p) => p.gid === x.gid)),
            ],
      );
      setMore(!!d.next);
      setPage(pg);
    } catch (ex) {
      setErr(
        ex.message === "BAD_KEY"
          ? "That RAWG key was rejected (check Settings)."
          : "Couldn't reach RAWG.",
      );
    }
    setBusy(false);
    setMbusy(false);
  };
  useEffect(() => {
    if (apiKey) load("", 1);
  }, [apiKey]);
  const tracked = useMemo(
    () => new Map(data.games.map((g) => [g.gid, g])),
    [data.games],
  );
  const doSearch = (e) => {
    e.preventDefault();
    load(q, 1);
  };
  return (
    <div>
      <div className="chips">
        <form
          onSubmit={doSearch}
          className="row"
          style={{ flex: 1, minWidth: 220 }}
        >
          <input
            style={{ flex: 1 }}
            placeholder="Search games (blank = popular)..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="small">Search</button>
        </form>
      </div>
      {err && <div className="empty">{err}</div>}
      {busy ? (
        <div className="spin">Loading from RAWG...</div>
      ) : (
        <>
          <div className="media">
            {list.map((a) => {
              const t = tracked.get(a.gid);
              return (
                <div
                  className="mcard"
                  key={a.gid}
                  onClick={() => onOpen(a)}
                  title={a.title}
                >
                  <div
                    className="cover"
                    style={{ backgroundImage: `url(${a.image || ""})` }}
                  >
                    {t && <span className="st">{gName(t.status)}</span>}
                    {a.metacritic ? (
                      <span className="sc">{a.metacritic}</span>
                    ) : a.score ? (
                      <span className="sc">{"\u2605 " + a.score}</span>
                    ) : null}
                  </div>
                  <div className="b">
                    <div className="t">{a.title}</div>
                    <div className="m">
                      {[a.year, (a.genres || [])[0]].filter(Boolean).join(DOT)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {list.length > 0 && (
            <div className="loadmore">
              <span className="sub">{list.length} shown</span>
              {more && (
                <button
                  className="outline small"
                  disabled={mbusy}
                  onClick={() => load(cur, page + 1)}
                >
                  {mbusy ? "Loading..." : "Load more"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
function GameLibrary({ data, onOpen }) {
  const [status, setStatus] = useState("all");
  let list = data.games;
  if (status !== "all") list = list.filter((g) => g.status === status);
  const counts = Object.fromEntries(
    G_STATUS.map(([s]) => [s, data.games.filter((g) => g.status === s).length]),
  );
  return (
    <div>
      <div className="chips">
        <button
          className={"small" + (status === "all" ? "" : " outline")}
          onClick={() => setStatus("all")}
        >
          All ({data.games.length})
        </button>
        {G_STATUS.map(([s, label]) => (
          <button
            key={s}
            className={"small" + (status === s ? "" : " outline")}
            onClick={() => setStatus(s)}
          >
            {label} ({counts[s]})
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          Nothing saved yet. Open <b>Browse</b> and add a game.
        </div>
      ) : (
        <div className="media">
          {list.map((a) => (
            <div
              className="mcard"
              key={a.gid}
              onClick={() => onOpen(a)}
              title={a.title}
            >
              <div
                className="cover"
                style={{ backgroundImage: `url(${a.image || ""})` }}
              >
                <span className="st">{gName(a.status)}</span>
                {a.rating ? (
                  <span className="sc">{"\u2605 " + a.rating}</span>
                ) : null}
              </div>
              <div className="b">
                <div className="t">{a.title}</div>
                <div className="m">
                  {[a.year, (a.genres || [])[0]].filter(Boolean).join(DOT)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function GameDetail({ item, data, update, apiKey, onOpen, onClose }) {
  const back = useBackClose(onClose);
  const [rich, setRich] = useState(null);
  const [shots, setShots] = useState([]);
  useEffect(() => {
    let ok = true;
    setRich(null);
    setShots([]);
    if (apiKey) {
      fetchGameFull(item.gid, apiKey)
        .then((x) => {
          if (ok) setRich(x);
        })
        .catch(() => {});
      fetchGameShots(item.gid, apiKey)
        .then((s) => {
          if (ok) setShots(s);
        })
        .catch(() => {});
    }
    return () => {
      ok = false;
    };
  }, [item.gid]);
  const tracked = data.games.find((g) => g.gid === item.gid);
  const genres =
    (rich && (rich.genres || []).map((g) => g.name)) || item.genres || [];
  const image = item.image || (rich && rich.background_image);
  const base = () => ({
    gid: item.gid,
    title: item.title,
    image,
    score: item.score,
    metacritic: item.metacritic,
    year: item.year,
    genres,
  });
  const ensure = (d, seed) => {
    let it = d.games.find((g) => g.gid === item.gid);
    if (!it) {
      it = {
        ...base(),
        status: seed,
        rating: null,
        note: "",
        added: Date.now(),
        stageHist: {},
      };
      d.games.push(it);
      setItemStage(it, G_STATUS, seed);
    }
    return it;
  };
  const setStage = (stage) =>
    update((d) => {
      const it = ensure(d, stage);
      setItemStage(it, G_STATUS, stage);
    });
  const setRating = (r) =>
    update((d) => {
      const it = ensure(d, "played");
      it.rating = it.rating === r ? null : r;
    });
  const remove = () => {
    if (data.settings.confirmRemove && !confirm('Remove "' + item.title + '"?'))
      return;
    update((d) => {
      d.games = d.games.filter((g) => g.gid !== item.gid);
    });
  };
  const plats =
    (rich && (rich.platforms || []).map((p) => p.platform.name)) ||
    item.platforms ||
    [];
  const stores = (rich && rich.stores) || [];
  const devs = (rich && (rich.developers || []).map((x) => x.name)) || [];
  const pubs = (rich && (rich.publishers || []).map((x) => x.name)) || [];
  const tags =
    (rich &&
      (rich.tags || [])
        .filter((t) => t.language === "eng")
        .slice(0, 15)
        .map((t) => t.name)) ||
    [];
  const bg = rich && rich.background_image_additional;
  return (
    <DetailPage title={item.title} onClose={back}>
      {(bg || image) && (
        <div
          className="dbanner"
          style={{ backgroundImage: `url(${bg || image})` }}
        />
      )}
      <div className="dhero">
        <img className="dposter" src={image} alt="" />
        <div className="dmeta">
          <h1>{item.title}</h1>
          <div className="sub">
            {[
              item.year || (rich && (rich.released || "").slice(0, 4)),
              (rich && rich.metacritic) || item.metacritic
                ? "Metacritic " + ((rich && rich.metacritic) || item.metacritic)
                : null,
              rich && rich.rating && "\u2605 " + rich.rating,
              rich && rich.playtime && rich.playtime + "h avg",
            ]
              .filter(Boolean)
              .join(DOT)}
          </div>
          {devs.length > 0 && (
            <div className="sub">Developer: {devs.join(", ")}</div>
          )}
          {pubs.length > 0 && (
            <div className="sub">Publisher: {pubs.join(", ")}</div>
          )}
          {plats.length > 0 && <div className="sub">{plats.join(DOT)}</div>}
          <div className="genres">
            {genres.map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          {tracked && (
            <div className="sub">
              In <b>{gName(tracked.status)}</b>
              {tracked.rating && (
                <>
                  {" "}
                  {DOT} your rating <b>{tracked.rating}/10</b>
                </>
              )}
            </div>
          )}
          <Stepper stages={G_STATUS} item={tracked} onSet={setStage} />
          <div className="acts">
            <span className="sub" style={{ alignSelf: "center" }}>
              Rate:
            </span>
            {[2, 4, 6, 8, 10].map((r) => (
              <button
                key={r}
                className={"small" + (tracked?.rating === r ? "" : " outline")}
                onClick={() => setRating(r)}
              >
                {r}
              </button>
            ))}
            {tracked && (
              <button className="small ghost" onClick={remove}>
                remove
              </button>
            )}
          </div>
        </div>
      </div>
      <div className="dsyn" style={{ whiteSpace: "pre-wrap" }}>
        {(rich && rich.description_raw) || item.overview || "No description."}
      </div>
      {stores.length > 0 && (
        <section>
          <h3>Where to buy</h3>
          <div className="chips">
            {stores.map((s) => (
              <a
                key={s.id}
                className="button small outline"
                href={s.url || "https://" + (s.store && s.store.domain)}
                target="_blank"
                rel="noreferrer"
              >
                {s.store && s.store.name}
              </a>
            ))}
          </div>
        </section>
      )}
      {tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <div className="genres">
            {tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
        </section>
      )}
      {shots.length > 0 && (
        <section>
          <h3>Screenshots</h3>
          <div className="shots">
            {shots.map((s, i) => (
              <img key={i} src={s} alt="" />
            ))}
          </div>
        </section>
      )}
      {rich && rich.website && (
        <section>
          <h3>Links</h3>
          <div className="chips">
            <a
              className="button small outline"
              href={rich.website}
              target="_blank"
              rel="noreferrer"
            >
              Official site
            </a>
          </div>
        </section>
      )}
    </DetailPage>
  );
}

/* ================= TO-DO & PLAN ================= */

export { GamesModule };
