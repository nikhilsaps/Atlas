import React, { useState, useEffect, useMemo } from "react";

/* ================= data store ================= */
const KEY = "atlas.data.v1", OLD_KEY = "codex.data.v1", THEME_KEY = "atlas.theme";
const blank = { anime:[], manga:[], movies:[], games:[], finance:{accounts:[],txns:[]},
  investments:[], todos:[], ideas:[], mllog:[], settings:{tmdbKey:"",rawgKey:""} };
function migrateAnime(a){
  const map={Plan:"towatch",Watching:"watching",Completed:"watched",Dropped:"towatch"};
  return { mal:a.mal, title:a.title, image:a.image||a.cover, score:a.score, year:a.year,
    type:a.type, episodes:a.episodes||a.count, genres:a.genres||[], synopsis:a.synopsis,
    status:a.status in map?map[a.status]:(a.status||"towatch"),
    progress:a.progress||0, rank:a.rank??null, added:a.added||Date.now() };
}
function load(){ try{
    let raw=localStorage.getItem(KEY);
    if(raw==null){ const old=localStorage.getItem(OLD_KEY); if(old!=null){ raw=old; localStorage.setItem(KEY,old); } }
    const d={...structuredClone(blank), ...JSON.parse(raw||"{}")};
    d.finance={accounts:[],txns:[],...(d.finance||{})};
    d.settings={tmdbKey:"",rawgKey:"",...(d.settings||{})};
    d.anime=(d.anime||[]).map(migrateAnime);
    return d;
  }catch(e){ return structuredClone(blank); } }
function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
function useStore(){
  const [data,setData] = useState(load);
  useEffect(()=>save(data),[data]);
  const update = (fn)=> setData(d=>{ const n=structuredClone(d); fn(n); return n; });
  return [data, update, setData];
}
const uid = ()=> (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());
const DOT = " \u00B7 ";

/* ================= money helpers ================= */
const inr = v => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0})
  .format(isFinite(v)?v:0);
const num = v => new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(isFinite(v)?v:0);
const pct = v => (isFinite(v)?v:0).toFixed(1)+"%";
function sipFV(P,rate,yrs){ const i=rate/1200,n=yrs*12; if(i===0)return P*n; return P*((Math.pow(1+i,n)-1)/i)*(1+i); }
function compoundFV(P,rate,yrs,comp){ const r=rate/100; return P*Math.pow(1+r/comp,comp*yrs); }
function realValue(FV,infl,yrs){ return FV/Math.pow(1+infl/100,yrs); }
function emiCalc(P,rate,yrs){ const r=rate/1200,n=yrs*12; if(r===0)return P/n; return P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1); }
function goalSIP(t,rate,yrs){ const i=rate/1200,n=yrs*12; if(i===0)return t/n; return t*i/((Math.pow(1+i,n)-1)*(1+i)); }
function futureCost(c,infl,yrs){ return c*Math.pow(1+infl/100,yrs); }
const n = v => (v===""||v==null||isNaN(v))?0:Number(v);

/* ================= remote data (AniList / TMDB / RAWG) ================= */
async function tfetch(url, opts={}, ms=12000){
  const c = new AbortController(); const t = setTimeout(()=>c.abort(), ms);
  try{ return await fetch(url, {...opts, signal:c.signal}); }
  finally{ clearTimeout(t); }
}

