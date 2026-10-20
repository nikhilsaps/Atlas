import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const S_STATUS = [
  ["towatch", "To watch"],
  ["acquire", "Download / Stream"],
  ["watching", "Watching"],
  ["watched", "Watched"],
];
const sName = (s) => (S_STATUS.find((x) => x[0] === s) || [, "\u2014"])[1];
function MoviesModule({ data, update }) {
  const [tab, setTab] = useState("browse");
  const [detail, setDetail] = useState(null);
  const key = data.settings.tmdbKey;
  const open = (it) => setDetail(it);
  return (
    <div>
      {detail ? (
        <ScreenDetail
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
            title="Movies & TV"
            sub="Browse films and series, track what you watch, rate them."
          />
          <Tabs
            tabs={[
              ["browse", "Browse"],
              ["library", "My library (" + data.movies.length + ")"],
            ]}
            tab={tab}
            set={setTab}
          />
          {!key && (
            <div className="empty">
              Add a free <b>TMDB</b> API key in <b>Settings</b> to browse. Your
              saved library still works without it.
            </div>
          )}
          {tab === "browse" && (
            <ScreenBrowse data={data} apiKey={key} onOpen={open} />
          )}
          {tab === "library" && (
            <ScreenLibrary
              data={data}
              update={update}
              onOpen={open}
              apiKey={key}
            />
          )}
        </>
      )}
    </div>
  );
}

