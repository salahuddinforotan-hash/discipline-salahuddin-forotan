import {
  ArrowLeftRight,
  Banknote,
  BarChart3,
  CalendarRange,
  CircleDollarSign,
  CreditCard,
  FolderOpen,
  Goal,
  PiggyBank,
  Repeat2,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const sections = [
  { name: "Overview", path: "/finance", icon: Wallet, end: true },
  { name: "Income", path: "/finance/income", icon: Banknote },
  { name: "Expenses", path: "/finance/expenses", icon: ArrowLeftRight },
  { name: "Budgets", path: "/finance/budgets", icon: BarChart3 },
  { name: "Savings", path: "/finance/savings", icon: PiggyBank },
  { name: "Financial goals", path: "/finance/goals", icon: Goal },
  { name: "Bank accounts", path: "/finance/bank-accounts", icon: CreditCard },
  { name: "Categories", path: "/finance/categories", icon: FolderOpen },
  { name: "Recurring", path: "/finance/recurring", icon: Repeat2 },
  { name: "Reports", path: "/finance/reports", icon: BarChart3 },
  { name: "History", path: "/history/income", icon: CalendarRange },
];

export default function FinanceLayout() {
  return (
    <div className="space-y-5 pb-8">
      <div className="flex flex-col gap-3 border-b border-white/[0.08] pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200"><CircleDollarSign size={14} /> Finance</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-white">Your financial workspace</h1>
        </div>
      </div>
      <nav aria-label="Finance sections" className="-mx-3 flex gap-1 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {sections.map(({ name, path, icon: Icon, end }) => (
          <NavLink key={path} to={path} end={end} className={({ isActive }) => `inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-medium transition ${isActive ? "bg-white text-slate-950" : "border border-white/[0.07] bg-white/[0.025] text-slate-400 hover:bg-white/[0.07] hover:text-white"}`}>
            <Icon size={14} />{name}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