/* ---- AniList (anime + manga), no API key ---- */
const ANILIST = "https://graphql.anilist.co";
const MEDIA_FIELDS = `id title{english romaji native} coverImage{extraLarge large} averageScore seasonYear startDate{year} format episodes genres description(asHtml:false)`;
async function alQuery(query, variables){
  const r = await tfetch(ANILIST, { method:"POST",
    headers:{"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify({query, variables}) });
  if(!r.ok) throw new Error("HTTP "+r.status);
  const j = await r.json();
  if(j.errors) throw new Error(j.errors[0]?.message||"AniList error");
  return j.data;
}
function stripHtml(s){ return (s||"").replace(/<br\s*\/?>/gi,"\n").replace(/<[^>]+>/g,"").trim(); }
function mapAnime(m){ return {
  mal: m.id, title: m.title?.english||m.title?.romaji||m.title?.native||"Untitled",
  image: m.coverImage?.extraLarge||m.coverImage?.large,
  score: m.averageScore!=null ? +(m.averageScore/10).toFixed(1) : null,
  year: m.seasonYear||m.startDate?.year, type: m.format, episodes: m.episodes,
  genres: m.genres||[], synopsis: stripHtml(m.description) }; }
function curSeason(){ const m=new Date().getMonth(), y=new Date().getFullYear();
  if(m===11) return {season:"WINTER", year:y+1};
  if(m<=1) return {season:"WINTER", year:y};
  if(m<=4) return {season:"SPRING", year:y};
  if(m<=7) return {season:"SUMMER", year:y};
  return {season:"FALL", year:y}; }
async function fetchTop(page=1){
  const d=await alQuery(`query($p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,sort:SCORE_DESC){${MEDIA_FIELDS}}}}`,{p:page});
  return {items:d.Page.media.map(mapAnime), more:d.Page.pageInfo.hasNextPage}; }
async function fetchSeason(page=1){ const {season,year}=curSeason();
  const d=await alQuery(`query($s:MediaSeason,$y:Int,$p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,season:$s,seasonYear:$y,sort:POPULARITY_DESC){${MEDIA_FIELDS}}}}`,{s:season,y:year,p:page});
  return {items:d.Page.media.map(mapAnime), more:d.Page.pageInfo.hasNextPage}; }
async function fetchSearch(q,page=1){
  const d=await alQuery(`query($q:String,$p:Int){Page(page:$p,perPage:24){pageInfo{hasNextPage} media(type:ANIME,search:$q,sort:SEARCH_MATCH){${MEDIA_FIELDS}}}}`,{q,p:page});
  return {items:d.Page.media.map(mapAnime), more:d.Page.pageInfo.hasNextPage}; }
async function fetchFull(id){
  const d=await alQuery(`query($id:Int){Media(id:$id,type:ANIME){${MEDIA_FIELDS} duration status}}`,{id});
  return mapAnime(d.Media); }
async function fetchEpisodes(id){
  const d=await alQuery(`query($id:Int){Media(id:$id,type:ANIME){episodes nextAiringEpisode{episode} streamingEpisodes{title thumbnail}}}`,{id});
  const m=d.Media, se=m.streamingEpisodes||[];
  const total=m.episodes||(m.nextAiringEpisode?m.nextAiringEpisode.episode-1:0);
  if(total>0) return Array.from({length:total},(_,i)=>({num:i+1, title:se[i]?.title||null}));
  return se.map((e,i)=>({num:i+1, title:e.title})); }
async function searchManga(q){
  const d=await alQuery(`query($q:String){Page(perPage:12){media(type:MANGA,search:$q,sort:SEARCH_MATCH){id title{english romaji native} coverImage{large} averageScore startDate{year} chapters format genres description(asHtml:false)}}}`,{q});
  return d.Page.media.map(x=>({ mal:x.id, title:x.title?.english||x.title?.romaji||x.title?.native,
    cover:x.coverImage?.large, score:x.averageScore!=null?+(x.averageScore/10).toFixed(1):null,
    year:x.startDate?.year, count:x.chapters, type:x.format,
    genres:(x.genres||[]).slice(0,3), synopsis:stripHtml(x.description) })); }

/* ---- TMDB (movies + TV), needs free api key ---- */
const TMDB="https://api.themoviedb.org/3", TMDBIMG="https://image.tmdb.org/t/p/w500";
async function tmdb(path, key){ if(!key) throw new Error("NO_KEY");
  const sep=path.includes("?")?"&":"?";
  const r=await tfetch(`${TMDB}${path}${sep}api_key=${key}`);
  if(r.status===401) throw new Error("BAD_KEY");
  if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function mapScreen(x, kind){ const k=kind||(x.title?"movie":"tv"); return {
  tid:x.id, kind:k, title:x.title||x.name,
  image:x.poster_path?TMDBIMG+x.poster_path:null,
  score:x.vote_average?+x.vote_average.toFixed(1):null,
  year:(x.release_date||x.first_air_date||"").slice(0,4),
  overview:x.overview, genres:(x.genres||[]).map(g=>g.name) }; }

/* ---- RAWG (games), needs free api key ---- */
const RAWG="https://api.rawg.io/api";
async function rawg(path, key){ if(!key) throw new Error("NO_KEY");
  const sep=path.includes("?")?"&":"?";
  const r=await tfetch(`${RAWG}${path}${sep}key=${key}`);
  if(r.status===401) throw new Error("BAD_KEY");
  if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function mapGame(x){ return { gid:x.id, title:x.name, image:x.background_image,
  score:x.rating?+x.rating.toFixed(1):null, metacritic:x.metacritic,
  year:(x.released||"").slice(0,4), genres:(x.genres||[]).map(g=>g.name),
  platforms:(x.platforms||[]).map(p=>p.platform.name) }; }

/* ================= nav ================= */
const NAV = [
  {grp:"Library", items:[
    {id:"dashboard", ic:"\u25C9", name:"Dashboard"},
    {id:"anime", ic:"\u25B6", name:"Anime"},
    {id:"manga", ic:"\u2637", name:"Manga"},
    {id:"movies", ic:"\u25A0", name:"Movies"},
    {id:"games", ic:"\u2726", name:"Games"},
  ]},
  {grp:"Life", items:[
    {id:"finance", ic:"\u20B9", name:"Finance"},
    {id:"investments", ic:"\u2197", name:"Investments"},
    {id:"todos", ic:"\u2713", name:"To-do & Plan"},
    {id:"ideas", ic:"\u2605", name:"Ideas"},
    {id:"mllog", ic:"\u2699", name:"ML Research"},
    {id:"settings", ic:"\u2692", name:"Settings"},
  ]},
];

/* ================= small bits ================= */
function Head({title, sub, children}){
  return (<div className="pagehead">
    <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
    <div className="grow"/>{children}</div>);
}
function Field({label, hint, children}){
  return (<label data-field>{label}{children}{hint && <small data-hint>{hint}</small>}</label>);
}
function NumIn({label, hint, value, set}){
  return (<Field label={label} hint={hint}>
    <input type="number" inputMode="decimal" step="any" value={value}
      onChange={e=>set(e.target.value===""?"":Number(e.target.value))}/></Field>);
}
function Out({rows}){
  return (<div className="out">{rows.map((r,i)=>(
    <div className={"outrow"+(r.big?" big":"")} key={i}>
      <span className="lbl">{r.lbl}</span><span className="num">{r.num}</span></div>))}</div>);
}
function Tabs({tabs, tab, set}){
  return (<div className="chips">{tabs.map(([id,name])=>(
    <button key={id} className={"small"+(tab===id?"":" outline")} onClick={()=>set(id)}>{name}</button>))}</div>);
}

/* ================= ANIME ================= */
const A_STATUS = [["towatch","To watch"],["download","Download"],["watching","Watching"],["watched","Watched"]];
const statusName = s => (A_STATUS.find(x=>x[0]===s)||[,"\u2014"])[1];

function AnimeModule({data, update}){
  const [tab,setTab] = useState("browse");
  const [detail,setDetail] = useState(null);
  return (<div>
    <Head title="Anime" sub="Browse the catalogue, track what you watch, rank your favourites."/>
    <Tabs tabs={[["browse","Browse"],["library","My library ("+data.anime.length+")"],["ranked","Ranked"]]} tab={tab} set={setTab}/>
    {tab==="browse" && <AnimeBrowse data={data} onOpen={setDetail}/>}
    {tab==="library" && <AnimeLibrary data={data} update={update} onOpen={setDetail}/>}
    {tab==="ranked" && <AnimeRanked data={data} update={update} onOpen={setDetail}/>}
    {detail && <AnimeDetail mal={detail} data={data} update={update} onClose={()=>setDetail(null)}/>}
  </div>);
}

function AnimeBrowse({data, onOpen}){
  const [src,setSrc] = useState("season");
  const [q,setQ] = useState("");
  const [cur,setCur] = useState({which:"season",query:""});
  const [list,setList] = useState([]);
  const [page,setPage] = useState(1);
  const [more,setMore] = useState(false);
  const [busy,setBusy] = useState(false);
  const [mbusy,setMbusy] = useState(false);
  const [err,setErr] = useState("");
  const load = async (which, query, pg)=>{
    const first = pg===1;
    if(first){ setBusy(true); setList([]); setCur({which,query}); } else setMbusy(true);
    setErr("");
    try{
      let r;
      if(which==="top") r=await fetchTop(pg);
      else if(which==="season") r=await fetchSeason(pg);
      else r=await fetchSearch(query, pg);
      setList(prev=> first ? r.items : [...prev, ...r.items.filter(x=>!prev.some(p=>p.mal===x.mal))]);
      setMore(r.more); setPage(pg);
    }catch(ex){ setErr(first?"Couldn't reach AniList (need internet to browse).":"Couldn't load more."); }
    setBusy(false); setMbusy(false);
  };
  useEffect(()=>{ load("season","",1); },[]);
  const tracked = useMemo(()=> new Map(data.anime.map(a=>[a.mal,a])), [data.anime]);
  const pick = (s)=>{ setSrc(s); if(s!=="search") load(s,"",1); };
  const doSearch = (e)=>{ e.preventDefault(); if(!q.trim())return; setSrc("search"); load("search",q,1); };
  return (<div>
    <div className="chips">
      <button className={"small"+(src==="season"?"":" outline")} onClick={()=>pick("season")}>This season</button>
      <button className={"small"+(src==="top"?"":" outline")} onClick={()=>pick("top")}>Top anime</button>
      <form onSubmit={doSearch} className="row" style={{flex:1,minWidth:220}}>
        <input style={{flex:1}} placeholder="Search any anime by title..." value={q}
          onChange={e=>setQ(e.target.value)}/>
        <button className="small">Search</button>
      </form>
    </div>
    {err && <div className="empty">{err}</div>}
    {busy ? <div className="spin">Loading from AniList...</div>
      : <>
        <div className="media">{list.map(a=>{ const t=tracked.get(a.mal);
          return (<div className="mcard" key={a.mal} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              {t && <span className="st">{statusName(t.status)}</span>}
              {a.score?<span className="sc">{"\u2605 "+a.score}</span>:null}
              {t && t.rank!=null && <span className="rk">#{t.rank}</span>}
            </div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,a.type,a.episodes&&(a.episodes+" ep")].filter(Boolean).join(DOT)}</div></div>
          </div>); })}</div>
        {list.length>0 && <div className="loadmore">
          <span className="sub">{list.length} shown</span>
          {more && <button className="outline small" disabled={mbusy}
            onClick={()=>load(cur.which,cur.query,page+1)}>{mbusy?"Loading...":"Load more"}</button>}
        </div>}
      </>}
  </div>);
}

/* ranking: insert at R pushes everything >=R down by one */
function clearRankIn(d, mal){
  const it=d.anime.find(a=>a.mal===mal);
  if(!it || it.rank==null) return;
  const old=it.rank; it.rank=null;
  d.anime.forEach(a=>{ if(a.rank!=null && a.rank>old) a.rank--; });
}
function RankControl({data, update, base, mal}){
  const tracked = data.anime.find(a=>a.mal===mal);
  const maxRank = data.anime.filter(a=>a.rank!=null).length + (tracked?.rank!=null?0:1);
  const [val,setVal] = useState("");
  const apply = ()=>{ const R=Math.max(1,Math.min(maxRank, Math.round(Number(val)||1)));
    update(d=>{
      let it=d.anime.find(a=>a.mal===mal);
      if(!it){ it={...base(), status:"watched", progress:0, rank:null, added:Date.now()}; d.anime.push(it); }
      clearRankIn(d, mal);
      it=d.anime.find(a=>a.mal===mal);
      d.anime.forEach(a=>{ if(a!==it && a.rank!=null && a.rank>=R) a.rank++; });
      it.rank=R;
    });
    setVal("");
  };
  return (<span className="row" style={{gap:6}}>
    <input type="number" min="1" style={{width:68}} placeholder={tracked?.rank!=null?("#"+tracked.rank):"rank"}
      value={val} onChange={e=>setVal(e.target.value)}/>
    <button className="small" onClick={apply}>Set rank</button>
    {tracked?.rank!=null && <button className="small ghost"
      onClick={()=>update(d=>clearRankIn(d,mal))}>unrank</button>}
  </span>);
}

function AnimeDetail({mal, data, update, onClose}){
  const [full,setFull] = useState(mal);
  const [eps,setEps] = useState(null);
  const [epErr,setEpErr] = useState("");
  useEffect(()=>{ let ok=true;
    fetchFull(mal.mal).then(f=>{ if(ok) setFull(p=>({...p,...f})); }).catch(()=>{});
    fetchEpisodes(mal.mal).then(e=>{ if(ok) setEps(e); }).catch(()=>{ if(ok){setEps([]);setEpErr("Episode list unavailable.");} });
    return ()=>{ ok=false; };
  },[mal.mal]);
  const tracked = data.anime.find(a=>a.mal===mal.mal);
  const base = ()=>({ mal:full.mal, title:full.title, image:full.image, score:full.score,
    year:full.year, type:full.type, episodes:full.episodes, genres:full.genres, synopsis:full.synopsis });
  const setStatus = (status)=> update(d=>{
    const i=d.anime.findIndex(a=>a.mal===full.mal);
    if(i<0) d.anime.push({...base(), status, progress:0, rank:null, added:Date.now()});
    else d.anime[i].status=status;
  });
  const remove = ()=> update(d=>{ clearRankIn(d,full.mal); d.anime=d.anime.filter(a=>a.mal!==full.mal); });
  const setProgress = (p)=> update(d=>{
    let i=d.anime.findIndex(a=>a.mal===full.mal);
    if(i<0){ d.anime.push({...base(), status:"watching", progress:0, rank:null, added:Date.now()}); i=d.anime.length-1; }
    d.anime[i].progress = d.anime[i].progress===p ? p-1 : p;
    if(d.anime[i].progress<0) d.anime[i].progress=0;
  });
  const progress = tracked?.progress||0;
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>{full.title}</b><div className="grow"/>
        <button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <div className="ahero">
          <img src={full.image} alt=""/>
          <div className="meta">
            <div className="sub">{[full.year,full.type,full.episodes&&(full.episodes+" episodes"),
              full.score&&("\u2605 "+full.score)].filter(Boolean).join(DOT)}</div>
            <div className="genres">{(full.genres||[]).map(g=><span className="tag" key={g}>{g}</span>)}</div>
            {tracked && <div className="sub">In <b>{statusName(tracked.status)}</b>
              {tracked.rank!=null && <> {DOT} ranked <b>#{tracked.rank}</b></>}
              {progress>0 && <> {DOT} watched <b>{progress}{full.episodes?("/"+full.episodes):""}</b></>}</div>}
          </div>
        </div>
        <div className="acts">
          {A_STATUS.map(([s,label])=>(
            <button key={s} className={"small"+(tracked?.status===s?"":" outline")}
              onClick={()=>setStatus(s)}>{label}</button>))}
          <RankControl data={data} update={update} base={base} mal={full.mal}/>
          {tracked && <button className="small ghost" onClick={remove}>remove</button>}
        </div>
        <div className="syn">{full.synopsis||"No synopsis."}</div>
        <h3 style={{margin:"18px 0 0"}}>Episodes</h3>
        {eps===null ? <div className="spin">Loading episodes...</div>
          : eps.length===0 ? <div className="sub" style={{marginTop:8}}>{epErr||"No episode list for this title."}</div>
          : <div className="eplist">{eps.map(e=>(
              <div className={"ep"+(e.num<=progress?" seen":"")} key={e.num}
                onClick={()=>setProgress(e.num)} title="Click to mark watched up to here">
                <span className="n">{e.num}</span>
                <div><div className="et">{e.title||("Episode "+e.num)}
                  {e.filler && <span className="tag">filler</span>}{e.recap && <span className="tag">recap</span>}</div>
                  {e.aired && <div className="ed">{String(e.aired).slice(0,10)}</div>}</div>
                <span className="sub">{e.num<=progress?"watched":""}</span>
              </div>))}</div>}
        {eps && eps.length>0 && <div className="sub" style={{marginTop:6}}>AniList provides episode counts and titles where available; air dates and filler flags are not tracked.</div>}
      </div>
    </div>
  </div>);
}

function AnimeLibrary({data, update, onOpen}){
  const [status,setStatus] = useState("all");
  const [genre,setGenre] = useState("All");
  const genres = useMemo(()=>["All",...Array.from(new Set(data.anime.flatMap(a=>a.genres||[]))).sort()],[data.anime]);
  let list = data.anime;
  if(status!=="all") list=list.filter(a=>a.status===status);
  if(genre!=="All") list=list.filter(a=>(a.genres||[]).includes(genre));
  const counts = Object.fromEntries(A_STATUS.map(([s])=>[s,data.anime.filter(a=>a.status===s).length]));
  return (<div>
    <div className="chips">
      <button className={"small"+(status==="all"?"":" outline")} onClick={()=>setStatus("all")}>All ({data.anime.length})</button>
      {A_STATUS.map(([s,label])=>(
        <button key={s} className={"small"+(status===s?"":" outline")} onClick={()=>setStatus(s)}>{label} ({counts[s]})</button>))}
    </div>
    {genres.length>1 && <div className="chips">
      {genres.map(g=><span key={g} className={"tag"+(genre===g?" on":"")} onClick={()=>setGenre(g)}>{g}</span>)}
    </div>}
    {list.length===0
      ? <div className="empty">Nothing here yet. Open <b>Browse</b>, pick an anime and add it to a list.</div>
      : <div className="media">{list.map(a=>(
          <div className="mcard" key={a.mal} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              <span className="st">{statusName(a.status)}</span>
              {a.score?<span className="sc">{"\u2605 "+a.score}</span>:null}
              {a.rank!=null && <span className="rk">#{a.rank}</span>}
            </div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.progress>0&&("ep "+a.progress+(a.episodes?("/"+a.episodes):"")),
                a.year].filter(Boolean).join(DOT)}</div></div>
          </div>))}</div>}
  </div>);
}

function AnimeRanked({data, update, onOpen}){
  const ranked = data.anime.filter(a=>a.rank!=null).sort((a,b)=>a.rank-b.rank);
  if(ranked.length===0) return <div className="empty">No ranked anime yet. Open one and hit <b>Set rank</b>.
    Rank 1 is your top pick; adding a new #1 pushes everything else down.</div>;
  return (<div className="txlist">{ranked.map(a=>(
    <div className="tx" key={a.mal}>
      <div className="row" style={{gap:12}}>
        <span style={{background:"linear-gradient(135deg,#6c47ff,#9a6cff)",color:"#fff",padding:"2px 10px",
          borderRadius:20,fontWeight:800}}>#{a.rank}</span>
        <span style={{fontWeight:600,cursor:"pointer"}} onClick={()=>onOpen(a)}>{a.title}</span>
      </div>
      <div className="cat">{a.score?("\u2605 "+a.score):""}</div>
      <span className="tag" onClick={()=>update(d=>clearRankIn(d,a.mal))}>unrank</span>
    </div>))}</div>);
}

/* ================= MANGA ================= */
const M_STATUS = ["Reading","Completed","Plan","Dropped"];
function MangaModule({data, update}){
  const list=data.manga;
  const [open,setOpen]=useState(false);
  const [filter,setFilter]=useState("All");
  const shown = filter==="All"?list:list.filter(x=>x.status===filter);
  const removeIt=(id)=>update(d=>{ d.manga=d.manga.filter(x=>x.id!==id); });
  const cycle=(id)=>update(d=>{ const it=d.manga.find(x=>x.id===id);
    it.status=M_STATUS[(M_STATUS.indexOf(it.status)+1)%M_STATUS.length]; });
  return (<div>
    <Head title="Manga" sub={list.length+" in your library"}>
      <button onClick={()=>setOpen(true)}>+ Add manga</button></Head>
    <div className="chips">{["All",...M_STATUS].map(s=>(
      <button key={s} className={"small"+(filter===s?"":" outline")} onClick={()=>setFilter(s)}>{s}</button>))}</div>
    {shown.length===0
      ? <div className="empty">Nothing here yet. Hit <b>+ Add manga</b> to search and pull in cover art and details.</div>
      : <div className="media">{shown.map(x=>(
          <div className="mcard" key={x.id} title={x.synopsis||""}>
            <div className="cover" style={{backgroundImage:`url(${x.cover||""})`}}>
              <span className="st" onClick={()=>cycle(x.id)}>{x.status}</span>
              {x.score?<span className="sc">{"\u2605 "+x.score}</span>:null}</div>
            <div className="b"><div className="t">{x.title}</div>
              <div className="m">{[x.year,x.count&&(x.count+" ch")].filter(Boolean).join(DOT)}</div>
              <div style={{marginTop:6}}>
                <span className="tag" onClick={()=>cycle(x.id)}>status</span>
                <span className="tag" onClick={()=>removeIt(x.id)}>remove</span></div></div>
          </div>))}</div>}
    {open && <MangaSearch onClose={()=>setOpen(false)}
      onAdd={(it)=>update(d=>{ if(!d.manga.some(e=>e.mal===it.mal))
        d.manga.push({...it, id:uid(), status:"Plan", added:Date.now()}); })}/>}
  </div>);
}
function MangaSearch({onClose, onAdd}){
  const [q,setQ]=useState(""); const [res,setRes]=useState([]);
  const [busy,setBusy]=useState(false); const [err,setErr]=useState("");
  const run=async(e)=>{ e&&e.preventDefault(); if(!q.trim())return; setBusy(true); setErr("");
    try{ setRes(await searchManga(q)); }catch(ex){ setErr("Lookup failed (offline?)."); } setBusy(false); };
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>Add manga</b><div className="grow"/>
        <button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <form className="row" onSubmit={run}>
          <input style={{flex:1}} autoFocus placeholder="Search manga by title..." value={q}
            onChange={e=>setQ(e.target.value)}/>
          <button disabled={busy}>{busy?"Searching...":"Search"}</button></form>
        <div className="sub" style={{margin:"10px 2px"}}>Metadata from AniList.
          {err && <span style={{color:"var(--destructive,#f87171)"}}> {err}</span>}</div>
        {res.map(x=>(
          <div className="sr" key={x.mal}><img src={x.cover} alt=""/>
            <div><div style={{fontWeight:600}}>{x.title}</div>
              <div className="sub">{[x.year,x.type,x.score&&("\u2605 "+x.score)].filter(Boolean).join(DOT)}</div>
              <div>{x.genres.map(g=><span className="tag" key={g}>{g}</span>)}</div></div>
            <button className="small" onClick={()=>{onAdd(x);onClose();}}>Add</button></div>))}
      </div>
    </div>
  </div>);
}

/* ================= FINANCE ================= */
const CATS = ["Food","Rent","Transport","Shopping","Bills","Health","Entertainment","Travel","Other"];
const monthKey = d => (d||"").slice(0,7);
const thisMonth = () => new Date().toISOString().slice(0,7);
const today = () => new Date().toISOString().slice(0,10);

function FinanceModule({data, update}){
  const [tab,setTab]=useState("expenses");
  return (<div>
    <Head title="Finance" sub="Track spending and plan with real numbers."/>
    <Tabs tabs={[["expenses","Expenses"],["sip","SIP"],["compound","Compound"],["loan","Loan / EMI"],["goal","Goal planner"]]}
      tab={tab} set={setTab}/>
    {tab==="expenses" && <Expenses data={data} update={update}/>}
    {tab==="sip" && <SipCalc/>}{tab==="compound" && <CompoundCalc/>}
    {tab==="loan" && <LoanCalc/>}{tab==="goal" && <GoalCalc/>}
  </div>);
}
function Expenses({data, update}){
  const txns=data.finance.txns;
  const [f,setF]=useState({amount:"",category:"Food",note:"",date:today()});
  const add=(e)=>{ e.preventDefault(); if(!f.amount)return;
    update(d=>{ d.finance.txns.push({id:uid(),amount:Number(f.amount),category:f.category,note:f.note.trim(),date:f.date||today()}); });
    setF({...f,amount:"",note:""}); };
  const rm=(id)=>update(d=>{ d.finance.txns=d.finance.txns.filter(t=>t.id!==id); });
  const sorted=[...txns].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
  const mk=thisMonth(); const monthTx=txns.filter(t=>monthKey(t.date)===mk);
  const monthTotal=monthTx.reduce((s,t)=>s+t.amount,0);
  const byCat={}; monthTx.forEach(t=>{byCat[t.category]=(byCat[t.category]||0)+t.amount;});
  const catRows=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const allTotal=txns.reduce((s,t)=>s+t.amount,0);
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>Log an expense</h3>
      <form onSubmit={add} style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Amount (\u20B9)" value={f.amount} set={v=>setF({...f,amount:v})}/>
        <Field label="Category"><select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>
          {CATS.map(c=><option key={c}>{c}</option>)}</select></Field>
        <Field label="Note (optional)"><input value={f.note} placeholder="e.g. groceries"
          onChange={e=>setF({...f,note:e.target.value})}/></Field>
        <Field label="Date"><input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
        <button>+ Add expense</button>
      </form>
      <div style={{marginTop:18}}><Out rows={[
        {lbl:"This month",num:inr(monthTotal),big:true},
        {lbl:"All-time logged",num:inr(allTotal)},
        {lbl:"Entries",num:num(txns.length)}]}/></div>
      {catRows.length>0 && <div style={{marginTop:14}}>
        <div className="sub" style={{marginBottom:6}}>This month by category</div>
        {catRows.map(([c,v])=>(<div className="outrow" key={c}>
          <span className="lbl">{c} <span className="sub">{pct(v/monthTotal*100)}</span></span>
          <span className="num" style={{fontSize:15}}>{inr(v)}</span></div>))}</div>}
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Recent</h3>
      {sorted.length===0 ? <div className="empty">No expenses yet.</div>
        : <div className="txlist">{sorted.slice(0,60).map(t=>(
            <div className="tx" key={t.id}>
              <div><div style={{fontWeight:600}}>{t.note||t.category}</div>
                <div className="cat">{t.category}{DOT}{t.date}</div></div>
              <div className="amt">{inr(t.amount)}</div>
              <span className="tag" onClick={()=>rm(t.id)}>remove</span></div>))}</div>}
    </article>
  </div>);
}
function SipCalc(){
  const [P,setP]=useState(10000),[rate,setR]=useState(12),[yrs,setY]=useState(10),[infl,setI]=useState(6);
  const fv=sipFV(n(P),n(rate),n(yrs)),inv=n(P)*n(yrs)*12,gain=fv-inv,real=realValue(fv,n(infl),n(yrs));
  return (<div className="calc">
    <article className="card"><h3 style={{marginTop:0}}>SIP (monthly investment)</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Monthly investment (\u20B9)" value={P} set={setP}/>
        <NumIn label="Expected return (% / yr)" value={rate} set={setR}/>
        <NumIn label="Duration (years)" value={yrs} set={setY}/>
        <NumIn label="Inflation (% / yr)" hint="for today's-money value" value={infl} set={setI}/></div></article>
    <article className="card"><h3 style={{marginTop:0}}>Projection</h3>
      <Out rows={[{lbl:"Future value",num:inr(fv),big:true},{lbl:"You invest",num:inr(inv)},
        {lbl:"Estimated gains",num:inr(gain)},{lbl:"Worth in today's money",num:inr(real)}]}/></article>
  </div>);
}
function CompoundCalc(){
  const [P,setP]=useState(100000),[rate,setR]=useState(10),[yrs,setY]=useState(10),[comp,setC]=useState(1),[infl,setI]=useState(6);
  const fv=compoundFV(n(P),n(rate),n(yrs),n(comp)||1),gain=fv-n(P),real=realValue(fv,n(infl),n(yrs));
  return (<div className="calc">
    <article className="card"><h3 style={{marginTop:0}}>Lump sum (compound interest)</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Principal (\u20B9)" value={P} set={setP}/>
        <NumIn label="Interest rate (% / yr)" value={rate} set={setR}/>
        <NumIn label="Duration (years)" value={yrs} set={setY}/>
        <Field label="Compounding"><select value={comp} onChange={e=>setC(Number(e.target.value))}>
          <option value={1}>Yearly</option><option value={2}>Half-yearly</option>
          <option value={4}>Quarterly</option><option value={12}>Monthly</option></select></Field>
        <NumIn label="Inflation (% / yr)" value={infl} set={setI}/></div></article>
    <article className="card"><h3 style={{marginTop:0}}>Projection</h3>
      <Out rows={[{lbl:"Maturity value",num:inr(fv),big:true},{lbl:"Interest earned",num:inr(gain)},
        {lbl:"Worth in today's money",num:inr(real)}]}/></article>
  </div>);
}
function LoanCalc(){
  const [P,setP]=useState(2000000),[rate,setR]=useState(9),[yrs,setY]=useState(20);
  const m=emiCalc(n(P),n(rate),n(yrs)),total=m*n(yrs)*12,interest=total-n(P);
  return (<div className="calc">
    <article className="card"><h3 style={{marginTop:0}}>Loan / EMI</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Loan amount (\u20B9)" value={P} set={setP}/>
        <NumIn label="Interest rate (% / yr)" value={rate} set={setR}/>
        <NumIn label="Tenure (years)" value={yrs} set={setY}/></div>
      <div className="sub" style={{marginTop:12}}>Want X that costs this much? Put the price above to see the EMI.</div></article>
    <article className="card"><h3 style={{marginTop:0}}>Breakdown</h3>
      <Out rows={[{lbl:"Monthly EMI",num:inr(m),big:true},{lbl:"Total interest",num:inr(interest)},
        {lbl:"Total payment",num:inr(total)},{lbl:"Interest as % of loan",num:pct(interest/n(P)*100)}]}/></article>
  </div>);
}
function GoalCalc(){
  const [cost,setCost]=useState(1000000),[yrs,setY]=useState(5),[rate,setR]=useState(12),[infl,setI]=useState(6);
  const target=futureCost(n(cost),n(infl),n(yrs)),need=goalSIP(target,n(rate),n(yrs)),lump=target/Math.pow(1+n(rate)/100,n(yrs));
  return (<div className="calc">
    <article className="card"><h3 style={{marginTop:0}}>Goal planner</h3>
      <div className="sub" style={{marginBottom:12}}>I want to buy X. Here's the real cost and the monthly saving.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Cost today (\u20B9)" value={cost} set={setCost}/>
        <NumIn label="Buy in (years)" value={yrs} set={setY}/>
        <NumIn label="Expected return (% / yr)" value={rate} set={setR}/>
        <NumIn label="Inflation (% / yr)" value={infl} set={setI}/></div></article>
    <article className="card"><h3 style={{marginTop:0}}>Plan</h3>
      <Out rows={[{lbl:"Monthly SIP needed",num:inr(need),big:true},
        {lbl:"Cost after inflation",num:inr(target)},{lbl:"Or invest one lump sum now",num:inr(lump)}]}/></article>
  </div>);
}

/* ================= INVESTMENTS ================= */
function Investments({data, update}){
  const list=data.investments;
  const TYPES=["Stock","Mutual fund","FD","Gold","Crypto","Real estate","Other"];
  const [f,setF]=useState({name:"",type:"Stock",invested:"",current:""});
  const add=(e)=>{ e.preventDefault(); if(!f.name||!f.invested)return;
    update(d=>{ d.investments.push({id:uid(),name:f.name.trim(),type:f.type,invested:Number(f.invested),current:Number(f.current||f.invested)}); });
    setF({name:"",type:"Stock",invested:"",current:""}); };
  const rm=(id)=>update(d=>{ d.investments=d.investments.filter(x=>x.id!==id); });
  const tInv=list.reduce((s,x)=>s+x.invested,0),tCur=list.reduce((s,x)=>s+x.current,0),pl=tCur-tInv;
  return (<div>
    <Head title="Investments" sub="Your holdings and overall return."/>
    <div className="statgrid" style={{marginBottom:20}}>
      <article className="card stat"><div className="k">Invested</div><div className="v">{inr(tInv)}</div></article>
      <article className="card stat"><div className="k">Current value</div><div className="v">{inr(tCur)}</div></article>
      <article className="card stat"><div className="k">Profit / loss</div>
        <div className="v" style={{color:pl>=0?"#16a34a":"#dc2626"}}>{inr(pl)} <small>{pct(tInv?pl/tInv*100:0)}</small></div></article>
    </div>
    <div className="calc">
      <article className="card"><h3 style={{marginTop:0}}>Add holding</h3>
        <form onSubmit={add} style={{display:"flex",flexDirection:"column",gap:12}}>
          <Field label="Name"><input value={f.name} placeholder="e.g. Nifty 50 Index"
            onChange={e=>setF({...f,name:e.target.value})}/></Field>
          <Field label="Type"><select value={f.type} onChange={e=>setF({...f,type:e.target.value})}>
            {TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
          <NumIn label="Invested (\u20B9)" value={f.invested} set={v=>setF({...f,invested:v})}/>
          <NumIn label="Current value (\u20B9)" hint="blank = same as invested" value={f.current} set={v=>setF({...f,current:v})}/>
          <button>+ Add</button></form></article>
      <article className="card"><h3 style={{marginTop:0}}>Holdings</h3>
        {list.length===0 ? <div className="empty">No holdings yet.</div>
          : <div className="txlist">{list.map(x=>{ const d=x.current-x.invested;
              return (<div className="tx" key={x.id}>
                <div><div style={{fontWeight:600}}>{x.name}</div>
                  <div className="cat">{x.type}{DOT}in {inr(x.invested)}</div></div>
                <div className="amt" style={{color:d>=0?"#16a34a":"#dc2626"}}>{inr(x.current)}
                  <div className="cat" style={{textAlign:"right"}}>{d>=0?"+":""}{pct(x.invested?d/x.invested*100:0)}</div></div>
                <span className="tag" onClick={()=>rm(x.id)}>remove</span></div>); })}</div>}</article>
    </div>
  </div>);
}

/* ================= dashboard ================= */
function Dashboard({data, go}){
  const spendMonth=data.finance.txns.filter(t=>monthKey(t.date)===thisMonth()).reduce((s,t)=>s+t.amount,0);
  const invCur=data.investments.reduce((s,x)=>s+x.current,0);
  const watching=data.anime.filter(a=>a.status==="watching").length;
  const cards=[
    {k:"Spent this month",v:inr(spendMonth),id:"finance"},
    {k:"Portfolio value",v:inr(invCur),id:"investments"},
    {k:"Anime",v:data.anime.length,s:watching+" watching",id:"anime"},
    {k:"Manga",v:data.manga.length,s:data.manga.filter(x=>x.status==="Reading").length+" reading",id:"manga"},
    {k:"Open to-dos",v:data.todos.filter(t=>!t.done).length,s:data.todos.length+" total",id:"todos"},
    {k:"Ideas",v:data.ideas.length,s:"captured",id:"ideas"},
  ];
  return (<div>
    <Head title="Dashboard" sub="Everything you track, in one place."/>
    <div className="statgrid">{cards.map(c=>(
      <article className="card stat" key={c.k} onClick={()=>go(c.id)} style={{cursor:"pointer"}}>
        <div className="k">{c.k}</div><div className="v">{c.v} {c.s && <small>{c.s}</small>}</div></article>))}</div>
  </div>);
}
function Soon({label, note}){
  return (<div><Head title={label} sub="Module scaffolded, logic coming next."/>
    <div className="empty">{note}</div></div>);
}


/* ================= MOVIES & TV (TMDB) ================= */
const S_STATUS=[["towatch","To watch"],["watching","Watching"],["watched","Watched"]];
const sName=s=>(S_STATUS.find(x=>x[0]===s)||[,"\u2014"])[1];
function MoviesModule({data,update}){
  const [tab,setTab]=useState("browse");
  const [detail,setDetail]=useState(null);
  const key=data.settings.tmdbKey;
  return (<div>
    <Head title="Movies & TV" sub="Browse films and series, track what you watch, rate them."/>
    <Tabs tabs={[["browse","Browse"],["library","My library ("+data.movies.length+")"]]} tab={tab} set={setTab}/>
    {!key && <div className="empty">Add a free <b>TMDB</b> API key in <b>Settings</b> to browse. Your saved library still works without it.</div>}
    {tab==="browse" && <ScreenBrowse data={data} apiKey={key} onOpen={setDetail}/>}
    {tab==="library" && <ScreenLibrary data={data} onOpen={setDetail}/>}
    {detail && <ScreenDetail item={detail} data={data} update={update} apiKey={key} onClose={()=>setDetail(null)}/>}
  </div>);
}
function ScreenBrowse({data,apiKey,onOpen}){
  const [src,setSrc]=useState("movie");
  const [q,setQ]=useState("");
  const [cur,setCur]=useState({which:"movie",query:""});
  const [list,setList]=useState([]);
  const [page,setPage]=useState(1); const [more,setMore]=useState(false);
  const [busy,setBusy]=useState(false); const [mbusy,setMbusy]=useState(false); const [err,setErr]=useState("");
  const load=async(which,query,pg)=>{ if(!apiKey){setErr("Add a TMDB key in Settings.");return;}
    const first=pg===1; if(first){setBusy(true);setList([]);setCur({which,query});} else setMbusy(true); setErr("");
    try{ let d;
      if(which==="movie") d=await tmdb("/movie/popular?page="+pg,apiKey);
      else if(which==="tv") d=await tmdb("/tv/popular?page="+pg,apiKey);
      else d=await tmdb("/search/multi?page="+pg+"&query="+encodeURIComponent(query),apiKey);
      const items=(d.results||[]).filter(x=>x.media_type!=="person").map(x=>mapScreen(x,which==="search"?null:which)).filter(x=>x.image);
      setList(prev=> first?items:[...prev,...items.filter(x=>!prev.some(p=>p.kind+p.tid===x.kind+x.tid))]);
      setMore((d.page||pg)<(d.total_pages||pg)); setPage(pg);
    }catch(ex){ setErr(ex.message==="BAD_KEY"?"That TMDB key was rejected (check Settings).":"Couldn't reach TMDB."); }
    setBusy(false); setMbusy(false); };
  useEffect(()=>{ if(apiKey) load("movie","",1); },[apiKey]);
  const tracked=useMemo(()=>new Map(data.movies.map(m=>[m.kind+m.tid,m])),[data.movies]);
  const pick=s=>{setSrc(s); load(s,"",1);};
  const doSearch=e=>{e.preventDefault(); if(!q.trim())return; setSrc("search"); load("search",q,1);};
  return (<div>
    <div className="chips">
      <button className={"small"+(src==="movie"?"":" outline")} onClick={()=>pick("movie")}>Popular movies</button>
      <button className={"small"+(src==="tv"?"":" outline")} onClick={()=>pick("tv")}>Popular TV</button>
      <form onSubmit={doSearch} className="row" style={{flex:1,minWidth:220}}>
        <input style={{flex:1}} placeholder="Search movies & TV..." value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="small">Search</button></form>
    </div>
    {err && <div className="empty">{err}</div>}
    {busy ? <div className="spin">Loading from TMDB...</div>
      : <>
        <div className="media">{list.map(a=>{ const t=tracked.get(a.kind+a.tid);
          return (<div className="mcard" key={a.kind+a.tid} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              {t && <span className="st">{sName(t.status)}</span>}
              {a.score?<span className="sc">{"\u2605 "+a.score}</span>:null}
              <span className="rk">{a.kind==="tv"?"TV":"Film"}</span>
            </div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,a.kind==="tv"?"Series":"Movie"].filter(Boolean).join(DOT)}</div></div>
          </div>); })}</div>
        {list.length>0 && <div className="loadmore">
          <span className="sub">{list.length} shown</span>
          {more && <button className="outline small" disabled={mbusy}
            onClick={()=>load(cur.which,cur.query,page+1)}>{mbusy?"Loading...":"Load more"}</button>}
        </div>}
      </>}
  </div>);
}
function ScreenLibrary({data,onOpen}){
  const [status,setStatus]=useState("all");
  let list=data.movies; if(status!=="all") list=list.filter(m=>m.status===status);
  const counts=Object.fromEntries(S_STATUS.map(([s])=>[s,data.movies.filter(m=>m.status===s).length]));
  return (<div>
    <div className="chips">
      <button className={"small"+(status==="all"?"":" outline")} onClick={()=>setStatus("all")}>All ({data.movies.length})</button>
      {S_STATUS.map(([s,label])=>(<button key={s} className={"small"+(status===s?"":" outline")} onClick={()=>setStatus(s)}>{label} ({counts[s]})</button>))}
    </div>
    {list.length===0 ? <div className="empty">Nothing saved yet. Open <b>Browse</b> and add a film or series.</div>
      : <div className="media">{list.map(a=>(
          <div className="mcard" key={a.kind+a.tid} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              <span className="st">{sName(a.status)}</span>
              {a.rating?<span className="sc">{"\u2605 "+a.rating}</span>:null}
              <span className="rk">{a.kind==="tv"?"TV":"Film"}</span></div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,a.kind==="tv"&&a.progress>0&&("ep "+a.progress)].filter(Boolean).join(DOT)}</div></div>
          </div>))}</div>}
  </div>);
}
function ScreenDetail({item,data,update,apiKey,onClose}){
  const [full,setFull]=useState(item);
  useEffect(()=>{ let ok=true;
    if(apiKey) tmdb("/"+item.kind+"/"+item.tid,apiKey).then(x=>{ if(ok) setFull(p=>({...p,
      overview:x.overview||p.overview, genres:(x.genres||[]).map(g=>g.name),
      runtime:x.runtime, seasons:x.number_of_seasons, totalEp:x.number_of_episodes })); }).catch(()=>{});
    return ()=>{ok=false;};
  },[item.tid]);
  const tracked=data.movies.find(m=>m.tid===item.tid && m.kind===item.kind);
  const base=()=>({tid:full.tid,kind:full.kind,title:full.title,image:full.image,score:full.score,
    year:full.year,overview:full.overview,genres:full.genres,totalEp:full.totalEp});
  const setStatus=status=>update(d=>{ const i=d.movies.findIndex(m=>m.tid===full.tid&&m.kind===full.kind);
    if(i<0) d.movies.push({...base(),status,rating:null,progress:0,added:Date.now()}); else d.movies[i].status=status; });
  const setRating=r=>update(d=>{ let i=d.movies.findIndex(m=>m.tid===full.tid&&m.kind===full.kind);
    if(i<0){ d.movies.push({...base(),status:"watched",rating:null,progress:0,added:Date.now()}); i=d.movies.length-1; }
    d.movies[i].rating=d.movies[i].rating===r?null:r; });
  const setProg=p=>update(d=>{ let i=d.movies.findIndex(m=>m.tid===full.tid&&m.kind===full.kind);
    if(i<0){ d.movies.push({...base(),status:"watching",rating:null,progress:0,added:Date.now()}); i=d.movies.length-1; }
    d.movies[i].progress=Math.max(0,p); });
  const remove=()=>update(d=>{ d.movies=d.movies.filter(m=>!(m.tid===full.tid&&m.kind===full.kind)); });
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>{full.title}</b><div className="grow"/><button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <div className="ahero"><img src={full.image} alt=""/>
          <div className="meta">
            <div className="sub">{[full.kind==="tv"?"Series":"Movie",full.year,full.runtime&&(full.runtime+" min"),
              full.seasons&&(full.seasons+" seasons"),full.totalEp&&(full.totalEp+" episodes"),
              full.score&&("\u2605 "+full.score)].filter(Boolean).join(DOT)}</div>
            <div className="genres">{(full.genres||[]).map(g=><span className="tag" key={g}>{g}</span>)}</div>
            {tracked && <div className="sub">In <b>{sName(tracked.status)}</b>
              {tracked.rating&&<> {DOT} your rating <b>{tracked.rating}/10</b></>}
              {full.kind==="tv"&&tracked.progress>0&&<> {DOT} watched <b>{tracked.progress}{full.totalEp?("/"+full.totalEp):""} ep</b></>}</div>}
          </div></div>
        <div className="acts">
          {S_STATUS.map(([s,label])=>(<button key={s} className={"small"+(tracked?.status===s?"":" outline")} onClick={()=>setStatus(s)}>{label}</button>))}
          {tracked && <button className="small ghost" onClick={remove}>remove</button>}
        </div>
        <div className="acts">
          <span className="sub" style={{alignSelf:"center"}}>Rate:</span>
          {[2,4,6,8,10].map(r=>(<button key={r} className={"small"+(tracked?.rating===r?"":" outline")} onClick={()=>setRating(r)}>{r}</button>))}
          {full.kind==="tv" && <span className="row" style={{gap:6,marginLeft:8}}>
            <span className="sub" style={{alignSelf:"center"}}>Episodes watched:</span>
            <input type="number" min="0" style={{width:72}} value={tracked?.progress||0}
              onChange={e=>setProg(Math.round(Number(e.target.value)||0))}/></span>}
        </div>
        <div className="syn">{full.overview||"No overview."}</div>
      </div>
    </div>
  </div>);
}

