const { useState, useEffect, useMemo } = React;

/* ================= data store: one JSON blob in localStorage ================= */
const KEY = "atlas.data.v1";
const OLD_KEY = "codex.data.v1";
const blank = { anime:[], manga:[], movies:[], games:[], finance:{accounts:[],txns:[]},
  investments:[], todos:[], ideas:[], mllog:[] };
function load(){ try{ let raw=localStorage.getItem(KEY);
  if(raw==null){ const old=localStorage.getItem(OLD_KEY); if(old!=null){ raw=old; localStorage.setItem(KEY,old); } }
  const d={...blank, ...JSON.parse(raw||"{}")};
  d.finance={accounts:[],txns:[],...(d.finance||{})}; return d; }catch(e){ return structuredClone(blank); } }
function save(d){ localStorage.setItem(KEY, JSON.stringify(d)); }
function useStore(){
  const [data,setData] = useState(load);
  useEffect(()=>save(data),[data]);
  const update = (fn)=> setData(d=>{ const n = structuredClone(d); fn(n); return n; });
  return [data, update, setData];
}
const uid = ()=> (crypto.randomUUID ? crypto.randomUUID() : String(Date.now())+Math.random());

/* ================= money helpers ================= */
const inr = n => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0})
  .format(isFinite(n)?n:0);
const num = n => new Intl.NumberFormat("en-IN",{maximumFractionDigits:0}).format(isFinite(n)?n:0);
const pct = n => (isFinite(n)?n:0).toFixed(1)+"%";

// SIP future value (monthly contribution P, annual rate%, years) - end-of-month
function sipFV(P, rate, yrs){ const i=rate/1200, n=yrs*12;
  if(i===0) return P*n; return P*((Math.pow(1+i,n)-1)/i)*(1+i); }
// lump-sum compounding (comp times/yr)
function compoundFV(P, rate, yrs, comp){ const r=rate/100; return P*Math.pow(1+r/comp, comp*yrs); }
// inflation-adjusted (today's) value of a future amount
function realValue(FV, infl, yrs){ return FV/Math.pow(1+infl/100, yrs); }
// EMI for a loan (principal P, annual rate%, years)
function emi(P, rate, yrs){ const r=rate/1200, n=yrs*12;
  if(r===0) return P/n; return P*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1); }
// monthly SIP needed to reach targetFV
function goalSIP(targetFV, rate, yrs){ const i=rate/1200, n=yrs*12;
  if(i===0) return targetFV/n; return targetFV*i/((Math.pow(1+i,n)-1)*(1+i)); }
// future cost of something after inflation
function futureCost(cost, infl, yrs){ return cost*Math.pow(1+infl/100, yrs); }

/* ================= Jikan (MyAnimeList) free metadata, no key, CORS ok ================= */
async function jikan(kind, q){
  const r = await fetch(`https://api.jikan.moe/v4/${kind}?q=${encodeURIComponent(q)}&limit=12&sfw`);
  const j = await r.json();
  return (j.data||[]).map(x=>({
    mal:x.mal_id, title:x.title_english||x.title, cover:x.images?.jpg?.image_url,
    score:x.score, year:x.year||x.published?.prop?.from?.year||x.aired?.prop?.from?.year,
    count:x.episodes||x.chapters, type:x.type,
    genres:(x.genres||[]).map(g=>g.name).slice(0,3), synopsis:x.synopsis }));
}

/* ================= nav config ================= */
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
const STATUS = ["Watching","Completed","Plan","Dropped"];

/* ================= small reusable bits ================= */
function Head({title, sub, children}){
  return (<div className="pagehead">
    <div><h1>{title}</h1>{sub && <div className="sub">{sub}</div>}</div>
    <div className="grow"/>{children}</div>);
}
function Field({label, hint, children}){
  return (<label data-field>{label}{children}{hint && <small data-hint>{hint}</small>}</label>);
}
function NumIn({label, hint, value, set, step, min}){
  return (<Field label={label} hint={hint}>
    <input type="number" inputMode="decimal" step={step||"any"} min={min}
      value={value} onChange={e=>set(e.target.value===""?"":Number(e.target.value))}/>
  </Field>);
}
function Out({rows}){
  return (<div className="out">{rows.map((r,i)=>(
    <div className={"outrow"+(r.big?" big":"")} key={i}>
      <span className="lbl">{r.lbl}</span><span className="num">{r.num}</span>
    </div>))}</div>);
}
const n = v => (v===""||v==null||isNaN(v)) ? 0 : Number(v);

