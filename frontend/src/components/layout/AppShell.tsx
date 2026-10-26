import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bell,
  BookOpen,
  CheckSquare,
  CircleDollarSign,
  Clock3,
  Flame,
  Goal as GoalIcon,
  Home,
  Menu,
  MessageSquare,
  Search,
  Settings,
  Target,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import CreatorBrand from "../branding/CreatorBrand";
import { primaryNavigation } from "../../navigation";
import { api } from "../../services/api";
import type {
  AppSettings,
  FinanceEntry,
  Goal,
  Habit,
  JournalEntry,
  LearningPlan,
  Notification,
  Task,
} from "../../services/api";
import { appDataUpdatedEventName } from "../../services/api";
import creatorPhoto from "../../assets/creator-photo.png";
import {
  applyAppearance,
  cacheAppSettings,
  readCachedAppSettings,
  settingsUpdatedEventName,
} from "../../services/preferences";
import { applyLanguage, getAppLocale } from "../../services/language";
import { syncNativeNotifications } from "../../services/nativeNotifications";

const mobileNavigation = [
  { name: "Home", path: "/dashboard", icon: Home },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Habits", path: "/habits", icon: Flame },
  { name: "Learn", path: "/learning", icon: BookOpen },
];

type SearchResult = {
  id: string;
  title: string;
  detail: string;
  category: string;
  href: string;
  Icon: LucideIcon;
};

type SearchData = {
  tasks: Task[];
  goals: Goal[];
  habits: Habit[];
  finance: FinanceEntry[];
  learning: LearningPlan[];
  journal: JournalEntry[];
};

const emptySearchData: SearchData = {
  tasks: [],
  goals: [],
  habits: [],
  finance: [],
  learning: [],
  journal: [],
};

const searchShortcuts: SearchResult[] = [
  { id: "page-dashboard", title: "Dashboard", detail: "Your daily overview", category: "Page", href: "/dashboard", Icon: Home },
  { id: "page-tasks", title: "Tasks", detail: "Your task list", category: "Page", href: "/tasks", Icon: CheckSquare },
  { id: "page-habits", title: "Habits", detail: "Daily, weekly, and monthly habits", category: "Page", href: "/habits", Icon: Flame },
  { id: "page-goals", title: "Goals", detail: "Your active goals", category: "Page", href: "/goals", Icon: Target },
  { id: "page-income", title: "Finance", detail: "Income, expenses, and reports", category: "Page", href: "/finance", Icon: CircleDollarSign },
  { id: "page-learning", title: "Learning", detail: "Your study plans", category: "Page", href: "/learning", Icon: BookOpen },
  { id: "page-journal", title: "Journal", detail: "Your private reflections", category: "Page", href: "/journal", Icon: BookOpen },
  { id: "page-assistant", title: "AI Assistant", detail: "Plan your next step", category: "Page", href: "/assistant", Icon: MessageSquare },
  { id: "page-settings", title: "Settings", detail: "Account and app preferences", category: "Page", href: "/settings", Icon: Settings },
];

function localDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat(getAppLocale(), { month: "short", day: "numeric" })
    .format(new Date(`${date}T12:00:00`));
}

function notificationRoute(notification: Notification) {
  switch (notification.related_item_type) {
    case "task": return "/tasks";
    case "habit": return "/habits";
    case "goal": return "/goals";
    case "journal": return "/journal";
    case "finance": return "/finance";
    default: return "/dashboard";
  }
}

function notificationIcon(type: string): LucideIcon {
  if (type.startsWith("task_")) return Clock3;
  if (type.startsWith("goal_")) return GoalIcon;
  if (type.startsWith("habit_")) return Flame;
  if (type === "journal_reminder") return BookOpen;
  if (type === "finance_limit") return CircleDollarSign;
  return Target;
}

