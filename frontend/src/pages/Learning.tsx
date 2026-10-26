import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CircleCheck,
  Clock3,
  GraduationCap,
  LoaderCircle,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from "lucide-react";

import { api } from "../services/api";
import HistoryIconLink from "../components/history/HistoryIconLink";
import { formatConfiguredDate } from "../services/solarHijri";
import { getAppLocale } from "../services/language";
import type { LearningPlan, LearningPlanInput } from "../services/api";

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToISO(dateString: string, days: number) {
  const date = new Date(`${dateString}T12:00:00`);
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function dateDistance(from: string, to: string) {
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

function pageTargets(plan: LearningPlan, today: string) {
  const remaining = Math.max(0, plan.total_pages - plan.current_page);
  if (!remaining) {
    return { remaining, daily: 0, weekly: 0, monthly: 0 };
  }

  const startDate = plan.started_on > today ? plan.started_on : today;
  const daysUntilFinish = Math.max(1, dateDistance(startDate, plan.target_date) + 1);
  const remainingStudyDays = Math.max(
    1,
    Math.ceil((daysUntilFinish * plan.study_days_per_week) / 7),
  );
  const daily = Math.ceil(remaining / remainingStudyDays);

  const endOfMonth = new Date(`${today}T12:00:00`);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1, 0);
  const endOfPlanningMonth = localDateString(endOfMonth) < plan.target_date
    ? localDateString(endOfMonth)
    : plan.target_date;
  const daysThisMonth = Math.max(
    0,
    dateDistance(startDate, endOfPlanningMonth) + 1,
  );
  const studyDaysThisMonth = Math.ceil(
    (daysThisMonth * plan.study_days_per_week) / 7,
  );

  return {
    remaining,
    daily,
    weekly: Math.min(remaining, daily * plan.study_days_per_week),
    monthly: Math.min(remaining, daily * studyDaysThisMonth),
  };
}

function formatDate(date: string) {
  return formatConfiguredDate(date);
}

function Learning() {
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<LearningPlan | null>(null);

  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [totalPages, setTotalPages] = useState("");
  const [currentPage, setCurrentPage] = useState("0");
  const [startedOn, setStartedOn] = useState(localDateString(new Date()));
  const [targetDate, setTargetDate] = useState(
    addDaysToISO(localDateString(new Date()), 30),
  );
  const [studyStartTime, setStudyStartTime] = useState("19:00");
  const [studyEndTime, setStudyEndTime] = useState("20:00");
  const [studyDaysPerWeek, setStudyDaysPerWeek] = useState("5");

  async function loadPlans() {
    try {
      setLoading(true);
      setError("");
      setPlans(await api.getLearningPlans());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your study plans.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPlans();
  }, []);

  useEffect(() => {
    if (showForm) {
      window.requestAnimationFrame(() => {
        document.getElementById("learning-plan-editor")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
  }, [showForm]);

  const today = localDateString(new Date());
  const planTargets = useMemo(
    () => plans.map((plan) => ({ plan, ...pageTargets(plan, today) })),
    [plans, today],
  );
  const activeTargets = planTargets.filter(({ remaining }) => remaining > 0);
  const completedCount = plans.length - activeTargets.length;
  const dailyPageGoal = activeTargets.reduce((sum, plan) => sum + plan.daily, 0);
  const weeklyPageGoal = activeTargets.reduce((sum, plan) => sum + plan.weekly, 0);
  const monthlyPageGoal = activeTargets.reduce((sum, plan) => sum + plan.monthly, 0);

  function clearForm() {
    setTitle("");
    setAuthor("");
    setTotalPages("");
    setCurrentPage("0");
    setStartedOn(today);
    setTargetDate(addDaysToISO(today, 30));
    setStudyStartTime("19:00");
    setStudyEndTime("20:00");
    setStudyDaysPerWeek("5");
  }

  function openCreateForm() {
    clearForm();
    setEditingPlan(null);
    setError("");
    setShowForm(true);
  }

  function openEditForm(plan: LearningPlan) {
    setEditingPlan(plan);
    setTitle(plan.title);
    setAuthor(plan.author ?? "");
    setTotalPages(String(plan.total_pages));
    setCurrentPage(String(plan.current_page));
    setStartedOn(plan.started_on);
    setTargetDate(plan.target_date);
    setStudyStartTime(plan.study_start_time.slice(0, 5));
    setStudyEndTime(plan.study_end_time.slice(0, 5));
    setStudyDaysPerWeek(String(plan.study_days_per_week));
    setError("");
    setShowForm(true);
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const pages = Number(totalPages);
    const readPages = Number(currentPage);
    if (!Number.isInteger(pages) || pages < 1) {
      setError("Enter the book’s total number of pages.");
      return;
    }
    if (!Number.isInteger(readPages) || readPages < 0 || readPages > pages) {
      setError("Pages read must be between zero and the total page count.");
      return;
    }
    if (targetDate < startedOn) {
      setError("The target finish date must be on or after the start date.");
      return;
    }
    if (studyEndTime <= studyStartTime) {
      setError("Choose an end time that is later than the start time.");
      return;
    }

    const payload: LearningPlanInput = {
      title: title.trim(),
      author: author.trim() || null,
      total_pages: pages,
      current_page: readPages,
      started_on: startedOn,
      target_date: targetDate,
      study_start_time: studyStartTime,
      study_end_time: studyEndTime,
      study_days_per_week: Number(studyDaysPerWeek),
    };

    try {
      setSaving(true);
      setError("");
      if (editingPlan) {
        const updated = await api.updateLearningPlan(editingPlan.id, payload);
        setPlans((current) => current.map((plan) => plan.id === updated.id ? updated : plan));
      } else {
        const created = await api.createLearningPlan(payload);
        setPlans((current) => [...current, created]);
      }
      setEditingPlan(null);
      clearForm();
      setShowForm(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "Unable to save your study plan.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deletePlan(plan: LearningPlan) {
    if (!window.confirm(`Delete the study plan for “${plan.title}”?`)) return;
    try {
      setError("");
      await api.deleteLearningPlan(plan.id);
      setPlans((current) => current.filter((item) => item.id !== plan.id));
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Unable to delete this study plan.",
      );
    }
  }

  const summaryCards = [
    {
      label: "Pages per study day",
      value: dailyPageGoal,
      suffix: "pages",
      detail: "Automatically paced to your target dates",
      icon: BookOpen,
      color: "text-indigo-300",
      iconBg: "bg-indigo-400/10",
    },
    {
      label: "Weekly plan",
      value: weeklyPageGoal,
      suffix: "pages",
      detail: "Across your planned study days",
      icon: CalendarDays,
      color: "text-cyan-300",
      iconBg: "bg-cyan-400/10",
    },
    {
      label: "Monthly plan",
      value: monthlyPageGoal,
      suffix: "pages",
      detail: `${activeTargets.length} active ${activeTargets.length === 1 ? "book" : "books"}`,
      icon: Target,
      color: "text-emerald-300",
      iconBg: "bg-emerald-400/10",
    },
  ];

  return (
    <section className="space-y-7 pb-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-indigo-300">
            <span className="h-2 w-2 rounded-full bg-indigo-300" />
            KEEP MAKING PROGRESS
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Learning planner
          </h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400 sm:text-base">
            Choose a book and finish date. Your daily, weekly, and monthly reading goals adjust as you progress.
          </p>
        </div>
        <HistoryIconLink section="learning" />
      </header>

      <div>
        <button
          type="button"
          onClick={openCreateForm}
          aria-label="Add book"
          className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-indigo-400 px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg shadow-indigo-950/20 transition hover:bg-indigo-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300 sm:w-fit"
          style={{
            display: "flex",
            width: "fit-content",
            minHeight: 44,
            backgroundColor: "#818cf8",
            color: "#020617",
            padding: "12px 16px",
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            fontWeight: 600,
          }}
        >
          <Plus size={16} /> Add book
        </button>
      </div>

      {showForm && (
        <section id="learning-plan-editor" aria-labelledby="learning-plan-title" className="scroll-mt-6 overflow-hidden rounded-2xl border border-indigo-300/15 bg-slate-900 shadow-xl shadow-black/10">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Build a realistic routine</p>
                <h2 id="learning-plan-title" className="mt-1 text-xl font-semibold text-white">{editingPlan ? "Update your study plan" : "Plan a book"}</h2>
              </div>
              <button type="button" onClick={() => { setShowForm(false); setEditingPlan(null); setError(""); }} aria-label="Close study plan form" className="rounded-lg p-2 text-slate-400 hover:bg-white/10 hover:text-white"><X size={14} /></button>
            </div>

            <form onSubmit={handleSave} className="space-y-5 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="book-title" className="mb-1.5 block text-sm font-medium text-slate-300">Book title</label>
                  <input id="book-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Deep Work" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10" />
                </div>
                <div>
                  <label htmlFor="book-author" className="mb-1.5 block text-sm font-medium text-slate-300">Author <span className="text-slate-500">(optional)</span></label>
                  <input id="book-author" maxLength={160} value={author} onChange={(event) => setAuthor(event.target.value)} placeholder="Author name" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-total-pages" className="mb-1.5 block text-sm font-medium text-slate-300">Total pages</label>
                  <input id="book-total-pages" required type="number" min="1" max="100000" step="1" value={totalPages} onChange={(event) => setTotalPages(event.target.value)} placeholder="320" className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-current-page" className="mb-1.5 block text-sm font-medium text-slate-300">Pages already read</label>
                  <input id="book-current-page" required type="number" min="0" max={totalPages || 100000} step="1" value={currentPage} onChange={(event) => setCurrentPage(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-days-per-week" className="mb-1.5 block text-sm font-medium text-slate-300">Study days per week</label>
                  <select id="book-days-per-week" value={studyDaysPerWeek} onChange={(event) => setStudyDaysPerWeek(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40">
                    {[1, 2, 3, 4, 5, 6, 7].map((days) => <option key={days} value={days}>{days} {days === 1 ? "day" : "days"} a week</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="book-start-date" className="mb-1.5 block text-sm font-medium text-slate-300">Start date</label>
                  <input id="book-start-date" required type="date" value={startedOn} onChange={(event) => setStartedOn(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-finish-date" className="mb-1.5 block text-sm font-medium text-slate-300">Target finish date</label>
                  <input id="book-finish-date" required type="date" min={startedOn} value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-study-start" className="mb-1.5 block text-sm font-medium text-slate-300">Study from</label>
                  <input id="book-study-start" required type="time" value={studyStartTime} onChange={(event) => setStudyStartTime(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40" />
                </div>
                <div>
                  <label htmlFor="book-study-end" className="mb-1.5 block text-sm font-medium text-slate-300">Study until</label>
                  <input id="book-study-end" required type="time" value={studyEndTime} onChange={(event) => setStudyEndTime(event.target.value)} className="w-full rounded-xl border border-white/10 bg-slate-950 px-3.5 py-3 text-sm text-white outline-none focus:border-indigo-300/40" />
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-indigo-300/10 bg-indigo-400/[0.06] p-3.5 text-sm text-slate-400">
                <Target size={14} className="mt-0.5 shrink-0 text-indigo-300" />
                <p>Daily pages are calculated from the pages you have left, your finish date, and the number of study days you choose. Weekly and monthly targets update with your progress.</p>
              </div>

              {error && <p role="alert" className="rounded-lg border border-rose-400/20 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">{error}</p>}

              <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
                <button type="button" onClick={() => { setShowForm(false); setEditingPlan(null); setError(""); }} disabled={saving} className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 hover:bg-white/5 disabled:opacity-50">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-300 disabled:opacity-50">
                  {saving ? <LoaderCircle size={14} className="animate-spin" /> : editingPlan ? <Check size={14} /> : <ArrowRight size={14} />}
                  {saving ? "Saving..." : editingPlan ? "Save changes" : "Create study plan"}
                </button>
              </div>
            </form>
        </section>
      )}

      {error && !showForm && (
        <div role="alert" className="flex items-center justify-between rounded-xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-200">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-400">Books in your plan</p>
            <span className="rounded-xl bg-violet-400/10 p-2.5 text-violet-300"><GraduationCap size={16} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold text-white">{plans.length}</p>
          <p className="mt-1 text-xs text-slate-500">{completedCount} completed</p>
        </article>
        {summaryCards.map((card) => {
          const Icon = card.icon;
          return (
            <article key={card.label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-400">{card.label}</p>
                <span className={`rounded-xl p-2.5 ${card.iconBg} ${card.color}`}><Icon size={16} /></span>
              </div>
              <p className="mt-4 text-3xl font-bold text-white">{card.value} <span className="text-sm font-medium text-slate-500">{card.suffix}</span></p>
              <p className="mt-1 text-xs text-slate-500">{card.detail}</p>
            </article>
          );
        })}
      </div>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Your reading plans</h2>
            <p className="mt-1 text-sm text-slate-500">Study sessions, finish dates, and page targets for each book.</p>
          </div>
          {plans.length > 0 && <span className="text-xs font-medium text-slate-500">{plans.length} {plans.length === 1 ? "plan" : "plans"}</span>}
        </div>

        {loading ? (
          <div className="flex min-h-56 items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] text-sm text-slate-400">
            <LoaderCircle className="animate-spin text-indigo-300" size={16} /> Loading your books
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/15 bg-white/[0.025] px-6 py-14 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-indigo-300"><BookOpen size={18} /></div>
            <h3 className="mt-4 text-lg font-semibold text-white">Make time for your next chapter</h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">Add a book, set your study hours and finish date, and get a page-by-page plan for the day, week, and month.</p>
            <button type="button" onClick={openCreateForm} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-400 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-300"><Plus size={14} /> Create a study plan</button>
          </div>
        ) : (
          <div className="space-y-4">
            {planTargets.map(({ plan, remaining, daily, weekly, monthly }) => {
              const completed = remaining === 0;
              const progressPercent = Math.round((plan.current_page / plan.total_pages) * 100);
              const overdue = !completed && plan.target_date < today;
              return (
                <article key={plan.id} className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
                  <div className="p-5 sm:p-6">
                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                      <div className="flex min-w-0 items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-indigo-300/15 bg-indigo-400/10 text-indigo-300"><BookOpen size={18} /></div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="truncate text-lg font-semibold text-white">{plan.title}</h3>
                            {completed ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-medium text-emerald-300"><CircleCheck size={13} /> Completed</span>
                            ) : overdue ? (
                              <span className="rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-medium text-amber-300">Past target date</span>
                            ) : (
                              <span className="rounded-full bg-indigo-400/10 px-2.5 py-1 text-xs font-medium text-indigo-300">In progress</span>
                            )}
                          </div>
                          <p className="mt-1 text-sm text-slate-500">{plan.author || "Author not added"} <span className="px-1.5 text-slate-700">·</span> {plan.total_pages.toLocaleString(getAppLocale())} pages</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2 self-end lg:self-auto">
                        <button type="button" onClick={() => openEditForm(plan)} className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"><Pencil size={13} /> Update</button>
                        <button type="button" onClick={() => void deletePlan(plan)} aria-label={`Delete ${plan.title}`} className="rounded-lg border border-white/10 p-2 text-slate-500 transition hover:border-rose-400/20 hover:bg-rose-400/10 hover:text-rose-300"><Trash2 size={14} /></button>
                      </div>
                    </div>

                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Reading progress</span>
                        <span className="font-medium text-white">{plan.current_page.toLocaleString(getAppLocale())} <span className="text-slate-500">/ {plan.total_pages.toLocaleString(getAppLocale())} pages</span><span className="ml-2 text-xs text-slate-500">{progressPercent}%</span></span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-cyan-300 transition-[width]" style={{ width: `${progressPercent}%` }} /></div>
                    </div>

                    {!completed && (
                      <div className="mt-5 grid gap-3 sm:grid-cols-3">
                        {[
                          ["Daily", daily, "pages per study day"],
                          ["Weekly", weekly, "pages this week"],
                          ["Monthly", monthly, "pages this month"],
                        ].map(([label, count, detail]) => (
                          <div key={label} className="rounded-xl border border-white/[0.07] bg-slate-950/40 px-4 py-3">
                            <p className="text-xs font-medium text-slate-500">{label}</p>
                            <p className="mt-1 text-xl font-semibold text-white">{count} <span className="text-xs font-medium text-slate-500">pages</span></p>
                            <p className="mt-0.5 text-[11px] text-slate-600">{detail}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 flex flex-col gap-3 border-t border-white/[0.07] pt-4 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                        <span className="inline-flex items-center gap-2"><Clock3 size={13} className="text-indigo-300" /> {plan.study_start_time.slice(0, 5)}–{plan.study_end_time.slice(0, 5)}</span>
                        <span>{plan.study_days_per_week} study {plan.study_days_per_week === 1 ? "day" : "days"} per week</span>
                      </div>
                      <span className="inline-flex items-center gap-2 text-slate-500"><CalendarDays size={13} /> Finish by {formatDate(plan.target_date)}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>


    </section>
  );
}

export default Learning;