/* ================= media module (anime / manga share one UI) ================= */
function MediaModule({data, update, kind, label}){
  const list = data[kind];
  const [open,setOpen] = useState(false);
  const [filter,setFilter] = useState("All");
  const shown = filter==="All" ? list : list.filter(x=>x.status===filter);
  const removeIt = (id)=> update(d=>{ d[kind] = d[kind].filter(x=>x.id!==id); });
  const cycle = (id)=> update(d=>{ const it=d[kind].find(x=>x.id===id);
    it.status = STATUS[(STATUS.indexOf(it.status)+1)%STATUS.length]; });
  return (<div>
    <Head title={label} sub={list.length+" in your library"}>
      <button onClick={()=>setOpen(true)}>+ Add {label}</button>
    </Head>
    <div className="chips">
      {["All",...STATUS].map(s=>(
        <button key={s} className={"small"+(filter===s?"":" outline")} onClick={()=>setFilter(s)}>{s}</button>))}
    </div>
    {shown.length===0
      ? <div className="empty">Nothing here yet. Hit <b>+ Add {label}</b> to search and pull in cover art, score and synopsis automatically.</div>
      : <div className="media">{shown.map(x=>(
          <div className="mcard" key={x.id} title={x.synopsis||""}>
            <div className="cover" style={{backgroundImage:`url(${x.cover||""})`}}>
              <span className="st" onClick={()=>cycle(x.id)}>{x.status}</span>
              {x.score?<span className="sc">{"\u2605 "+x.score}</span>:null}
            </div>
            <div className="b">
              <div className="t">{x.title}</div>
              <div className="m">{[x.year,x.count&&(x.count+(kind==="anime"?" ep":" ch"))].filter(Boolean).join(" \u00B7 ")}</div>
              <div style={{marginTop:6}}>
                <span className="tag" onClick={()=>cycle(x.id)}>status</span>
                <span className="tag" onClick={()=>removeIt(x.id)}>remove</span>
              </div>
            </div>
          </div>))}
        </div>}
    {open && <SearchModal kind={kind} label={label} onClose={()=>setOpen(false)}
      onAdd={(it)=>update(d=>{ if(!d[kind].some(e=>e.mal===it.mal))
        d[kind].push({...it, id:uid(), status:"Plan", added:Date.now()}); })}/>}
  </div>);
}

