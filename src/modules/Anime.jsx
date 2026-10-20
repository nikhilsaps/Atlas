import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const A_STATUS = [
  ["towatch", "To watch"],
  ["acquire", "Download / Stream"],
  ["watching", "Watching"],
  ["watched", "Watched"],
];
const statusName = (s) => (A_STATUS.find((x) => x[0] === s) || [, "\u2014"])[1];

function AnimeModule({ data, update }) {
  const [tab, setTab] = useState("browse");
  const [detail, setDetail] = useState(null);
  const open = (it) => setDetail(it);
  return (
    <div>
      {detail ? (
        <AnimeDetail
          mal={detail}
          data={data}
          update={update}
          onOpen={open}
          onClose={() => setDetail(null)}
        />
      ) : (
        <>
          <Head
            title="Anime"
            sub="Browse the catalogue, track what you watch, rank your favourites."
          />
          <Tabs
            tabs={[
              ["browse", "Browse"],
              ["library", "My library (" + data.anime.length + ")"],
              ["ranked", "Ranked"],
            ]}
            tab={tab}
            set={setTab}
          />
          {tab === "browse" && <AnimeBrowse data={data} onOpen={open} />}
          {tab === "library" && (
            <AnimeLibrary data={data} update={update} onOpen={open} />
          )}
          {tab === "ranked" && (
            <AnimeRanked data={data} update={update} onOpen={open} />
          )}
        </>
      )}
    </div>
  );
}

