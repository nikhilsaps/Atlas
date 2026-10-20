import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

function TodoModule({ data, update }) {
  const [text, setText] = useState("");
  const [due, setDue] = useState("");
  const [prio, setPrio] = useState("med");
  const [filter, setFilter] = useState("active");
  const add = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    update((d) =>
      d.todos.unshift({
        id: uid(),
        text: text.trim(),
        due,
        prio,
        done: false,
        added: Date.now(),
      }),
    );
    setText("");
    setDue("");
    setPrio("med");
  };
  const toggle = (id) =>
    update((d) => {
      const t = d.todos.find((x) => x.id === id);
      t.done = !t.done;
    });
  const del = (id) =>
    update((d) => {
      d.todos = d.todos.filter((x) => x.id !== id);
    });
  let list = data.todos;
  if (filter === "active") list = list.filter((t) => !t.done);
  else if (filter === "done") list = list.filter((t) => t.done);
  const order = { high: 0, med: 1, low: 2 };
  list = [...list].sort(
    (a, b) =>
      a.done - b.done ||
      (a.due || "zzzz").localeCompare(b.due || "zzzz") ||
      order[a.prio] - order[b.prio],
  );
  const active = data.todos.filter((t) => !t.done).length;
  return (
    <div>
      <Head
        title="To-do & Plan"
        sub={
          active +
          " open" +
          (active !== data.todos.length ? " of " + data.todos.length : "")
        }
      />
      <form
        className="row"
        onSubmit={add}
        style={{ marginBottom: 14, flexWrap: "wrap" }}
      >
        <input
          style={{ flex: 2, minWidth: 200 }}
          placeholder="What needs doing?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <input
          type="date"
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <select value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option value="high">High</option>
          <option value="med">Medium</option>
          <option value="low">Low</option>
        </select>
        <button>Add</button>
      </form>
      <div className="chips">
        {[
          ["active", "Active"],
          ["all", "All"],
          ["done", "Done"],
        ].map(([k, l]) => (
          <button
            key={k}
            className={"small" + (filter === k ? "" : " outline")}
            onClick={() => setFilter(k)}
          >
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">Nothing here. Add your first task above.</div>
      ) : (
        <div className="txlist">
          {list.map((t) => (
            <div className="tx" key={t.id}>
              <div className="row" style={{ gap: 12 }}>
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggle(t.id)}
                />
                <span
                  style={{
                    fontWeight: 600,
                    textDecoration: t.done ? "line-through" : "none",
                    opacity: t.done ? 0.55 : 1,
                  }}
                >
                  {t.text}
                </span>
                <span
                  className="tag"
                  style={{
                    background:
                      t.prio === "high"
                        ? "#f8717133"
                        : t.prio === "low"
                          ? "#9ca3af33"
                          : "#f59e0b33",
                  }}
                >
                  {t.prio}
                </span>
              </div>
              <div className="cat">{t.due || ""}</div>
              <span className="tag" onClick={() => del(t.id)}>
                delete
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ================= IDEAS ================= */

export { TodoModule };