function SearchModal({kind, label, onClose, onAdd}){
  const [q,setQ] = useState(""); const [res,setRes] = useState([]);
  const [busy,setBusy] = useState(false); const [err,setErr] = useState("");
  const run = async(e)=>{ e&&e.preventDefault(); if(!q.trim())return;
    setBusy(true); setErr("");
    try{ setRes(await jikan(kind,q)); }catch(ex){ setErr("Lookup failed (offline?). Add manually later."); }
    setBusy(false); };
  return (<div className="ovl" onClick={onClose}>
    <div className="modal" onClick={e=>e.stopPropagation()}>
      <div className="mh"><b>Add {label}</b><div className="grow"/>
        <button className="ghost small" onClick={onClose}>close</button></div>
      <div className="mc">
        <form className="row" onSubmit={run}>
          <input style={{flex:1}} autoFocus placeholder={`Search ${label} by title...`}
            value={q} onChange={e=>setQ(e.target.value)} />
          <button disabled={busy}>{busy?"Searching...":"Search"}</button>
        </form>
        <div className="sub" style={{margin:"10px 2px"}}>Metadata from Jikan (MyAnimeList).
          {err && <span style={{color:"var(--destructive,#f87171)"}}> {err}</span>}</div>
        <div style={{marginTop:4}}>
          {res.map(x=>(
            <div className="sr" key={x.mal}>
              <img src={x.cover} alt=""/>
              <div>
                <div style={{fontWeight:600}}>{x.title}</div>
                <div className="sub">{[x.year,x.type,x.score&&("\u2605 "+x.score)].filter(Boolean).join(" \u00B7 ")}</div>
                <div>{x.genres.map(g=><span className="tag" key={g}>{g}</span>)}</div>
              </div>
              <button className="small" onClick={()=>{onAdd(x);onClose();}}>Add</button>
            </div>))}
        </div>
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
  const [tab,setTab] = useState("expenses");
  const tabs = [["expenses","Expenses"],["sip","SIP"],["compound","Compound"],
    ["loan","Loan / EMI"],["goal","Goal planner"]];
  return (<div>
    <Head title="Finance" sub="Track spending and plan with real numbers."/>
    <div className="chips">
      {tabs.map(([id,name])=>(
        <button key={id} className={"small"+(tab===id?"":" outline")} onClick={()=>setTab(id)}>{name}</button>))}
    </div>
    {tab==="expenses" && <Expenses data={data} update={update}/>}
    {tab==="sip" && <SipCalc/>}
    {tab==="compound" && <CompoundCalc/>}
    {tab==="loan" && <LoanCalc/>}
    {tab==="goal" && <GoalCalc/>}
  </div>);
}

function Expenses({data, update}){
  const txns = data.finance.txns;
  const [f,setF] = useState({amount:"", category:"Food", note:"", date:today()});
  const add = (e)=>{ e.preventDefault(); if(!f.amount) return;
    update(d=>{ d.finance.txns.push({id:uid(), amount:Number(f.amount), category:f.category,
      note:f.note.trim(), date:f.date||today()}); });
    setF({...f, amount:"", note:""}); };
  const rm = (id)=> update(d=>{ d.finance.txns = d.finance.txns.filter(t=>t.id!==id); });
  const sorted = [...txns].sort((a,b)=> (b.date||"").localeCompare(a.date||"") || 0);
  const mk = thisMonth();
  const monthTx = txns.filter(t=>monthKey(t.date)===mk);
  const monthTotal = monthTx.reduce((s,t)=>s+t.amount,0);
  const byCat = {}; monthTx.forEach(t=>{ byCat[t.category]=(byCat[t.category]||0)+t.amount; });
  const catRows = Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
  const allTotal = txns.reduce((s,t)=>s+t.amount,0);
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>Log an expense</h3>
      <form onSubmit={add} style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Amount (\u20B9)" value={f.amount} set={v=>setF({...f,amount:v})}/>
        <Field label="Category">
          <select value={f.category} onChange={e=>setF({...f,category:e.target.value})}>
            {CATS.map(c=><option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Note (optional)">
          <input value={f.note} placeholder="e.g. groceries" onChange={e=>setF({...f,note:e.target.value})}/>
        </Field>
        <Field label="Date">
          <input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})}/>
        </Field>
        <button>+ Add expense</button>
      </form>
      <div style={{marginTop:18}}>
        <Out rows={[
          {lbl:"This month", num:inr(monthTotal), big:true},
          {lbl:"All-time logged", num:inr(allTotal)},
          {lbl:"Entries", num:num(txns.length)},
        ]}/>
      </div>
      {catRows.length>0 && <div style={{marginTop:14}}>
        <div className="sub" style={{marginBottom:6}}>This month by category</div>
        {catRows.map(([c,v])=>(
          <div className="outrow" key={c}>
            <span className="lbl">{c} <span className="sub">{pct(v/monthTotal*100)}</span></span>
            <span className="num" style={{fontSize:15}}>{inr(v)}</span>
          </div>))}
      </div>}
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Recent</h3>
      {sorted.length===0
        ? <div className="empty">No expenses yet. Log your first on the left.</div>
        : <div className="txlist">{sorted.slice(0,60).map(t=>(
            <div className="tx" key={t.id}>
              <div>
                <div style={{fontWeight:600}}>{t.note||t.category}</div>
                <div className="cat">{t.category} · {t.date}</div>
              </div>
              <div className="amt">{inr(t.amount)}</div>
              <span className="tag" onClick={()=>rm(t.id)}>remove</span>
            </div>))}</div>}
    </article>
  </div>);
}