function AnimeBrowse({ data, onOpen }) {
  const [src, setSrc] = useState("season");
  const [q, setQ] = useState("");
  const [cur, setCur] = useState({ which: "season", query: "" });
  const [list, setList] = useState([]);
  const [page, setPage] = useState(1);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mbusy, setMbusy] = useState(false);
  const [err, setErr] = useState("");
  const load = async (which, query, pg) => {
    const first = pg === 1;
    if (first) {
      setBusy(true);
      setList([]);
      setCur({ which, query });
    } else setMbusy(true);
    setErr("");
    try {
      let r;
      if (which === "top") r = await fetchTop(pg);
      else if (which === "season") r = await fetchSeason(pg);
      else r = await fetchSearch(query, pg);
      setList((prev) =>
        first
          ? r.items
          : [
              ...prev,
              ...r.items.filter((x) => !prev.some((p) => p.mal === x.mal)),
            ],
      );
      setMore(r.more);
      setPage(pg);
    } catch (ex) {
      setErr(
        first
          ? "Couldn't reach AniList (need internet to browse)."
          : "Couldn't load more.",
      );
    }
    setBusy(false);
    setMbusy(false);
  };
  useEffect(() => {
    load("season", "", 1);
  }, []);
  const tracked = useMemo(
    () => new Map(data.anime.map((a) => [a.mal, a])),
    [data.anime],
  );
  const pick = (s) => {
    setSrc(s);
    if (s !== "search") load(s, "", 1);
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
          className={"small" + (src === "season" ? "" : " outline")}
          onClick={() => pick("season")}
        >
          This season
        </button>
        <button
          className={"small" + (src === "top" ? "" : " outline")}
          onClick={() => pick("top")}
        >
          Top anime
        </button>
        <form
          onSubmit={doSearch}
          className="row"
          style={{ flex: 1, minWidth: 220 }}
        >
          <input
            style={{ flex: 1 }}
            placeholder="Search any anime by title..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <button className="small">Search</button>
        </form>
      </div>
      {err && <div className="empty">{err}</div>}
      {busy ? (
        <div className="spin">Loading from AniList...</div>
      ) : (
        <>
          <div className="media">
            {list.map((a) => {
              const t = tracked.get(a.mal);
              return (
                <div
                  className="mcard"
                  key={a.mal}
                  onClick={() => onOpen(a)}
                  title={a.title}
                >
                  <div
                    className="cover"
                    style={{ backgroundImage: `url(${a.image || ""})` }}
                  >
                    {t && <span className="st">{statusName(t.status)}</span>}
                    {a.score ? (
                      <span className="sc">{"\u2605 " + a.score}</span>
                    ) : null}
                    {t && t.rank != null && (
                      <span className="rk">#{t.rank}</span>
                    )}
                  </div>
                  <div className="b">
                    <div className="t">{a.title}</div>
                    <div className="m">
                      {[a.year, a.type, a.episodes && a.episodes + " ep"]
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

/* ranking: insert at R pushes everything >=R down by one */
function clearRankIn(d, mal) {
  const it = d.anime.find((a) => a.mal === mal);
  if (!it || it.rank == null) return;
  const old = it.rank;
  it.rank = null;
  d.anime.forEach((a) => {
    if (a.rank != null && a.rank > old) a.rank--;
  });
}
function RankControl({ data, update, base, mal }) {
  const tracked = data.anime.find((a) => a.mal === mal);
  const maxRank =
    data.anime.filter((a) => a.rank != null).length +
    (tracked?.rank != null ? 0 : 1);
  const [val, setVal] = useState("");
  const apply = () => {
    const R = Math.max(1, Math.min(maxRank, Math.round(Number(val) || 1)));
    update((d) => {
      let it = d.anime.find((a) => a.mal === mal);
      if (!it) {
        it = {
          ...base(),
          status: "watched",
          progress: 0,
          rank: null,
          added: Date.now(),
        };
        d.anime.push(it);
      }
      clearRankIn(d, mal);
      it = d.anime.find((a) => a.mal === mal);
      d.anime.forEach((a) => {
        if (a !== it && a.rank != null && a.rank >= R) a.rank++;
      });
      it.rank = R;
    });
    setVal("");
  };
  return (
    <span className="row" style={{ gap: 6 }}>
      <input
        type="number"
        min="1"
        style={{ width: 68 }}
        placeholder={tracked?.rank != null ? "#" + tracked.rank : "rank"}
        value={val}
        onChange={(e) => setVal(e.target.value)}
      />
      <button className="small" onClick={apply}>
        Set rank
      </button>
      {tracked?.rank != null && (
        <button
          className="small ghost"
          onClick={() => update((d) => clearRankIn(d, mal))}
        >
          unrank
        </button>
      )}
    </span>
  );
}

function AnimeDetail({ mal, data, update, onOpen, onClose }) {
  const back = useBackClose(onClose);
  const lang = data.settings.titleLang;
  const [rich, setRich] = useState(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    let ok = true;
    setRich(null);
    setErr("");
    fetchAnimeFull(mal.mal)
      .then((f) => {
        if (ok) setRich(f);
      })
      .catch(() => {
        if (ok) setErr("Couldn't load full details from AniList.");
      });
    return () => {
      ok = false;
    };
  }, [mal.mal]);
  const tracked = data.anime.find((a) => a.mal === mal.mal);
  const total = (rich && rich.episodes) || mal.episodes || 0;
  const title = rich ? pickTitle(rich.title, lang) : mal.title;
  const poster =
    (rich &&
      rich.coverImage &&
      (rich.coverImage.extraLarge || rich.coverImage.large)) ||
    mal.image;
  const base = () => ({
    mal: mal.mal,
    title,
    image: poster,
    score:
      rich && rich.averageScore != null
        ? +(rich.averageScore / 10).toFixed(1)
        : mal.score,
    year: (rich && rich.seasonYear) || mal.year,
    type: (rich && rich.format) || mal.type,
    episodes: total,
    genres: (rich && rich.genres) || mal.genres,
    synopsis: rich ? stripHtml(rich.description) : mal.synopsis,
  });
  const ensure = (d, seed) => {
    let it = d.anime.find((a) => a.mal === mal.mal);
    if (!it) {
      it = {
        ...base(),
        status: seed,
        progress: 0,
        rank: null,
        rating: null,
        note: "",
        added: Date.now(),
        stageHist: {},
      };
      d.anime.push(it);
      setItemStage(it, A_STATUS, seed);
    }
    return it;
  };
  const setStage = (stage) =>
    update((d) => {
      const it = ensure(d, stage);
      setItemStage(it, A_STATUS, stage);
      if (stage === "watched" && total) it.progress = total;
    });
  const setProgress = (p) =>
    update((d) => {
      const it = ensure(d, "watching");
      let np = it.progress === p ? p - 1 : p;
      if (np < 0) np = 0;
      it.progress = np;
      if (total && np >= total) setItemStage(it, A_STATUS, "watched");
      else if (np > 0 && (it.status === "towatch" || it.status === "acquire"))
        setItemStage(it, A_STATUS, "watching");
      else if (it.status === "watched" && total && np < total)
        it.status = "watching";
    });
  const setRating = (r) =>
    update((d) => {
      const it = ensure(d, "watched");
      it.rating = it.rating === r ? null : r;
    });
  const remove = () => {
    if (
      data.settings.confirmRemove &&
      !confirm('Remove "' + title + '" from your library?')
    )
      return;
    update((d) => {
      clearRankIn(d, mal.mal);
      d.anime = d.anime.filter((a) => a.mal !== mal.mal);
    });
  };
  const progress = tracked?.progress || 0;
  const openRel = (node) => onOpen(mapAnime(node));
  const banner = rich && rich.bannerImage;
  const trailer =
    rich && rich.trailer && rich.trailer.site === "youtube"
      ? rich.trailer
      : null;
  const edges = rich ? (rich.relations && rich.relations.edges) || [] : [];
  const sequels = edges.filter(
    (e) => e.relationType === "SEQUEL" && e.node.type === "ANIME",
  );
  return (
    <DetailPage title={title} onClose={back}>
      {banner && (
        <div
          className="dbanner"
          style={{ backgroundImage: `url(${banner})` }}
        />
      )}
      <div className="dhero">
        <img className="dposter" src={poster} alt="" />
        <div className="dmeta">
          <h1>{title}</h1>
          <div className="sub">
            {[
              mal.year || (rich && rich.seasonYear),
              (rich && rich.format) || mal.type,
              total && total + " episodes",
              rich && rich.duration && rich.duration + " min/ep",
              rich && rich.averageScore && "\u2605 " + rich.averageScore / 10,
              rich && rich.status,
            ]
              .filter(Boolean)
              .join(DOT)}
          </div>
          {rich && rich.studios && rich.studios.nodes.length > 0 && (
            <div className="sub">
              Studio: {rich.studios.nodes.map((x) => x.name).join(", ")}
            </div>
          )}
          <div className="genres">
            {((rich && rich.genres) || mal.genres || []).map((g) => (
              <span className="tag" key={g}>
                {g}
              </span>
            ))}
          </div>
          {tracked && (
            <div className="sub">
              In <b>{statusName(tracked.status)}</b>
              {tracked.rank != null && (
                <>
                  {" "}
                  {DOT} ranked <b>#{tracked.rank}</b>
                </>
              )}
              {progress > 0 && (
                <>
                  {" "}
                  {DOT} watched{" "}
                  <b>
                    {progress}
                    {total ? "/" + total : ""}
                  </b>
                </>
              )}
              {tracked.rating != null && (
                <>
                  {" "}
                  {DOT} your rating <b>{tracked.rating}/10</b>
                </>
              )}
            </div>
          )}
          <Stepper stages={A_STATUS} item={tracked} onSet={setStage} />
          <div className="acts">
            <RankControl
              data={data}
              update={update}
              base={base}
              mal={mal.mal}
            />
            {tracked && (
              <button className="small ghost" onClick={remove}>
                remove
              </button>
            )}
          </div>
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
          </div>
        </div>
      </div>
      {sequels.length > 0 && (
        <div className="notebanner">
          Sequels exist:{" "}
          {sequels.map((e) => pickTitle(e.node.title, lang)).join(", ")}. Use{" "}
          <b>Check for new seasons</b> in your library to add them.
        </div>
      )}
      <div className="dsyn" style={{ whiteSpace: "pre-wrap" }}>
        {rich ? stripHtml(rich.description) : mal.synopsis || "No synopsis."}
      </div>
      {err && <div className="sub">{err}</div>}
      {total > 0 && (
        <section>
          <h3>
            Episodes{" "}
            {progress > 0 && (
              <span className="sub">
                ({progress}/{total} watched)
              </span>
            )}
          </h3>
          <div className="epgrid">
            {Array.from({ length: total }, (_, i) => i + 1).map((nn) => (
              <button
                key={nn}
                className={"epbox" + (nn <= progress ? " seen" : "")}
                onClick={() => setProgress(nn)}
                title="Click to mark watched up to here"
              >
                {nn}
              </button>
            ))}
          </div>
        </section>
      )}
      {rich && rich.streamingEpisodes && rich.streamingEpisodes.length > 0 && (
        <section>
          <h3>Streaming episodes</h3>
          <div className="strow">
            {rich.streamingEpisodes.slice(0, 24).map((e, i) => (
              <a
                key={i}
                className="stcard"
                href={e.url}
                target="_blank"
                rel="noreferrer"
              >
                <div
                  className="th"
                  style={{ backgroundImage: `url(${e.thumbnail || ""})` }}
                />
                <div className="stt">{e.title || "Episode " + (i + 1)}</div>
                <div className="sub">{e.site}</div>
              </a>
            ))}
          </div>
        </section>
      )}
      {rich && rich.characters && rich.characters.edges.length > 0 && (
        <section>
          <h3>Characters</h3>
          <div className="charrow">
            {rich.characters.edges.map((e, i) => (
              <div className="charcard" key={i}>
                <div
                  className="ci"
                  style={{
                    backgroundImage: `url(${(e.node.image && e.node.image.medium) || ""})`,
                  }}
                />
                <div className="cn">{e.node.name.full}</div>
                <div className="sub">{e.role}</div>
                {e.voiceActors && e.voiceActors[0] && (
                  <div className="sub">{e.voiceActors[0].name.full}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
      {edges.filter((e) => e.node.type === "ANIME").length > 0 && (
        <section>
          <h3>Related</h3>
          <div className="relrow">
            {edges
              .filter((e) => e.node.type === "ANIME")
              .map((e, i) => (
                <div
                  className="relcard"
                  key={i}
                  onClick={() => openRel(e.node)}
                  title={pickTitle(e.node.title, lang)}
                >
                  <div
                    className="rc"
                    style={{
                      backgroundImage: `url(${(e.node.coverImage && (e.node.coverImage.extraLarge || e.node.coverImage.large)) || ""})`,
                    }}
                  />
                  <div className="rt">{pickTitle(e.node.title, lang)}</div>
                  <div className="sub">{e.relationType}</div>
                </div>
              ))}
          </div>
        </section>
      )}
      {rich && rich.tags && rich.tags.length > 0 && (
        <section>
          <h3>Tags</h3>
          <div className="genres">
            {rich.tags
              .filter((t) => !t.isGeneralSpoiler)
              .slice(0, 20)
              .map((t) => (
                <span className="tag" key={t.name}>
                  {t.name}
                </span>
              ))}
          </div>
        </section>
      )}
      {rich && rich.externalLinks && rich.externalLinks.length > 0 && (
        <section>
          <h3>Where to watch / links</h3>
          <div className="chips">
            {rich.externalLinks.map((l, i) => (
              <a
                key={i}
                className="button small outline"
                href={l.url}
                target="_blank"
                rel="noreferrer"
              >
                {l.site}
              </a>
            ))}
          </div>
        </section>
      )}
      {trailer && (
        <section>
          <h3>Trailer</h3>
          <div className="trailer">
            <iframe
              src={"https://www.youtube.com/embed/" + trailer.id}
              title="trailer"
              frameBorder="0"
              allowFullScreen
            />
          </div>
        </section>
      )}
    </DetailPage>
  );
}

function AnimeLibrary({ data, update, onOpen }) {
  const [status, setStatus] = useState("all");
  const [genre, setGenre] = useState("All");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const genres = useMemo(
    () => [
      "All",
      ...Array.from(new Set(data.anime.flatMap((a) => a.genres || []))).sort(),
    ],
    [data.anime],
  );
  let list = data.anime;
  if (status !== "all") list = list.filter((a) => a.status === status);
  if (genre !== "All")
    list = list.filter((a) => (a.genres || []).includes(genre));
  const counts = Object.fromEntries(
    A_STATUS.map(([s]) => [s, data.anime.filter((a) => a.status === s).length]),
  );
  const checkSeasons = async () => {
    const watched = data.anime.filter((a) => a.status === "watched");
    if (watched.length === 0) {
      setMsg("Mark some anime as Watched first, then I can look for sequels.");
      return;
    }
    setBusy(true);
    setMsg(
      "Checking " +
        watched.length +
        " watched title" +
        (watched.length > 1 ? "s" : "") +
        " for new seasons...",
    );
    const have = new Set(data.anime.map((a) => a.mal));
    const found = [];
    for (const a of watched) {
      try {
        const eds = await fetchRelations(a.mal);
        eds
          .filter(
            (e) =>
              e.relationType === "SEQUEL" &&
              e.node.type === "ANIME" &&
              ["RELEASING", "FINISHED", "NOT_YET_RELEASED"].includes(
                e.node.status,
              ) &&
              !have.has(e.node.id),
          )
          .forEach((e) => {
            if (!found.some((f) => f.mal === e.node.id)) {
              found.push(mapAnime(e.node));
              have.add(e.node.id);
            }
          });
      } catch (ex) {}
    }
    if (found.length === 0) {
      setMsg(
        "No new seasons found \u2014 your watched anime are all caught up.",
      );
      setBusy(false);
      return;
    }
    update((d) => {
      found.forEach((f) => {
        if (!d.anime.some((a) => a.mal === f.mal)) {
          const it = {
            ...f,
            status: "towatch",
            progress: 0,
            rank: null,
            rating: null,
            note: "New season / sequel",
            added: Date.now(),
            stageHist: {},
          };
          setItemStage(it, A_STATUS, "towatch");
          d.anime.push(it);
        }
      });
    });
    setMsg(
      "Added " +
        found.length +
        " new season" +
        (found.length > 1 ? "s" : "") +
        " to your To-watch list: " +
        found.map((f) => f.title).join(", "),
    );
    setBusy(false);
  };
  return (
    <div>
      <div className="chips">
        <button className="small" disabled={busy} onClick={checkSeasons}>
          {busy ? "Checking..." : "\u21BB Check for new seasons"}
        </button>
      </div>
      {msg && <div className="notebanner">{msg}</div>}
      <div className="chips">
        <button
          className={"small" + (status === "all" ? "" : " outline")}
          onClick={() => setStatus("all")}
        >
          All ({data.anime.length})
        </button>
        {A_STATUS.map(([s, label]) => (
          <button
            key={s}
            className={"small" + (status === s ? "" : " outline")}
            onClick={() => setStatus(s)}
          >
            {label} ({counts[s]})
          </button>
        ))}
      </div>
      {genres.length > 1 && (
        <div className="chips">
          {genres.map((g) => (
            <span
              key={g}
              className={"tag" + (genre === g ? " on" : "")}
              onClick={() => setGenre(g)}
            >
              {g}
            </span>
          ))}
        </div>
      )}
      {list.length === 0 ? (
        <div className="empty">
          Nothing here yet. Open <b>Browse</b>, pick an anime and add it to a
          list.
        </div>
      ) : (
        <div className="media">
          {list.map((a) => (
            <div
              className="mcard"
              key={a.mal}
              onClick={() => onOpen(a)}
              title={a.title}
            >
              <div
                className="cover"
                style={{ backgroundImage: `url(${a.image || ""})` }}
              >
                <span className="st">{statusName(a.status)}</span>
                {a.score ? (
                  <span className="sc">{"\u2605 " + a.score}</span>
                ) : null}
                {a.rank != null && <span className="rk">#{a.rank}</span>}
              </div>
              <div className="b">
                <div className="t">{a.title}</div>
                <div className="m">
                  {[
                    a.status === "watched"
                      ? "watched" +
                        (a.episodes
                          ? " " + (a.progress || a.episodes) + "/" + a.episodes
                          : "")
                      : a.progress > 0 &&
                        "ep " +
                          a.progress +
                          (a.episodes ? "/" + a.episodes : ""),
                    a.year,
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

function AnimeRanked({ data, update, onOpen }) {
  const ranked = data.anime
    .filter((a) => a.rank != null)
    .sort((a, b) => a.rank - b.rank);
  if (ranked.length === 0)
    return (
      <div className="empty">
        No ranked anime yet. Open one and hit <b>Set rank</b>. Rank 1 is your
        top pick; adding a new #1 pushes everything else down.
      </div>
    );
  return (
    <div className="txlist">
      {ranked.map((a) => (
        <div className="tx" key={a.mal}>
          <div className="row" style={{ gap: 12 }}>
            <span
              style={{
                background: "linear-gradient(135deg,#6c47ff,#9a6cff)",
                color: "#fff",
                padding: "2px 10px",
                borderRadius: 20,
                fontWeight: 800,
              }}
            >
              #{a.rank}
            </span>
            <span
              style={{ fontWeight: 600, cursor: "pointer" }}
              onClick={() => onOpen(a)}
            >
              {a.title}
            </span>
          </div>
          <div className="cat">{a.score ? "\u2605 " + a.score : ""}</div>
          <span
            className="tag"
            onClick={() => update((d) => clearRankIn(d, a.mal))}
          >
            unrank
          </span>
        </div>
      ))}
    </div>
  );
}

/* ================= MANGA ================= */

export { AnimeModule };
