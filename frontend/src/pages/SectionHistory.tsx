import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, Circle, Flame, LoaderCircle, NotebookPen, Target } from "lucide-react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { api } from "../services/api";
import type {
  FinanceEntry,
  FinanceMonthlyReport,
  FinanceMonthlyReportSummary,
  GoalHistoryDetail,
  GoalHistoryMonth,
  HabitHistoryDetail,
  HabitHistoryMonth,
  JournalHistoryDetail,
  JournalHistoryMonth,
  LearningHistoryDetail,
  LearningHistoryMonth,
  TaskHistoryDetail,
  TaskHistoryMonth,
} from "../services/api";
import { formatConfiguredDate, formatSolarHijriMonthYear } from "../services/solarHijri";
import type { HistorySection } from "../components/history/HistoryIconLink";

type MonthSummary =
  | TaskHistoryMonth
  | GoalHistoryMonth
  | HabitHistoryMonth
  | LearningHistoryMonth
  | JournalHistoryMonth
  | FinanceMonthlyReportSummary;

type MonthDetail =
  | TaskHistoryDetail
  | GoalHistoryDetail
  | HabitHistoryDetail
  | LearningHistoryDetail
  | JournalHistoryDetail
  | FinanceMonthlyReport;

const EMPTY_MONTHS: MonthSummary[] = [];

const sectionLabels: Record<HistorySection, string> = {
  tasks: "Tasks",
  goals: "Goals",
  habits: "Habits",
  learning: "Learning",
  income: "Income & expenses",
  journal: "Journal",
};

const solarNumber = new Intl.NumberFormat("fa-AF", { useGrouping: false });

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return formatConfiguredDate(value.slice(0, 10));
}

function formatTime(value: string | null | undefined) {
  if (!value) return "";
  const [hourText, minute] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isFinite(hour)) return value;
  return `${hour % 12 || 12}:${minute ?? "00"} ${hour >= 12 ? "PM" : "AM"}`;
}

