import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Task } from "../services/api";
import { formatSolarHijriDate, formatSolarHijriMonthYear, getSolarHijriParts } from "../services/solarHijri";

function formatDateTime(value?: string | null) {
  if (!value) return "Completion date was not recorded for this older task.";
  const parsed = new Date(value.endsWith("Z") ? value : `${value}Z`);
  const localDate = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  return `${formatSolarHijriDate(localDate)} · ${parsed.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
}

export default function CompletedTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [query, setQuery] = useState("");
  const [month, setMonth] = useState("all");
  const [selected, setSelected] = useState<Task | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void api.getCompletedTasks().then(setTasks).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load completed tasks."));
  }, []);

  const months = useMemo(() => {
    const values = new Map<string, { year: number; month: number }>();
    tasks.forEach((task) => {
      const date = task.completed_at?.slice(0, 10);
      if (date) {
        const parts = getSolarHijriParts(date);
        values.set(`${parts.year}-${parts.month}`, { year: parts.year, month: parts.month });
      }
    });
    return [...values.entries()].sort((a, b) => b[1].year - a[1].year || b[1].month - a[1].month);
  }, [tasks]);

  const filtered = useMemo(() => tasks.filter((task) => {
    const matchesQuery = `${task.title} ${task.description ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const date = task.completed_at?.slice(0, 10);
    const parts = date ? getSolarHijriParts(date) : null;
    const matchesMonth = month === "all" || (parts && `${parts.year}-${parts.month}` === month);
    return matchesQuery && matchesMonth;
  }), [tasks, query, month]);

  const grouped = useMemo(() => {
    const groups = new Map<string, Task[]>();
    filtered.forEach((task) => {
      const key = task.completed_at ? formatSolarHijriDate(task.completed_at.slice(0, 10)) : "Completion date not recorded";
      groups.set(key, [...(groups.get(key) ?? []), task]);
    });
    return [...groups.entries()];
  }, [filtered]);

  return <section className="mx-auto max-w-4xl space-y-6">
    <header className="flex items-start gap-3">
      <Link to="/tasks" aria-label="Back to tasks" className="mt-1 rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/[0.06]"><ArrowLeft size={18} /></Link>
      <div><p className="text-sm text-slate-500">Tasks</p><h1 className="mt-1 text-3xl font-bold">Completed Tasks</h1><p className="mt-2 text-sm text-slate-400">Your completed task records, saved from your account.</p></div>
    </header>

    <div className="grid gap-3 sm:grid-cols-[1fr_14rem]">
      <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 text-slate-500"><Search size={16} /><input aria-label="Search completed tasks" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search completed tasks" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600" /></label>
      <select aria-label="Filter by Solar Hijri month" value={month} onChange={(event) => setMonth(event.target.value)} className="h-11 rounded-xl border border-white/10 bg-slate-900 px-3 text-sm text-slate-200"><option value="all">All months</option>{months.map(([key, value]) => <option key={key} value={key}>{formatSolarHijriMonthYear(value.year, value.month)}</option>)}</select>
    </div>

    {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">{error}</p>}
    {filtered.length === 0 ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">No completed tasks match this search.</div> : <div className="space-y-5">{grouped.map(([day, dayTasks]) => <section key={day} className="space-y-2"><h2 className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{day}</h2>{dayTasks.map((task) => <button key={task.id} type="button" onClick={() => setSelected(task)} className="flex w-full items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:bg-white/[0.07]"><span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-300/10 text-emerald-200"><Check size={15} /></span><span className="min-w-0 flex-1"><span className="block font-medium text-white">{task.title}</span>{task.description && <span className="mt-1 block line-clamp-2 text-sm text-slate-400">{task.description}</span>}<span className="mt-2 block text-xs text-slate-500">{formatDateTime(task.completed_at)}</span></span></button>)}</section>)}</div>}

    {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><article role="dialog" aria-modal="true" aria-labelledby="completed-task-title" className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-5 shadow-2xl"><header className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-emerald-200/70">Completed task</p><h2 id="completed-task-title" className="mt-2 text-xl font-semibold text-white">{selected.title}</h2></div><button type="button" aria-label="Close task details" onClick={() => setSelected(null)} className="rounded-lg p-2 text-slate-400 hover:bg-white/5"><X size={18} /></button></header><p className="mt-4 text-sm text-slate-400">{selected.description || "No description."}</p><dl className="mt-5 space-y-3 border-t border-white/10 pt-4 text-sm"><div><dt className="text-xs text-slate-500">Completed</dt><dd className="mt-1 text-slate-200">{formatDateTime(selected.completed_at)}</dd></div>{selected.due_date && <div><dt className="text-xs text-slate-500">Due</dt><dd className="mt-1 text-slate-200">{formatSolarHijriDate(selected.due_date)}{selected.due_time ? ` · ${selected.due_time.slice(0, 5)}` : ""}</dd></div>}<div><dt className="text-xs text-slate-500">Task ID</dt><dd className="mt-1 text-slate-200">{selected.id}</dd></div></dl><p className="mt-4 text-xs text-slate-600">This app does not currently store task categories or priorities.</p></article></div>}
  </section>;
}