function notificationTime(value: string) {
  const date = new Date(value.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) return "Just now";
  return new Intl.DateTimeFormat(getAppLocale(), { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function buildSearchResults(data: SearchData, query: string): SearchResult[] {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return searchShortcuts;
  const results: SearchResult[] = [];
  const matches = (values: Array<string | null | undefined>) =>
    values.some((value) => value?.toLocaleLowerCase().includes(normalized));

  for (const task of data.tasks) {
    if (matches([task.title, task.description, task.due_date])) {
      results.push({ id: `task-${task.id}`, title: task.title, detail: task.due_date ? `Due ${formatDate(task.due_date)}` : "No due date", category: "Task", href: "/tasks", Icon: CheckSquare });
    }
  }
  for (const habit of data.habits) {
    if (matches([habit.name, habit.description])) {
      results.push({ id: `habit-${habit.id}`, title: habit.name, detail: `${habit.frequency} habit`, category: "Habit", href: "/habits", Icon: Flame });
    }
  }
  for (const goal of data.goals) {
    if (matches([goal.title, goal.description])) {
      results.push({ id: `goal-${goal.id}`, title: goal.title, detail: `${goal.progress}% complete`, category: "Goal", href: "/goals", Icon: Target });
    }
  }
  for (const entry of data.finance) {
    if (matches([entry.title, entry.category, entry.notes])) {
      results.push({ id: `finance-${entry.id}`, title: entry.title, detail: `${entry.kind === "income" ? "Income" : "Expense"} · ${entry.currency} ${entry.amount.toLocaleString(getAppLocale())}`, category: entry.kind === "income" ? "Income" : "Expense", href: `/finance/transactions/${entry.id}`, Icon: CircleDollarSign });
    }
  }
  for (const plan of data.learning) {
    if (matches([plan.title, plan.author])) {
      results.push({ id: `learning-${plan.id}`, title: plan.title, detail: `${plan.current_page} of ${plan.total_pages} pages read`, category: "Learning", href: "/learning", Icon: BookOpen });
    }
  }
  for (const entry of data.journal) {
    const answerText = Object.values(entry.answers ?? {}).join(" ");
    if (matches([entry.mood, answerText, entry.entry_date])) {
      results.push({ id: `journal-${entry.id}`, title: `Journal · ${formatDate(entry.entry_date)}`, detail: entry.mood ? `Private reflection · ${entry.mood}` : "Private reflection", category: "Journal", href: "/journal", Icon: BookOpen });
    }
  }
  for (const shortcut of searchShortcuts) {
    if (matches([shortcut.title, shortcut.detail])) results.push(shortcut);
  }
  return results.slice(0, 16);
}

function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [data, setData] = useState<SearchData>(emptySearchData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const results = useMemo(() => buildSearchResults(data, query), [data, query]);

  useEffect(() => {
    let active = true;
    const today = localDateString(new Date());
    void Promise.allSettled([
      api.getTasks(),
      api.getGoals(),
      api.getHabits(),
      api.getFinanceEntries(),
      api.getLearningPlans(),
      api.getJournalEntries("1970-01-01", today),
    ]).then((responses) => {
      if (!active) return;
      const next: SearchData = { ...emptySearchData };
      const errors: string[] = [];
      const keys: Array<keyof SearchData> = ["tasks", "goals", "habits", "finance", "learning", "journal"];
      responses.forEach((response, index) => {
        if (response.status === "fulfilled") {
          next[keys[index]] = response.value as never;
        } else {
          errors.push(keys[index]);
        }
      });
      setData(next);
      if (errors.length) setError(`Some ${errors.join(", ")} could not be searched.`);
      setLoading(false);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-slate-950/75 px-3 pb-6 pt-[8vh] backdrop-blur-sm sm:px-4 sm:pt-[12vh]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="global-search-title" className="w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-3 sm:px-4">
          <Search size={18} className="shrink-0 text-slate-500" />
          <label id="global-search-title" htmlFor="global-search-input" className="sr-only">Search your Discipline data</label>
          <input id="global-search-input" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tasks, habits, goals, journal…" className="h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-500" />
          <button type="button" onClick={onClose} aria-label="Close search" className="rounded-lg p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white"><X size={16} /></button>
        </div>
        <div className="max-h-[65vh] overflow-y-auto p-2">
          <p className="px-3 pb-2 pt-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-600">{query.trim() ? "Results across your app" : "Go to"}</p>
          {loading ? <p className="px-3 py-8 text-center text-sm text-slate-500">Searching your private records…</p> : results.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-500">No matching items found.</p> : results.map((result) => {
            const Icon = result.Icon;
            return <NavLink key={result.id} to={result.href} onClick={onClose} className="flex min-w-0 items-center gap-2 rounded-xl px-2 py-3 transition hover:bg-white/[0.06] sm:gap-3 sm:px-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] text-slate-400"><Icon size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{result.title}</span><span className="mt-0.5 block truncate text-xs text-slate-500">{result.detail}</span></span>
              <span className="hidden shrink-0 text-[10px] font-medium text-slate-600 sm:block">{result.category}</span>
              <ArrowRight size={14} className="shrink-0 text-slate-600" />
            </NavLink>;
          })}
          {error && <p role="status" className="px-3 py-2 text-xs text-amber-200">{error}</p>}
        </div>
      </section>
    </div>
  );
}

export default function AppShell() {
  const navigate = useNavigate();
  const [compactSidebar, setCompactSidebar] = useState(
    () => readCachedAppSettings().appearance.compact_sidebar,
  );
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationError, setNotificationError] = useState("");

  async function refreshNotifications() {
    try {
      const response = await api.getNotifications();
      setNotifications(response.items);
      setUnreadCount(response.unread_count);
      setNotificationError("");
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Could not load notifications.");
    }
  }

  useEffect(() => {
    let active = true;
    const applySettings = (settings: AppSettings) => {
      cacheAppSettings(settings);
      applyAppearance(settings.appearance.theme, settings.appearance.accent, settings.appearance.reduce_animations);
      applyLanguage(settings.appearance.language);
      setCompactSidebar(settings.appearance.compact_sidebar);
      void syncNativeNotifications(settings).catch(() => undefined);
    };
    const handleSettingsUpdated = (event: Event) => {
      const settings = (event as CustomEvent<AppSettings>).detail;
      if (settings) applySettings(settings);
    };

    window.addEventListener(settingsUpdatedEventName(), handleSettingsUpdated);
    void api.getAppSettings().then((settings) => {
      if (active) applySettings(settings);
    }).catch(() => undefined);

    return () => {
      active = false;
      window.removeEventListener(settingsUpdatedEventName(), handleSettingsUpdated);
    };
  }, []);

  useEffect(() => {
    void refreshNotifications();
    void syncNativeNotifications().catch(() => undefined);
    const interval = window.setInterval(() => void refreshNotifications(), 45_000);
    const handleDataUpdated = () => void syncNativeNotifications().catch(() => undefined);
    window.addEventListener(appDataUpdatedEventName, handleDataUpdated);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(appDataUpdatedEventName, handleDataUpdated);
    };
  }, []);

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setNotificationsOpen(false);
      }
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, []);

  async function openNotification(notification: Notification) {
    if (!notification.is_read) {
      try {
        await api.markNotificationRead(notification.id);
        setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, is_read: true } : item));
        setUnreadCount((count) => Math.max(0, count - 1));
      } catch (error) {
        setNotificationError(error instanceof Error ? error.message : "Could not mark this alert as read.");
      }
    }
    setNotificationsOpen(false);
    navigate(notificationRoute(notification));
  }

  async function markAllRead() {
    try {
      await api.markAllNotificationsRead();
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
      setNotificationError("");
    } catch (error) {
      setNotificationError(error instanceof Error ? error.message : "Could not mark alerts as read.");
    }
  }

  const navClass = ({ isActive }: { isActive: boolean }) => [
    `flex min-h-11 items-center rounded-xl text-sm font-medium transition ${compactSidebar ? "justify-center px-2" : "gap-3 px-4"}`,
    isActive ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-white",
  ].join(" ");

  return (
    <div className="min-h-screen overflow-x-clip bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className={`hidden shrink-0 flex-col border-r border-white/10 bg-slate-950 transition-[width] md:flex ${compactSidebar ? "w-20" : "w-64"}`}>
          <div className={`flex h-20 items-center border-b border-white/10 ${compactSidebar ? "justify-center px-2" : "px-6"}`}>
            {compactSidebar ? <span title="DISCIPLINE · Created by MR Salahuddin Forotan" className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white text-sm font-bold text-slate-950"><img src={creatorPhoto} alt="" className="h-full w-full object-cover" /></span> : <CreatorBrand />}
          </div>
          <nav aria-label="Primary navigation" className={`flex-1 space-y-1 ${compactSidebar ? "p-3" : "p-4"}`}>
            {primaryNavigation.map((item) => {
              const Icon = item.icon;
              return <NavLink key={item.path} to={item.path} title={compactSidebar ? item.name : undefined} className={navClass}>
                <Icon size={17} />{!compactSidebar && <span>{item.name}</span>}
              </NavLink>;
            })}
          </nav>
          <div className={`border-t border-white/10 ${compactSidebar ? "p-3" : "p-4"}`}>
            <NavLink to="/assistant" title={compactSidebar ? "AI Assistant" : undefined} className={navClass}>
              <MessageSquare size={17} />{!compactSidebar && <span>AI Assistant</span>}
            </NavLink>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto min-h-screen max-w-7xl px-3 pb-24 pt-3 sm:px-6 sm:pb-8 sm:pt-5 lg:px-8">
            <header className="sticky top-0 z-40 -mx-3 mb-5 flex min-h-16 items-center justify-between gap-2 border-b border-white/10 bg-slate-950/95 px-3 py-2 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:mb-6 md:justify-end md:border-0 md:bg-transparent md:px-0 md:py-0">
              <div className="min-w-0 md:hidden"><CreatorBrand className="gap-2" /></div>
              <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                <button type="button" onClick={() => { setSearchOpen(true); setNotificationsOpen(false); }} aria-label="Search everything" title="Search (Ctrl+K)" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"><Search size={17} /></button>
                <div className="relative">
                  <button type="button" onClick={() => { setNotificationsOpen((open) => !open); setSearchOpen(false); if (!notificationsOpen) void refreshNotifications(); }} aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ", none unread"}`} aria-expanded={notificationsOpen} className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300">
                    <Bell size={17} />{unreadCount > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-400 px-1 text-[10px] font-bold leading-none text-slate-950">{unreadCount > 9 ? "9+" : unreadCount}</span>}
                  </button>
                  {notificationsOpen && <section role="dialog" aria-label="Notifications" className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/40">
                    <div className="flex items-center justify-between gap-3 border-b border-white/[0.07] px-4 py-3">
                      <div><h2 className="text-sm font-semibold text-white">Notifications</h2><p className="mt-0.5 text-xs text-slate-500">{unreadCount ? `${unreadCount} unread` : "You’re all caught up"}</p></div>
                      <div className="flex items-center gap-1">{unreadCount > 0 && <button type="button" onClick={() => void markAllRead()} className="rounded-lg px-2 py-1.5 text-[11px] font-medium text-indigo-200 hover:bg-white/[0.05]">Mark all read</button>}<button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Close notifications" className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white"><X size={16} /></button></div>
                    </div>
                    <div className="max-h-[min(65vh,28rem)] overflow-y-auto p-2">
                      {notificationError && <p role="alert" className="m-2 rounded-lg bg-rose-300/[0.08] px-3 py-2 text-xs text-rose-200">{notificationError}</p>}
                      {notifications.length === 0 ? <p className="px-3 py-8 text-center text-sm text-slate-400">No notifications yet.</p> : notifications.map((notification) => {
                        const Icon = notificationIcon(notification.type);
                        return <button key={notification.id} type="button" onClick={() => void openNotification(notification)} className={`flex w-full items-start gap-3 rounded-xl p-3 text-left transition hover:bg-white/[0.05] ${notification.is_read ? "opacity-65" : "bg-white/[0.025]"}`}>
                          <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${notification.is_read ? "bg-white/[0.04] text-slate-400" : "bg-indigo-300/[0.1] text-indigo-200"}`}><Icon size={15} /></span>
                          <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-2"><span className="text-xs font-semibold text-slate-200">{notification.title}</span>{!notification.is_read && <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-300" />}</span><span className="mt-1 block text-xs leading-relaxed text-slate-400">{notification.message}</span><span className="mt-1.5 block text-[10px] text-slate-600">{notificationTime(notification.created_at)}</span></span>
                        </button>;
                      })}
                    </div>
                  </section>}
                </div>
              </div>
            </header>
            <Outlet />
          </div>
          <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-white/10 bg-slate-950/95 px-1 pb-[env(safe-area-inset-bottom)] pt-1 backdrop-blur md:hidden">
            {mobileNavigation.map((item) => {
              const Icon = item.icon;
              return <NavLink key={item.path} to={item.path} className={({ isActive }) => `flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium transition ${isActive ? "text-white" : "text-slate-500 hover:text-slate-300"}`}>
                <Icon size={17} /><span className="max-w-full truncate">{item.name}</span>
              </NavLink>;
            })}
            <button type="button" onClick={() => setMobileMenuOpen(true)} className="flex min-h-14 min-w-0 flex-col items-center justify-center gap-1 rounded-lg px-1 text-[10px] font-medium text-slate-500 hover:text-slate-300"><Menu size={17} /><span>More</span></button>
          </nav>
        </main>
      </div>

      {mobileMenuOpen && <div className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm md:hidden" onMouseDown={(event) => { if (event.target === event.currentTarget) setMobileMenuOpen(false); }}>
        <aside aria-label="More navigation" className="flex h-full w-[min(19rem,88vw)] flex-col border-r border-white/10 bg-slate-950 p-4 shadow-2xl">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4"><CreatorBrand /><button type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Close menu" className="rounded-lg p-2 text-slate-400 hover:bg-white/5 hover:text-white"><X size={17} /></button></div>
          <nav aria-label="All pages" className="mt-4 flex-1 space-y-1 overflow-y-auto">
            {primaryNavigation.map((item) => { const Icon = item.icon; return <NavLink key={item.path} to={item.path} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium ${isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/[0.06]"}`}><Icon size={17} />{item.name}</NavLink>; })}
          </nav>
          <NavLink to="/assistant" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `flex min-h-12 items-center gap-3 rounded-xl px-4 text-sm font-medium ${isActive ? "bg-white text-slate-950" : "text-slate-300 hover:bg-white/[0.06]"}`}><MessageSquare size={17} />AI Assistant</NavLink>
        </aside>
      </div>}

      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </div>
  );
}
