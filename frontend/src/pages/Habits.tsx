import { useEffect, useState } from "react";
import {
  Flame,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";

import { api,
  CreateHabitInput,
  Habit,
  HabitCompletion,
} from "../services/api";

type HabitForm = {
  name: string;
  description: string;
  frequency: "daily" | "weekly";
};

const emptyForm: HabitForm = {
  name: "",
  description: "",
  frequency: "daily",
};

function formatDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completedToday, setCompletedToday] = useState<Set<number>>(
    new Set(),
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [openMenu, setOpenMenu] = useState<number | null>(null);

  const [form, setForm] = useState<HabitForm>(emptyForm);

  async function loadHabits() {
    try {
      setLoading(true);
      setError("");

      const data = await api.getHabits();
      setHabits(data);

      const todaySet = new Set<number>();

      await Promise.all(
        data.map(async (habit) => {
          try {
            const completions = await api.getHabitCompletions(habit.id);

            const today = new Date().toISOString().slice(0, 10);

            if (
              completions.some(
                (completion: HabitCompletion) =>
                  completion.completion_date === today,
              )
            ) {
              todaySet.add(habit.id);
            }
          } catch {
            // Keep the habit visible even if completion history fails.
          }
        }),
      );

      setCompletedToday(todaySet);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load habits.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHabits();
  }, []);

  function openCreateModal() {
    setEditingHabit(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEditModal(habit: Habit) {
    setEditingHabit(habit);
    setForm({
      name: habit.name,
      description: habit.description ?? "",
      frequency: habit.frequency,
    });
    setOpenMenu(null);
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;

    setShowModal(false);
    setEditingHabit(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      setError("Habit name is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload: CreateHabitInput = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        frequency: form.frequency,
      };

      if (editingHabit) {
        await api.updateHabit(editingHabit.id, payload);
      } else {
        await api.createHabit(payload);
      }

      closeModal();
      await loadHabits();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save habit.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleToday(habit: Habit) {
    try {
      setError("");

      if (completedToday.has(habit.id)) {
        await api.uncompleteHabit(habit.id);

        setCompletedToday((current) => {
          const next = new Set(current);
          next.delete(habit.id);
          return next;
        });
      } else {
        await api.completeHabit(habit.id);

        setCompletedToday((current) => {
          const next = new Set(current);
          next.add(habit.id);
          return next;
        });
      }

      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update habit.",
      );
    }
  }

  async function toggleActive(habit: Habit) {
    try {
      setError("");

      await api.updateHabit(habit.id, {
        is_active: !habit.is_active,
      });

      setOpenMenu(null);
      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update habit.",
      );
    }
  }

  async function handleDelete(habit: Habit) {
    const confirmed = window.confirm(
      `Delete "${habit.name}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      setError("");

      await api.deleteHabit(habit.id);

      setOpenMenu(null);
      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete habit.",
      );
    }
  }

  const activeHabits = habits.filter((habit) => habit.is_active);
  const completedCount = activeHabits.filter((habit) =>
    completedToday.has(habit.id),
  ).length;

  const completionRate =
    activeHabits.length > 0
      ? Math.round((completedCount / activeHabits.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Consistency</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">
            Habits
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Build routines that become automatic.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
        >
          <Plus size={18} />
          New habit
        </button>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError("")}
            className="shrink-0"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Active habits</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {activeHabits.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Completed today</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {completedCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm text-slate-500">Today's rate</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">
            {completionRate}%
          </p>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">
          Loading habits...
        </div>
      ) : habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-500">
            <Flame size={28} />
          </div>

          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            No habits yet
          </h2>

          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Start with one simple habit and build consistency one day at a
            time.
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus size={18} />
            Create your first habit
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {habits.map((habit) => {
            const isDone = completedToday.has(habit.id);

            return (
              <div
                key={habit.id}
                className={`relative rounded-2xl border bg-white p-5 shadow-sm transition ${
                  habit.is_active
                    ? "border-slate-200"
                    : "border-slate-200 opacity-65"
                }`}
              >
                <div className="flex items-start gap-4">
                  <button
                    type="button"
                    onClick={() => toggleToday(habit)}
                    className={`mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isDone
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-slate-300 bg-white text-slate-300 hover:border-emerald-400 hover:text-emerald-400"
                    }`}
                    title={
                      isDone
                        ? "Mark incomplete"
                        : "Mark complete for today"
                    }
                  >
                    {isDone ? "?" : ""}
                  </button>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2
                          className={`text-lg font-semibold ${
                            isDone
                              ? "text-slate-500 line-through"
                              : "text-slate-900"
                          }`}
                        >
                          {habit.name}
                        </h2>

                        {habit.description && (
                          <p className="mt-1 text-sm text-slate-500">
                            {habit.description}
                          </p>
                        )}
                      </div>

                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenMenu(
                              openMenu === habit.id ? null : habit.id,
                            )
                          }
                          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <MoreHorizontal size={20} />
                        </button>

                        {openMenu === habit.id && (
                          <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
                            <button
                              type="button"
                              onClick={() => openEditModal(habit)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            >
                              <RotateCcw size={16} />
                              Edit habit
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleActive(habit)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
                            >
                              {habit.is_active ? (
                                <>
                                  <Pause size={16} />
                                  Pause habit
                                </>
                              ) : (
                                <>
                                  <Play size={16} />
                                  Resume habit
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(habit)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={16} />
                              Delete habit
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium capitalize text-slate-600">
                        {habit.frequency}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                        <Flame size={13} />
                        {habit.current_streak} day streak
                      </span>

                      <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        Best: {habit.longest_streak}
                      </span>

                      {!habit.is_active && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                          Paused
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-xs text-slate-400">
                      Created {formatDate(habit.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  {editingHabit ? "Edit habit" : "New habit"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Keep it simple enough to repeat consistently.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Habit name
                </label>

                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="e.g. Read for 20 minutes"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Optional details"
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Frequency
                </label>

                <select
                  value={form.frequency}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      frequency: event.target.value as "daily" | "weekly",
                    }))
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={saving}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingHabit
                    ? "Save changes"
                    : "Create habit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


