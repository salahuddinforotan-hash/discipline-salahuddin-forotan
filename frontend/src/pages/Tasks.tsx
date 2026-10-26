import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import { Check, Circle, Pencil, Plus, Trash2, X } from "lucide-react";
import { api } from "../services/api";
import type {
  CreateTaskInput,
  Task,
  UpdateTaskInput,
} from "../services/api";

export default function Tasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");

  async function loadTasks() {
    try {
      setLoading(true);
      setError("");

      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load tasks.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTasks();
  }, []);

  function resetForm() {
    setTitle("");
    setDescription("");
    setDueDate("");
    setEditingTask(null);
    setShowForm(false);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function openEditForm(task: Task) {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setDueDate(task.due_date ?? "");
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }

    try {
      setError("");

      const data: CreateTaskInput = {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
      };

      if (editingTask) {
        const updateData: UpdateTaskInput = data;

        const updated = await api.updateTask(
          editingTask.id,
          updateData,
        );

        setTasks((current) =>
          current.map((task) =>
            task.id === updated.id ? updated : task,
          ),
        );
      } else {
        const created = await api.createTask(data);
        setTasks((current) => [created, ...current]);
      }

      resetForm();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save task.",
      );
    }
  }

  async function toggleTask(task: Task) {
    try {
      const updated = await api.updateTask(task.id, {
        is_completed: !task.is_completed,
      });

      setTasks((current) =>
        current.map((item) =>
          item.id === updated.id ? updated : item,
        ),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update task.",
      );
    }
  }

  async function deleteTask(task: Task) {
    if (!window.confirm(`Delete "${task.title}"?`)) {
      return;
    }

    try {
      await api.deleteTask(task.id);

      setTasks((current) =>
        current.filter((item) => item.id !== task.id),
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete task.",
      );
    }
  }

  const completedCount = useMemo(
    () => tasks.filter((task) => task.is_completed).length,
    [tasks],
  );

  const remainingCount = tasks.length - completedCount;

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">Execution</p>
          <h2 className="mt-1 text-3xl font-bold">Tasks</h2>
          <p className="mt-2 text-sm text-slate-400">
            Turn your priorities into concrete actions.
          </p>
        </div>

        <button
          onClick={openCreateForm}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
        >
          <Plus size={18} />
          New task
        </button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Total</p>
          <p className="mt-2 text-3xl font-bold">{tasks.length}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Remaining</p>
          <p className="mt-2 text-3xl font-bold">{remainingCount}</p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-slate-400">Completed</p>
          <p className="mt-2 text-3xl font-bold">{completedCount}</p>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-sm text-slate-500">
          Loading tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-white/10 bg-white/[0.03] p-10 text-center">
          <p className="text-lg font-semibold">No tasks yet</p>
          <p className="mt-2 text-sm text-slate-500">
            Create your first task and start executing.
          </p>

          <button
            onClick={openCreateForm}
            className="mt-5 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
          >
            Create your first task
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={[
                "rounded-2xl border p-5 transition",
                task.is_completed
                  ? "border-white/5 bg-white/[0.03]"
                  : "border-white/10 bg-white/5",
              ].join(" ")}
            >
              <div className="flex items-start gap-4">
                <button
                  onClick={() => toggleTask(task)}
                  className="mt-1 shrink-0 text-slate-400 transition hover:text-white"
                  aria-label={
                    task.is_completed
                      ? "Mark task incomplete"
                      : "Mark task complete"
                  }
                >
                  {task.is_completed ? (
                    <Check size={22} />
                  ) : (
                    <Circle size={22} />
                  )}
                </button>

                <div className="min-w-0 flex-1">
                  <h3
                    className={[
                      "font-semibold",
                      task.is_completed
                        ? "text-slate-500 line-through"
                        : "text-white",
                    ].join(" ")}
                  >
                    {task.title}
                  </h3>

                  {task.description && (
                    <p className="mt-1 text-sm text-slate-500">
                      {task.description}
                    </p>
                  )}

                  {task.due_date && (
                    <p className="mt-3 text-xs text-slate-500">
                      Due {task.due_date}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <button
                    onClick={() => openEditForm(task)}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-white/10 hover:text-white"
                    aria-label="Edit task"
                  >
                    <Pencil size={16} />
                  </button>

                  <button
                    onClick={() => deleteTask(task)}
                    className="rounded-lg p-2 text-slate-500 transition hover:bg-red-500/10 hover:text-red-300"
                    aria-label="Delete task"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">
                  {editingTask ? "Edit task" : "New task"}
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Define exactly what needs to be done.
                </p>
              </div>

              <button
                onClick={resetForm}
                className="rounded-lg p-2 text-slate-500 hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Title
                </label>

                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Finish project proposal"
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Description
                </label>

                <textarea
                  value={description}
                  onChange={(event) =>
                    setDescription(event.target.value)
                  }
                  placeholder="Optional details..."
                  rows={4}
                  className="w-full resize-none rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none placeholder:text-slate-600 focus:border-white/30"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm text-slate-400">
                  Due date
                </label>

                <input
                  type="date"
                  value={dueDate}
                  onChange={(event) =>
                    setDueDate(event.target.value)
                  }
                  className="w-full rounded-xl border border-white/10 bg-slate-950 px-4 py-3 text-sm outline-none focus:border-white/30"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/5"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-slate-200"
                >
                  {editingTask ? "Save changes" : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
