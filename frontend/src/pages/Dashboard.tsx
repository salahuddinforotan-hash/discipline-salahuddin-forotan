import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CircleDollarSign,
  LoaderCircle,
  Quote,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../services/api";
import type { FinanceOverview, Goal, LearningPlan } from "../services/api";
import { getAppLocale, getLanguage } from "../services/language";

const dailyMotivations = [
  {
    en: "Small progress every day creates extraordinary results.",
    fa: "پیشرفت کوچک هر روز، نتیجه‌های بزرگی می‌سازد.",
  },
  {
    en: "Choose one worthwhile action, give it your attention, and begin.",
    fa: "یک کار ارزشمند را انتخاب کن، به آن توجه کن و شروع کن.",
  },
  {
    en: "A missed day does not erase your progress. Take the next small step.",
    fa: "یک روز از دست‌رفته پیشرفتت را پاک نمی‌کند. گام کوچک بعدی را بردار.",
  },
  {
    en: "Protect your focus. Steady effort is how confidence is built.",
    fa: "تمرکزت را حفظ کن. اعتمادبه‌نفس با تلاش پیوسته ساخته می‌شود.",
  },
  {
    en: "Rest when you need it, then return without guilt.",
    fa: "هر وقت نیاز داشتی استراحت کن و بعد بدون احساس گناه برگرد.",
  },
  {
    en: "Measure progress by honest effort, not comparison.",
    fa: "پیشرفت را با تلاش صادقانه بسنج، نه با مقایسه.",
  },
  {
    en: "Begin where you are. The next step is enough for today.",
    fa: "از همین‌جا شروع کن. برای امروز همان گام بعدی کافی است.",
  },
];

type PreviewCardProps = {
  title: string;
  detail: string;
  href: string;
  Icon: LucideIcon;
  iconStyle: string;
  children: React.ReactNode;
  className?: string;
};

function PreviewCard({ title, detail, href, Icon, iconStyle, children, className = "" }: PreviewCardProps) {
  return (
    <Link
      to={href}
      className={`group flex min-w-0 flex-col rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 transition hover:border-white/[0.15] hover:bg-white/[0.045] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200 sm:p-6 ${className}`}
    >
      <span className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${iconStyle}`} aria-hidden="true">
          <Icon size={17} strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">{title}</span>
          <span className="mt-1 block text-xs text-slate-500">{detail}</span>
        </span>
        <ArrowRight size={15} className="mt-1 shrink-0 text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-slate-300" aria-hidden="true" />
      </span>
      <span className="mt-5 flex min-h-16 flex-1 flex-col">{children}</span>
    </Link>
  );
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(getAppLocale(), {
    style: "currency", currencyDisplay: "narrowSymbol",
    currency,
    maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString(getAppLocale())}`;
  }
}

function formatTotals(rows: Array<{ currency: string; amount: number }>) {
  return rows.length ? rows.map((row) => formatMoney(row.amount, row.currency)).join(" · ") : "—";
}