function SipCalc(){
  const [P,setP]=useState(10000),[rate,setR]=useState(12),[yrs,setY]=useState(10),[infl,setI]=useState(6);
  const fv=sipFV(n(P),n(rate),n(yrs)), inv=n(P)*n(yrs)*12, gain=fv-inv, real=realValue(fv,n(infl),n(yrs));
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>SIP (monthly investment)</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Monthly investment (\u20B9)" value={P} set={setP}/>
        <NumIn label="Expected return (% / yr)" value={rate} set={setR}/>
        <NumIn label="Duration (years)" value={yrs} set={setY}/>
        <NumIn label="Inflation (% / yr)" hint="for today's-money value" value={infl} set={setI}/>
      </div>
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Projection</h3>
      <Out rows={[
        {lbl:"Future value", num:inr(fv), big:true},
        {lbl:"You invest", num:inr(inv)},
        {lbl:"Estimated gains", num:inr(gain)},
        {lbl:"Worth in today's money", num:inr(real)},
      ]}/>
    </article>
  </div>);
}

function CompoundCalc(){
  const [P,setP]=useState(100000),[rate,setR]=useState(10),[yrs,setY]=useState(10);
  const [comp,setC]=useState(1),[infl,setI]=useState(6);
  const fv=compoundFV(n(P),n(rate),n(yrs),n(comp)||1), gain=fv-n(P), real=realValue(fv,n(infl),n(yrs));
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>Lump sum (compound interest)</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Principal (\u20B9)" value={P} set={setP}/>
        <NumIn label="Interest rate (% / yr)" value={rate} set={setR}/>
        <NumIn label="Duration (years)" value={yrs} set={setY}/>
        <Field label="Compounding">
          <select value={comp} onChange={e=>setC(Number(e.target.value))}>
            <option value={1}>Yearly</option><option value={2}>Half-yearly</option>
            <option value={4}>Quarterly</option><option value={12}>Monthly</option>
          </select>
        </Field>
        <NumIn label="Inflation (% / yr)" value={infl} set={setI}/>
      </div>
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Projection</h3>
      <Out rows={[
        {lbl:"Maturity value", num:inr(fv), big:true},
        {lbl:"Interest earned", num:inr(gain)},
        {lbl:"Worth in today's money", num:inr(real)},
      ]}/>
    </article>
  </div>);
}

function LoanCalc(){
  const [P,setP]=useState(2000000),[rate,setR]=useState(9),[yrs,setY]=useState(20);
  const m=emi(n(P),n(rate),n(yrs)), total=m*n(yrs)*12, interest=total-n(P);
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>Loan / EMI</h3>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Loan amount (\u20B9)" value={P} set={setP}/>
        <NumIn label="Interest rate (% / yr)" value={rate} set={setR}/>
        <NumIn label="Tenure (years)" value={yrs} set={setY}/>
      </div>
      <div className="sub" style={{marginTop:12}}>Want X that costs this much? Put the price above and see
        the monthly EMI you'd pay.</div>
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Breakdown</h3>
      <Out rows={[
        {lbl:"Monthly EMI", num:inr(m), big:true},
        {lbl:"Total interest", num:inr(interest)},
        {lbl:"Total payment", num:inr(total)},
        {lbl:"Interest as % of loan", num:pct(interest/n(P)*100)},
      ]}/>
    </article>
  </div>);
}

function GoalCalc(){
  const [cost,setCost]=useState(1000000),[yrs,setY]=useState(5),[rate,setR]=useState(12),[infl,setI]=useState(6);
  const target=futureCost(n(cost),n(infl),n(yrs)), need=goalSIP(target,n(rate),n(yrs));
  const lump = target/Math.pow(1+n(rate)/100,n(yrs));
  return (<div className="calc">
    <article className="card">
      <h3 style={{marginTop:0}}>Goal planner</h3>
      <div className="sub" style={{marginBottom:12}}>I want to buy X. Here's what it'll really cost and how
        much to save each month.</div>
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        <NumIn label="Cost today (\u20B9)" value={cost} set={setCost}/>
        <NumIn label="Buy in (years)" value={yrs} set={setY}/>
        <NumIn label="Expected return (% / yr)" value={rate} set={setR}/>
        <NumIn label="Inflation (% / yr)" value={infl} set={setI}/>
      </div>
    </article>
    <article className="card">
      <h3 style={{marginTop:0}}>Plan</h3>
      <Out rows={[
        {lbl:"Monthly SIP needed", num:inr(need), big:true},
        {lbl:"Cost after inflation", num:inr(target)},
        {lbl:"Or invest one lump sum now", num:inr(lump)},
      ]}/>
    </article>
  </div>);
}