function formatMoney(amount: number, currency = "AFN") {
  return new Intl.NumberFormat("en-US", {
    style: "currency", currencyDisplay: "narrowSymbol",
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

function activityDescription(section: HistorySection, month: MonthSummary) {
  switch (section) {
    case "tasks": {
      const item = month as TaskHistoryMonth;
      return `${item.total_tasks} ${item.total_tasks === 1 ? "task" : "tasks"}`;
    }
    case "goals": {
      const item = month as GoalHistoryMonth;
      return `${item.started_count} started · ${item.completed_count} completed`;
    }
    case "habits": {
      const item = month as HabitHistoryMonth;
      return `${item.completion_count} check-ins · ${item.added_habits} added`;
    }
    case "learning": {
      const item = month as LearningHistoryMonth;
      return `${item.pages_advanced} pages advanced · ${item.plans_added} plans added`;
    }
    case "journal": {
      const item = month as JournalHistoryMonth;
      return `${item.entry_count} ${item.entry_count === 1 ? "entry" : "entries"}`;
    }
    case "income": {
      const item = month as FinanceMonthlyReportSummary;
      return `${item.income_count + item.expense_count} transactions`;
    }
  }
}

function SummaryCards({ items }: { items: { label: string; value: string | number; detail?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <article key={item.label} className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4">
          <p className="text-xs font-medium text-slate-400">{item.label}</p>
          <p className="mt-2 text-xl font-semibold text-white">{item.value}</p>
          {item.detail && <p className="mt-1 text-xs text-slate-500">{item.detail}</p>}
        </article>
      ))}
    </div>
  );
}

function EmptyRecords({ children }: { children: string }) {
  return <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-8 text-center text-sm text-slate-500">{children}</p>;
}

function DetailContent({ section, report }: { section: HistorySection; report: MonthDetail }) {
  if (section === "tasks") {
    const data = report as TaskHistoryDetail;
    const rate = data.total_tasks ? Math.round(data.completed_tasks / data.total_tasks * 100) : 0;
    const completed = data.tasks.filter((task) => task.is_completed);
    const incomplete = data.tasks.filter((task) => !task.is_completed);
    const rows = (tasks: TaskHistoryDetail["tasks"], title: string, done: boolean) => (
      <section className="space-y-3" aria-label={title}>
        <h3 className="text-sm font-semibold text-white">{title} <span className="ml-1 text-xs font-normal text-slate-500">{tasks.length}</span></h3>
        {tasks.length === 0 ? <EmptyRecords>{done ? "No completed tasks in this month." : "No incomplete tasks in this month."}</EmptyRecords> : (
          <div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08]">
            {tasks.map((task) => (
              <article key={task.id} className="flex items-start gap-3 px-4 py-3">
                <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${done ? "bg-emerald-300/10 text-emerald-200" : "bg-white/[0.05] text-slate-400"}`}>{done ? <Check size={15} /> : <Circle size={14} />}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-medium text-white">{task.title}</h4>
                  {task.description && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">{task.description}</p>}
                  <p className="mt-1.5 text-xs text-slate-500">{task.due_date ? "Due" : "Added"}: {formatDate(task.due_date ?? task.created_at)}{task.due_time ? ` · ${formatTime(task.due_time)}` : ""}</p>
                  {task.is_completed && task.completed_at && <p className="mt-1 text-xs text-emerald-200/80">Completed {formatDate(task.completed_at)}</p>}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    );
    return <div className="space-y-6"><SummaryCards items={[
      { label: "Total tasks", value: data.total_tasks },
      { label: "Completed", value: data.completed_tasks },
      { label: "Incomplete", value: data.incomplete_tasks },
      { label: "Completion rate", value: `${rate}%` },
    ]} />{rows(completed, "Completed tasks", true)}{rows(incomplete, "Incomplete tasks", false)}</div>;
  }

  if (section === "goals") {
    const data = report as GoalHistoryDetail;
    return <div className="space-y-6"><SummaryCards items={[
      { label: "Goals started", value: data.started_count },
      { label: "Goals completed", value: data.completed_count },
      { label: "Goals in this history", value: data.goals.length },
    ]} />{data.goals.length === 0 ? <EmptyRecords>No goal records for this month.</EmptyRecords> : (
      <div className="space-y-3">{data.goals.map((goal) => (
        <article key={goal.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5">
          <div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-300/10 text-violet-200"><Target size={17} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold text-white">{goal.title}</h3>{goal.is_completed && <span className="rounded-full bg-emerald-300/10 px-2 py-0.5 text-[10px] font-medium text-emerald-200">Completed</span>}</div>{goal.description && <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">{goal.description}</p>}</div></div>
          <div className="mt-4 grid gap-2 text-xs text-slate-400 sm:grid-cols-2"><p>Started: {formatDate(goal.start_date ?? goal.created_at)}</p><p>Target: {formatDate(goal.target_date)}{goal.target_time ? ` · ${formatTime(goal.target_time)}` : ""}</p>{goal.completed_at && <p>Completed: {formatDate(goal.completed_at)}</p>}<p>Progress: {goal.progress}%</p></div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-violet-300" style={{ width: `${Math.max(0, Math.min(100, goal.progress))}%` }} /></div>
        </article>
      ))}</div>
    )}{data.progress_entries?.length ? <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Saved progress entries</h3><div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08]">{data.progress_entries.map((entry) => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><span className="min-w-0"><span className="block text-sm font-medium text-white">{data.goals.find((goal) => goal.id === entry.goal_id)?.title ?? "Goal"}</span>{entry.note && <span className="mt-0.5 block text-xs text-slate-500">{entry.note}</span>}</span><span className="text-sm text-emerald-200">+{entry.amount} {entry.unit} · {formatDate(entry.entry_date)}</span></article>)}</div></section> : null}</div>;
  }

  if (section === "habits") {
    const data = report as HabitHistoryDetail;
    const habitsById = new Map(data.habits.map((habit) => [habit.id, habit]));
    return <div className="space-y-6"><SummaryCards items={[
      { label: "Habits added", value: data.added_habits },
      { label: "Check-ins", value: data.completion_count },
      { label: "Progress entries", value: data.progress_count ?? data.progress_entries?.length ?? 0 },
      { label: "Habits completed", value: data.completed_habits },
    ]} />
      <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Habit records</h3>{data.habits.length ? <div className="grid gap-3 md:grid-cols-2">{data.habits.map((habit) => <article key={habit.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orange-300/10 text-orange-200"><Flame size={17} /></span><div className="min-w-0"><h4 className="truncate text-sm font-semibold text-white">{habit.name}</h4><p className="mt-0.5 text-xs capitalize text-slate-500">{habit.frequency}{habit.day_of_month ? ` · day ${habit.day_of_month}` : ""}</p></div></div>{habit.description && <p className="mt-3 text-sm text-slate-400">{habit.description}</p>}<p className="mt-3 text-xs text-slate-500">Created {formatDate(habit.created_at)} · longest streak {habit.longest_streak}</p></article>)}</div> : <EmptyRecords>No habit records in this month.</EmptyRecords>}</section>
      <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Completed habit check-ins</h3>{data.completions.length ? <div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08]">{data.completions.map((completion) => <article key={completion.id} className="flex items-center justify-between gap-3 px-4 py-3"><span className="flex min-w-0 items-center gap-3"><Check size={16} className="shrink-0 text-emerald-200" /><span className="truncate text-sm text-white">{habitsById.get(completion.habit_id)?.name ?? "Habit"}</span></span><time className="shrink-0 text-xs text-slate-400">{formatDate(completion.completion_date)}</time></article>)}</div> : <EmptyRecords>No completed habit check-ins in this month.</EmptyRecords>}</section>
      {data.progress_entries?.length ? <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Measured habit progress</h3><div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08]">{data.progress_entries.map((entry) => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><span className="min-w-0"><span className="block text-sm font-medium text-white">{habitsById.get(entry.habit_id)?.name ?? "Habit"}</span>{entry.note && <span className="mt-0.5 block text-xs text-slate-500">{entry.note}</span>}</span><span className="text-sm text-emerald-200">{entry.amount} {entry.unit} · {formatDate(entry.entry_date)}</span></article>)}</div></section> : null}
    </div>;
  }

  if (section === "learning") {
    const data = report as LearningHistoryDetail;
    const plansById = new Map(data.plans.map((plan) => [plan.id, plan]));
    return <div className="space-y-6"><SummaryCards items={[
      { label: "Plans added", value: data.plans_added },
      { label: "Pages advanced", value: data.pages_advanced },
      { label: "Progress updates", value: data.progress_updates },
    ]} />
      <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Learning plans</h3>{data.plans.length ? <div className="grid gap-3 md:grid-cols-2">{data.plans.map((plan) => <article key={plan.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-start gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-300/10 text-indigo-200"><BookOpen size={17} /></span><div className="min-w-0"><h4 className="font-semibold text-white">{plan.title}</h4>{plan.author && <p className="mt-0.5 text-xs text-slate-400">{plan.author}</p>}</div></div><p className="mt-3 text-sm text-slate-300">Current position: page {plan.current_page} of {plan.total_pages}</p><p className="mt-1 text-xs text-slate-500">Plan added {formatDate(plan.created_at)} · Started {formatDate(plan.started_on)} · Target {formatDate(plan.target_date)}</p><p className="mt-1 text-xs text-slate-500">Study time {formatTime(plan.study_start_time)}–{formatTime(plan.study_end_time)} · {plan.study_days_per_week} days/week</p></article>)}</div> : <EmptyRecords>No learning plans or page updates in this month.</EmptyRecords>}</section>
      <section className="space-y-3"><h3 className="text-sm font-semibold text-white">Dated page updates</h3>{data.progress_updates_detail.length ? <div className="divide-y divide-white/[0.07] overflow-hidden rounded-xl border border-white/[0.08]">{data.progress_updates_detail.map((update) => <article key={update.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{plansById.get(update.learning_plan_id)?.title ?? "Learning plan"}</span><span className="mt-0.5 block text-xs text-slate-500">Page {update.from_page} → {update.to_page}{update.to_page > update.from_page ? ` · ${update.to_page - update.from_page} pages advanced` : " · position corrected"}</span></span><time className="text-xs text-slate-400">{formatDate(update.activity_date)}</time></article>)}</div> : <EmptyRecords>No page-position updates were recorded this month.</EmptyRecords>}</section>
    </div>;
  }

  if (section === "journal") {
    const data = report as JournalHistoryDetail;
    return <div className="space-y-6"><SummaryCards items={[
      { label: "Journal entries", value: data.entry_count },
      { label: "Average discipline score", value: data.average_discipline_score === null ? "—" : `${data.average_discipline_score}%` },
    ]} />{data.entries.length ? <div className="space-y-3">{data.entries.map((entry) => <article key={entry.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 sm:p-5"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="flex items-center gap-2 font-semibold text-white"><NotebookPen size={16} className="text-indigo-200" />{formatDate(entry.entry_date)}</h3><div className="flex gap-2"><span className="rounded-full bg-indigo-300/10 px-2.5 py-1 text-xs text-indigo-100">{entry.mood ?? "No mood"}</span><span className="rounded-full bg-white/[0.05] px-2.5 py-1 text-xs text-slate-300">{entry.discipline_score}% score</span></div></div><div className="mt-3 grid gap-3 sm:grid-cols-2">{Object.entries(entry.answers).filter(([, answer]) => answer.trim()).map(([question, answer]) => <div key={question} className="rounded-lg border border-white/[0.06] bg-slate-950/40 p-3"><p className="text-xs font-medium text-slate-400">{question}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{answer}</p></div>)}</div><p className="mt-3 text-xs text-slate-500">Tasks {entry.tasks_completed}/{entry.tasks_total} · Habits {entry.habits_completed}/{entry.habits_total} · Active goals {entry.active_goals}{entry.goal_progress !== null ? ` · Goal progress ${entry.goal_progress}%` : ""}</p></article>)}</div> : <EmptyRecords>No journal entries for this month.</EmptyRecords>}</div>;
  }

  const data = report as FinanceMonthlyReport;
  return <div className="space-y-6"><SummaryCards items={[
    { label: "Total income", value: formatMoney(data.total_income) },
    { label: "Total expenses", value: formatMoney(data.total_expenses) },
    { label: "Net balance", value: formatMoney(data.balance) },
    { label: "Transactions", value: data.transactions.length },
  ]} />{data.transactions.length ? <section className="overflow-hidden rounded-xl border border-white/[0.08]"><div className="border-b border-white/[0.07] px-4 py-3"><h3 className="text-sm font-semibold text-white">Income and expense records</h3></div><div className="divide-y divide-white/[0.07]">{data.transactions.map((entry: FinanceEntry) => <article key={entry.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_120px_150px] sm:items-center sm:gap-4"><div className="min-w-0"><h4 className="truncate text-sm font-medium text-white">{entry.title}</h4><p className="text-xs text-slate-500">{entry.category}{entry.source !== "manual" ? ` · ${entry.source}` : entry.notes ? ` · ${entry.notes}` : ""}</p></div><time className="text-xs text-slate-400">{formatDate(entry.entry_date)}</time><p className={`text-sm font-semibold sm:text-right ${entry.kind === "income" ? "text-emerald-200" : "text-amber-100"}`}>{entry.kind === "income" ? "+" : "−"}{formatMoney(entry.amount, entry.currency)}</p></article>)}</div></section> : <EmptyRecords>No income or expense transactions in this month.</EmptyRecords>}</div>;
}

export default function SectionHistory() {
  const { section: rawSection, solarYear, solarMonth } = useParams();
  const navigate = useNavigate();
  const allowed: HistorySection[] = ["tasks", "goals", "habits", "learning", "income", "journal"];
  const section = allowed.includes(rawSection as HistorySection) ? rawSection as HistorySection : null;
  const routeKey = `${section ?? rawSection ?? ""}/${solarYear ?? ""}/${solarMonth ?? ""}`;
  const [loadedHistory, setLoadedHistory] = useState(() => ({
    routeKey,
    months: [] as MonthSummary[],
    report: null as MonthDetail | null,
    loading: true,
    error: "",
  }));
  const loading = loadedHistory.routeKey !== routeKey || loadedHistory.loading;
  const error = loadedHistory.routeKey === routeKey ? loadedHistory.error : "";
  const months = loadedHistory.routeKey === routeKey ? loadedHistory.months : EMPTY_MONTHS;
  const report = loadedHistory.routeKey === routeKey ? loadedHistory.report : null;
  const detailMode = Boolean(solarYear && solarMonth);

  useEffect(() => {
    if (!section) return;
    let active = true;
    const year = Number(solarYear);
    const month = Number(solarMonth);
    const load = detailMode
      ? (async () => {
          if (!Number.isInteger(year) || !Number.isInteger(month)) throw new Error("Invalid Solar Hijri month.");
          switch (section) {
            case "tasks": return api.getTaskMonthlyHistoryDetail(year, month);
            case "goals": return api.getGoalMonthlyHistoryDetail(year, month);
            case "habits": return api.getHabitMonthlyHistoryDetail(year, month);
            case "learning": return api.getLearningMonthlyHistoryDetail(year, month);
            case "income": return api.getFinanceMonthlyReport(year, month);
            case "journal": return api.getJournalMonthlyHistoryDetail(year, month);
          }
        })()
      : (async () => {
          switch (section) {
            case "tasks": return api.getTaskMonthlyHistory();
            case "goals": return api.getGoalMonthlyHistory();
            case "habits": return api.getHabitMonthlyHistory();
            case "learning": return api.getLearningMonthlyHistory();
            case "income": return api.getFinanceMonthlyReports();
            case "journal": return api.getJournalMonthlyHistory();
          }
        })();
    void load.then((result) => {
      if (!active) return;
      setLoadedHistory({
        routeKey,
        months: detailMode ? [] : result as MonthSummary[],
        report: detailMode ? result as MonthDetail : null,
        loading: false,
        error: "",
      });
    }).catch((loadError: unknown) => {
      if (active) setLoadedHistory({
        routeKey,
        months: [],
        report: null,
        loading: false,
        error: loadError instanceof Error ? loadError.message : "Unable to load this history.",
      });
    });
    return () => { active = false; };
  }, [section, solarYear, solarMonth, detailMode, routeKey]);

  const groupedMonths = useMemo(() => {
    const groups = new Map<number, MonthSummary[]>();
    for (const item of months) {
      const rows = groups.get(item.solar_year) ?? [];
      rows.push(item);
      groups.set(item.solar_year, rows);
    }
    return [...groups.entries()]
      .sort(([yearA], [yearB]) => yearB - yearA)
      .map(([year, rows]) => [year, [...rows].sort((a, b) => b.solar_month - a.solar_month)] as const);
  }, [months]);

  if (!section) return <Navigate to="/dashboard" replace />;
  const sectionPath = section === "income" ? "/income" : `/${section}`;
  const monthLabel = detailMode && solarYear && solarMonth
    ? formatSolarHijriMonthYear(Number(solarYear), Number(solarMonth))
    : "Monthly history";

  return (
    <section className="space-y-6 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-indigo-200/15 bg-indigo-200/[0.06] text-indigo-100"><CalendarDays size={18} /></span>
          <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{sectionLabels[section]} history</p><h1 className="mt-1 truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">{detailMode ? monthLabel : "Monthly history"}</h1></div>
        </div>
        <nav className="flex flex-wrap items-center gap-2" aria-label="History navigation">
          <Link to={sectionPath} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><ArrowLeft size={14} /> Back to {sectionLabels[section]}</Link>
          {detailMode && <button type="button" onClick={() => navigate(`/history/${section}`)} className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-xs font-medium text-slate-300 transition hover:bg-white/[0.08] hover:text-white"><ArrowLeft size={14} /> Back to months</button>}
        </nav>
      </header>

      {!detailMode && <p className="text-sm text-slate-400">Choose a month with saved {section === "income" ? "income or expense" : section} activity. Dates use the Afghan Solar Hijri calendar.</p>}
      {error && <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-200">{error}</div>}
      {loading ? <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-slate-400"><LoaderCircle size={18} className="animate-spin text-indigo-200" /> Loading {sectionLabels[section].toLocaleLowerCase()} history</div>
        : detailMode && report ? <DetailContent section={section} report={report} />
          : !detailMode && !error && groupedMonths.length > 0 ? <div className="space-y-7">{groupedMonths.map(([year, yearMonths]) => <section key={year} aria-label={`${solarNumber.format(year)} Solar Hijri year`}><h2 className="mb-3 text-sm font-semibold tracking-wide text-slate-300">{solarNumber.format(year)}</h2><div className="grid gap-3 md:grid-cols-2">{yearMonths.map((item) => <Link key={`${item.solar_year}-${item.solar_month}`} to={`/history/${section}/${item.solar_year}/${item.solar_month}`} className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition hover:border-indigo-200/25 hover:bg-indigo-200/[0.04]"><span className="flex items-center justify-between gap-3"><span className="font-semibold text-white">{formatSolarHijriMonthYear(item.solar_year, item.solar_month)}</span><ArrowRight size={16} className="shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-indigo-100" /></span><span className="mt-2 block text-xs text-slate-400">{activityDescription(section, item)}</span></Link>)}</div></section>)}</div>
            : !detailMode && !error ? <div className="rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 py-14 text-center"><CalendarDays className="mx-auto text-slate-500" size={23} /><p className="mt-3 text-sm font-medium text-slate-300">No history yet</p><p className="mt-1 text-xs text-slate-500">Saved {section === "income" ? "income and expense" : section} activity will appear here.</p></div>
              : detailMode && !report && !error ? <EmptyRecords>No records are available for this month.</EmptyRecords> : null}
    </section>
  );
}