function Dashboard() {
  const [today, setToday] = useState(() => new Date());
  const [isPersian, setIsPersian] = useState(() => getLanguage() === "fa");
  const [goals, setGoals] = useState<Goal[]>([]);
  const [learningPlans, setLearningPlans] = useState<LearningPlan[]>([]);
  const [financeOverview, setFinanceOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadIssues, setLoadIssues] = useState({ goals: false, learning: false, finance: false });

  useEffect(() => {
    const timer = window.setInterval(() => {
      setToday((current) => {
        const now = new Date();
        return dateKey(now) === dateKey(current) ? current : now;
      });
    }, 60_000);
    const updateLanguage = () => setIsPersian(getLanguage() === "fa");
    window.addEventListener("discipline:language-updated", updateLanguage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("discipline:language-updated", updateLanguage);
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadOverview() {
      const [goalsResult, learningResult, financeResult] = await Promise.allSettled([
        api.getGoals(),
        api.getLearningPlans(),
        api.getFinanceOverview(),
      ]);
      if (!active) return;

      if (goalsResult.status === "fulfilled") setGoals(goalsResult.value);
      if (learningResult.status === "fulfilled") setLearningPlans(learningResult.value);
      if (financeResult.status === "fulfilled") setFinanceOverview(financeResult.value);
      setLoadIssues({
        goals: goalsResult.status === "rejected",
        learning: learningResult.status === "rejected",
        finance: financeResult.status === "rejected",
      });
      setLoading(false);
    }
    void loadOverview();
    return () => { active = false; };
  }, []);

  const goal = useMemo(() => goals
    .filter((item) => !item.is_completed)
    .sort((a, b) => {
      if (a.target_date && b.target_date) return a.target_date.localeCompare(b.target_date);
      if (a.target_date) return -1;
      if (b.target_date) return 1;
      return a.created_at.localeCompare(b.created_at);
    })[0], [goals]);

  const learningPlan = useMemo(() => {
    const activePlans = learningPlans.filter((plan) => plan.current_page < plan.total_pages);
    if (activePlans.length) return [...activePlans].sort((a, b) => a.target_date.localeCompare(b.target_date))[0];
    return [...learningPlans].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  }, [learningPlans]);

  const monthIncome = financeOverview?.month_income ?? [];
  const monthExpenses = financeOverview?.month_expenses ?? [];
  const currencies = [...new Set([...monthIncome, ...monthExpenses].map((item) => item.currency))].sort();
  const monthlyNet = currencies.map((currency) => ({
    currency,
    amount: (monthIncome.find((item) => item.currency === currency)?.amount ?? 0)
      - (monthExpenses.find((item) => item.currency === currency)?.amount ?? 0),
  }));

  const dayNumber = Math.floor(Date.parse(`${dateKey(today)}T00:00:00Z`) / 86_400_000);
  const motivation = dailyMotivations[((dayNumber % dailyMotivations.length) + dailyMotivations.length) % dailyMotivations.length];
  const dateLabel = new Intl.DateTimeFormat(getAppLocale(), {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(today);

  const labels = isPersian
    ? {
      dashboard: "داشبورد",
      overview: "نگاهی کوتاه به آنچه اکنون در جریان است.",
      motivation: "انگیزه امروز",
      goal: "هدف",
      currentGoal: "هدف فعال نزدیک‌تر",
      noGoal: "هنوز هدف فعالی ندارید.",
      learning: "یادگیری",
      currentLearning: "برنامه مطالعه فعلی",
      noLearning: "هنوز برنامه یادگیری ثبت نشده است.",
      pages: "صفحه",
      finance: "امور مالی",
      thisMonth: "این ماه",
      balance: "خالص ماهانه",
      income: "درآمد",
      expenses: "هزینه‌ها",
      noFinance: "هنوز فعالیت مالی برای این ماه ثبت نشده است.",
      loading: "در حال بارگذاری پیش‌نمایش‌ها…",
      unavailable: "پیش‌نمایش بارگذاری نشد. برای تلاش دوباره وارد بخش شوید.",
      completed: "تکمیل‌شده",
    }
    : {
      dashboard: "Dashboard",
      overview: "A quick look at what is happening right now.",
      motivation: "Daily motivation",
      goal: "Goal",
      currentGoal: "Next active goal",
      noGoal: "No active goal yet.",
      learning: "Learning",
      currentLearning: "Current study plan",
      noLearning: "No learning activity yet.",
      pages: "pages",
      finance: "Finance",
      thisMonth: "This month",
      balance: "Monthly balance",
      income: "Income",
      expenses: "Expenses",
      noFinance: "No financial activity this month.",
      loading: "Loading your previews…",
      unavailable: "This preview could not load. Open the section to try again.",
      completed: "Completed",
    };

  function previewMessage(issue: boolean, empty: boolean, emptyMessage: string) {
    if (loading) {
      return <span className="inline-flex items-center gap-2 text-sm text-slate-500"><LoaderCircle size={14} className="animate-spin" aria-hidden="true" />{labels.loading}</span>;
    }
    if (issue) return <span role="status" className="text-sm leading-relaxed text-slate-500">{labels.unavailable}</span>;
    if (empty) return <span className="text-sm text-slate-500">{emptyMessage}</span>;
    return null;
  }

  const learningProgress = learningPlan?.total_pages
    ? Math.max(0, Math.min(100, Math.round((learningPlan.current_page / learningPlan.total_pages) * 100)))
    : 0;
  const hasFinance = currencies.length > 0;

  return (
    <section className="mx-auto max-w-5xl space-y-5 pb-8 sm:space-y-6 sm:pb-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-slate-500">{isPersian ? "سامانه شخصی پیشرفت" : "Your personal workspace"}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white sm:text-4xl">{labels.dashboard}</h1>
          <p className="mt-2 text-sm text-slate-400">{labels.overview}</p>
        </div>
        <p className="text-sm text-slate-500" lang={isPersian ? "fa" : "en"} dir={isPersian ? "rtl" : "ltr"}>{dateLabel}</p>
      </header>

      <section aria-labelledby="daily-motivation-title" className="rounded-2xl border border-white/[0.08] bg-white/[0.03] px-5 py-4 sm:px-6 sm:py-5">
        <h2 id="daily-motivation-title" className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-indigo-200/75">
          <Quote size={14} aria-hidden="true" />{labels.motivation}
        </h2>
        <p lang={isPersian ? "fa" : "en"} dir={isPersian ? "rtl" : "ltr"} className="mt-2 text-base font-medium leading-relaxed text-white sm:text-lg">
          {motivation[isPersian ? "fa" : "en"]}
        </p>
      </section>

      <div className="grid min-w-0 gap-4 md:grid-cols-2">
        <PreviewCard
          title={labels.goal}
          detail={labels.currentGoal}
          href={goal ? `/goals/${goal.id}/details` : "/goals"}
          Icon={Target}
          iconStyle="border-violet-200/15 bg-violet-200/[0.08] text-violet-200"
        >
          {previewMessage(loadIssues.goals, !goal, labels.noGoal) ?? (goal && <>
            <span className="line-clamp-2 text-sm font-medium leading-relaxed text-slate-100">{goal.title}</span>
            <span className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400"><span>{isPersian ? "پیشرفت" : "Progress"}</span><span className="font-semibold tabular-nums text-slate-200">{Math.round(Math.max(0, Math.min(goal.progress, 100)))}%</span></span>
            <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-violet-300/80 transition-[width]" style={{ width: `${Math.max(0, Math.min(goal.progress, 100))}%` }} /></span>
          </>)}
        </PreviewCard>

        <PreviewCard
          title={labels.learning}
          detail={learningPlan && learningPlan.current_page >= learningPlan.total_pages
            ? (isPersian ? "آخرین برنامه ثبت‌شده" : "Latest reading plan")
            : labels.currentLearning}
          href="/learning"
          Icon={BookOpen}
          iconStyle="border-indigo-200/15 bg-indigo-200/[0.08] text-indigo-200"
        >
          {previewMessage(loadIssues.learning, !learningPlan, labels.noLearning) ?? (learningPlan && <>
            <span className="line-clamp-2 text-sm font-medium leading-relaxed text-slate-100">{learningPlan.title}</span>
            <span className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400"><span>{learningPlan.current_page} / {learningPlan.total_pages} {labels.pages}</span><span className="font-semibold tabular-nums text-slate-200">{learningProgress}%</span></span>
            <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><span className="block h-full rounded-full bg-indigo-300/80 transition-[width]" style={{ width: `${learningProgress}%` }} /></span>
            {learningPlan.current_page >= learningPlan.total_pages && <span className="mt-2 text-[11px] text-emerald-200">{labels.completed}</span>}
          </>)}
        </PreviewCard>

        <PreviewCard
          title={labels.finance}
          detail={labels.thisMonth}
          href="/finance"
          Icon={CircleDollarSign}
          iconStyle="border-emerald-200/15 bg-emerald-200/[0.08] text-emerald-200"
          className="md:col-span-2"
        >
          {previewMessage(loadIssues.finance, !hasFinance, labels.noFinance) ?? <span className="grid flex-1 grid-cols-3 gap-2 sm:gap-4">
            {[
              { label: labels.balance, value: formatTotals(monthlyNet), tone: monthlyNet.some((item) => item.amount < 0) ? "text-rose-200" : "text-white" },
              { label: labels.income, value: formatTotals(monthIncome), tone: "text-emerald-200" },
              { label: labels.expenses, value: formatTotals(monthExpenses), tone: "text-amber-200" },
            ].map((item) => <span key={item.label} className="min-w-0 rounded-xl border border-white/[0.06] bg-slate-950/25 p-3 sm:p-4">
              <span className="block truncate text-[11px] text-slate-500 sm:text-xs">{item.label}</span>
              <span className={`mt-2 block truncate text-sm font-semibold tabular-nums sm:text-lg ${item.tone}`}>{item.value}</span>
            </span>)}
          </span>}
        </PreviewCard>
      </div>
    </section>
  );
}

export default Dashboard;
