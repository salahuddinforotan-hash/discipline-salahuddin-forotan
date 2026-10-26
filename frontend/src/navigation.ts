import {
  BookOpen,
  CheckSquare,
  CircleDollarSign,
  Flame,
  Home,
  Settings,
  Target,
  NotebookPen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type WorkspaceSection = {
  title: string;
  path: string;
  icon: LucideIcon;
  description: string;
  faTitle: string;
  faDescription: string;
  iconStyle: string;
};

export const workspaceSections: WorkspaceSection[] = [
  {
    title: "Tasks",
    path: "/tasks",
    icon: CheckSquare,
    description: "Plan your work and keep track of what needs to be done.",
    faTitle: "کارها",
    faDescription: "کارهایت را برنامه‌ریزی کن و کارهای پیش رو را دنبال کن.",
    iconStyle: "border-sky-200/15 bg-sky-200/[0.08] text-sky-200",
  },
  {
    title: "Goals",
    path: "/goals",
    icon: Target,
    description: "Set meaningful goals and follow your progress.",
    faTitle: "هدف‌ها",
    faDescription: "هدف‌های ارزشمند تعیین کن و پیشرفتت را دنبال کن.",
    iconStyle: "border-violet-200/15 bg-violet-200/[0.08] text-violet-200",
  },
  {
    title: "Habits",
    path: "/habits",
    icon: Flame,
    description: "Build steady routines one day at a time.",
    faTitle: "عادت‌ها",
    faDescription: "با گام‌های روزانه عادت‌های پایدار بساز.",
    iconStyle: "border-orange-200/15 bg-orange-200/[0.08] text-orange-200",
  },
  {
    title: "Learning",
    path: "/learning",
    icon: BookOpen,
    description: "Organize books, study sessions, and learning plans.",
    faTitle: "یادگیری",
    faDescription: "کتاب‌ها، نشست‌های مطالعه و برنامه‌های یادگیری را سامان بده.",
    iconStyle: "border-indigo-200/15 bg-indigo-200/[0.08] text-indigo-200",
  },
  {
    title: "Finance",
    path: "/finance",
    icon: CircleDollarSign,
    description: "Review income, expenses, budgets, and savings.",
    faTitle: "امور مالی",
    faDescription: "درآمد، هزینه‌ها، بودجه و پس‌انداز را ببین.",
    iconStyle: "border-emerald-200/15 bg-emerald-200/[0.08] text-emerald-200",
  },
  {
    title: "Journal",
    path: "/journal",
    icon: NotebookPen,
    description: "Write private reflections and look back on your days.",
    faTitle: "دفتر روزانه",
    faDescription: "یادداشت‌های شخصی بنویس و به روزهای گذشته نگاه کن.",
    iconStyle: "border-pink-200/15 bg-pink-200/[0.08] text-pink-200",
  },
  {
    title: "Settings",
    path: "/settings",
    icon: Settings,
    description: "Manage your account, language, calendar, and app preferences.",
    faTitle: "تنظیمات",
    faDescription: "حساب، زبان، تقویم و ترجیحات برنامه را مدیریت کن.",
    iconStyle: "border-slate-200/15 bg-slate-200/[0.06] text-slate-200",
  },
];

export const primaryNavigation = [
  { name: "Dashboard", path: "/dashboard", icon: Home },
  ...workspaceSections.map(({ title, path, icon }) => ({ name: title, path, icon })),
];
