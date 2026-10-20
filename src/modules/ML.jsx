import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

const ML_TYPES = ["Paper", "Concept", "Project", "Course"];
const ML_STATUS = ["Backlog", "Studying", "Done"];
function MLModule({ data, update }) {
  const [open, setOpen] = useState(null);
  const [f, setF] = useState("all");
  const save = (it) =>
    update((d) => {
      if (it.id) {
        const i = d.mllog.findIndex((x) => x.id === it.id);
        d.mllog[i] = it;
      } else d.mllog.unshift({ ...it, id: uid(), added: Date.now() });
    });
  const del = (id) =>
    update((d) => {
      d.mllog = d.mllog.filter((x) => x.id !== id);
    });
  const editing =
    open && open !== "new" ? data.mllog.find((x) => x.id === open) : null;
  let list = data.mllog;
  if (f !== "all") list = list.filter((x) => x.status === f);
  return (
    <div>
      <Head title="ML Research" sub={data.mllog.length + " entries"}>
        <button onClick={() => setOpen("new")}>+ Add entry</button>
      </Head>
      <div className="chips">
        {["all", ...ML_STATUS].map((s) => (
          <button
            key={s}
            className={"small" + (f === s ? "" : " outline")}
            onClick={() => setF(s)}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <div className="empty">
          Nothing logged yet. Track papers, concepts, projects and courses here.
        </div>
      ) : (
        <div className="txlist">
          {list.map((x) => (
            <div className="tx" key={x.id}>
              <div className="row" style={{ gap: 12 }}>
                <span className="tag">{x.type}</span>
                <span
                  style={{ fontWeight: 600, cursor: "pointer" }}
                  onClick={() => setOpen(x.id)}
                >
                  {x.title}
                </span>
                {x.link && (
                  <a
                    href={x.link}
                    target="_blank"
                    rel="noreferrer"
                    className="sub"
                  >
                    link
                  </a>
                )}
              </div>
              <div className="cat">
                {x.status}
                {x.date ? DOT + x.date : ""}
              </div>
              <span className="tag" onClick={() => del(x.id)}>
                delete
              </span>
            </div>
          ))}
        </div>
      )}
      {(open === "new" || editing) && (
        <MLEditor entry={editing} onClose={() => setOpen(null)} onSave={save} />
      )}
    </div>
  );
}
function MLEditor({ entry, onClose, onSave }) {
  const [title, setTitle] = useState(entry?.title || "");
  const [type, setType] = useState(entry?.type || "Paper");
  const [status, setStatus] = useState(entry?.status || "Backlog");
  const [link, setLink] = useState(entry?.link || "");
  const [date, setDate] = useState(entry?.date || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const save = () => {
    if (!title.trim()) return;
    onSave({
      ...(entry || {}),
      title: title.trim(),
      type,
      status,
      link: link.trim(),
      date,
      notes,
    });
    onClose();
  };
  return (
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <b>{entry ? "Edit entry" : "New entry"}</b>
          <div className="grow" />
          <button className="ghost small" onClick={onClose}>
            close
          </button>
        </div>
        <div className="mc">
          <Field label="Title">
            <input
              value={title}
              autoFocus
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="row" style={{ flexWrap: "wrap" }}>
            <Field label="Type">
              <select value={type} onChange={(e) => setType(e.target.value)}>
                {ML_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Status">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                {ML_STATUS.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Date">
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </div>
          <Field label="Link" hint="arXiv, repo, course URL">
            <input value={link} onChange={(e) => setLink(e.target.value)} />
          </Field>
          <Field label="Notes">
            <textarea
              rows={6}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>
          <div className="acts">
            <button onClick={save}>Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= SETTINGS ================= */

export { MLModule };
