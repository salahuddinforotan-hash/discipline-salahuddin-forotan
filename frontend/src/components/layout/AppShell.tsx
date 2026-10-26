import {
  BookOpen,
  CheckSquare,
  Home,
  MessageSquare,
  Settings,
  Target,
  WalletCards,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";

const navigation = [
  { name: "Dashboard", path: "/dashboard", icon: Home },
  { name: "Tasks", path: "/tasks", icon: CheckSquare },
  { name: "Goals", path: "/goals", icon: Target },
  { name: "Finance", path: "/finance", icon: WalletCards },
  { name: "Learning", path: "/learning", icon: BookOpen },
  { name: "Journal", path: "/journal", icon: BookOpen },
  { name: "Settings", path: "/settings", icon: Settings },
];

export default function AppShell() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 flex-col border-r border-white/10 bg-slate-950 md:flex">
          <div className="flex h-20 items-center border-b border-white/10 px-6">
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                Discipline
              </h1>

              <p className="text-xs text-slate-500">
                Personal operating system
              </p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 p-4">
            {navigation.map((item) => {
              const Icon = item.icon;

              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    [
                      "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                      isActive
                        ? "bg-white text-slate-950"
                        : "text-slate-400 hover:bg-white/5 hover:text-white",
                    ].join(" ")
                  }
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          <div className="border-t border-white/10 p-4">
            <NavLink
              to="/assistant"
              className={({ isActive }) =>
                [
                  "flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition",
                  isActive
                    ? "bg-white text-slate-950"
                    : "text-slate-400 hover:bg-white/5 hover:text-white",
                ].join(" ")
              }
            >
              <MessageSquare size={18} />
              <span>AI Assistant</span>
            </NavLink>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <div className="mx-auto min-h-screen max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