/* ================= GAMES (RAWG) ================= */
const G_STATUS=[["toplay","To play"],["playing","Playing"],["played","Played"],["dropped","Dropped"]];
const gName=s=>(G_STATUS.find(x=>x[0]===s)||[,"\u2014"])[1];
function GamesModule({data,update}){
  const [tab,setTab]=useState("browse");
  const [detail,setDetail]=useState(null);
  const key=data.settings.rawgKey;
  return (<div>
    <Head title="Games" sub="Browse games, track your backlog, rate what you play."/>
    <Tabs tabs={[["browse","Browse"],["library","My library ("+data.games.length+")"]]} tab={tab} set={setTab}/>
    {!key && <div className="empty">Add a free <b>RAWG</b> API key in <b>Settings</b> to browse. Your saved library still works without it.</div>}
    {tab==="browse" && <GameBrowse data={data} apiKey={key} onOpen={setDetail}/>}
    {tab==="library" && <GameLibrary data={data} onOpen={setDetail}/>}
    {detail && <GameDetail item={detail} data={data} update={update} apiKey={key} onClose={()=>setDetail(null)}/>}
  </div>);
}
function GameBrowse({data,apiKey,onOpen}){
  const [q,setQ]=useState("");
  const [cur,setCur]=useState("");
  const [list,setList]=useState([]);
  const [page,setPage]=useState(1); const [more,setMore]=useState(false);
  const [busy,setBusy]=useState(false); const [mbusy,setMbusy]=useState(false); const [err,setErr]=useState("");
  const load=async(query,pg)=>{ if(!apiKey){setErr("Add a RAWG key in Settings.");return;}
    const first=pg===1; if(first){setBusy(true);setList([]);setCur(query);} else setMbusy(true); setErr("");
    try{ const base=query?("/games?search="+encodeURIComponent(query)):"/games?ordering=-added&dates=2022-01-01,2026-12-31";
      const d=await rawg(base+"&page_size=24&page="+pg,apiKey);
      const items=(d.results||[]).map(mapGame).filter(x=>x.image);
      setList(prev=> first?items:[...prev,...items.filter(x=>!prev.some(p=>p.gid===x.gid))]);
      setMore(!!d.next); setPage(pg);
    }catch(ex){ setErr(ex.message==="BAD_KEY"?"That RAWG key was rejected (check Settings).":"Couldn't reach RAWG."); }
    setBusy(false); setMbusy(false); };
  useEffect(()=>{ if(apiKey) load("",1); },[apiKey]);
  const tracked=useMemo(()=>new Map(data.games.map(g=>[g.gid,g])),[data.games]);
  const doSearch=e=>{e.preventDefault(); load(q,1);};
  return (<div>
    <div className="chips">
      <form onSubmit={doSearch} className="row" style={{flex:1,minWidth:220}}>
        <input style={{flex:1}} placeholder="Search games (blank = popular)..." value={q} onChange={e=>setQ(e.target.value)}/>
        <button className="small">Search</button></form>
    </div>
    {err && <div className="empty">{err}</div>}
    {busy ? <div className="spin">Loading from RAWG...</div>
      : <>
        <div className="media">{list.map(a=>{ const t=tracked.get(a.gid);
          return (<div className="mcard" key={a.gid} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              {t && <span className="st">{gName(t.status)}</span>}
              {a.metacritic?<span className="sc">{a.metacritic}</span>:(a.score?<span className="sc">{"\u2605 "+a.score}</span>:null)}
            </div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,(a.genres||[])[0]].filter(Boolean).join(DOT)}</div></div>
          </div>); })}</div>
        {list.length>0 && <div className="loadmore">
          <span className="sub">{list.length} shown</span>
          {more && <button className="outline small" disabled={mbusy}
            onClick={()=>load(cur,page+1)}>{mbusy?"Loading...":"Load more"}</button>}
        </div>}
      </>}
  </div>);
}
function GameLibrary({data,onOpen}){
  const [status,setStatus]=useState("all");
  let list=data.games; if(status!=="all") list=list.filter(g=>g.status===status);
  const counts=Object.fromEntries(G_STATUS.map(([s])=>[s,data.games.filter(g=>g.status===s).length]));
  return (<div>
    <div className="chips">
      <button className={"small"+(status==="all"?"":" outline")} onClick={()=>setStatus("all")}>All ({data.games.length})</button>
      {G_STATUS.map(([s,label])=>(<button key={s} className={"small"+(status===s?"":" outline")} onClick={()=>setStatus(s)}>{label} ({counts[s]})</button>))}
    </div>
    {list.length===0 ? <div className="empty">Nothing saved yet. Open <b>Browse</b> and add a game.</div>
      : <div className="media">{list.map(a=>(
          <div className="mcard" key={a.gid} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              <span className="st">{gName(a.status)}</span>
              {a.rating?<span className="sc">{"\u2605 "+a.rating}</span>:null}</div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,(a.genres||[])[0]].filter(Boolean).join(DOT)}</div></div>
          </div>))}</div>}
  </div>);
}
function GameDetail({item,data,update,apiKey,onClose}){
  const [full,setFull]=useState(item);
  useEffect(()=>{ let ok=true;
    if(apiKey) rawg("/games/"+item.gid,apiKey).then(x=>{ if(ok) setFull(p=>({...p,
      overview:(x.description_raw||"").slice(0,1200), genres:(x.genres||[]).map(g=>g.name),
      platforms:(x.platforms||[]).map(pf=>pf.platform.name) })); }).catch(()=>{});
    return ()=>{ok=false;};
  },[item.gid]);
  const tracked=data.games.find(g=>g.gid===item.gid);
  const base=()=>({gid:full.gid,title:full.title,image:full.image,score:full.score,
    metacritic:full.metacritic,year:full.year,genres:full.genres});
  const setStatus=status=>update(d=>{ const i=d.games.findIndex(g=>g.gid===full.gid);
    if(i<0) d.games.push({...base(),status,rating:null,added:Date.now()}); else d.games[i].status=status; });
  const setRating=r=>update(d=>{ let i=d.games.findIndex(g=>g.gid===full.gid);
    if(i<0){ d.games.push({...base(),status:"played",rating:null,added:Date.now()}); i=d.games.length-1; }
    d.games[i].rating=d.games[i].rating===r?null:r; });
  const remove=()=>update(d=>{ d.games=d.games.filter(g=>g.gid!==full.gid); });
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>{full.title}</b><div className="grow"/><button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <div className="ahero"><img src={full.image} alt=""/>
          <div className="meta">
            <div className="sub">{[full.year,full.metacritic&&("Metacritic "+full.metacritic),
              full.score&&("\u2605 "+full.score)].filter(Boolean).join(DOT)}</div>
            <div className="genres">{(full.genres||[]).map(g=><span className="tag" key={g}>{g}</span>)}</div>
            {(full.platforms||[]).length>0 && <div className="sub">{full.platforms.slice(0,6).join(DOT)}</div>}
            {tracked && <div className="sub">In <b>{gName(tracked.status)}</b>
              {tracked.rating&&<> {DOT} your rating <b>{tracked.rating}/10</b></>}</div>}
          </div></div>
        <div className="acts">
          {G_STATUS.map(([s,label])=>(<button key={s} className={"small"+(tracked?.status===s?"":" outline")} onClick={()=>setStatus(s)}>{label}</button>))}
          {tracked && <button className="small ghost" onClick={remove}>remove</button>}
        </div>
        <div className="acts"><span className="sub" style={{alignSelf:"center"}}>Rate:</span>
          {[2,4,6,8,10].map(r=>(<button key={r} className={"small"+(tracked?.rating===r?"":" outline")} onClick={()=>setRating(r)}>{r}</button>))}</div>
        <div className="syn">{full.overview||"No description."}</div>
      </div>
    </div>
  </div>);
}

