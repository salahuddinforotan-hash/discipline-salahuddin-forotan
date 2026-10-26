import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../services/api";
import type { Goal } from "../services/api";

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState("");
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

    try {
      setSaving(true);
      setError("");

      const goal = await api.createGoal({
        title: title.trim(),
        description: description.trim() || null,
        target_date: targetDate || null,
      });

      setGoals((current) => [goal, ...current]);
      setTitle("");
      setDescription("");
      setTargetDate("");
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

    try {
      setSaving(true);
      setError("");

      const updated = await api.updateGoal(editingGoal.id, {
        title: editingGoal.title.trim(),
        description: editingGoal.description,
        target_date: editingGoal.target_date,
        progress: editingGoal.progress,
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

          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              type="date"
              value={targetDate}
              onChange={(event) => setTargetDate(event.target.value)}
              className="rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-white/30"
            />

            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Creating..." : "Create Goal"}
            </button>
          </div>
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
                    <button
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
                    </button>

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

                  {goal.target_date && (
                    <p className="mt-3 text-xs text-slate-500">
                      Target: {goal.target_date}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setEditingGoal(goal)}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
                    title="Edit goal"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteGoal(goal)}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                    title="Delete goal"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex items-center justify-between text-xs">
                  <span className="text-slate-500">
                    Progress
                  </span>

                  <span className="font-medium text-slate-300">
                    {goal.progress}%
                  </span>
                </div>

                <input
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
                />
              </div>
            </div>
          ))
        )}
      </div>

      {editingGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <form
            onSubmit={saveEdit}
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-950 p-6 shadow-2xl"
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
              <input
                value={editingGoal.title}
                onChange={(event) =>
                  setEditingGoal({
                    ...editingGoal,
                    title: event.target.value,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
              />

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

              <input
                type="date"
                value={editingGoal.target_date || ""}
                onChange={(event) =>
                  setEditingGoal({
                    ...editingGoal,
                    target_date: event.target.value || null,
                  })
                }
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm outline-none focus:border-white/30"
              />

              <div>
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
              </div>
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