function ScreenBrowse({ data, apiKey, onOpen }) {
  const [src, setSrc] = useState("movie");
  const [q, setQ] = useState("");
  const [cur, setCur] = useState({ which: "movie", query: "" });
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mbusy, setMbusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (which, query, pg) => {
    if (!apiKey) {
      setErr("Add a TMDB key in Settings.");
      return;
    }
    const first = pg === 1;
    if (first) {
      setBusy(true);
      setList([]);
      setCur({ which, query });
    } else setMbusy(true);
    setErr("");
    try {
      let d;
      if (which === "movie")
        d = await tmdb("/movie/popular?page=" + pg, apiKey);
      else if (which === "tv") d = await tmdb("/tv/popular?page=" + pg, apiKey);
      else
        d = await tmdb(
          "/search/multi?page=" + pg + "&query=" + encodeURIComponent(query),
          apiKey,
        );
      const items = (d.results || [])
        .filter((x) => x.media_type !== "person")
        .map((x) => mapScreen(x, which === "search" ? null : which))
        .filter((x) => x.image);
      setList((prev) =>
        first
          ? items
          : [
              ...prev,
              ...items.filter(
                (x) => !prev.some((p) => p.kind + p.tid === x.kind + x.tid),
              ),
            ],
      );
      setMore((d.page || pg) < (d.total_pages || pg));
      setPage(pg);
    } catch (ex) {
      setErr(
        ex.message === "BAD_KEY"
          ? "That TMDB key was rejected (check Settings)."
          : "Couldn't reach TMDB.",
      );
    }
    setBusy(false);
    setMbusy(false);
  };
  useEffect(() => {
    if (apiKey) load("movie", "", 1);
  }, [apiKey]);
  const tracked = useMemo(
    () => new Map(data.movies.map((m) => [m.kind + m.tid, m])),
    [data.movies],
  );
  const pick = (s) => {
    setSrc(s);
    load(s, "", 1);
  };
  const doSearch = (e) => {
    e.preventDefault();
    if (!q.trim()) return;
    setSrc("search");
    load("search", q, 1);
  };
  return (
    <div>
      <div className="chips">
        <button
          className={"small" + (src === "movie" ? "" : " outline")}
          onClick={() => pick("movie")}
        >
          Popular movies
        </button>
        <button
          className={"small" + (src === "tv" ? "" : " outline")}
          onClick={() => pick("tv")}
        >
          Popular TV
        </button>
        <form
          onSubmit={doSearch}
          className="row"
          style={{ flex: 1, minWidth: 220 }}
        >
          <input
            style={{ flex: 1 }}
            placeholder="Search movies & TV..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="small">Search</button>
        </form>
      </div>
      {err && <div className="empty">{err}</div>}
      {busy ? (
        <div className="spin">Loading from TMDB...</div>
      ) : (
        <>
          <div className="media">
            {list.map((a) => {
              const t = tracked.get(a.kind + a.tid);
              return (
                <div
                  className="mcard"
                  key={a.kind + a.tid}
                  onClick={() => onOpen(a)}
                  title={a.title}
                >
                  <div
                    className="cover"
                    style={{ backgroundImage: `url(${a.image || ""})` }}
                  >
                    {t && <span className="st">{sName(t.status)}</span>}
                    {a.score ? (
                      <span className="sc">{"\u2605 " + a.score}</span>
                    ) : null}
                    <span className="rk">
                      {a.kind === "tv" ? "TV" : "Film"}
                    </span>
                  </div>
                  <div className="b">
                    <div className="t">{a.title}</div>
                    <div className="m">
                      {[a.year, a.kind === "tv" ? "Series" : "Movie"]
                        .filter(Boolean)
                        .join(DOT)}
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
                  onClick={() => load(cur.which, cur.query, page + 1)}
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
function ScreenLibrary({ data, update, onOpen, apiKey }) {
  const [status, setStatus] = useState("all");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  let list = data.movies;
  if (status !== "all") list = list.filter((m) => m.status === status);
  const counts = Object.fromEntries(
    S_STATUS.map(([s]) => [
      s,
      data.movies.filter((m) => m.status === s).length,
    ]),
  );
  const checkEps = async () => {
    if (!apiKey) {
      setMsg("Add a TMDB key in Settings to check for new episodes.");
      return;
    }
    const tv = data.movies.filter(
      (m) => m.kind === "tv" && m.status === "watched",
    );
    if (tv.length === 0) {
      setMsg("No watched TV series to check. Mark a series Watched first.");
      return;
    }
    setBusy(true);
    setMsg("Checking " + tv.length + " series for new episodes...");
    let hits = 0;
    for (const m of tv) {
      try {
        const x = await tmdb("/tv/" + m.tid, apiKey);
        const tot = x.number_of_episodes || 0;
        const seen = m.progress || 0;
        if (tot > seen) {
          hits++;
          update((d) => {
            const it = d.movies.find((z) => z.tid === m.tid && z.kind === "tv");
            if (it) {
              it.totalEp = tot;
              it.newEps = tot - seen;
            }
          });
        }
      } catch (ex) {}
    }
    setMsg(
      hits === 0
        ? "All your watched series are caught up."
        : hits + " series have new episodes \u2014 see the +N badges below.",
    );
    setBusy(false);
  };
  return (
    <div>
      <div className="chips">
        <button className="small" disabled={busy} onClick={checkEps}>
          {busy ? "Checking..." : "\u21BB Check for new episodes"}
        </button>
      </div>
      {msg && <div className="notebanner">{msg}</div>}
      <div className="chips">
        <button
          className={"small" + (status === "all" ? "" : " outline")}
          onClick={() => setStatus("all")}
        >
          All ({data.movies.length})
        </button>
        {S_STATUS.map(([s, label]) => (
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
          Nothing saved yet. Open <b>Browse</b> and add a film or series.
        </div>
      ) : (
        <div className="media">
          {list.map((a) => (
            <div
              className="mcard"
              key={a.kind + a.tid}
              onClick={() => onOpen(a)}
              title={a.title}
            >
              <div
                className="cover"
                style={{ backgroundImage: `url(${a.image || ""})` }}
              >
                <span className="st">{sName(a.status)}</span>
                {a.rating ? (
                  <span className="sc">{"\u2605 " + a.rating}</span>
                ) : null}
                {a.newEps > 0 && <span className="badge">+{a.newEps}</span>}
                <span className="rk">{a.kind === "tv" ? "TV" : "Film"}</span>
              </div>
              <div className="b">
                <div className="t">{a.title}</div>
                <div className="m">
                  {[
                    a.year,
                    a.kind === "tv" &&
                      a.progress > 0 &&
                      "ep " + a.progress + (a.totalEp ? "/" + a.totalEp : ""),
                  ]
                    .filter(Boolean)
                    .join(DOT)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
function ScreenDetail({ item, data, update, apiKey, onOpen, onClose }) {
  const back = useBackClose(onClose);
  const [rich, setRich] = useState(null);
  const [openSeason, setOpenSeason] = useState(null);
  const [seasonData, setSeasonData] = useState({});
  useEffect(() => {
    let ok = true;
    setRich(null);
    setOpenSeason(null);
    setSeasonData({});
    if (apiKey)
      fetchScreenFull(item.kind, item.tid, apiKey)
        .then((x) => {
          if (ok) setRich(x);
        })
        .catch(() => {});
    return () => {
      ok = false;
    };
  }, [item.tid, item.kind]);
  const tracked = data.movies.find(
    (m) => m.tid === item.tid && m.kind === item.kind,
  );
  const totalEp = (rich && rich.number_of_episodes) || item.totalEp || 0;
  const genres =
    (rich && (rich.genres || []).map((g) => g.name)) || item.genres || [];
  const poster =
    item.image || (rich && rich.poster_path && TMDBIMG + rich.poster_path);
  const backdrop =
    rich && rich.backdrop_path
      ? "https://image.tmdb.org/t/p/w1280" + rich.backdrop_path
      : null;
  const base = () => ({
    tid: item.tid,
    kind: item.kind,
    title: item.title,
    image: poster,
    score: item.score,
    year: item.year,
    overview: (rich && rich.overview) || item.overview,
    genres,
    totalEp,
  });
  const ensure = (d, seed) => {
    let it = d.movies.find((m) => m.tid === item.tid && m.kind === item.kind);
    if (!it) {
      it = {
        ...base(),
        status: seed,
        rating: null,
        progress: 0,
        note: "",
        added: Date.now(),
        stageHist: {},
      };
      d.movies.push(it);
      setItemStage(it, S_STATUS, seed);
    }
    return it;
  };
  const setStage = (stage) =>
    update((d) => {
      const it = ensure(d, stage);
      setItemStage(it, S_STATUS, stage);
      if (stage === "watched") {
        if (item.kind === "tv" && totalEp) it.progress = totalEp;
        it.newEps = 0;
      }
    });
  const setRating = (r) =>
    update((d) => {
      const it = ensure(d, "watched");
      it.rating = it.rating === r ? null : r;
    });
  const setProg = (p) =>
    update((d) => {
      const it = ensure(d, "watching");
      let np = Math.max(0, p);
      it.progress = np;
      if (totalEp && np >= totalEp) {
        setItemStage(it, S_STATUS, "watched");
        it.newEps = 0;
      } else if (np > 0 && (it.status === "towatch" || it.status === "acquire"))
        setItemStage(it, S_STATUS, "watching");
      else if (it.status === "watched" && totalEp && np < totalEp)
        it.status = "watching";
    });
  const remove = () => {
    if (data.settings.confirmRemove && !confirm('Remove "' + item.title + '"?'))
      return;
    update((d) => {
      d.movies = d.movies.filter(
        (m) => !(m.tid === item.tid && m.kind === item.kind),
      );
    });
  };
  const loadSeason = async (sn) => {
    if (openSeason === sn) {
      setOpenSeason(null);
      return;
    }
    setOpenSeason(sn);
    if (!seasonData[sn] && apiKey) {
      try {
        const s = await fetchTvSeason(item.tid, sn, apiKey);
        setSeasonData((p) => ({ ...p, [sn]: s }));
      } catch (ex) {}
    }
  };
  const cast = (rich && rich.credits && rich.credits.cast) || [];
  const crew = (rich && rich.credits && rich.credits.crew) || [];
  const director = crew.find((c) => c.job === "Director");
  const creator = rich && rich.created_by && rich.created_by[0];
  const vids = (rich && rich.videos && rich.videos.results) || [];
  const trailer =
    vids.find((v) => v.site === "YouTube" && v.type === "Trailer") ||
    vids.find((v) => v.site === "YouTube");
  const prov =
    rich &&
    rich["watch/providers"] &&
    rich["watch/providers"].results &&
    rich["watch/providers"].results.US;
  const flat = (prov && prov.flatrate) || [];
  const recs =
    (rich && rich.recommendations && rich.recommendations.results) || [];
  const ext = rich && rich.external_ids;
  return (
    <DetailPage title={item.title} onClose={back}>
      {backdrop && (
        <div
          className="dbanner"
          style={{ backgroundImage: `url(${backdrop})` }}
        />
      )}
      <div className="dhero">
        <img className="dposter" src={poster} alt="" />
        <div className="dmeta">
          <h1>{item.title}</h1>
          {rich && rich.tagline ? (
            <div className="sub">
              <i>{rich.tagline}</i>
            </div>
          ) : null}
          <div className="sub">
            {[
              item.kind === "tv" ? "Series" : "Movie",
              item.year ||
                (rich &&
                  (rich.release_date || rich.first_air_date || "").slice(0, 4)),
              rich && rich.runtime && rich.runtime + " min",
              rich &&
                rich.number_of_seasons &&
                rich.number_of_seasons + " seasons",
              totalEp && totalEp + " episodes",
              item.score && "\u2605 " + item.score,
            ]
              .filter(Boolean)
              .join(DOT)}
          </div>
          {director && <div className="sub">Director: {director.name}</div>}
          {creator && <div className="sub">Creator: {creator.name}</div>}
          <div className="genres">
            {genres.map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          {tracked && (
            <div className="sub">
              In <b>{sName(tracked.status)}</b>
              {tracked.rating && (
                <>
                  {" "}
                  {DOT} your rating <b>{tracked.rating}/10</b>
                </>
              )}
              {item.kind === "tv" && tracked.progress > 0 && (
                <>
                  {" "}
                  {DOT} watched{" "}
                  <b>
                    {tracked.progress}
                    {totalEp ? "/" + totalEp : ""} ep
                  </b>
                </>
              )}
            </div>
          )}
          <Stepper stages={S_STATUS} item={tracked} onSet={setStage} />
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
          {item.kind === "tv" && (
            <div className="acts">
              <span className="sub" style={{ alignSelf: "center" }}>
                Episodes watched:
              </span>
              <input
                type="number"
                min="0"
                style={{ width: 80 }}
                value={tracked?.progress || 0}
                onChange={(e) =>
                  setProg(Math.round(Number(e.target.value) || 0))
                }
              />
              {totalEp ? (
                <span className="sub" style={{ alignSelf: "center" }}>
                  of {totalEp}
                </span>
              ) : null}
            </div>
          )}
        </div>
      </div>
      <div className="dsyn">
        {(rich && rich.overview) || item.overview || "No overview."}
      </div>
      {flat.length > 0 && (
        <section>
          <h3>Where to stream (US)</h3>
          <div className="chips">
            {flat.map((p) => (
              <span className="tag" key={p.provider_id}>
                {p.provider_name}
              </span>
            ))}
          </div>
        </section>
      )}
      {item.kind === "tv" && rich && rich.seasons && (
        <section>
          <h3>Seasons</h3>
          <div className="seasons">
            {rich.seasons
              .filter((s) => s.season_number > 0)
              .map((s) => (
                <div className="season" key={s.id}>
                  <button
                    className="shead"
                    onClick={() => loadSeason(s.season_number)}
                  >
                    <b>{s.name}</b>
                    <span className="sub">
                      {s.episode_count} ep
                      {s.air_date ? DOT + s.air_date.slice(0, 4) : ""}
                    </span>
                    <span className="grow" />
                    <span>
                      {openSeason === s.season_number ? "\u2212" : "+"}
                    </span>
                  </button>
                  {openSeason === s.season_number && (
                    <div className="seps">
                      {seasonData[s.season_number] ? (
                        (seasonData[s.season_number].episodes || []).map(
                          (ep) => (
                            <div className="sep" key={ep.id}>
                              <span className="n">{ep.episode_number}</span>
                              <div>
                                <div className="et">{ep.name}</div>
                                {ep.air_date && (
                                  <div className="sub">{ep.air_date}</div>
                                )}
                              </div>
                              {ep.vote_average ? (
                                <span className="sub">
                                  {"\u2605 " + ep.vote_average.toFixed(1)}
                                </span>
                              ) : null}
                            </div>
                          ),
                        )
                      ) : (
                        <div className="spin">Loading...</div>
                      )}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </section>
      )}
      {cast.length > 0 && (
        <section>
          <h3>Cast</h3>
          <div className="charrow">
            {cast.slice(0, 12).map((c) => (
              <div className="charcard" key={c.id}>
                <div
                  className="ci"
                  style={{
                    backgroundImage: `url(${c.profile_path ? TMDBIMG + c.profile_path : ""})`,
                  }}
                />
                <div className="cn">{c.name}</div>
                <div className="sub">{c.character}</div>
              </div>
            ))}
          </div>
        </section>
      )}
      {((ext && ext.imdb_id) || (rich && rich.homepage)) && (
        <section>
          <h3>Links</h3>
          <div className="chips">
            {ext && ext.imdb_id && (
              <a
                className="button small outline"
                href={"https://www.imdb.com/title/" + ext.imdb_id}
                target="_blank"
                rel="noreferrer"
              >
                IMDb
              </a>
            )}
            {rich && rich.homepage && (
              <a
                className="button small outline"
                href={rich.homepage}
                target="_blank"
                rel="noreferrer"
              >
                Official site
              </a>
            )}
          </div>
        </section>
      )}
      {trailer && (
        <section>
          <h3>Trailer</h3>
          <div className="trailer">
            <iframe
              src={"https://www.youtube.com/embed/" + trailer.key}
              title="trailer"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </section>
      )}
      {recs.length > 0 && (
        <section>
          <h3>You might also like</h3>
          <div className="relrow">
            {recs.slice(0, 12).map((r) => {
              const m = mapScreen(
                r,
                r.media_type === "tv"
                  ? "tv"
                  : r.media_type === "movie"
                    ? "movie"
                    : null,
              );
              return (
                <div
                  className="relcard"
                  key={m.kind + m.tid}
                  onClick={() => onOpen(m)}
                  title={m.title}
                >
                  <div
                    className="rc"
                    style={{ backgroundImage: `url(${m.image || ""})` }}
                  />
                  <div className="rt">{m.title}</div>
                  <div className="sub">
                    {m.kind === "tv" ? "TV" : "Film"}
                    {m.year ? DOT + m.year : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </DetailPage>
  );
}

/* ================= GAMES (RAWG) ================= */

export { MoviesModule };
