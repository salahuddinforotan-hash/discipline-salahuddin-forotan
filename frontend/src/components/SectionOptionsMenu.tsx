import type { ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";

export default function SectionOptionsMenu({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group relative shrink-0">
    <summary aria-label={label} className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-xl border border-white/10 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"><MoreHorizontal size={18} /></summary>
    <div className="absolute right-0 z-20 mt-2 w-48 rounded-xl border border-white/10 bg-slate-900 p-1.5 shadow-xl shadow-black/30">{children}</div>
  </details>;
}
