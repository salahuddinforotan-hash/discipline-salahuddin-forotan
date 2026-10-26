import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Flame,
  Pause,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";

import { api } from "../services/api";
import HistoryIconLink from "../components/history/HistoryIconLink";
import { readCachedAppSettings } from "../services/preferences";
import SectionOptionsMenu from "../components/SectionOptionsMenu";
import { formatConfiguredDate } from "../services/solarHijri";

import type {
  CreateHabitInput,
  Habit,
  HabitCompletion,
} from "../services/api";

function getTodayString() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCompletionDate(dateString: string) {
  return formatConfiguredDate(dateString);
}

function startOfWeek(dateString: string) {
  const date = new Date(`${dateString}T12:00:00Z`);
  const weekOffset = readCachedAppSettings().date_calendar.week_start === "sunday" ? 0 : 1;
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() - weekOffset + 7) % 7));
  return date.toISOString().slice(0, 10);
}

function dayOrdinal(day: number) {
  const remainder = day % 100;
  const suffix = remainder >= 11 && remainder <= 13
    ? "th"
    : day % 10 === 1
      ? "st"
      : day % 10 === 2
        ? "nd"
        : day % 10 === 3
          ? "rd"
          : "th";
  return `${day}${suffix}`;
}

function completedThisPeriod(
  frequency: Habit["frequency"],
  completions: HabitCompletion[],
  today: string,
) {
  return completions.some((completion) => {
    if (frequency === "daily") return completion.completion_date === today;
    if (frequency === "monthly") return completion.completion_date.slice(0, 7) === today.slice(0, 7);
    return completion.completion_date >= startOfWeek(today)
      && completion.completion_date <= today;
  });
}