/* ================= TO-DO & PLAN ================= */
function TodoModule({data,update}){
  const [text,setText]=useState(""); const [due,setDue]=useState(""); const [prio,setPrio]=useState("med");
  const [filter,setFilter]=useState("active");
  const add=e=>{ e.preventDefault(); if(!text.trim())return;
    update(d=>d.todos.unshift({id:uid(),text:text.trim(),due,prio,done:false,added:Date.now()}));
    setText(""); setDue(""); setPrio("med"); };
  const toggle=id=>update(d=>{ const t=d.todos.find(x=>x.id===id); t.done=!t.done; });
  const del=id=>update(d=>{ d.todos=d.todos.filter(x=>x.id!==id); });
  let list=data.todos;
  if(filter==="active") list=list.filter(t=>!t.done);
  else if(filter==="done") list=list.filter(t=>t.done);
  const order={high:0,med:1,low:2};
  list=[...list].sort((a,b)=>(a.done-b.done)||((a.due||"zzzz").localeCompare(b.due||"zzzz"))||(order[a.prio]-order[b.prio]));
  const active=data.todos.filter(t=>!t.done).length;
  return (<div>
    <Head title="To-do & Plan" sub={active+" open"+(active!==data.todos.length?(" of "+data.todos.length):"")}/>
    <form className="row" onSubmit={add} style={{marginBottom:14,flexWrap:"wrap"}}>
      <input style={{flex:2,minWidth:200}} placeholder="What needs doing?" value={text} onChange={e=>setText(e.target.value)}/>
      <input type="date" value={due} onChange={e=>setDue(e.target.value)}/>
      <select value={prio} onChange={e=>setPrio(e.target.value)}>
        <option value="high">High</option><option value="med">Medium</option><option value="low">Low</option></select>
      <button>Add</button></form>
    <div className="chips">{[["active","Active"],["all","All"],["done","Done"]].map(([k,l])=>(
      <button key={k} className={"small"+(filter===k?"":" outline")} onClick={()=>setFilter(k)}>{l}</button>))}</div>
    {list.length===0 ? <div className="empty">Nothing here. Add your first task above.</div>
      : <div className="txlist">{list.map(t=>(
          <div className="tx" key={t.id}>
            <div className="row" style={{gap:12}}>
              <input type="checkbox" checked={t.done} onChange={()=>toggle(t.id)}/>
              <span style={{fontWeight:600,textDecoration:t.done?"line-through":"none",opacity:t.done?0.55:1}}>{t.text}</span>
              <span className="tag" style={{background:t.prio==="high"?"#f8717133":t.prio==="low"?"#9ca3af33":"#f59e0b33"}}>{t.prio}</span>
            </div>
            <div className="cat">{t.due||""}</div>
            <span className="tag" onClick={()=>del(t.id)}>delete</span>
          </div>))}</div>}
  </div>);
}

