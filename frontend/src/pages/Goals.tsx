import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Circle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { getAppLocale } from "../services/language";
import type { Goal } from "../services/api";
import HistoryIconLink from "../components/history/HistoryIconLink";
import SectionOptionsMenu from "../components/SectionOptionsMenu";
import { formatConfiguredDate } from "../services/solarHijri";

function todayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return formatConfiguredDate(value);
}

function formatTime(value: string) {
  const [hours, minutes] = value.split(":").map(Number);
  const period = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${period}`;
}

function formatCompletedAt(value: string) {
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(value);
  const date = new Date(hasTimezone ? value : `${value}Z`);
  return new Intl.DateTimeFormat(getAppLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState(todayString());
  const [targetDate, setTargetDate] = useState("");
  const [targetTime, setTargetTime] = useState("23:59");
  const [targetAmount, setTargetAmount] = useState("");
  const [unit, setUnit] = useState("");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

  async function loadGoals() {
    try {
      setLoading(true);
      setError("");

      const data = await api.getGoals();
      setGoals(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load goals.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGoals();
  }, []);

  async function handleCreate(event: FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Goal title is required.");
      return;
    }
    if ((targetAmount && !unit.trim()) || (!targetAmount && unit.trim())) {
      setError("Enter both a measurable target and its unit, or leave both blank.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const goal = await api.createGoal({
        title: title.trim(),
        description: description.trim() || null,
        start_date: startDate,
        target_date: targetDate || null,
        target_time: targetDate ? targetTime || null : null,
        target_amount: targetAmount ? Number(targetAmount) : null,
        unit: unit.trim() || null,
      });

      setGoals((current) => [goal, ...current]);
      setTitle("");
      setDescription("");
      setStartDate(todayString());
      setTargetDate("");
      setTargetTime("23:59");
      setTargetAmount("");
      setUnit("");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to create goal.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(goal: Goal) {
    try {
      setError("");

      const updated = await api.updateGoal(goal.id, {
        is_completed: !goal.is_completed,
      });

      setGoals((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update goal.",
      );
    }
  }

  async function updateProgress(goal: Goal, progress: number) {
    try {
      setError("");

      const updated = await api.updateGoal(goal.id, {
        progress,
      });

      setGoals((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update progress.",
      );
    }
  }

  async function deleteGoal(goal: Goal) {
    const message =
      'Delete "' + goal.title + '"? This cannot be undone.';

    if (!window.confirm(message)) {
      return;
    }

    try {
      setError("");

      await api.deleteGoal(goal.id);

      setGoals((current) =>
        current.filter((item) => item.id !== goal.id),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete goal.",
      );
    }
  }

  async function saveEdit(event: FormEvent) {
    event.preventDefault();

    if (!editingGoal || !editingGoal.title.trim()) {
      return;
    }
    if ((editingGoal.target_amount != null && !editingGoal.unit?.trim()) || (editingGoal.target_amount == null && editingGoal.unit?.trim())) {
      setError("Enter both a measurable target and its unit, or leave both blank.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const updated = await api.updateGoal(editingGoal.id, {
        title: editingGoal.title.trim(),
        description: editingGoal.description,
        start_date: editingGoal.start_date || editingGoal.created_at.slice(0, 10),
        target_date: editingGoal.target_date,
        target_time: editingGoal.target_date
          ? editingGoal.target_time?.slice(0, 5) || null
          : null,
        ...(editingGoal.target_amount == null ? { progress: editingGoal.progress } : {}),
        ...(editingGoal.target_amount != null || editingGoal.unit ? { target_amount: editingGoal.target_amount ?? null, unit: editingGoal.unit ?? null } : {}),
      });

      setGoals((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );

      setEditingGoal(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to edit goal.",
      );
    } finally {
      setSaving(false);
    }
  }

  const completedCount = goals.filter(
    (goal) => goal.is_completed,
  ).length;

  return (
    <section>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm text-slate-500">Planning</p>

          <h2 className="mt-1 text-3xl font-bold">
            Goals
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            {completedCount} of {goals.length} goals completed
          </p>
        </div>
        <HistoryIconLink section="goals" />
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      <form
        onSubmit={handleCreate}
        className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-6"
      >
        <div className="flex items-center gap-2">
          <Plus size={18} />
          <h3 className="font-semibold">Create a goal</h3>
        </div>

        <div className="mt-5 grid gap-4">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Goal title"
            className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
          />

          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Description (optional)"
            rows={3}
            className="resize-none rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-400">Measurable target (optional)
              <input type="number" min="0.01" step="any" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)} placeholder="e.g. 100" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600" />
            </label>
            <label className="text-sm text-slate-400">Unit
              <input maxLength={40} value={unit} onChange={(event) => setUnit(event.target.value)} placeholder="hours, pages, km…" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none placeholder:text-slate-600" />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="text-sm text-slate-400">
              Start date
              <input
                required
                type="date"
                value={startDate}
                onChange={(event) => {
                  const nextStartDate = event.target.value;
                  setStartDate(nextStartDate);
                  if (targetDate && targetDate < nextStartDate) {
                    setTargetDate("");
                    setTargetTime("23:59");
                  }
                }}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-white/30"
              />
            </label>

            <label className="text-sm text-slate-400">
              Target completion date
              <input
                type="date"
                min={startDate}
                value={targetDate}
                onChange={(event) => setTargetDate(event.target.value)}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-white/30"
              />
            </label>

            <label className="text-sm text-slate-400">
              Target completion time
              <input
                type="time"
                value={targetTime}
                onChange={(event) => setTargetTime(event.target.value)}
                disabled={!targetDate}
                className="mt-2 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-white outline-none focus:border-white/30 disabled:opacity-50"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="justify-self-start rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Creating..." : "Create Goal"}
          </button>
        </div>
      </form>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
            Loading goals...
          </div>
        ) : goals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
            <p className="font-medium">No goals yet</p>

            <p className="mt-2 text-sm text-slate-500">
              Create your first goal above.
            </p>
          </div>
        ) : (
          goals.map((goal) => (
            <div
              key={goal.id}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    {goal.target_amount == null && <button
                      type="button"
                      onClick={() => toggleComplete(goal)}
                      className={[
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition",
                        goal.is_completed
                          ? "border-white bg-white text-slate-950"
                          : "border-white/20 text-transparent hover:border-white/50",
                      ].join(" ")}
                    >
                      <Check size={16} />
                    </button>}
                    {goal.target_amount != null && <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-slate-500" title="Measured goals are completed through recorded progress">{goal.is_completed ? <Check size={16} /> : <Circle size={14} />}</span>}

                    <h3
                      className={[
                        "truncate text-lg font-semibold",
                        goal.is_completed
                          ? "text-slate-500 line-through"
                          : "text-white",
                      ].join(" ")}
                    >
                      {goal.title}
                    </h3>
                  </div>

                  {goal.description && (
                    <p className="mt-3 text-sm text-slate-400">
                      {goal.description}
                    </p>
                  )}

                  <div className="mt-3 space-y-1 text-xs text-slate-500">
                    <p>
                      Started: {formatDate(goal.start_date ?? goal.created_at.slice(0, 10))}
                    </p>
                    {goal.target_date && (
                      <p>
                        Target: {formatDate(goal.target_date)}
                        {goal.target_time ? ` · ${formatTime(goal.target_time)}` : ""}
                      </p>
                    )}
                    {goal.is_completed && goal.completed_at && (
                      <p className="font-medium text-emerald-600">
                        Completed: {formatCompletedAt(goal.completed_at)}
                      </p>
                    )}
                  </div>
                </div>

                <SectionOptionsMenu label={`Options for ${goal.title}`}>
                    <Link to={`/goals/${goal.id}/details`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Goal details</Link>
                    <Link to={`/goals/${goal.id}/add`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Add progress</Link>
                    <Link to={`/goals/${goal.id}/daily`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Daily progress</Link>
                    <Link to={`/goals/${goal.id}/history`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Progress history</Link>
                    <Link to="/history/goals" className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Monthly history</Link>
                    <button type="button" onClick={() => setEditingGoal(goal)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06]"><Pencil size={14} /> Edit goal</button>
                    <button type="button" onClick={() => void deleteGoal(goal)} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-300/[0.08]"><Trash2 size={14} /> Delete goal</button>
                </SectionOptionsMenu>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Progress
                  </span>

                  <span className="font-medium text-slate-300">
                    {goal.target_amount != null && goal.unit ? `${goal.current_amount ?? 0} / ${goal.target_amount} ${goal.unit} · ` : ""}{goal.progress}%
                  </span>
                </div>

                {goal.target_amount == null && <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={goal.progress}
                  onChange={(event) =>
                    updateProgress(
                      goal,
                      Number(event.target.value),
                    )
                  }
                  className="w-full accent-white"
                />}
              </div>
            </div>
          ))
        )}
      </div>

      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-3 sm:items-center sm:p-4 sm:py-8">
          <form
            onSubmit={saveEdit}
            className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-4 shadow-2xl sm:max-h-[calc(100dvh-4rem)] sm:p-6"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">
                Edit goal
              </h3>

              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-400">
                Goal name
                <input
                  value={editingGoal.title}
                  onChange={(event) =>
                    setEditingGoal({
                      ...editingGoal,
                      title: event.target.value,
                    })
                  }
                  className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                />
              </label>

              <textarea
                value={editingGoal.description || ""}
                onChange={(event) =>
                  setEditingGoal({
                    ...editingGoal,
                    description: event.target.value,
                  })
                }
                rows={4}
                className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm text-slate-400">Target amount (optional)<input type="number" min="0.01" step="any" value={editingGoal.target_amount ?? ""} onChange={(event) => setEditingGoal({ ...editingGoal, target_amount: event.target.value ? Number(event.target.value) : null })} className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white" /></label>
                <label className="text-sm text-slate-400">Unit<input maxLength={40} value={editingGoal.unit ?? ""} onChange={(event) => setEditingGoal({ ...editingGoal, unit: event.target.value || null })} placeholder="hours, pages, km…" className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-600" /></label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm text-slate-400">
                  Start date
                  <input
                    required
                    type="date"
                    value={editingGoal.start_date ?? editingGoal.created_at.slice(0, 10)}
                    onChange={(event) =>
                      setEditingGoal((current) => {
                        if (!current) return current;
                        const nextStartDate = event.target.value;
                        return {
                          ...current,
                          start_date: nextStartDate,
                          target_date: current.target_date && current.target_date < nextStartDate
                            ? null
                            : current.target_date,
                          target_time: current.target_date && current.target_date < nextStartDate
                            ? null
                            : current.target_time,
                        };
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                  />
                </label>

                <label className="block text-sm text-slate-400">
                  Target completion date
                  <input
                    type="date"
                    min={editingGoal.start_date ?? editingGoal.created_at.slice(0, 10)}
                    value={editingGoal.target_date || ""}
                    onChange={(event) =>
                      setEditingGoal({
                        ...editingGoal,
                        target_date: event.target.value || null,
                        target_time: event.target.value
                          ? editingGoal.target_time
                          : null,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
                  />
                </label>

                <label className="block text-sm text-slate-400 sm:col-span-2">
                  Target completion time
                  <input
                    type="time"
                    disabled={!editingGoal.target_date}
                    value={editingGoal.target_time?.slice(0, 5) ?? ""}
                    onChange={(event) =>
                      setEditingGoal({
                        ...editingGoal,
                        target_time: event.target.value || null,
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none focus:border-white/30 disabled:opacity-50"
                  />
                </label>
              </div>

              {editingGoal.target_amount == null && <div>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-slate-400">
                    Progress
                  </span>

                  <span>
                    {editingGoal.progress}%
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={editingGoal.progress}
                  onChange={(event) =>
                    setEditingGoal({
                      ...editingGoal,
                      progress: Number(event.target.value),
                    })
                  }
                  className="w-full accent-white"
                />
              </div>}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingGoal(null)}
                className="rounded-xl px-4 py-3 text-sm text-slate-400 hover:bg-white/5 hover:text-white"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
