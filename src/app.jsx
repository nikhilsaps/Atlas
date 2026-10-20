import React, { useState, useEffect } from "react";
import {
  KEY, THEME_KEY, blank, pickTitle, migrateAnime, fixStages, setItemStage, load, save, sdLoad, sdSave, useStore, uid, DOT, inr, num, pct, sipFV, compoundFV, realValue, emiCalc, goalSIP, futureCost, n, tfetch, ANILIST, MEDIA_FIELDS, alQuery, stripHtml, mapAnime, curSeason, fetchTop, fetchSeason, fetchSearch, fetchFull, fetchEpisodes, searchManga, fetchAnimeFull, fetchRelations, TMDB, tmdb, mapScreen, fetchScreenFull, fetchTvSeason, RAWG, rawg, mapGame, fetchGameFull, fetchGameShots, monthKey, thisMonth, today
} from "./core.jsx";
import { AnimeModule } from "./modules/Anime.jsx";
import { MangaModule } from "./modules/Manga.jsx";
import { FinanceModule } from "./modules/Finance.jsx";
import { Investments } from "./modules/Investments.jsx";
import { Dashboard } from "./modules/Dashboard.jsx";
import { MoviesModule } from "./modules/Movies.jsx";
import { GamesModule } from "./modules/Games.jsx";
import { TodoModule } from "./modules/Todo.jsx";
import { IdeasModule } from "./modules/Ideas.jsx";
import { MLModule } from "./modules/ML.jsx";
import { SettingsModule } from "./modules/Settings.jsx";

const NAV = [
  {
    grp: "Library",
    items: [
      { id: "dashboard", ic: "\u25C9", name: "Dashboard" },
      { id: "anime", ic: "\u25B6", name: "Anime" },
      { id: "manga", ic: "\u2637", name: "Manga" },
      { id: "movies", ic: "\u25A0", name: "Movies" },
      { id: "games", ic: "\u2726", name: "Games" },
    ],
  },
  {
    grp: "Life",
    items: [
      { id: "finance", ic: "\u20B9", name: "Finance" },
      { id: "investments", ic: "\u2197", name: "Investments" },
      { id: "todos", ic: "\u2713", name: "To-do & Plan" },
      { id: "ideas", ic: "\u2605", name: "Ideas" },
      { id: "mllog", ic: "\u2699", name: "ML Research" },
      { id: "settings", ic: "\u2692", name: "Settings" },
    ],
  },
];

/* ================= small bits ================= */
function App() {
  const [data, update, setData] = useStore();
  const [view, setView] = useState(
    () => (data.settings && data.settings.startView) || "anime",
  );
  const [theme, setTheme] = useState(
    () => (data.settings && data.settings.theme) || "light",
  );
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("atlas.sidebar") === "1",
  );
  const [drawerOpen, setDrawerOpen] = useState(false);
  const applyTheme = (t) => {
    let eff = t;
    if (t === "system")
      eff =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
    document.documentElement.dataset.theme = eff;
  };
  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem(THEME_KEY, theme);
    if (theme === "system" && window.matchMedia) {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const h = () => applyTheme("system");
      mq.addEventListener("change", h);
      return () => mq.removeEventListener("change", h);
    }
  }, [theme]);
  useEffect(() => {
    localStorage.setItem("atlas.sidebar", collapsed ? "1" : "0");
  }, [collapsed]);
  useEffect(() => {
    let ok = true;
    if (data.settings && data.settings.sdSync)
      sdLoad().then((d) => {
        if (ok && d) setData((p) => ({ ...structuredClone(blank), ...d }));
      });
    return () => {
      ok = false;
    };
  }, []);

  const counts = {
    anime: data.anime.length,
    manga: data.manga.length,
    movies: data.movies.length,
    games: data.games.length,
    investments: data.investments.length,
    todos: data.todos.filter((t) => !t.done).length,
    ideas: data.ideas.length,
  };

  const body = () => {
    switch (view) {
      case "dashboard":
        return <Dashboard data={data} go={setView} />;
      case "anime":
        return <AnimeModule data={data} update={update} />;
      case "manga":
        return <MangaModule data={data} update={update} />;
      case "movies":
        return <MoviesModule data={data} update={update} />;
      case "games":
        return <GamesModule data={data} update={update} />;
      case "finance":
        return <FinanceModule data={data} update={update} />;
      case "investments":
        return <Investments data={data} update={update} />;
      case "todos":
        return <TodoModule data={data} update={update} />;
      case "ideas":
        return <IdeasModule data={data} update={update} />;
      case "mllog":
        return <MLModule data={data} update={update} />;
      case "settings":
        return (
          <SettingsModule
            data={data}
            update={update}
            setData={setData}
            theme={theme}
            setTheme={setTheme}
          />
        );
      default:
        return null;
    }
  };

  const nextTheme = theme === "dark" ? "light" : "dark";
  return (
    <div
      data-sidebar-layout
      data-collapsed={collapsed ? "1" : undefined}
      data-drawer={drawerOpen ? "1" : undefined}
    >
      <button
        className="mobile-burger"
        onClick={() => setDrawerOpen(true)}
        title="Open menu"
        aria-label="Open menu"
      >
        {"\u2630"}
      </button>
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <aside data-sidebar>
        <div className="brand">
          <button
            className="burger"
            onClick={() => {
              setCollapsed((c) => !c);
              setDrawerOpen(false);
            }}
            title="Toggle sidebar"
          >
            {"\u2630"}
          </button>
          <span className="logo">A</span>
          <span className="btext">
            At<b>las</b>
          </span>
        </div>
        <nav>
          {NAV.map((g) => (
            <React.Fragment key={g.grp}>
              <div className="navgrp">{g.grp}</div>
              {g.items.map((it) => (
                <a
                  key={it.id}
                  href="#"
                  aria-current={view === it.id ? "page" : undefined}
                  title={it.name}
                  onClick={(e) => {
                    e.preventDefault();
                    setView(it.id);
                    setDrawerOpen(false);
                  }}
                >
                  <span className="ic">{it.ic}</span>
                  <span className="ntext">{it.name}</span>
                  {counts[it.id] > 0 && (
                    <span className="cnt">{counts[it.id]}</span>
                  )}
                </a>
              ))}
            </React.Fragment>
          ))}
        </nav>
        <div className="sidefoot">
          <button
            className="outline small"
            onClick={() => setTheme(nextTheme)}
            title="Toggle theme"
          >
            {theme === "dark" ? "\u2600" : "\u263E"}
            <span className="btext">
              {" "}
              {theme === "dark" ? "Light" : "Dark"} mode
            </span>
          </button>
        </div>
      </aside>
      <main>{body()}</main>
    </div>
  );
}

export default App;
