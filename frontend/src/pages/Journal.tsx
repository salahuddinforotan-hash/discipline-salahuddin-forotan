import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Bell,
  Flame,
  Search,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import HistoryIconLink from "../components/history/HistoryIconLink";

import { api } from "../services/api";
import { getAppLocale } from "../services/language";
import { defaultAppSettings } from "../services/api";
import { formatConfiguredDate } from "../services/solarHijri";
import type { DisciplineSnapshot, JournalEntry } from "../services/api";

type JournalPrompt = { key: string; question: string };
type MoodOption = { value: string; label: string; emoji: string };

const moodOptions: MoodOption[] = [
  { value: "happy", label: "Happy", emoji: "😊" },
  { value: "calm", label: "Calm", emoji: "😌" },
  { value: "neutral", label: "Neutral", emoji: "😐" },
  { value: "sad", label: "Low", emoji: "😔" },
  { value: "frustrated", label: "Frustrated", emoji: "😤" },
  { value: "motivated", label: "Motivated", emoji: "🔥" },
];

const promptLabels: Record<string, string> = {
  today_focus: "What do I want to accomplish today?",
  important_task: "What is my most important task?",
  person_today: "What kind of person do I want to be today?",
  accomplished: "What did I accomplish today?",
  improve: "What could I have done better?",
  learned: "What did I learn?",
  grateful: "What am I grateful for?",
  proud: "What am I proud of?",
  tomorrow: "What will I do differently tomorrow?",
};

const morningPrompts: JournalPrompt[] = [
  { key: "today_focus", question: promptLabels.today_focus },
  { key: "important_task", question: promptLabels.important_task },
  { key: "person_today", question: promptLabels.person_today },
];

const rotatingEveningPrompts: JournalPrompt[] = [
  { key: "improve", question: promptLabels.improve },
  { key: "learned", question: promptLabels.learned },
  { key: "grateful", question: promptLabels.grateful },
  { key: "proud", question: promptLabels.proud },
  { key: "tomorrow", question: promptLabels.tomorrow },
];

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthRange(date: Date) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const end = localDateString(new Date(year, month + 1, 0));
  return { start, end };
}

function promptsForDay(date: string, period: "morning" | "evening") {
  if (period === "morning") return morningPrompts;

  const dayNumber = Number(date.slice(-2));
  const first = (dayNumber - 1) % rotatingEveningPrompts.length;
  const second = (first + 1) % rotatingEveningPrompts.length;
  return [
    { key: "accomplished", question: promptLabels.accomplished },
    rotatingEveningPrompts[first],
    rotatingEveningPrompts[second],
  ];
}

function formatEntryDate(date: string, options: Intl.DateTimeFormatOptions = {}) {
  return formatConfiguredDate(date, { weekday: "long", ...options });
}

function moodLabel(value: string | null) {
  return moodOptions.find((mood) => mood.value === value)?.label ?? "No mood selected";
}

function moodEmoji(value: string | null) {
  return moodOptions.find((mood) => mood.value === value)?.emoji ?? "—";
}

