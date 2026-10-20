import { useState, useEffect, useMemo, useRef } from "react";

const KEY = "atlas.data.v1",
  OLD_KEY = "codex.data.v1",
  THEME_KEY = "atlas.theme";
const blank = {
  v: 3,
  anime: [],
  manga: [],
  movies: [],
  games: [],
  finance: { accounts: [], txns: [] },
  investments: [],
  todos: [],
  ideas: [],
  mllog: [],
  settings: {
    tmdbKey: "",
    rawgKey: "",
    theme: "light",
    startView: "anime",
    titleLang: "romaji",
    confirmRemove: true,
    sdSync: false,
  },
};

function pickTitle(t, lang) {
  if (!t) return "Untitled";
  return lang === "english"
    ? t.english || t.romaji || t.native
    : t.romaji || t.english || t.native;
}
function migrateAnime(a) {
  return {
    mal: a.mal,
    title: a.title,
    image: a.image || a.cover,
    score: a.score,
    year: a.year,
    type: a.type,
    episodes: a.episodes || a.count,
    genres: a.genres || [],
    synopsis: a.synopsis,
    status: a.status,
    stageHist: a.stageHist,
    progress: a.progress || 0,
    rank: a.rank == null ? null : a.rank,
    rating: a.rating == null ? null : a.rating,
    note: a.note || "",
    added: a.added || Date.now(),
  };
}
function fixStages(it, STAGES, remap) {
  let st = (remap && remap[it.status]) || it.status;
  if (!STAGES.some((s) => s[0] === st)) st = STAGES[0][0];
  it.status = st;
  if (!it.stageHist) {
    it.stageHist = {};
    const order = STAGES.map((x) => x[0]);
    const ti = order.indexOf(st);
    for (let i = 0; i <= ti; i++)
      it.stageHist[order[i]] = it.added || Date.now();
  }
  return it;
}
function setItemStage(item, STAGES, target) {
  item.status = target;
  item.stageHist = item.stageHist || {};
  const order = STAGES.map((x) => x[0]),
    ti = order.indexOf(target);
  for (let i = 0; i <= ti; i++)
    if (!item.stageHist[order[i]]) item.stageHist[order[i]] = Date.now();
  item.updated = Date.now();
}
function load() {
  try {
    let raw = localStorage.getItem(KEY);
    if (raw == null) {
      const old = localStorage.getItem(OLD_KEY);
      if (old != null) {
        raw = old;
        localStorage.setItem(KEY, old);
      }
    }
    const d = { ...structuredClone(blank), ...JSON.parse(raw || "{}") };
    d.finance = { accounts: [], txns: [], ...(d.finance || {}) };
    d.settings = { ...structuredClone(blank.settings), ...(d.settings || {}) };
    if (!d.settings.theme)
      d.settings.theme = localStorage.getItem(THEME_KEY) || "light";
    d.anime = (d.anime || []).map((a) =>
      fixStages(migrateAnime(a), A_STATUS, {
        download: "acquire",
        Plan: "towatch",
        Watching: "watching",
        Completed: "watched",
        Dropped: "towatch",
      }),
    );
    d.movies = (d.movies || []).map((m) => fixStages(m, S_STATUS, {}));
    d.games = (d.games || []).map((g) =>
      fixStages(g, G_STATUS, { dropped: "played" }),
    );
    return d;
  } catch (e) {
    return structuredClone(blank);
  }
}
function save(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
async function sdLoad() {
  try {
    const r = await fetch("/data/atlas.json", { cache: "no-store" });
    if (r.ok) return await r.json();
  } catch (e) {}
  return null;
}
async function sdSave(d) {
  try {
    await fetch("/api/save/data/atlas.json", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(d),
    });
  } catch (e) {}
}
function useStore() {
  const [data, setData] = useState(load);
  useEffect(() => {
    save(data);
    if (data.settings && data.settings.sdSync) sdSave(data);
  }, [data]);
  const update = (fn) =>
    setData((d) => {
      const n = structuredClone(d);
      fn(n);
      return n;
    });
  return [data, update, setData];
}
const uid = () =>
  crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();

const DOT = " \u00B7 ";

/* ================= money helpers ================= */
const inr = (v) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(isFinite(v) ? v : 0);
const num = (v) =>
  new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(
    isFinite(v) ? v : 0,
  );