/* ================= IDEAS ================= */
function IdeasModule({data,update}){
  const [open,setOpen]=useState(null);
  const save=(idea)=>update(d=>{ if(idea.id){ const i=d.ideas.findIndex(x=>x.id===idea.id); d.ideas[i]=idea; }
    else d.ideas.unshift({...idea,id:uid(),added:Date.now()}); });
  const del=id=>update(d=>{ d.ideas=d.ideas.filter(x=>x.id!==id); });
  const editing = open && open!=="new" ? data.ideas.find(x=>x.id===open) : null;
  return (<div>
    <Head title="Ideas" sub={data.ideas.length+" captured"}>
      <button onClick={()=>setOpen("new")}>+ New idea</button></Head>
    {data.ideas.length===0 ? <div className="empty">No ideas yet. Hit <b>+ New idea</b> to capture one.</div>
      : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(240px,1fr))",gap:14}}>{data.ideas.map(x=>(
          <article className="card" key={x.id} style={{cursor:"pointer"}} onClick={()=>setOpen(x.id)}>
            <h3 style={{margin:"0 0 6px"}}>{x.title||"Untitled"}</h3>
            <div className="sub" style={{whiteSpace:"pre-wrap"}}>{(x.body||"").slice(0,180)}</div>
            <div style={{marginTop:8}}>{(x.tags||[]).map(t=><span className="tag" key={t}>{t}</span>)}</div>
          </article>))}</div>}
    {(open==="new"||editing) && <IdeaEditor idea={editing} onClose={()=>setOpen(null)} onSave={save}
      onDelete={editing?()=>{del(editing.id);setOpen(null);}:null}/>}
  </div>);
}
function IdeaEditor({idea,onClose,onSave,onDelete}){
  const [title,setTitle]=useState(idea?.title||"");
  const [body,setBody]=useState(idea?.body||"");
  const [tags,setTags]=useState((idea?.tags||[]).join(", "));
  const save=()=>{ onSave({...(idea||{}),title:title.trim(),body,tags:tags.split(",").map(t=>t.trim()).filter(Boolean)}); onClose(); };
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>{idea?"Edit idea":"New idea"}</b><div className="grow"/><button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <Field label="Title"><input value={title} autoFocus onChange={e=>setTitle(e.target.value)}/></Field>
        <Field label="Notes"><textarea rows={8} value={body} onChange={e=>setBody(e.target.value)}/></Field>
        <Field label="Tags" hint="comma-separated"><input value={tags} onChange={e=>setTags(e.target.value)}/></Field>
        <div className="acts"><button onClick={save}>Save</button>
          {onDelete && <button className="ghost small" onClick={onDelete}>delete</button>}</div>
      </div>
    </div>
  </div>);
}