function Habits() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [completionMap, setCompletionMap] = useState<
    Record<number, HabitCompletion[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState<Habit["frequency"]>("daily");
  const [reminderTime, setReminderTime] = useState("20:00");
  const [dayOfMonth, setDayOfMonth] = useState(String(new Date().getDate()));
  const [trackingType, setTrackingType] = useState<Habit["tracking_type"]>("yes_no");
  const [dailyTarget, setDailyTarget] = useState("");
  const [targetUnit, setTargetUnit] = useState("");

  const today = getTodayString();

  async function loadHabits() {
    try {
      setLoading(true);
      setError("");

      const data = await api.getHabits();
      setHabits(data);

      const completionEntries = await Promise.all(
        data.map(async (habit) => {
          try {
            const completions = await api.getHabitCompletions(habit.id);
            return [habit.id, completions] as const;
          } catch {
            return [habit.id, []] as const;
          }
        }),
      );

      setCompletionMap(Object.fromEntries(completionEntries));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load habits.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHabits();
  }, []);

  const activeHabits = useMemo(
    () => habits.filter((habit) => habit.is_active),
    [habits],
  );

  const completedToday = useMemo(
    () =>
      habits.filter((habit) =>
        (completionMap[habit.id] ?? []).some(
          (completion) => completion.completion_date === today,
        ),
      ).length,
    [habits, completionMap, today],
  );

  const completionRate = habits.length
    ? Math.round((completedToday / habits.length) * 100)
    : 0;

  function openCreateModal() {
    setEditingHabit(null);
    setName("");
    setDescription("");
    setFrequency("daily");
    setReminderTime("20:00");
    setDayOfMonth(String(new Date().getDate()));
    setTrackingType("yes_no");
    setDailyTarget("");
    setTargetUnit("");
    setError("");
    setShowModal(true);
  }

  function openEditModal(habit: Habit) {
    setEditingHabit(habit);
    setName(habit.name);
    setDescription(habit.description ?? "");
    setFrequency(habit.frequency);
    setReminderTime(habit.reminder_time?.slice(0, 5) ?? "20:00");
    setDayOfMonth(String(habit.day_of_month ?? new Date().getDate()));
    setTrackingType(habit.tracking_type ?? "yes_no");
    setDailyTarget(habit.daily_target == null ? "" : String(habit.daily_target));
    setTargetUnit(habit.target_unit ?? "");
    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingHabit(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!name.trim()) {
      setError("Habit name is required.");
      return;
    }

    if (
      frequency === "monthly"
      && (!Number.isInteger(Number(dayOfMonth)) || Number(dayOfMonth) < 1 || Number(dayOfMonth) > 31)
    ) {
      setError("Choose a day from 1 to 31 for a monthly habit.");
      return;
    }
    if (trackingType === "measurable" && (Number(dailyTarget) <= 0 || !targetUnit.trim())) {
      setError("Measurable habits need a daily target and unit.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload: CreateHabitInput = {
        name: name.trim(),
        description: description.trim() || null,
        frequency,
        reminder_time: reminderTime || null,
        day_of_month: frequency === "monthly" ? Number(dayOfMonth) : null,
        tracking_type: trackingType,
        daily_target: trackingType === "measurable" ? Number(dailyTarget) : null,
        target_unit: trackingType === "measurable" ? targetUnit.trim() : null,
      };

      if (editingHabit) {
        await api.updateHabit(editingHabit.id, payload);
      } else {
        await api.createHabit(payload);
      }

      closeModal();
      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save habit.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleComplete(habit: Habit) {
    try {
      setError("");

      const habitCompletions = completionMap[habit.id] ?? [];
      const isCompletedToday = habitCompletions.some(
        (completion) => completion.completion_date === today,
      );
      if (!isCompletedToday && completedThisPeriod(habit.frequency, habitCompletions, today)) return;

      if (isCompletedToday) {
        await api.uncompleteHabit(habit.id);
      } else {
        await api.completeHabit(habit.id);
      }

      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update habit completion.",
      );
    }
  }

  async function handleToggleActive(habit: Habit) {
    try {
      setError("");

      await api.updateHabit(habit.id, {
        is_active: !habit.is_active,
      });

      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to update habit status.",
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
      await loadHabits();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete habit.",
      );
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-500">Loading habits...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Habits</h1>
          <p className="mt-1 text-sm text-slate-400">
            Build consistency through small actions every day.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <HistoryIconLink section="habits" />
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200"
          >
            <Plus size={17} />
            New habit
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-4 py-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-orange-300/10 p-2 text-orange-200">
              <Flame size={19} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Active habits</p>
              <p className="text-2xl font-bold text-white">
                {activeHabits.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-300/10 p-2 text-emerald-200">
              <Check size={19} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Completed today</p>
              <p className="text-2xl font-bold text-white">
                {completedToday}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-300/10 p-2 text-sky-200">
              <Flame size={19} />
            </div>
            <div>
              <p className="text-sm text-slate-400">Today's rate</p>
              <p className="text-2xl font-bold text-white">
                {completionRate}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
          <Flame className="mx-auto text-slate-500" size={36} />
          <h2 className="mt-4 text-lg font-semibold text-white">
            No habits yet
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Create your first habit and start building consistency.
          </p>

          <button
            type="button"
            onClick={openCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-200"
          >
            <Plus size={17} />
            Create habit
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {habits.map((habit) => {
            const completions = completionMap[habit.id] ?? [];
            const completedTodayForHabit = completions.some(
              (completion) => completion.completion_date === today,
            );
            const completedForPeriod = completedThisPeriod(
              habit.frequency,
              completions,
              today,
            );
            const reminder = habit.reminder_time?.slice(0, 5) ?? "20:00";

            return (
              <div
                key={habit.id}
                className={`rounded-2xl border bg-white/[0.035] p-5 ${
                  habit.is_active
                    ? "border-white/[0.08]"
                    : "border-white/[0.06] opacity-65"
                }`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {habit.name}
                      </h2>

                      <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2.5 py-1 text-xs font-medium capitalize text-slate-300">
                        {habit.frequency}
                      </span>

                      {!habit.is_active && (
                        <span className="rounded-full border border-amber-300/15 bg-amber-300/[0.08] px-2.5 py-1 text-xs font-medium text-amber-200">
                          Paused
                        </span>
                      )}
                    </div>

                    {habit.description && (
                      <p className="mt-1 text-sm text-slate-400">
                        {habit.description}
                      </p>
                    )}

                    <p className="mt-2 text-xs text-slate-500">
                      {habit.frequency === "monthly"
                        ? `Every ${dayOrdinal(habit.day_of_month ?? 1)} of the month`
                        : habit.frequency === "weekly"
                          ? "Once per week"
                          : "Every day"}
                      {` · Reminder ${reminder}`}
                    </p>

                    <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                      <span>
                        Current streak:{" "}
                        <strong className="text-slate-100">
                          {habit.current_streak}
                        </strong>
                      </span>

                      <span>
                        Longest streak:{" "}
                        <strong className="text-slate-100">
                          {habit.longest_streak}
                        </strong>
                      </span>

                      <span>
                        Completions:{" "}
                        <strong className="text-slate-100">
                          {completions.length}
                        </strong>
                      </span>
                    </div>

                    {completions.length > 0 && (
                      <div className="mt-4">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Recent completions
                        </p>

                        <div className="flex flex-wrap gap-2">
                          {completions.slice(-5).reverse().map((completion) => (
                            <span
                              key={completion.id}
                              className="rounded-lg border border-emerald-300/10 bg-emerald-300/[0.07] px-2.5 py-1.5 text-xs text-emerald-200"
                            >
                              {formatCompletionDate(
                                completion.completion_date,
                              )}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {habit.tracking_type === "measurable" ? <Link to={`/habits/${habit.id}/today`} className="inline-flex items-center gap-2 rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-indigo-200"><Plus size={16} />Record today’s amount</Link> : <button
                      type="button"
                      onClick={() => void handleToggleComplete(habit)}
                      disabled={!habit.is_active || (completedForPeriod && !completedTodayForHabit)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                        completedForPeriod
                          ? "border border-emerald-300/15 bg-emerald-300/[0.08] text-emerald-200 hover:bg-emerald-300/[0.14]"
                          : "bg-indigo-300 text-slate-950 hover:bg-indigo-200"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <Check size={17} />
                      {completedForPeriod
                        ? `Completed ${habit.frequency === "daily" ? "today" : `this ${habit.frequency === "weekly" ? "week" : "month"}`}`
                        : `Complete ${habit.frequency === "daily" ? "today" : `this ${habit.frequency === "weekly" ? "week" : "month"}`}`}
                    </button>}

                    <div className="relative">
                      <SectionOptionsMenu label={`Options for ${habit.name}`}>
                          <Link to={`/habits/${habit.id}/today`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Today’s progress</Link>
                          <Link to={`/habits/${habit.id}/history`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">History</Link>
                          <Link to={`/habits/${habit.id}/stats`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Statistics</Link>
                          <Link to={`/habits/${habit.id}/streak`} className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/[0.06]">Streak</Link>
                          <button
                            type="button"
                            onClick={() => openEditModal(habit)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                          >
                            <Pencil size={15} />
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleActive(habit)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-300 hover:bg-white/[0.06] hover:text-white"
                          >
                            {habit.is_active ? (
                              <>
                                <Pause size={15} />
                                Pause
                              </>
                            ) : (
                              <>
                                <Play size={15} />
                                Resume
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleDelete(habit)}
                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-300 hover:bg-rose-300/[0.08]"
                          >
                            <Trash2 size={15} />
                            Delete
                          </button>
                      </SectionOptionsMenu>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-3 sm:items-center sm:p-4 sm:py-8">
          <div className="my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/50 sm:max-h-[calc(100dvh-4rem)]">
            <div className="flex items-center justify-between border-b border-white/[0.08] px-6 py-4">
              <div>
                <h2 className="text-lg font-bold text-white">
                  {editingHabit ? "Edit habit" : "Create habit"}
                </h2>
                <p className="text-sm text-slate-400">
                  Define a habit you want to repeat consistently.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="habit-name"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Name
                </label>

                <input
                  id="habit-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="e.g. Exercise"
                  maxLength={200}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10"
                  autoFocus
                />
              </div>

              <div>
                <label
                  htmlFor="habit-description"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Description
                </label>

                <textarea
                  id="habit-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Optional description"
                  maxLength={500}
                  rows={3}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none placeholder:text-slate-600 focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10"
                />
              </div>

              <div>
                <label
                  htmlFor="habit-frequency"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Frequency
                </label>

                <select
                  id="habit-frequency"
                  value={frequency}
                  onChange={(event) =>
                    setFrequency(event.target.value as Habit["frequency"])
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              <div>
                <label htmlFor="habit-tracking" className="mb-1.5 block text-sm font-medium text-slate-300">Tracking</label>
                <select id="habit-tracking" value={trackingType} onChange={(event) => setTrackingType(event.target.value as Habit["tracking_type"])} className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-300/40">
                  <option value="yes_no">Yes / No</option><option value="measurable">Measurable amount</option>
                </select>
              </div>
              {trackingType === "measurable" && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm text-slate-300">Daily target<input required type="number" min="0.01" step="any" value={dailyTarget} onChange={(event) => setDailyTarget(event.target.value)} className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-white" /></label><label className="text-sm text-slate-300">Unit<input required maxLength={40} value={targetUnit} onChange={(event) => setTargetUnit(event.target.value)} placeholder="pages, km, minutes…" className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-white placeholder:text-slate-600" /></label></div>}

              {frequency === "monthly" && (
                <div>
                  <label
                    htmlFor="habit-day-of-month"
                    className="mb-1.5 block text-sm font-medium text-slate-300"
                  >
                    Day of month
                  </label>
                  <select
                    id="habit-day-of-month"
                    required
                    value={dayOfMonth}
                    onChange={(event) => setDayOfMonth(event.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10"
                  >
                    {Array.from({ length: 31 }, (_, index) => index + 1).map((day) => (
                      <option key={day} value={day}>{dayOrdinal(day)}</option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Shorter months use their last calendar day.
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="habit-reminder-time"
                  className="mb-1.5 block text-sm font-medium text-slate-300"
                >
                  Reminder time
                </label>
                <input
                  id="habit-reminder-time"
                  required
                  type="time"
                  value={reminderTime}
                  onChange={(event) => setReminderTime(event.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-slate-950/60 px-3.5 py-2.5 text-sm text-white outline-none focus:border-indigo-300/40 focus:ring-2 focus:ring-indigo-300/10"
                />
              </div>

              {error && (
                <div role="alert" className="rounded-xl border border-rose-300/20 bg-rose-300/[0.08] px-3 py-2 text-sm text-rose-200">
                  {error}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-white/[0.05] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-indigo-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-indigo-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingHabit
                      ? "Save changes"
                      : "Create habit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Habits;