const pct = (v) => (isFinite(v) ? v : 0).toFixed(1) + "%";
function sipFV(P, rate, yrs) {
  const i = rate / 1200,
    n = yrs * 12;
  if (i === 0) return P * n;
  return P * ((Math.pow(1 + i, n) - 1) / i) * (1 + i);
}
function compoundFV(P, rate, yrs, comp) {
  const r = rate / 100;
  return P * Math.pow(1 + r / comp, comp * yrs);
}
function realValue(FV, infl, yrs) {
  return FV / Math.pow(1 + infl / 100, yrs);
}
function emiCalc(P, rate, yrs) {
  const r = rate / 1200,
    n = yrs * 12;
  if (r === 0) return P / n;
  return (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}
function goalSIP(t, rate, yrs) {
  const i = rate / 1200,
    n = yrs * 12;
  if (i === 0) return t / n;
  return (t * i) / ((Math.pow(1 + i, n) - 1) * (1 + i));
}
function futureCost(c, infl, yrs) {
  return c * Math.pow(1 + infl / 100, yrs);
}
const n = (v) => (v === "" || v == null || isNaN(v) ? 0 : Number(v));

/* ================= remote data (AniList / TMDB / RAWG) ================= */
async function tfetch(url, opts = {}, ms = 12000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

/* ---- AniList (anime + manga), no API key ---- */
const ANILIST = "https://graphql.anilist.co";
const MEDIA_FIELDS = `id title{english romaji native} coverImage{extraLarge large} averageScore seasonYear startDate{year} format episodes genres description(asHtml:false)`;
async function alQuery(query, variables) {
  const r = await tfetch(ANILIST, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  if (j.errors) throw new Error(j.errors[0]?.message || "AniList error");
  return j.data;
}
function stripHtml(s) {
  return (s || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .trim();
}
function mapAnime(m) {
  return {
    mal: m.id,
    title: m.title?.english || m.title?.romaji || m.title?.native || "Untitled",
    image: m.coverImage?.extraLarge || m.coverImage?.large,
    score: m.averageScore != null ? +(m.averageScore / 10).toFixed(1) : null,
    year: m.seasonYear || m.startDate?.year,
    type: m.format,
    episodes: m.episodes,
    genres: m.genres || [],
    synopsis: stripHtml(m.description),
  };
}
function curSeason() {
  const m = new Date().getMonth(),
    y = new Date().getFullYear();
  if (m === 11) return { season: "WINTER", year: y + 1 };
  if (m <= 1) return { season: "WINTER", year: y };
  if (m <= 4) return { season: "SPRING", year: y };
  if (m <= 7) return { season: "SUMMER", year: y };
  return { season: "FALL", year: y };
}
async function fetchTop(page = 1) {
  const d = await alQuery(
    `query($p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,sort:SCORE_DESC){${MEDIA_FIELDS}}}}`,
    { p: page },
  );
  return {
    items: d.Page.media.map(mapAnime),
    more: d.Page.pageInfo.hasNextPage,
  };
}
async function fetchSeason(page = 1) {
  const { season, year } = curSeason();
  const d = await alQuery(
    `query($s:MediaSeason,$y:Int,$p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,season:$s,seasonYear:$y,sort:POPULARITY_DESC){${MEDIA_FIELDS}}}}`,
    { s: season, y: year, p: page },
  );
  return {
    items: d.Page.media.map(mapAnime),
    more: d.Page.pageInfo.hasNextPage,
  };
}
async function fetchSearch(q, page = 1) {
  const d = await alQuery(
    `query($q:String,$p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,search:$q,sort:SEARCH_MATCH){${MEDIA_FIELDS}}}}`,
    { q, p: page },
  );
  return {
    items: d.Page.media.map(mapAnime),
    more: d.Page.pageInfo.hasNextPage,
  };
}
async function fetchFull(id) {
  const d = await alQuery(
    `query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} duration status}}`,
    { id },
  );
  return mapAnime(d.Media);
}
async function fetchEpisodes(id) {
  const d = await alQuery(
    `query($id:Int){Media(id:$id,type:ANIME){episodes nextAiringEpisode{episode} streamingEpisodes{title thumbnail}}}`,
    { id },
  );
  const m = d.Media,
    se = m.streamingEpisodes || [];
  const total =
    m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : 0);
  if (total > 0)
    return Array.from({ length: total }, (_, i) => ({
      num: i + 1,
      title: se[i]?.title || null,
    }));
  return se.map((e, i) => ({ num: i + 1, title: e.title }));
}
async function searchManga(q) {
  const d = await alQuery(
    `query($q:String){Page(perPage:12){media(type:MANGA,search:$q,sort:SEARCH_MATCH){id title{english romaji native} coverImage{large} averageScore startDate{year} chapters format genres description(asHtml:false)}}}`,
    { q },
  );
  return d.Page.media.map((x) => ({
    mal: x.id,
    title: x.title?.english || x.title?.romaji || x.title?.native,
    cover: x.coverImage?.large,
    score: x.averageScore != null ? +(x.averageScore / 10).toFixed(1) : null,
    year: x.startDate?.year,
    count: x.chapters,
    type: x.format,
    genres: (x.genres || []).slice(0, 3),
    synopsis: stripHtml(x.description),
  }));
}

async function fetchAnimeFull(id) {
  const q = `query($id:Int){Media(id:$id,type:ANIME){id title{english romaji native} coverImage{extraLarge large} bannerImage averageScore meanScore popularity favourites format status season seasonYear episodes duration source genres description(asHtml:false) startDate{year month day} endDate{year month day} studios(isMain:true){nodes{name}} tags{name rank isGeneralSpoiler} trailer{id site thumbnail} externalLinks{site url} rankings{rank type context allTime} nextAiringEpisode{episode airingAt} relations{edges{relationType node{id type format status title{english romaji native} coverImage{extraLarge large} seasonYear}}} characters(sort:ROLE,perPage:12){edges{role node{name{full} image{medium}} voiceActors(language:JAPANESE){name{full}}}} streamingEpisodes{title thumbnail url site}}}`;
  const d = await alQuery(q, { id });
  return d.Media;
}
async function fetchRelations(id) {
  const d = await alQuery(
    `query($id:Int){Media(id:$id,type:ANIME){relations{edges{relationType node{id type format status title{english romaji native} coverImage{extraLarge large} averageScore seasonYear episodes genres description(asHtml:false)}}}}}`,
    { id },
  );
  return (d.Media.relations && d.Media.relations.edges) || [];
}

/* ---- TMDB (movies + TV), needs free api key ---- */

const TMDB = "https://api.themoviedb.org/3",
  TMDBIMG = "https://image.tmdb.org/t/p/w500";
async function tmdb(path, key) {
  if (!key) throw new Error("NO_KEY");
  const sep = path.includes("?") ? "&" : "?";
  const r = await tfetch(`${TMDB}${path}${sep}api_key=${key}`);
  if (r.status === 401) throw new Error("BAD_KEY");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
function mapScreen(x, kind) {
  const k = kind || (x.title ? "movie" : "tv");
  return {
    tid: x.id,
    kind: k,
    title: x.title || x.name,
    image: x.poster_path ? TMDBIMG + x.poster_path : null,
    score: x.vote_average ? +x.vote_average.toFixed(1) : null,
    year: (x.release_date || x.first_air_date || "").slice(0, 4),
    overview: x.overview,
    genres: (x.genres || []).map((g) => g.name),
  };
}

async function fetchScreenFull(kind, id, key) {
  return tmdb(
    "/" +
      kind +
      "/" +
      id +
      "?append_to_response=credits,videos,images,recommendations,external_ids,watch/providers",
    key,
  );
}
async function fetchTvSeason(id, season, key) {
  return tmdb("/tv/" + id + "/season/" + season, key);
}

/* ---- RAWG (games), needs free api key ---- */

const RAWG = "https://api.rawg.io/api";
async function rawg(path, key) {
  if (!key) throw new Error("NO_KEY");
  const sep = path.includes("?") ? "&" : "?";
  const r = await tfetch(`${RAWG}${path}${sep}key=${key}`);
  if (r.status === 401) throw new Error("BAD_KEY");
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
function mapGame(x) {
  return {
    gid: x.id,
    title: x.name,
    image: x.background_image,
    score: x.rating ? +x.rating.toFixed(1) : null,
    metacritic: x.metacritic,
    year: (x.released || "").slice(0, 4),
    genres: (x.genres || []).map((g) => g.name),
    platforms: (x.platforms || []).map((p) => p.platform.name),
  };
}

async function fetchGameFull(id, key) {
  return rawg("/games/" + id, key);
}
async function fetchGameShots(id, key) {
  try {
    const d = await rawg("/games/" + id + "/screenshots", key);
    return (d.results || []).map((s) => s.image);
  } catch (e) {
    return [];
  }
}

/* ================= nav ================= */

const monthKey = (d) => (d || "").slice(0, 7);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const today = () => new Date().toISOString().slice(0, 10);


export {
  KEY, THEME_KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
};
