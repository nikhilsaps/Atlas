import React, { useState, useEffect, useMemo } from "react";

/* ================= data store ================= */
const KEY = "atlas.data.v1", OLD_KEY = "codex.data.v1", THEME_KEY = "atlas.theme";
const blank = { anime:[], manga:[], movies:[], games:[], finance:{accounts:[],txns:[]},
  investments:[], todos:[], ideas:[], mllog:[] };
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

/* ================= Jikan (MyAnimeList) ================= */
const J = "https://api.jikan.moe/v4";
async function jget(path){ const r=await fetch(J+path); if(!r.ok) throw new Error("HTTP "+r.status); return r.json(); }
function mapAnime(x){ return {
  mal:x.mal_id, title:x.title_english||x.title,
  image:x.images?.jpg?.large_image_url||x.images?.jpg?.image_url,
  score:x.score, year:x.year||x.aired?.prop?.from?.year, type:x.type, episodes:x.episodes,
  genres:(x.genres||[]).map(g=>g.name), synopsis:x.synopsis }; }
async function fetchTop(page=1){ return (await jget(`/top/anime?page=${page}&limit=24`)).data.map(mapAnime); }
async function fetchSeason(){ return (await jget(`/seasons/now?limit=24&sfw`)).data.map(mapAnime); }
async function fetchSearch(q){ return (await jget(`/anime?q=${encodeURIComponent(q)}&limit=24&sfw&order_by=members&sort=desc`)).data.map(mapAnime); }
async function fetchFull(mal){ return mapAnime((await jget(`/anime/${mal}/full`)).data); }
async function fetchEpisodes(mal){ return ((await jget(`/anime/${mal}/episodes`)).data||[])
  .map(e=>({num:e.mal_id, title:e.title||e.title_romanji, aired:e.aired, filler:e.filler, recap:e.recap})); }
async function searchManga(q){ return (await jget(`/manga?q=${encodeURIComponent(q)}&limit=12&sfw`)).data
  .map(x=>({ mal:x.mal_id, title:x.title_english||x.title, cover:x.images?.jpg?.image_url, score:x.score,
    year:x.published?.prop?.from?.year, count:x.chapters, type:x.type,
    genres:(x.genres||[]).map(g=>g.name).slice(0,3), synopsis:x.synopsis })); }

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
  const [list,setList] = useState([]);
  const [busy,setBusy] = useState(false);
  const [err,setErr] = useState("");
  const run = async (which, query)=>{
    setBusy(true); setErr(""); setList([]);
    try{
      if(which==="top") setList(await fetchTop());
      else if(which==="season") setList(await fetchSeason());
      else setList(await fetchSearch(query));
    }catch(ex){ setErr("Couldn't reach MyAnimeList (need internet to browse)."); }
    setBusy(false);
  };
  useEffect(()=>{ run("season"); },[]);
  const tracked = useMemo(()=> new Map(data.anime.map(a=>[a.mal,a])), [data.anime]);
  const pick = (s)=>{ setSrc(s); if(s!=="search") run(s); };
  const doSearch = (e)=>{ e.preventDefault(); if(!q.trim())return; setSrc("search"); run("search",q); };
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
    {busy ? <div className="spin">Loading from MyAnimeList...</div>
      : <div className="media">{list.map(a=>{ const t=tracked.get(a.mal);
          return (<div className="mcard" key={a.mal} onClick={()=>onOpen(a)} title={a.title}>
            <div className="cover" style={{backgroundImage:`url(${a.image||""})`}}>
              {t && <span className="st">{statusName(t.status)}</span>}
              {a.score?<span className="sc">{"\u2605 "+a.score}</span>:null}
              {t && t.rank!=null && <span className="rk">#{t.rank}</span>}
            </div>
            <div className="b"><div className="t">{a.title}</div>
              <div className="m">{[a.year,a.type,a.episodes&&(a.episodes+" ep")].filter(Boolean).join(DOT)}</div></div>
          </div>); })}</div>}
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
          : eps.length===0 ? <div className="sub" style={{marginTop:8}}>{epErr||"No episode list on MyAnimeList."}</div>
          : <div className="eplist">{eps.map(e=>(
              <div className={"ep"+(e.num<=progress?" seen":"")} key={e.num}
                onClick={()=>setProgress(e.num)} title="Click to mark watched up to here">
                <span className="n">{e.num}</span>
                <div><div className="et">{e.title||("Episode "+e.num)}
                  {e.filler && <span className="tag">filler</span>}{e.recap && <span className="tag">recap</span>}</div>
                  {e.aired && <div className="ed">{String(e.aired).slice(0,10)}</div>}</div>
                <span className="sub">{e.num<=progress?"watched":""}</span>
              </div>))}</div>}
        {eps && eps.length>0 && <div className="sub" style={{marginTop:6}}>MyAnimeList gives episode titles and
          air dates; per-episode descriptions are rarely available there.</div>}
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
        <div className="sub" style={{margin:"10px 2px"}}>Metadata from Jikan (MyAnimeList).
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
    case "movies": return <Soon label="Movies" note="Will use TMDB for posters & metadata."/>;
    case "games": return <Soon label="Games" note="Will use RAWG for cover art & metadata."/>;
    case "finance": return <FinanceModule data={data} update={update}/>;
    case "investments": return <Investments data={data} update={update}/>;
    case "todos": return <Soon label="To-do & Plan" note="Tasks, due dates, and a simple planner."/>;
    case "ideas": return <Soon label="Ideas" note="Quick capture notes with tags."/>;
    case "mllog": return <Soon label="ML Research" note="Log papers, topics, and progress."/>;
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