function Journal() {
  const today = localDateString(new Date());
  const currentPeriod = new Date().getHours() < 12 ? "morning" : "evening";
  const prompts = promptsForDay(today, currentPeriod);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [snapshot, setSnapshot] = useState<DisciplineSnapshot | null>(null);
  const [monthAnchor, setMonthAnchor] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  );
  const [mood, setMood] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [savedMessage, setSavedMessage] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historySearchOpen, setHistorySearchOpen] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [openEntry, setOpenEntry] = useState<JournalEntry | null>(null);

  const { start, end } = monthRange(monthAnchor);

  useEffect(() => {
    let active = true;

    async function loadJournal() {
      try {
        setLoading(true);
        setError("");
        const [monthEntries, todaySnapshot, appSettings] = await Promise.all([
          api.getJournalEntries(start, end),
          api.getDisciplineSnapshot(today),
          api.getAppSettings().catch(() => defaultAppSettings),
        ]);
        if (!active) return;

        setEntries(monthEntries);
        setSnapshot(todaySnapshot);
        const todayEntry = monthEntries.find((entry) => entry.entry_date === today);
        setMood(todayEntry?.mood ?? appSettings.journal.default_mood);
        setAnswers(todayEntry?.answers ?? {});
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load your journal.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadJournal();
    return () => { active = false; };
  }, [start, end, today]);

  useEffect(() => {
    if (!openEntry) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenEntry(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openEntry]);

  const todayEntry = entries.find((entry) => entry.entry_date === today);
  const monthLabel = new Intl.DateTimeFormat(getAppLocale(), {
    month: "long",
    year: "numeric",
  }).format(monthAnchor);
  const filteredEntries = useMemo(() => {
    const term = historySearch.trim().toLocaleLowerCase();
    if (!term) return entries;
    return entries.filter((entry) => [
      entry.entry_date,
      entry.mood ?? "",
      ...Object.values(entry.answers),
    ].some((value) => value.toLocaleLowerCase().includes(term)));
  }, [entries, historySearch]);

  function changeMonth(offset: number) {
    setMonthAnchor((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  async function saveEntry() {
    const cleanedAnswers = Object.fromEntries(
      Object.entries(answers)
        .map(([key, value]) => [key, value.trim()] as const)
        .filter(([, value]) => value.length > 0),
    );
    if (!mood && Object.keys(cleanedAnswers).length === 0) {
      setError("Choose a mood or answer a prompt before saving.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSavedMessage("");
      const saved = await api.saveJournalEntry(today, { mood, answers: cleanedAnswers });
      setEntries((current) => [saved, ...current.filter((entry) => entry.entry_date !== today)]
        .sort((first, second) => second.entry_date.localeCompare(first.entry_date)));
      setAnswers(saved.answers);
      setSnapshot({
        entry_date: saved.entry_date,
        tasks_completed: saved.tasks_completed,
        tasks_total: saved.tasks_total,
        habits_completed: saved.habits_completed,
        habits_total: saved.habits_total,
        active_goals: saved.active_goals,
        goal_progress: saved.goal_progress,
        journal_completed: true,
        discipline_score: saved.discipline_score,
      });
      setSavedMessage("Saved privately to your journal.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save your journal entry.");
    } finally {
      setSaving(false);
    }
  }

  const scoreRows = [
    {
      label: "Tasks",
      value: snapshot?.tasks_total ? Math.round((snapshot.tasks_completed / snapshot.tasks_total) * 100) : null,
      detail: snapshot?.tasks_total ? `${snapshot.tasks_completed} of ${snapshot.tasks_total}` : "None due",
      Icon: CheckCircle2,
    },
    {
      label: "Habits",
      value: snapshot?.habits_total ? Math.round((snapshot.habits_completed / snapshot.habits_total) * 100) : null,
      detail: snapshot?.habits_total ? `${snapshot.habits_completed} of ${snapshot.habits_total}` : "None active",
      Icon: Flame,
    },
    {
      label: "Goals",
      value: snapshot?.goal_progress ?? null,
      detail: snapshot?.active_goals ? `${snapshot.active_goals} active` : "None active",
      Icon: BookOpen,
    },
  ];

  return (
    <section className="space-y-7 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Write. Reflect. Improve.</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Journal</h1>
          <p className="mt-2 text-sm text-slate-400">A private place to notice your progress and reset your focus.</p>
        </div>
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <HistoryIconLink section="journal" />
          <Link to="/dashboard?panel=search" aria-label="Search everything" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><Search size={17} /></Link>
          <Link to="/dashboard?panel=alerts" aria-label="Open alerts" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><Bell size={16} /></Link>
          <Link to="/settings" aria-label="Open profile settings" className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><span className="text-xs font-semibold">SF</span></Link>
        </div>
      </header>

      {error && <div role="alert" className="rounded-xl border border-rose-400/20 bg-rose-400/[0.08] px-4 py-3 text-sm text-rose-200">{error}</div>}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.9fr)]">
        <section aria-labelledby="today-journal-title" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-slate-500"><CalendarDays size={15} /> Today</p>
              <h2 id="today-journal-title" className="mt-2 text-lg font-semibold text-white">{formatEntryDate(today)}</h2>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/10 bg-emerald-300/[0.04] px-3 py-1.5 text-[11px] text-emerald-100/80"><span className="h-1.5 w-1.5 rounded-full bg-emerald-300" /> Private by default</span>
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-200">How are you feeling today?</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {moodOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    setMood((current) => current === option.value ? null : option.value);
                    setError("");
                  }}
                  aria-label={option.label}
                  aria-pressed={mood === option.value}
                  className={`flex min-w-14 flex-col items-center gap-1 rounded-xl border px-3 py-2.5 transition ${mood === option.value ? "border-indigo-300/40 bg-indigo-300/[0.1] text-white" : "border-white/[0.07] bg-slate-950/30 text-slate-400 hover:border-white/15 hover:text-white"}`}
                >
                  <span className="text-lg leading-none">{option.emoji}</span>
                  <span className="text-[10px]">{option.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-7 border-t border-white/[0.06] pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-white"><BookOpen size={16} className="text-slate-400" /> {currentPeriod === "morning" ? "Morning plan" : "Today’s reflection"}</h3>
                <p className="mt-1 text-xs text-slate-500">A few prompts to help you get started.</p>
              </div>
              <span className="text-[10px] font-medium uppercase tracking-wider text-slate-600">3 prompts</span>
            </div>

            <div className="mt-5 space-y-4">
              {prompts.map((prompt, index) => (
                <label key={prompt.key} className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-300">{prompt.question}</span>
                  <textarea
                    value={answers[prompt.key] ?? ""}
                    onChange={(event) => {
                      setAnswers((current) => ({ ...current, [prompt.key]: event.target.value }));
                      setError("");
                    }}
                    rows={index === 0 ? 3 : 2}
                    maxLength={10000}
                    placeholder="Write a few thoughts…"
                    className="w-full resize-y rounded-xl border border-white/[0.08] bg-slate-950/50 px-3.5 py-3 text-sm leading-relaxed text-slate-200 outline-none placeholder:text-slate-600 focus:border-indigo-300/35 focus:ring-2 focus:ring-indigo-300/[0.08]"
                  />
                </label>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p aria-live="polite" className="text-xs text-emerald-200/80">{savedMessage || (todayEntry ? "Today’s entry is saved. You can update it anytime today." : "Only you can see entries saved to your account.")}</p>
              <button
                type="button"
                onClick={() => void saveEntry()}
                disabled={saving || loading}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-300 px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 size={16} /> {saving ? "Saving…" : todayEntry ? "Update journal" : "Save journal"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section aria-labelledby="discipline-record-title" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="discipline-record-title" className="flex items-center gap-2 text-sm font-semibold text-white"><Flame size={16} className="text-orange-300" /> Daily discipline</h2>
                <p className="mt-1 text-xs text-slate-500">Your activity snapshot for today</p>
              </div>
              {snapshot && <span className="text-2xl font-semibold tracking-tight text-white">{snapshot.discipline_score}<span className="ml-0.5 text-sm text-slate-500">%</span></span>}
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
              <div className="h-full rounded-full bg-indigo-300 transition-[width]" style={{ width: `${snapshot?.discipline_score ?? 0}%` }} />
            </div>
            <div className="mt-4 space-y-3">
              {scoreRows.map((row) => {
                const Icon = row.Icon;
                return (
                  <div key={row.label} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-xs text-slate-400"><Icon size={15} className="text-slate-500" /> {row.label}</span>
                    <span className="text-xs font-medium text-slate-300">{row.value === null ? row.detail : `${row.value}%`}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
                <span className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 size={15} className="text-slate-500" /> Journal</span>
                <span className={`text-xs font-medium ${snapshot?.journal_completed ? "text-emerald-200" : "text-slate-500"}`}>{snapshot?.journal_completed ? "Saved" : "Not saved yet"}</span>
              </div>
            </div>
            <p className="mt-4 text-[10px] leading-relaxed text-slate-600">Score averages task completion, daily habits, active-goal progress, and today’s journal when each applies.</p>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-white">A small reset</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">You don’t need a perfect day. Notice what happened, take one lesson with you, and begin again.</p>
            <Link to="/dashboard" className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-300 transition hover:text-white">Back to your overview <ArrowRight size={14} /></Link>
          </section>
        </aside>
      </div>

      <section aria-labelledby="journal-history-title" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 id="journal-history-title" className="text-sm font-semibold text-white">
              <button
                type="button"
                onClick={() => setHistoryOpen((open) => !open)}
                aria-expanded={historyOpen}
                aria-controls="journal-history-content"
                className="inline-flex items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-indigo-300/60"
              >
                Journal history
                <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${historyOpen ? "rotate-180" : ""}`} />
              </button>
            </h2>
            <p className="mt-1 text-xs text-slate-500">Your private reflections, saved by date.</p>
          </div>
          {historyOpen && <div className="flex items-center gap-2">
            <button type="button" onClick={() => setHistorySearchOpen((open) => !open)} aria-label="Search journal history" className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] text-slate-400 transition hover:bg-white/[0.05] hover:text-white"><Search size={16} /></button>
            <div className="flex items-center rounded-lg border border-white/[0.08] bg-slate-950/30 p-0.5">
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"><ChevronLeft size={16} /></button>
              <span className="min-w-32 px-2 text-center text-xs font-medium text-slate-300">{monthLabel}</span>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="rounded-md p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"><ChevronRight size={16} /></button>
            </div>
          </div>}
        </div>

        {historyOpen && <div id="journal-history-content">
        {historySearchOpen && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/[0.08] bg-slate-950/40 px-3">
            <Search size={15} className="text-slate-500" />
            <input value={historySearch} onChange={(event) => setHistorySearch(event.target.value)} placeholder="Search your journal history…" className="h-10 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" />
            <button type="button" onClick={() => { setHistorySearch(""); setHistorySearchOpen(false); }} aria-label="Close history search" className="rounded p-1 text-slate-500 hover:text-white"><X size={14} /></button>
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-slate-500">Loading your entries…</p>
        ) : filteredEntries.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-white/[0.08] px-4 py-10 text-center">
            <BookOpen size={19} className="mx-auto text-slate-600" />
            <p className="mt-3 text-sm text-slate-400">{historySearch ? "No entries match that search." : `No journal entries for ${monthLabel}.`}</p>
            <p className="mt-1 text-xs text-slate-600">Your saved reflections will appear here.</p>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-white/[0.06]">
            {filteredEntries.map((entry) => {
              const preview = Object.values(entry.answers).find((answer) => answer.trim().length > 0);
              return (
                <button key={entry.id} type="button" onClick={() => setOpenEntry(entry)} className="flex w-full items-center gap-3 py-4 text-left transition hover:bg-white/[0.02]">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.06] bg-slate-950/40 text-lg">{moodEmoji(entry.mood)}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-200"><span>{formatEntryDate(entry.entry_date, { weekday: "short" })}</span><span className="text-xs font-normal text-slate-500">{moodLabel(entry.mood)}</span></span>
                    <span className="mt-1 block truncate text-xs text-slate-500">{preview || "Mood check-in"}</span>
                  </span>
                  <span className="hidden shrink-0 items-center gap-1 rounded-full border border-white/[0.06] px-2 py-1 text-[10px] text-slate-400 sm:inline-flex"><Flame size={12} /> {entry.discipline_score}%</span>
                  <ChevronRight size={16} className="shrink-0 text-slate-600" />
                </button>
              );
            })}
          </div>
        )}
        </div>}
      </section>

      {openEntry && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 px-4 py-10 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) setOpenEntry(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="journal-entry-dialog-title" className="my-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50">
            <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-5 sm:px-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Private journal entry</p>
                <h2 id="journal-entry-dialog-title" className="mt-1 text-lg font-semibold text-white">{formatEntryDate(openEntry.entry_date)}</h2>
                <p className="mt-1 text-xs text-slate-400">{moodEmoji(openEntry.mood)} {moodLabel(openEntry.mood)} · Discipline score {openEntry.discipline_score}%</p>
              </div>
              <button type="button" onClick={() => setOpenEntry(null)} aria-label="Close journal entry" className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"><X size={16} /></button>
            </div>
            <div className="space-y-5 p-5 sm:p-6">
              {Object.entries(openEntry.answers).filter(([, answer]) => answer.trim()).map(([key, answer]) => (
                <div key={key}>
                  <h3 className="text-sm font-medium text-slate-300">{promptLabels[key] ?? key}</h3>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{answer}</p>
                </div>
              ))}
              <div className="grid gap-3 border-t border-white/[0.06] pt-4 sm:grid-cols-3">
                <p className="text-xs text-slate-500">Tasks <span className="ml-1 text-slate-300">{openEntry.tasks_total ? `${openEntry.tasks_completed}/${openEntry.tasks_total}` : "—"}</span></p>
                <p className="text-xs text-slate-500">Habits <span className="ml-1 text-slate-300">{openEntry.habits_total ? `${openEntry.habits_completed}/${openEntry.habits_total}` : "—"}</span></p>
                <p className="text-xs text-slate-500">Active goals <span className="ml-1 text-slate-300">{openEntry.goal_progress === null ? "—" : `${openEntry.goal_progress}% avg.`}</span></p>
              </div>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

export default Journal;