/* ================= ML RESEARCH ================= */
const ML_TYPES=["Paper","Concept","Project","Course"];
const ML_STATUS=["Backlog","Studying","Done"];
function MLModule({data,update}){
  const [open,setOpen]=useState(null);
  const [f,setF]=useState("all");
  const save=(it)=>update(d=>{ if(it.id){ const i=d.mllog.findIndex(x=>x.id===it.id); d.mllog[i]=it; }
    else d.mllog.unshift({...it,id:uid(),added:Date.now()}); });
  const del=id=>update(d=>{ d.mllog=d.mllog.filter(x=>x.id!==id); });
  const editing= open && open!=="new" ? data.mllog.find(x=>x.id===open):null;
  let list=data.mllog; if(f!=="all") list=list.filter(x=>x.status===f);
  return (<div>
    <Head title="ML Research" sub={data.mllog.length+" entries"}>
      <button onClick={()=>setOpen("new")}>+ Add entry</button></Head>
    <div className="chips">{["all",...ML_STATUS].map(s=>(
      <button key={s} className={"small"+(f===s?"":" outline")} onClick={()=>setF(s)}>{s==="all"?"All":s}</button>))}</div>
    {list.length===0 ? <div className="empty">Nothing logged yet. Track papers, concepts, projects and courses here.</div>
      : <div className="txlist">{list.map(x=>(
          <div className="tx" key={x.id}>
            <div className="row" style={{gap:12}}>
              <span className="tag">{x.type}</span>
              <span style={{fontWeight:600,cursor:"pointer"}} onClick={()=>setOpen(x.id)}>{x.title}</span>
              {x.link && <a href={x.link} target="_blank" rel="noreferrer" className="sub">link</a>}
            </div>
            <div className="cat">{x.status}{x.date?(DOT+x.date):""}</div>
            <span className="tag" onClick={()=>del(x.id)}>delete</span>
          </div>))}</div>}
    {(open==="new"||editing) && <MLEditor entry={editing} onClose={()=>setOpen(null)} onSave={save}/>}
  </div>);
}
function MLEditor({entry,onClose,onSave}){
  const [title,setTitle]=useState(entry?.title||"");
  const [type,setType]=useState(entry?.type||"Paper");
  const [status,setStatus]=useState(entry?.status||"Backlog");
  const [link,setLink]=useState(entry?.link||"");
  const [date,setDate]=useState(entry?.date||"");
  const [notes,setNotes]=useState(entry?.notes||"");
  const save=()=>{ if(!title.trim())return; onSave({...(entry||{}),title:title.trim(),type,status,link:link.trim(),date,notes}); onClose(); };
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>{entry?"Edit entry":"New entry"}</b><div className="grow"/><button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <Field label="Title"><input value={title} autoFocus onChange={e=>setTitle(e.target.value)}/></Field>
        <div className="row" style={{flexWrap:"wrap"}}>
          <Field label="Type"><select value={type} onChange={e=>setType(e.target.value)}>{ML_TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
          <Field label="Status"><select value={status} onChange={e=>setStatus(e.target.value)}>{ML_STATUS.map(t=><option key={t}>{t}</option>)}</select></Field>
          <Field label="Date"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
        </div>
        <Field label="Link" hint="arXiv, repo, course URL"><input value={link} onChange={e=>setLink(e.target.value)}/></Field>
        <Field label="Notes"><textarea rows={6} value={notes} onChange={e=>setNotes(e.target.value)}/></Field>
        <div className="acts"><button onClick={save}>Save</button></div>
      </div>
    </div>
  </div>);
}

