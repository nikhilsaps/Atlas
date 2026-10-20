import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const CATS = [
  "Food",
  "Rent",
  "Transport",
  "Shopping",
  "Bills",
  "Health",
  "Entertainment",
  "Travel",
  "Other",
];
function FinanceModule({ data, update }) {
  const [tab, setTab] = useState("expenses");
  return (
    <div>
      <Head title="Finance" sub="Track spending and plan with real numbers." />
      <Tabs
        tabs={[
          ["expenses", "Expenses"],
          ["sip", "SIP"],
          ["compound", "Compound"],
          ["loan", "Loan / EMI"],
          ["goal", "Goal planner"],
        ]}
        tab={tab}
        set={setTab}
      />
      {tab === "expenses" && <Expenses data={data} update={update} />}
      {tab === "sip" && <SipCalc />}
      {tab === "compound" && <CompoundCalc />}
      {tab === "loan" && <LoanCalc />}
      {tab === "goal" && <GoalCalc />}
    </div>
  );
}
function Expenses({ data, update }) {
  const txns = data.finance.txns;
  const [f, setF] = useState({
    amount: "",
    category: "Food",
    note: "",
    date: today(),
  });
  const add = (e) => {
    e.preventDefault();
    if (!f.amount) return;
    update((d) => {
      d.finance.txns.push({
        id: uid(),
        amount: Number(f.amount),
        category: f.category,
        note: f.note.trim(),
        date: f.date || today(),
      });
    });
    setF({ ...f, amount: "", note: "" });
  };
  const rm = (id) =>
    update((d) => {
      d.finance.txns = d.finance.txns.filter((t) => t.id !== id);
    });
  const sorted = [...txns].sort((a, b) =>
    (b.date || "").localeCompare(a.date || ""),
  );
  const mk = thisMonth();
  const monthTx = txns.filter((t) => monthKey(t.date) === mk);
  const monthTotal = monthTx.reduce((s, t) => s + t.amount, 0);
  const byCat = {};
  monthTx.forEach((t) => {
    byCat[t.category] = (byCat[t.category] || 0) + t.amount;
  });
  const catRows = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const allTotal = txns.reduce((s, t) => s + t.amount, 0);
  return (
    <div className="calc">
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Log an expense</h3>
        <form
          onSubmit={add}
          style={{ display: "flex", flexDirection: "column", gap: 12 }}
        >
          <NumIn
            label="Amount (\u20B9)"
            value={f.amount}
            set={(v) => setF({ ...f, amount: v })}
          />
          <Field label="Category">
            <select
              value={f.category}
              onChange={(e) => setF({ ...f, category: e.target.value })}
            >
              {CATS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Note (optional)">
            <input
              value={f.note}
              placeholder="e.g. groceries"
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={f.date}
              onChange={(e) => setF({ ...f, date: e.target.value })}
            />
          </Field>
          <button>+ Add expense</button>
        </form>
        <div style={{ marginTop: 18 }}>
          <Out
            rows={[
              { lbl: "This month", num: inr(monthTotal), big: true },
              { lbl: "All-time logged", num: inr(allTotal) },
              { lbl: "Entries", num: num(txns.length) },
            ]}
          />
        </div>
        {catRows.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div className="sub" style={{ marginBottom: 6 }}>
              This month by category
            </div>
            {catRows.map(([c, v]) => (
              <div className="outrow" key={c}>
                <span className="lbl">
                  {c} <span className="sub">{pct((v / monthTotal) * 100)}</span>
                </span>
                <span className="num" style={{ fontSize: 15 }}>
                  {inr(v)}
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Recent</h3>
        {sorted.length === 0 ? (
          <div className="empty">No expenses yet.</div>
        ) : (
          <div className="txlist">
            {sorted.slice(0, 60).map((t) => (
              <div className="tx" key={t.id}>
                <div>
                  <div style={{ fontWeight: 600 }}>{t.note || t.category}</div>
                  <div className="cat">
                    {t.category}
                    {DOT}
                    {t.date}
                  </div>
                </div>
                <div className="amt">{inr(t.amount)}</div>
                <span className="tag" onClick={() => rm(t.id)}>
                  remove
                </span>
              </div>
            ))}
          </div>
        )}
      </article>
    </div>
  );
}
function SipCalc() {
  const [P, setP] = useState(10000),
    [rate, setR] = useState(12),
    [yrs, setY] = useState(10),
    [infl, setI] = useState(6);
  const fv = sipFV(n(P), n(rate), n(yrs)),
    inv = n(P) * n(yrs) * 12,
    gain = fv - inv,
    realRate = ((1 + n(rate) / 100) / (1 + n(infl) / 100) - 1) * 100,
    real = sipFV(n(P), realRate, n(yrs));
  return (
    <div className="calc">
      <article className="card">
        <h3 style={{ marginTop: 0 }}>SIP (monthly investment)</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <NumIn label="Monthly investment (\u20B9)" value={P} set={setP} />
          <NumIn label="Expected return (% / yr)" value={rate} set={setR} />
          <NumIn label="Duration (years)" value={yrs} set={setY} />
          <NumIn
            label="Inflation (% / yr)"
            hint="for today's-money value"
            value={infl}
            set={setI}
          />
        </div>
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Projection</h3>
        <Out
          rows={[
            { lbl: "Future value", num: inr(fv), big: true },
            { lbl: "You invest", num: inr(inv) },
            { lbl: "Estimated gains", num: inr(gain) },
            { lbl: "Worth in today's money", num: inr(real) },
          ]}
        />
      </article>
    </div>
  );
}
function CompoundCalc() {
  const [P, setP] = useState(100000),
    [rate, setR] = useState(10),
    [yrs, setY] = useState(10),
    [comp, setC] = useState(1),
    [infl, setI] = useState(6);
  const fv = compoundFV(n(P), n(rate), n(yrs), n(comp) || 1),
    gain = fv - n(P),
    real = realValue(fv, n(infl), n(yrs));
  return (
    <div className="calc">
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Lump sum (compound interest)</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <NumIn label="Principal (\u20B9)" value={P} set={setP} />
          <NumIn label="Interest rate (% / yr)" value={rate} set={setR} />
          <NumIn label="Duration (years)" value={yrs} set={setY} />
          <Field label="Compounding">
            <select value={comp} onChange={(e) => setC(Number(e.target.value))}>
              <option value={1}>Yearly</option>
              <option value={2}>Half-yearly</option>
              <option value={4}>Quarterly</option>
              <option value={12}>Monthly</option>
            </select>
          </Field>
          <NumIn label="Inflation (% / yr)" value={infl} set={setI} />
        </div>
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Projection</h3>
        <Out
          rows={[
            { lbl: "Maturity value", num: inr(fv), big: true },
            { lbl: "Interest earned", num: inr(gain) },
            { lbl: "Worth in today's money", num: inr(real) },
          ]}
        />
      </article>
    </div>
  );
}
function LoanCalc() {
  const [P, setP] = useState(2000000),
    [rate, setR] = useState(9),
    [yrs, setY] = useState(20);
  const m = emiCalc(n(P), n(rate), n(yrs)),
    total = m * n(yrs) * 12,
    interest = total - n(P);
  return (
    <div className="calc">
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Loan / EMI</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <NumIn label="Loan amount (\u20B9)" value={P} set={setP} />
          <NumIn label="Interest rate (% / yr)" value={rate} set={setR} />
          <NumIn label="Tenure (years)" value={yrs} set={setY} />
        </div>
        <div className="sub" style={{ marginTop: 12 }}>
          Want X that costs this much? Put the price above to see the EMI.
        </div>
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Breakdown</h3>
        <Out
          rows={[
            { lbl: "Monthly EMI", num: inr(m), big: true },
            { lbl: "Total interest", num: inr(interest) },
            { lbl: "Total payment", num: inr(total) },
            { lbl: "Interest as % of loan", num: pct((interest / n(P)) * 100) },
          ]}
        />
      </article>
    </div>
  );
}
function GoalCalc() {
  const [cost, setCost] = useState(1000000),
    [yrs, setY] = useState(5),
    [rate, setR] = useState(12),
    [infl, setI] = useState(6);
  const target = futureCost(n(cost), n(infl), n(yrs)),
    need = goalSIP(target, n(rate), n(yrs)),
    lump = target / Math.pow(1 + n(rate) / 100, n(yrs));
  return (
    <div className="calc">
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Goal planner</h3>
        <div className="sub" style={{ marginBottom: 12 }}>
          I want to buy X. Here's the real cost and the monthly saving.
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <NumIn label="Cost today (\u20B9)" value={cost} set={setCost} />
          <NumIn label="Buy in (years)" value={yrs} set={setY} />
          <NumIn label="Expected return (% / yr)" value={rate} set={setR} />
          <NumIn label="Inflation (% / yr)" value={infl} set={setI} />
        </div>
      </article>
      <article className="card">
        <h3 style={{ marginTop: 0 }}>Plan</h3>
        <Out
          rows={[
            { lbl: "Monthly SIP needed", num: inr(need), big: true },
            { lbl: "Cost after inflation", num: inr(target) },
            { lbl: "Or invest one lump sum now", num: inr(lump) },
          ]}
        />
      </article>
    </div>
  );
}

/* ================= INVESTMENTS ================= */

export { FinanceModule };
