import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "../core.jsx";
import { Head, Field, NumIn, Out, Tabs, Soon, useBackClose, DetailPage, Stepper } from "../ui.jsx";

function IdeasModule({ data, update }) {
  const [open, setOpen] = useState(null);
  const save = (idea) =>
    update((d) => {
      if (idea.id) {
        const i = d.ideas.findIndex((x) => x.id === idea.id);
        d.ideas[i] = idea;
      } else d.ideas.unshift({ ...idea, id: uid(), added: Date.now() });
    });
  const del = (id) =>
    update((d) => {
      d.ideas = d.ideas.filter((x) => x.id !== id);
    });
  const editing =
    open && open !== "new" ? data.ideas.find((x) => x.id === open) : null;
  return (
    <div>
      <Head title="Ideas" sub={data.ideas.length + " captured"}>
        <button onClick={() => setOpen("new")}>+ New idea</button>
      </Head>
      {data.ideas.length === 0 ? (
        <div className="empty">
          No ideas yet. Hit <b>+ New idea</b> to capture one.
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))",
            gap: 14,
          }}
        >
          {data.ideas.map((x) => (
            <article
              className="card"
              key={x.id}
              style={{ cursor: "pointer" }}
              onClick={() => setOpen(x.id)}
            >
              <h3 style={{ margin: "0 0 6px" }}>{x.title || "Untitled"}</h3>
              <div className="sub" style={{ whiteSpace: "pre-wrap" }}>
                {(x.body || "").slice(0, 180)}
              </div>
              <div style={{ marginTop: 8 }}>
                {(x.tags || []).map((t) => (
                  <span className="tag" key={t}>
                    {t}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
      {(open === "new" || editing) && (
        <IdeaEditor
          idea={editing}
          onClose={() => setOpen(null)}
          onSave={save}
          onDelete={
            editing
              ? () => {
                  del(editing.id);
                  setOpen(null);
                }
              : null
          }
        />
      )}
    </div>
  );
}
function IdeaEditor({ idea, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState(idea?.title || "");
  const [body, setBody] = useState(idea?.body || "");
  const [tags, setTags] = useState((idea?.tags || []).join(", "));
  const save = () => {
    onSave({
      ...(idea || {}),
      title: title.trim(),
      body,
      tags: tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    });
    onClose();
  };
  return (
    <div className="ovl" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="mh">
          <b>{idea ? "Edit idea" : "New idea"}</b>
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
          <Field label="Notes">
            <textarea
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          <Field label="Tags" hint="comma-separated">
            <input value={tags} onChange={(e) => setTags(e.target.value)} />
          </Field>
          <div className="acts">
            <button onClick={save}>Save</button>
            {onDelete && (
              <button className="ghost small" onClick={onDelete}>
                delete
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================= ML RESEARCH ================= */

export { IdeasModule };