/* ================= SETTINGS ================= */
function SettingsModule({data,update}){
  const s=data.settings;
  const set=(k,v)=>update(d=>{ d.settings[k]=v; });
  return (<div>
    <Head title="Settings" sub="API keys stay on this device (localStorage) and are never uploaded."/>
    <article className="card" style={{marginBottom:16}}>
      <h3 style={{marginTop:0}}>TMDB (Movies & TV)</h3>
      <div className="sub" style={{marginBottom:8}}>Free key: sign up at themoviedb.org, then Settings {DOT} API {DOT} copy the <b>API Key (v3 auth)</b>.</div>
      <Field label="TMDB API key"><input value={s.tmdbKey} placeholder="paste v3 key" onChange={e=>set("tmdbKey",e.target.value.trim())}/></Field>
    </article>
    <article className="card" style={{marginBottom:16}}>
      <h3 style={{marginTop:0}}>RAWG (Games)</h3>
      <div className="sub" style={{marginBottom:8}}>Free key: sign up at rawg.io/apidocs, copy your API key.</div>
      <Field label="RAWG API key"><input value={s.rawgKey} placeholder="paste key" onChange={e=>set("rawgKey",e.target.value.trim())}/></Field>
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Data sources</h3>
      <div className="sub">Anime & manga use <b>AniList</b> (no key needed). Movies & TV use <b>TMDB</b>. Games use <b>RAWG</b>. Finance, to-do, ideas and ML research are fully local to this browser.</div>
    </article>
  </div>);
}

