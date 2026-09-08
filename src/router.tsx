/* eslint-disable react-refresh/only-export-components -- route definitions, not a component module */
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  redirect,
  useBlocker,
  useCanGoBack,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import { useWorkoutStore } from "./store/useWorkoutStore";
import { useWakeLock } from "./hooks/useWakeLock";
import { WorkoutScreen } from "./components/WorkoutScreen";
import { HistoryScreen } from "./components/HistoryScreen";
import type { HistoryView } from "./components/HistoryScreen";
import { ImportScreen } from "./components/ImportScreen";
import { GymLogScreen } from "./components/GymLogScreen";
import { ProgressScreen } from "./components/ProgressScreen";
import type { ProgressView } from "./components/ProgressScreen";
import { PyramidScreen } from "./components/PyramidScreen";
import { ScrollingPyramidsScreen } from "./components/ScrollingPyramidsScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { NoteEditorScreen } from "./components/NoteEditorScreen";
import { ScheduleScreen } from "./components/ScheduleScreen";
import { TabBar } from "./components/TabBar";
import type { Tab } from "./components/TabBar";
import { getSession } from "./lib/history";
import type { SessionRecord } from "./lib/history";
import { getNote } from "./lib/notes";
import { forgetScrollPosition } from "./hooks/useScrollRestore";

// ─── Back ────────────────────────────────────────────────────────────────────

/**
 * Back for the on-screen chevrons, so they behave like the hardware button:
 * pop a real history entry when there is one, otherwise fall back to a sensible
 * parent. The fallback matters when a screen is opened cold, from a deep link
 * or a notification, where there is nothing behind it to pop.
 */
function useGoBack(fallback: string) {
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const navigate = useNavigate();
  return () => {
    if (canGoBack) router.history.back();
    else void navigate({ to: fallback });
  };
}

// ─── Root ────────────────────────────────────────────────────────────────────

function RootLayout() {
  const phase = useWorkoutStore((s) => s.phase);
  const isActive = phase !== "idle";

  useWakeLock(isActive);

  // A running timer owns the screen, and back must not quit out of it. The
  // workout's own End button (which asks for confirmation) is the way out.
  useBlocker({ shouldBlockFn: () => isActive, enableBeforeUnload: false });

  if (isActive) return <WorkoutScreen />;
  return <Outlet />;
}

const rootRoute = createRootRoute({ component: RootLayout });

// ─── Tab shell ───────────────────────────────────────────────────────────────

const TAB_PATHS: Record<Tab, string> = {
  home: "/",
  schedule: "/schedule",
  workout: "/workout",
  history: "/history",
};

function TabShell() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const active =
    (Object.keys(TAB_PATHS) as Tab[]).find((t) => TAB_PATHS[t] === pathname) ?? "home";

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
      <TabBar active={active} onChange={(t) => void navigate({ to: TAB_PATHS[t] })} />
    </div>
  );
}

// Pathless: the four tabs share the bar, the drill-in screens below don't.
const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  component: TabShell,
});

/** Route a session to its editor: gym entries to the gym log, board sessions to the importer. */
function editPathFor(record: SessionRecord) {
  return `/sessions/${record.id}/edit`;
}

const GRANULARITIES = ["months", "seasons", "years"] as const;

type HomeSearch = {
  workout?: "max-hang";
  hold?: number;
  granularity?: "months" | "years";
};

/** Defaults are left out of the URL, so the home screen stays a bare `/`. */
function validateHomeSearch(raw: Record<string, unknown>): HomeSearch {
  const out: HomeSearch = {};
  if (raw.workout === "max-hang") out.workout = "max-hang";
  const hold = Number(raw.hold);
  if (Number.isInteger(hold) && hold > 0) out.hold = hold;
  const g = GRANULARITIES.find((x) => x === raw.granularity);
  if (g && g !== "seasons") out.granularity = g;
  return out;
}

const homeRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  validateSearch: validateHomeSearch,
  component: function Home() {
    const navigate = useNavigate();
    const search = homeRoute.useSearch();

    const view: ProgressView = {
      workout: search.workout ?? "repeaters",
      hold: search.hold ?? 0,
      granularity: search.granularity ?? "seasons",
    };

    // Picking a hold isn't a place you'd want to press back out of.
    const onViewChange = (patch: Partial<ProgressView>) => {
      const next = { ...view, ...patch };
      void navigate({
        to: "/",
        replace: true,
        search: {
          workout: next.workout === "repeaters" ? undefined : next.workout,
          hold: next.hold === 0 ? undefined : next.hold,
          granularity: next.granularity === "seasons" ? undefined : next.granularity,
        },
      });
    };

    return (
      <ProgressScreen
        view={view}
        onViewChange={onViewChange}
        onEditSession={(record) => void navigate({ to: editPathFor(record) })}
        onShowSettings={() => void navigate({ to: "/settings" })}
        onShowPyramid={() => void navigate({ to: "/pyramid" })}
        onShowSchedule={() => void navigate({ to: "/schedule" })}
      />
    );
  },
});

const scheduleRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/schedule",
  component: function Schedule() {
    const navigate = useNavigate();
    return <ScheduleScreen onShowSettings={() => void navigate({ to: "/settings" })} />;
  },
});

const workoutRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/workout",
  component: function Workout() {
    const navigate = useNavigate();
    return (
      <GymLogScreen
        mode="tab"
        onBack={() => {}}
        onSaved={() => {
          // The new entry lands at the top of History, so don't drop the user
          // back at wherever they last were in the list.
          forgetScrollPosition("history");
          void navigate({ to: "/history" });
        }}
        onShowSettings={() => void navigate({ to: "/settings" })}
      />
    );
  },
});

// ─── History, with its filters in the URL ────────────────────────────────────

const FILTERS = ["all", "workouts", "climbs", "notes"] as const;
type Filter = (typeof FILTERS)[number];

type HistorySearch = {
  filter?: Filter;
  q?: string;
  tags?: string;
  types?: string;
};

/** Empty values are left out so the common case stays a bare `/history`. */
function validateHistorySearch(raw: Record<string, unknown>): HistorySearch {
  const out: HistorySearch = {};
  const filter = FILTERS.find((f) => f === raw.filter);
  if (filter && filter !== "all") out.filter = filter;
  if (typeof raw.q === "string" && raw.q !== "") out.q = raw.q;
  if (typeof raw.tags === "string" && raw.tags !== "") out.tags = raw.tags;
  if (typeof raw.types === "string" && raw.types !== "") out.types = raw.types;
  return out;
}

const splitList = (v: string | undefined) => (v ? v.split(",").filter(Boolean) : []);
const joinList = (v: string[]) => (v.length > 0 ? v.join(",") : undefined);

const historyRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/history",
  validateSearch: validateHistorySearch,
  component: function History() {
    const navigate = useNavigate();
    const search = historyRoute.useSearch();

    const view: HistoryView = {
      filter: search.filter ?? "all",
      query: search.q ?? "",
      tags: splitList(search.tags),
      types: splitList(search.types),
    };

    // `replace` keeps typing in the search box out of the history stack —
    // otherwise every keystroke would be its own back press.
    const onViewChange = (patch: Partial<HistoryView>) => {
      const next = { ...view, ...patch };
      void navigate({
        to: "/history",
        replace: true,
        search: {
          filter: next.filter === "all" ? undefined : next.filter,
          q: next.query === "" ? undefined : next.query,
          tags: joinList(next.tags),
          types: joinList(next.types),
        },
      });
    };

    return (
      <HistoryScreen
        view={view}
        onViewChange={onViewChange}
        onAddNote={() => void navigate({ to: "/notes/new" })}
        onEdit={(record) => void navigate({ to: editPathFor(record) })}
        onEditNote={(note) => void navigate({ to: `/notes/${note.id}/edit` })}
        onShowSettings={() => void navigate({ to: "/settings" })}
      />
    );
  },
});

// ─── Drill-in screens: full width, no tab bar ────────────────────────────────

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: function Settings() {
    return <SettingsScreen onBack={useGoBack("/")} />;
  },
});

const pyramidRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pyramid",
  component: function Pyramid() {
    const navigate = useNavigate();
    return (
      <PyramidScreen
        onBack={useGoBack("/")}
        onShowScrollingPyramids={() => void navigate({ to: "/pyramid/scrolling" })}
      />
    );
  },
});

const scrollingPyramidsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/pyramid/scrolling",
  component: function ScrollingPyramids() {
    return <ScrollingPyramidsScreen onBack={useGoBack("/pyramid")} />;
  },
});

const importRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/import",
  component: function Import() {
    const back = useGoBack("/history");
    return <ImportScreen onBack={back} onSaved={back} />;
  },
});

const editSessionRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sessions/$sessionId/edit",
  loader: async ({ params }) => {
    const record = await getSession(params.sessionId);
    // Deleted out from under a deep link or a stale back entry.
    if (!record) throw redirect({ to: "/history" });
    return record;
  },
  component: function EditSession() {
    const record = editSessionRoute.useLoaderData();
    const back = useGoBack("/history");
    // Gym entries and board sessions have different editors; the record says which.
    if (record.gymData !== undefined) {
      return (
        <div className="h-full">
          <GymLogScreen
            mode="edit"
            onBack={back}
            onSaved={back}
            onDeleted={back}
            initialRecord={record}
          />
        </div>
      );
    }
    return (
      <ImportScreen onBack={back} onSaved={back} onDeleted={back} initialRecord={record} />
    );
  },
});

const newNoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notes/new",
  component: function NewNote() {
    const back = useGoBack("/history");
    return <NoteEditorScreen onBack={back} onSaved={back} />;
  },
});

const editNoteRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/notes/$noteId/edit",
  loader: async ({ params }) => {
    const record = await getNote(params.noteId);
    if (!record) throw redirect({ to: "/history" });
    return record;
  },
  component: function EditNote() {
    const record = editNoteRoute.useLoaderData();
    const back = useGoBack("/history");
    return (
      <NoteEditorScreen
        onBack={back}
        onSaved={back}
        onDeleted={back}
        initialRecord={record}
      />
    );
  },
});

// ─── Router ──────────────────────────────────────────────────────────────────

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([homeRoute, scheduleRoute, workoutRoute, historyRoute]),
  settingsRoute,
  pyramidRoute,
  scrollingPyramidsRoute,
  importRoute,
  editSessionRoute,
  newNoteRoute,
  editNoteRoute,
]);

export const router = createRouter({
  routeTree,
  defaultPreload: false,
  // Screens scroll their own inner containers, which the router's window-level
  // restoration can't see. useScrollRestore handles those.
  scrollRestoration: false,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
