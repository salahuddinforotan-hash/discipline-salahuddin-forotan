import { CalendarDays } from "lucide-react";
import { Link } from "react-router-dom";

export type HistorySection = "tasks" | "goals" | "habits" | "learning" | "income" | "journal";

export default function HistoryIconLink({ section }: { section: HistorySection }) {
  return (
    <Link
      to={`/history/${section}`}
      aria-label={`Open ${section === "income" ? "income and expenses" : section} monthly history`}
      title="Monthly history"
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] text-slate-300 transition hover:border-indigo-200/20 hover:bg-indigo-200/[0.08] hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-200"
    >
      <CalendarDays size={16} strokeWidth={1.9} />
    </Link>
  );
}
