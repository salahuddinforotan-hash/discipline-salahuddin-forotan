import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { ArrowLeft, CalendarDays, Check, Flame, History, Plus, Trophy } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { api } from "../services/api";
import type { Habit, HabitCompletion, HabitProgressEntry } from "../services/api";
import { formatSolarHijriDate, formatSolarHijriMonthYear, getSolarHijriParts } from "../services/solarHijri";

function todayISO() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function periodKey(date: string, frequency: Habit["frequency"]) {
  if (frequency === "daily") return date;
  if (frequency === "monthly") return date.slice(0, 7);
  const current = new Date(`${date}T12:00:00Z`);
  current.setUTCDate(current.getUTCDate() - ((current.getUTCDay() + 6) % 7));
  return current.toISOString().slice(0, 10);
}
function expectedPeriodKeys(start: string, end: string, frequency: Habit["frequency"], dayOfMonth: number | null = null) {
  const periods = new Set<string>();
  if (frequency === "daily") {
    const cursor = new Date(`${start}T12:00:00Z`);
    const stop = new Date(`${end}T12:00:00Z`);
    while (cursor <= stop) { periods.add(cursor.toISOString().slice(0, 10)); cursor.setUTCDate(cursor.getUTCDate() + 1); }
  } else if (frequency === "weekly") {
    const cursor = new Date(`${start}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + ((7 - cursor.getUTCDay()) % 7));
    const stop = new Date(`${end}T12:00:00Z`);
    while (cursor <= stop) { periods.add(periodKey(cursor.toISOString().slice(0, 10), frequency)); cursor.setUTCDate(cursor.getUTCDate() + 7); }
  } else {
    const [startYear, startMonth] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);
    const targetDay = dayOfMonth ?? 1;
    let cursor = new Date(Date.UTC(startYear, startMonth - 1, 1, 12));
    const stop = new Date(Date.UTC(endYear, endMonth, 1, 12));
    while (cursor < stop) {
      const lastDay = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0, 12)).getUTCDate();
      const due = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), Math.min(targetDay, lastDay), 12));
      const iso = due.toISOString().slice(0, 10);
      if (iso >= start && iso <= end) periods.add(periodKey(iso, frequency));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  return periods;
}
function expectedKeysForDateList(dates: string[], frequency: Habit["frequency"], dayOfMonth: number | null) {
  if (frequency === "daily") return new Set(dates);
  if (frequency === "weekly") return new Set(dates.filter((date) => new Date(`${date}T12:00:00Z`).getUTCDay() === 0).map((date) => periodKey(date, frequency)));
  return new Set(dates.filter((date) => {
    const [year, month] = date.split("-").map(Number);
    const lastDay = new Date(Date.UTC(year, month, 0, 12)).getUTCDate();
    return Number(date.slice(-2)) === Math.min(dayOfMonth ?? 1, lastDay);
  }).map((date) => periodKey(date, frequency)));
}

export default function HabitProgress() {
  const { habitId, view = "today" } = useParams();
  const id = Number(habitId);
  const today = todayISO();
  const [historyMonth, setHistoryMonth] = useState(() => { const current = getSolarHijriParts(todayISO()); return `${current.year}-${current.month}`; });
  const [habit, setHabit] = useState<Habit | null>(null);
  const [completions, setCompletions] = useState<HabitCompletion[]>([]);
  const [entries, setEntries] = useState<HabitProgressEntry[]>([]);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const [habits, done, progress] = await Promise.all([api.getHabits(), api.getHabitCompletions(id), api.getHabitProgress(id)]);
    setHabit(habits.find((item) => item.id === id) ?? null); setCompletions(done); setEntries(progress);
  }, [id]);
  useEffect(() => { if (Number.isInteger(id) && id > 0) void load().catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load habit history.")); }, [id, load]);

  const todayAmount = entries.filter((entry) => entry.entry_date === today).reduce((total, entry) => total + entry.amount, 0);
  const completedDates = useMemo(() => new Set(completions.map((item) => item.completion_date)), [completions]);
  const solarNow = getSolarHijriParts(today);
  const monthCompletions = completions.filter((item) => { const p = getSolarHijriParts(item.completion_date); return p.year === solarNow.year && p.month === solarNow.month; }).length;
  const completedPeriods = habit ? new Set(completions.filter((item) => item.completion_date >= habit.created_at.slice(0, 10) && item.completion_date <= today).map((item) => periodKey(item.completion_date, habit.frequency))) : new Set<string>();
  const expectedPeriods = habit ? expectedPeriodKeys(habit.created_at.slice(0, 10), today, habit.frequency, habit.day_of_month) : new Set<string>();
  completedPeriods.forEach((period) => expectedPeriods.add(period));
  const periodCompletions = completedPeriods.size;
  const missed = Math.max(0, expectedPeriods.size - periodCompletions);
  const rate = expectedPeriods.size ? Math.round(periodCompletions / expectedPeriods.size * 100) : 0;
  const historyMonths = useMemo(() => {
    const keys = new Map<string, { year: number; month: number }>();
    [...completions.map((item) => item.completion_date), ...entries.map((item) => item.entry_date)].forEach((date) => {
      const parts = getSolarHijriParts(date);
      keys.set(`${parts.year}-${parts.month}`, { year: parts.year, month: parts.month });
    });
    return [...keys.entries()].sort((a, b) => b[1].year - a[1].year || b[1].month - a[1].month);
  }, [completions, entries]);
  const activeHistoryMonth = historyMonths.some(([key]) => key === historyMonth) ? historyMonth : historyMonths[0]?.[0] ?? historyMonth;
  const [historyYear, historyMonthNumber] = activeHistoryMonth.split("-").map(Number);
  const historyDates = useMemo(() => {
    if (!Number.isInteger(historyYear) || !Number.isInteger(historyMonthNumber)) return [];
    const dates: string[] = [];
    const cursor = new Date(Date.UTC(historyYear + 621, 0, 1, 12));
    const stop = new Date(Date.UTC(historyYear + 623, 0, 1, 12));
    while (cursor < stop) {
      const iso = cursor.toISOString().slice(0, 10);
      const parts = getSolarHijriParts(iso);
      if (parts.year === historyYear && parts.month === historyMonthNumber && iso >= (habit?.created_at.slice(0, 10) ?? iso) && iso <= today) dates.push(iso);
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return dates;
  }, [historyYear, historyMonthNumber, habit, today]);
  const monthCompletionsSelected = completions.filter((item) => { const parts = getSolarHijriParts(item.completion_date); return parts.year === historyYear && parts.month === historyMonthNumber; });
  const monthEntriesSelected = entries.filter((item) => { const parts = getSolarHijriParts(item.entry_date); return parts.year === historyYear && parts.month === historyMonthNumber; });
  const monthExpectedPeriods = expectedKeysForDateList(historyDates, habit?.frequency ?? "daily", habit?.day_of_month ?? null).size;
  const monthCompletedPeriods = new Set(monthCompletionsSelected.map((item) => periodKey(item.completion_date, habit?.frequency ?? "daily"))).size;

  async function saveAmount(event: FormEvent) {
    event.preventDefault(); if (!habit || Number(amount) <= 0) return;
    try { setSaving(true); setError(""); await api.addHabitProgress(id, { amount: Number(amount), entry_date: today, note: note.trim() || null }); await load(); setAmount(""); setNote(""); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to save this amount."); }
    finally { setSaving(false); }
  }
  async function toggleToday() {
    try { setSaving(true); setError(""); if (completedDates.has(today)) await api.uncompleteHabit(id); else await api.completeHabit(id); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to update today’s completion."); }
    finally { setSaving(false); }
  }

  if (error && !habit) return <section role="alert" className="mx-auto max-w-3xl rounded-2xl border border-rose-300/20 p-5 text-rose-100">{error}</section>;
  if (!habit) return <section className="mx-auto max-w-3xl rounded-2xl border border-white/10 p-8 text-center text-slate-400">Loading habit…</section>;
  const titles: Record<string, string> = { today: "Today’s progress", history: "Habit history", stats: "Statistics", streak: "Streak" };
  return <section className="mx-auto max-w-3xl space-y-5">
    <header className="flex items-start gap-3"><Link to="/habits" aria-label="Back to habits" className="mt-1 rounded-xl border border-white/10 p-2.5 text-slate-300 hover:bg-white/[0.06]"><ArrowLeft size={18} /></Link><div><p className="text-xs uppercase tracking-wide text-slate-500">Habits</p><h1 className="mt-1 text-2xl font-bold text-white">{titles[view] ?? "Habit progress"}</h1><p className="mt-1 text-sm text-slate-400">{habit.name}</p></div></header>
    <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4">{[["today","Today",Check],["history","History",History],["stats","Statistics",CalendarDays],["streak","Streak",Flame]].map(([path,label,Icon]) => {const I=Icon as typeof Check; return <Link key={path as string} to={`/habits/${id}/${path}`} aria-current={view===path?"page":undefined} className={`flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs ${(view===path)?"border-indigo-300/25 bg-indigo-300/[0.08] text-white":"border-white/10 text-slate-400 hover:bg-white/[0.04] hover:text-white"}`}><I size={15}/>{label as string}</Link>;})}</nav>
    {error && <p role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.07] p-3 text-sm text-rose-100">{error}</p>}
    {view === "today" && <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 sm:p-6"><h2 className="font-semibold text-white">{formatSolarHijriDate(today)}</h2>{habit.tracking_type === "measurable" ? <><p className="mt-3 text-sm text-slate-400">Today: <strong className="text-white">{todayAmount} / {habit.daily_target} {habit.target_unit}</strong></p><div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-300" style={{width:`${Math.min(100,(todayAmount/(habit.daily_target||1))*100)}%`}}/></div><form onSubmit={(event)=>void saveAmount(event)} className="mt-5 space-y-3"><label className="block text-xs text-slate-400">Amount completed<input required type="number" min="0.01" step="any" value={amount} onChange={(event)=>setAmount(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white"/></label><label className="block text-xs text-slate-400">Note (optional)<input value={note} onChange={(event)=>setNote(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-white/10 bg-slate-950/50 px-3 text-sm text-white"/></label><button disabled={saving} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"><Plus size={16}/>{saving?"Saving…":"Save amount"}</button></form></> : <><p className="mt-2 text-sm text-slate-400">{completedDates.has(today)?"This habit is recorded as complete today.":"No completion has been recorded today."}</p><button disabled={saving||!habit.is_active} onClick={()=>void toggleToday()} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-indigo-300 px-4 text-sm font-semibold text-slate-950 disabled:opacity-50"><Check size={16}/>{completedDates.has(today)?"Undo today’s completion":"Mark complete today"}</button></>}</article>}
    {view === "history" && <article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-white">Solar Hijri history</h2><p className="mt-1 text-xs text-slate-500">Month options come from saved habit records.</p></div><select aria-label="Habit history month" value={activeHistoryMonth} onChange={(event)=>setHistoryMonth(event.target.value)} className="h-10 rounded-xl border border-white/10 bg-slate-950 px-3 text-sm text-slate-200">{historyMonths.length===0&&<option value={activeHistoryMonth}>No saved months</option>}{historyMonths.map(([key, value])=><option key={key} value={key}>{formatSolarHijriMonthYear(value.year,value.month)}</option>)}</select></div>
      {historyMonths.length===0 ? <p className="mt-5 rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">No habit history has been saved yet.</p> : <>
        <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-xl border border-white/[0.07] p-3"><p className="text-xs text-slate-500">Completed periods</p><p className="mt-1 font-semibold text-white">{monthCompletedPeriods} / {monthExpectedPeriods}</p></div><div className="rounded-xl border border-white/[0.07] p-3"><p className="text-xs text-slate-500">Completion rate</p><p className="mt-1 font-semibold text-white">{monthExpectedPeriods ? Math.round(monthCompletedPeriods / monthExpectedPeriods * 100) : 0}%</p></div><div className="rounded-xl border border-white/[0.07] p-3"><p className="text-xs text-slate-500">Progress entries</p><p className="mt-1 font-semibold text-white">{monthEntriesSelected.length}</p></div></div>
        <h3 className="mt-5 text-sm font-semibold text-white">{habit.frequency === "daily" ? "Daily history" : `${habit.frequency[0].toUpperCase()}${habit.frequency.slice(1)} schedule`}</h3><div className="mt-2 divide-y divide-white/[0.06]">{historyDates.map((date)=>{const sum=entries.filter((item)=>item.entry_date===date).reduce((total,item)=>total+item.amount,0);const done=completedDates.has(date);const periodDone=completions.some((item)=>periodKey(item.completion_date,habit.frequency)===periodKey(date,habit.frequency));const beforeToday=date<today;const [year,month,day]=date.split("-").map(Number);const lastDay=new Date(Date.UTC(year,month,0)).getUTCDate();const due=habit.frequency==="daily"||(habit.frequency==="weekly"&&new Date(`${date}T12:00:00Z`).getUTCDay()===0)||(habit.frequency==="monthly"&&day===Math.min(habit.day_of_month??1,lastDay));const status=habit.tracking_type==="measurable"?`${sum} / ${habit.daily_target} ${habit.target_unit}`:done?"Completed":periodDone?"Period completed":due?(beforeToday?"Missed expected period":"Due today"):"—";return <div key={date} className="flex items-center justify-between gap-4 py-3 text-sm"><span className="text-slate-300">{formatSolarHijriDate(date)}</span><span className={done||periodDone?"text-emerald-200":"text-slate-500"}>{status}</span></div>;})}</div>
        {monthEntriesSelected.length>0&&<div className="mt-5 border-t border-white/[0.07] pt-4"><h3 className="text-sm font-semibold text-white">Saved amount entries</h3><div className="mt-2 divide-y divide-white/[0.06]">{monthEntriesSelected.map((entry)=><div key={entry.id} className="flex items-center justify-between gap-3 py-2 text-xs"><span className="text-slate-300">{formatSolarHijriDate(entry.entry_date)}{entry.note?` · ${entry.note}`:""}</span><span className="text-emerald-200">{entry.amount} {entry.unit}</span></div>)}</div></div>}
      </>}
    </article>}
    {view === "stats" && <div className="grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-slate-500">Completed periods</p><p className="mt-2 text-2xl font-semibold text-white">{periodCompletions}</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-slate-500">Missed expected periods</p><p className="mt-2 text-2xl font-semibold text-white">{missed}</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-slate-500">Completion rate</p><p className="mt-2 text-2xl font-semibold text-white">{rate}%</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><p className="text-xs text-slate-500">This Solar Hijri month</p><p className="mt-2 text-2xl font-semibold text-white">{monthCompletions}</p></article></div>}
    {view === "streak" && <div className="grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-orange-200/10 bg-orange-200/[0.04] p-5"><Flame size={18} className="text-orange-200"/><p className="mt-3 text-xs text-slate-500">Current streak</p><p className="mt-1 text-3xl font-semibold text-white">{habit.current_streak}</p></article><article className="rounded-2xl border border-white/10 bg-white/[0.035] p-5"><Trophy size={18} className="text-indigo-200"/><p className="mt-3 text-xs text-slate-500">Best streak</p><p className="mt-1 text-3xl font-semibold text-white">{habit.longest_streak}</p></article></div>}
    <p className="text-xs text-slate-600">Tracking frequency: {habit.frequency}. Amount records are saved individually and are not overwritten.</p>
  </section>;
}