/* ================= INVESTMENTS ================= */
function Investments({data, update}){
  const list = data.investments;
  const [f,setF] = useState({name:"", type:"Stock", invested:"", current:""});
  const TYPES=["Stock","Mutual fund","FD","Gold","Crypto","Real estate","Other"];
  const add=(e)=>{ e.preventDefault(); if(!f.name||!f.invested) return;
    update(d=>{ d.investments.push({id:uid(), name:f.name.trim(), type:f.type,
      invested:Number(f.invested), current:Number(f.current||f.invested)}); });
    setF({name:"", type:"Stock", invested:"", current:""}); };
  const rm=(id)=>update(d=>{ d.investments=d.investments.filter(x=>x.id!==id); });
  const tInv=list.reduce((s,x)=>s+x.invested,0), tCur=list.reduce((s,x)=>s+x.current,0);
  const pl=tCur-tInv;
  return (<div>
    <Head title="Investments" sub="Your holdings and overall return."/>
    <div className="statgrid" style={{marginBottom:20}}>
      <article className="card stat"><div className="k">Invested</div><div className="v">{inr(tInv)}</div></article>
      <article className="card stat"><div className="k">Current value</div><div className="v">{inr(tCur)}</div></article>
      <article className="card stat"><div className="k">Profit / loss</div>
        <div className="v" style={{color:pl>=0?"#4ade80":"#f87171"}}>{inr(pl)} <small>{pct(tInv?pl/tInv*100:0)}</small></div></article>
    </div>
    <div className="calc">
      <article className="card">
        <h3 style={{marginTop:0}}>Add holding</h3>
        <form onSubmit={add} style={{display:"flex",flexDirection:"column",gap:12}}>
          <Field label="Name"><input value={f.name} placeholder="e.g. Nifty 50 Index"
            onChange={e=>setF({...f,name:e.target.value})}/></Field>
          <Field label="Type"><select value={f.type} onChange={e=>setF({...f,type:e.target.value})}>
            {TYPES.map(t=><option key={t}>{t}</option>)}</select></Field>
          <NumIn label="Invested (\u20B9)" value={f.invested} set={v=>setF({...f,invested:v})}/>
          <NumIn label="Current value (\u20B9)" hint="leave blank = same as invested"
            value={f.current} set={v=>setF({...f,current:v})}/>
          <button>+ Add</button>
        </form>
      </article>
      <article className="card">
        <h3 style={{marginTop:0}}>Holdings</h3>
        {list.length===0
          ? <div className="empty">No holdings yet.</div>
          : <div className="txlist">{list.map(x=>{ const d=x.current-x.invested;
              return (<div className="tx" key={x.id}>
                <div><div style={{fontWeight:600}}>{x.name}</div>
                  <div className="cat">{x.type} · in {inr(x.invested)}</div></div>
                <div className="amt" style={{color:d>=0?"#4ade80":"#f87171"}}>
                  {inr(x.current)}<div className="cat" style={{textAlign:"right"}}>{d>=0?"+":""}{pct(x.invested?d/x.invested*100:0)}</div></div>
                <span className="tag" onClick={()=>rm(x.id)}>remove</span>
              </div>); })}</div>}
      </article>
    </div>
  </div>);
}

