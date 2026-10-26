import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CalendarDays, Check, Clock3, History, Plus, Target } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../services/api";
import type { Goal, GoalProgressEntry } from "../services/api";
import { formatSolarHijriDate } from "../services/solarHijri";

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
function dateLabel(value: string) {
  return formatSolarHijriDate(value.slice(0, 10));
}

export default function GoalProgress() {
  const { goalId, view = "details" } = useParams();
  const navigate = useNavigate();
  const id = Number(goalId);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [entries, setEntries] = useState<GoalProgressEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [entryDate, setEntryDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!Number.isInteger(id) || id < 1) return;
    Promise.all([api.getGoals(), api.getGoalProgress(id)]).then(([goals, progress]) => {
      setGoal(goals.find((item) => item.id === id) ?? null);
      setEntries(progress);
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : "Unable to load goal progress."));
  }, [id]);

  const target = goal?.target_amount ?? 100;
  const current = goal?.current_amount ?? goal?.progress ?? 0;
  const unit = goal?.unit ?? "%";
  const remaining = Math.max(0, target - current);
  const today = todayISO();
  const start = goal?.start_date ?? goal?.created_at.slice(0, 10) ?? today;
  const deadline = goal?.target_date ?? today;
  const hasDeadline = Boolean(goal?.target_date);
  const daysLeft = Math.max(1, Math.ceil((new Date(`${deadline}T00:00:00Z`).getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000));
  const duration = Math.max(1, Math.ceil((new Date(`${deadline}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000));
  const elapsed = Math.min(duration, Math.max(0, Math.ceil((new Date(`${today}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime()) / 86_400_000)));
  const requiredDaily = hasDeadline ? remaining / daysLeft : null;
  const plannedDaily = hasDeadline ? target / duration : null;
  const requiredByNow = hasDeadline ? target * elapsed / duration : null;
  const aheadAmount = requiredByNow === null ? null : current - requiredByNow;
  const dailyTotals = useMemo(() => {
    const totals = new Map<string, number>();
    entries.forEach((entry) => totals.set(entry.entry_date, (totals.get(entry.entry_date) ?? 0) + entry.amount));
    return [...totals.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);
  const dailyTimeline = useMemo(() => {
    if (start > today) return [];
    const dailyMap = new Map<string, number>();
    entries.forEach((entry) => dailyMap.set(entry.entry_date, (dailyMap.get(entry.entry_date) ?? 0) + entry.amount));
    const elapsed = Math.max(1, Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) + 1);
    const count = Math.min(30, elapsed);
    return Array.from({ length: count }, (_, index) => {
      const date = new Date(`${today}T12:00:00`);
      date.setDate(date.getDate() - (count - index - 1));
      const iso = date.toISOString().slice(0, 10);
      return { date: iso, amount: dailyMap.get(iso) ?? 0, hasEntry: dailyMap.has(iso) };
    });
  }, [entries, start, today]);

  async function saveProgress(event: FormEvent) {
    event.preventDefault();
    if (!goal || !Number(amount) || Number(amount) <= 0) return;
    try {
      setBusy(true); setError("");
      await api.addGoalProgress(id, { amount: Number(amount), entry_date: entryDate, note: note.trim() || null });
      const [goals, history] = await Promise.all([api.getGoals(), api.getGoalProgress(id)]);
      setGoal(goals.find((item) => item.id === id) ?? null);
      setEntries(history); setAmount(""); setNote("");
      navigate(`/goals/${id}/history`);
    } catch (err) { setError(err instanceof Error ? err.message : "Unable to save progress."); }
    finally { setBusy(false); }
  }

  if (error && !goal) return <section className="mx-auto max-w-3xl rounded-2xl border border-rose-300/20 bg-rose-300/[0.06] p-5 text-sm text-rose-100">{error}</section>;
  if (!goal) return <section className="mx-auto max-w-3xl rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-slate-400">Loading goal…</section>;

  const viewTitles: Record<string, string> = { details: "Goal details", add: "Add progress", daily: "Daily progress", history: "Progress history" };
  return <section className="mx-auto max-w-3xl space-y-5">
    <header className="flex items-start gap-3"><Link to="/goals" aria-label="Back to goals" className="mt-1 rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/[0.06]"><ArrowLeft size={18} /></Link><div className="min-w-0"><p className="text-xs uppercase tracking-wide text-slate-500">Goals</p><h1 className="mt-1 text-2xl font-bold text-white">{viewTitles[view] ?? "Goal details"}</h1><p className="mt-1 text-sm text-slate-400">{goal.title}</p></div></header>
    <nav aria-label="Goal options" className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["details", "Details", Target], ["add", "Add progress", Plus], ["daily", "Daily progress", CalendarDays], ["history", "History", History]].map(([path, label, Icon]) => { const I = Icon as typeof Target; return <Link key={path as string} to={`/goals/${id}/${path}`} aria-current={view === path ? "page" : undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-medium ${(view === path) ? "border-indigo-300/25 bg-indigo-300/[0.08] text-white" : "border-white/10 text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><I size={15} />{label as string}</Link>; })}</nav>
    {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">{error}</p>}
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6">
      <div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold text-white">{goal.title}</h2><p className="mt-1 text-xs text-slate-500">{goal.description || "No description."}</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">{Math.min(100, goal.progress)}%</span></div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-300" style={{ width: `${Math.min(100, goal.progress)}%` }} /></div>
      <p className="mt-2 text-sm text-slate-300">{current} / {target} {unit}</p>
    </div>
    {view === "add" && <form onSubmit={(event) => void saveProgress(event)} className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><h2 className="font-semibold text-white">Record completed work</h2><label className="block text-xs text-slate-400">Amount completed<input required autoFocus type="number" min="0.01" step="any" max={remaining || undefined} value={amount} onChange={(event) => setAmount(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white outline-none focus:border-indigo-300/40" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-xs text-slate-400">Unit<input value={unit} readOnly className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-slate-400" /></label><label className="block text-xs text-slate-400">Progress date<input required type="date" value={entryDate} onChange={(event) => setEntryDate(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white" /><span className="mt-1 block text-[11px] text-slate-600">Saved as a standard date; history displays Solar Hijri.</span></label></div><label className="block text-xs text-slate-400">Note (optional)<textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} className="mt-2 w-full resize-none rounded-xl border border-white/10 bg-slate-950/50 p-3 text-sm text-white" /></label><button disabled={busy || remaining <= 0} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus size={16} />{busy ? "Saving…" : "Save progress"}</button></form>}
    {view === "daily" && <div className="space-y-4">{!hasDeadline && <p className="rounded-xl border border-amber-200/15 bg-amber-200/[0.05] p-3 text-sm text-amber-100">Add a target completion date to calculate the required daily pace.</p>}<div className="grid gap-3 sm:grid-cols-3">{[["Required per day", requiredDaily === null ? "Set a deadline" : `${requiredDaily.toFixed(2)} ${unit}`], ["Remaining", `${remaining.toFixed(2)} ${unit}`], ["Pace", aheadAmount === null ? "Set a deadline" : `${Math.abs(aheadAmount).toFixed(2)} ${unit} ${aheadAmount >= 0 ? "ahead" : "behind"}`]].map(([label, value]) => <article key={label} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-slate-500">{label}</p><p className="mt-2 text-lg font-semibold text-white">{value}</p></article>)}</div><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><div className="flex items-center gap-2 text-sm font-semibold text-white"><Clock3 size={16} /> Logged daily progress</div><p className="mt-1 text-xs text-slate-500">Only dates with saved progress records are shown.</p><div className="mt-4 divide-y divide-white/[0.06]">{dailyTotals.length ? dailyTotals.map(([date, total]) => <div key={date} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="text-slate-300">{dateLabel(date)}</span><span className="text-emerald-200">{total} {unit}</span></div>) : <p className="py-6 text-center text-sm text-slate-500">No progress has been recorded.</p>}</div></article></div>}
    {view === "daily" && <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold text-white">Daily timeline · recent 30 days</h2><p className="mt-1 text-xs text-slate-500">“No entry” means there is no saved progress record for that date.</p><div className="mt-3 divide-y divide-white/[0.06]">{dailyTimeline.map((row)=>{const variance=plannedDaily===null?null:row.amount-plannedDaily;return <div key={row.date} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-3 text-sm"><span className="text-slate-300">{dateLabel(row.date)}</span><span className="text-slate-400">{row.hasEntry?`${row.amount} ${unit}`:"No entry"}</span><span className={`text-xs ${variance!==null&&variance>=0?"text-emerald-200":"text-slate-500"}`}>{variance===null?"Daily target unavailable":`${variance>=0?"+":""}${variance.toFixed(2)} ${unit} vs planned daily amount`}</span></div>;})}</div></article>}
    {view === "history" && <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold text-white">Progress history</h2><div className="mt-4 divide-y divide-white/[0.06]">{entries.length ? entries.map((entry) => <div key={entry.id} className="py-3"><div className="flex items-center justify-between gap-4"><span className="text-sm text-slate-300">{dateLabel(entry.entry_date)}</span><span className="font-medium text-emerald-200">+{entry.amount} {entry.unit}</span></div>{entry.note && <p className="mt-1 text-xs text-slate-500">{entry.note}</p>}</div>) : <p className="py-6 text-center text-sm text-slate-500">No progress entries are saved yet.</p>}</div></article>}
    {view === "details" && <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><h2 className="font-semibold text-white">Schedule</h2><p className="mt-3 text-sm text-slate-400">Started {dateLabel(start)}</p><p className="mt-2 text-sm text-slate-400">{goal.target_date ? `Target ${dateLabel(goal.target_date)}` : "No target date set"}{goal.target_time ? ` · ${goal.target_time.slice(0, 5)}` : ""}</p><Link to={`/history/goals`} className="mt-4 inline-flex items-center gap-2 text-sm text-indigo-200 hover:text-white"><Check size={15} />Monthly history</Link></article>}
  </section>;
}