/* ================= app shell ================= */
function App(){
  const [data, update, setData] = useStore();
  const [view, setView] = useState("anime");
  const [theme, setTheme] = useState(()=> localStorage.getItem(THEME_KEY) || "light");
  useEffect(()=>{ document.documentElement.dataset.theme = theme; localStorage.setItem(THEME_KEY, theme); },[theme]);

  const counts = {anime:data.anime.length, manga:data.manga.length, movies:data.movies.length,
    games:data.games.length, investments:data.investments.length,
    todos:data.todos.filter(t=>!t.done).length, ideas:data.ideas.length};

  const exportJson = ()=>{ const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download="atlas-"+today()+".json"; a.click(); };
  const importJson = (e)=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ setData({...structuredClone(blank), ...JSON.parse(r.result)}); }
      catch(ex){ alert("Invalid JSON"); } }; r.readAsText(f); };

  const body=()=>{ switch(view){
    case "dashboard": return <Dashboard data={data} go={setView}/>;
    case "anime": return <AnimeModule data={data} update={update}/>;
    case "manga": return <MangaModule data={data} update={update}/>;
    case "movies": return <MoviesModule data={data} update={update}/>;
    case "games": return <GamesModule data={data} update={update}/>;
    case "finance": return <FinanceModule data={data} update={update}/>;
    case "investments": return <Investments data={data} update={update}/>;
    case "todos": return <TodoModule data={data} update={update}/>;
    case "ideas": return <IdeasModule data={data} update={update}/>;
    case "mllog": return <MLModule data={data} update={update}/>;
    case "settings": return <SettingsModule data={data} update={update}/>;
    default: return null; } };

  return (<div data-sidebar-layout>
    <aside data-sidebar>
      <div className="brand"><span className="logo">A</span><span>At<b>las</b></span></div>
      <nav>{NAV.map(g=>(<React.Fragment key={g.grp}>
        <div className="navgrp">{g.grp}</div>
        {g.items.map(it=>(
          <a key={it.id} href="#" aria-current={view===it.id?"page":undefined}
            onClick={e=>{e.preventDefault();setView(it.id);}}>
            <span>{it.ic}</span><span>{it.name}</span>
            {counts[it.id]>0 && <span className="cnt">{counts[it.id]}</span>}</a>))}
      </React.Fragment>))}</nav>
      <div style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:8,paddingTop:14}}>
        <button className="outline small" onClick={()=>setTheme(theme==="light"?"dark":"light")}>
          {theme==="light"?"\u263E Dark":"\u2600 Light"} mode</button>
        <button className="outline small" onClick={exportJson}>{"\u2193"} Export JSON</button>
        <label className="button outline small" style={{textAlign:"center",cursor:"pointer"}}>{"\u2191"} Import JSON
          <input type="file" accept="application/json" hidden onChange={importJson}/></label>
      </div>
    </aside>
    <main>{body()}</main>
  </div>);
}

export default App;