/* ================= dashboard ================= */
function Dashboard({data, go}){
  const spendMonth = data.finance.txns.filter(t=>monthKey(t.date)===thisMonth())
    .reduce((s,t)=>s+t.amount,0);
  const invCur = data.investments.reduce((s,x)=>s+x.current,0);
  const cards = [
    {k:"Spent this month", v:inr(spendMonth), id:"finance"},
    {k:"Portfolio value", v:inr(invCur), id:"investments"},
    {k:"Anime", v:data.anime.length, s:data.anime.filter(x=>x.status==="Watching").length+" watching", id:"anime"},
    {k:"Manga", v:data.manga.length, s:data.manga.filter(x=>x.status==="Watching").length+" reading", id:"manga"},
    {k:"Open to-dos", v:data.todos.filter(t=>!t.done).length, s:data.todos.length+" total", id:"todos"},
    {k:"Ideas", v:data.ideas.length, s:"captured", id:"ideas"},
  ];
  return (<div>
    <Head title="Dashboard" sub="Everything you track, in one place."/>
    <div className="statgrid">{cards.map(c=>(
      <article className="card stat" key={c.k} onClick={()=>go(c.id)} style={{cursor:"pointer"}}>
        <div className="k">{c.k}</div><div className="v">{c.v} {c.s && <small>{c.s}</small>}</div>
      </article>))}</div>
  </div>);
}

/* ================= placeholder for not-yet-built modules ================= */
function Soon({label, note}){
  return (<div><Head title={label} sub="Module scaffolded, logic coming next."/>
    <div className="empty">{note}</div></div>);
}

/* ================= app shell ================= */
function App(){
  const [data, update, setData] = useStore();
  const [view, setView] = useState("dashboard");
  const counts = {anime:data.anime.length, manga:data.manga.length, movies:data.movies.length,
    games:data.games.length, investments:data.investments.length,
    todos:data.todos.filter(t=>!t.done).length, ideas:data.ideas.length};

  const exportJson = ()=>{ const b=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(b);
    a.download="atlas-"+today()+".json"; a.click(); };
  const importJson = (e)=>{ const f=e.target.files[0]; if(!f)return; const r=new FileReader();
    r.onload=()=>{ try{ setData({...structuredClone(blank), ...JSON.parse(r.result)}); }
      catch(ex){ alert("Invalid JSON"); } }; r.readAsText(f); };

  const body = () => {
    switch(view){
      case "dashboard": return <Dashboard data={data} go={setView}/>;
      case "anime": return <MediaModule data={data} update={update} kind="anime" label="Anime"/>;
      case "manga": return <MediaModule data={data} update={update} kind="manga" label="Manga"/>;
      case "movies": return <Soon label="Movies" note="Will use TMDB for posters & metadata. Same card UI as Anime."/>;
      case "games": return <Soon label="Games" note="Will use RAWG for cover art & metadata."/>;
      case "finance": return <FinanceModule data={data} update={update}/>;
      case "investments": return <Investments data={data} update={update}/>;
      case "todos": return <Soon label="To-do & Plan" note="Tasks, due dates, and a simple planner board."/>;
      case "ideas": return <Soon label="Ideas" note="Quick capture notes with tags."/>;
      case "mllog": return <Soon label="ML Research" note="Log papers, topics, and progress toward goals."/>;
      default: return null;
    }
  };

  return (<div data-sidebar-layout>
    <aside data-sidebar>
      <div className="brand"><span className="logo">A</span><span>At<b>las</b></span></div>
      <nav>
        {NAV.map(g=>(<React.Fragment key={g.grp}>
          <div className="navgrp">{g.grp}</div>
          {g.items.map(it=>(
            <a key={it.id} href="#" aria-current={view===it.id?"page":undefined}
              onClick={e=>{e.preventDefault();setView(it.id);}}>
              <span>{it.ic}</span><span>{it.name}</span>
              {counts[it.id]>0 && <span className="cnt">{counts[it.id]}</span>}
            </a>))}
        </React.Fragment>))}
      </nav>
      <div style={{marginTop:"auto",display:"flex",flexDirection:"column",gap:8,paddingTop:14}}>
        <button className="outline small" onClick={exportJson}>{"\u2193"} Export JSON</button>
        <label className="button outline small" style={{textAlign:"center",cursor:"pointer"}}>{"\u2191"} Import JSON
          <input type="file" accept="application/json" hidden onChange={importJson}/></label>
      </div>
    </aside>
    <main>{body()}</main>
  </div>);
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
