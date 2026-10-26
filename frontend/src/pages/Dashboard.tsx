import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  Target,
  ListTodo,
  Plus,
  TrendingUp,
} from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import type { Goal, Task } from "../services/api";

export default function Dashboard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const [taskData, goalData] = await Promise.all([
        api.getTasks(),
        api.getGoals(),
      ]);

      setTasks(taskData);
      setGoals(goalData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const completedTasks = useMemo(
    () => tasks.filter((task) => task.is_completed).length,
    [tasks],
  );

  const remainingTasks = tasks.length - completedTasks;

  const completedGoals = useMemo(
    () => goals.filter((goal) => goal.is_completed).length,
    [goals],
  );

  const averageGoalProgress = useMemo(() => {
    if (goals.length === 0) {
      return 0;
    }

    const total = goals.reduce(
      (sum, goal) => sum + goal.progress,
      0,
    );

    return Math.round(total / goals.length);
  }, [goals]);

  const today = new Date().toISOString().split("T")[0];

  const todayTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          task.due_date === today &&
          !task.is_completed,
      ),
    [tasks, today],
  );

  const recentTasks = tasks.slice(0, 5);
  const activeGoals = goals
    .filter((goal) => !goal.is_completed)
    .slice(0, 4);

  const taskCompletionRate =
    tasks.length === 0
      ? 0
      : Math.round((completedTasks / tasks.length) * 100);

  return (
    <section>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-slate-500">
            Personal operating system
          </p>

          <h2 className="mt-1 text-3xl font-bold tracking-tight">
            Dashboard
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Your current execution overview.
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            to="/tasks"
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-slate-300 transition hover:bg-white/5 hover:text-white"
          >
            <ListTodo size={17} />
            Tasks
          </Link>

          <Link
            to="/goals"
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-200"
          >
            <Plus size={17} />
            Goal
          </Link>
        </div>
      </div>

      {error && (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-500">
          Loading your dashboard...
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Total tasks
                </p>

                <ListTodo
                  size={18}
                  className="text-slate-500"
                />
              </div>

              <p className="mt-3 text-3xl font-bold">
                {tasks.length}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {remainingTasks} remaining
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Task completion
                </p>

                <CheckCircle2
                  size={18}
                  className="text-slate-500"
                />
              </div>

              <p className="mt-3 text-3xl font-bold">
                {taskCompletionRate}%
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {completedTasks} completed
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Active goals
                </p>

                <Target
                  size={18}
                  className="text-slate-500"
                />
              </div>

              <p className="mt-3 text-3xl font-bold">
                {goals.length - completedGoals}
              </p>

              <p className="mt-2 text-xs text-slate-500">
                {completedGoals} completed
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-400">
                  Goal progress
                </p>

                <TrendingUp
                  size={18}
                  className="text-slate-500"
                />
              </div>

              <p className="mt-3 text-3xl font-bold">
                {averageGoalProgress}%
              </p>

              <p className="mt-2 text-xs text-slate-500">
                Average across goals
              </p>
            </div>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    Today's tasks
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Tasks due today
                  </p>
                </div>

                <Link
                  to="/tasks"
                  className="text-slate-500 transition hover:text-white"
                >
                  <ArrowRight size={18} />
                </Link>
              </div>

              <div className="mt-5 space-y-3">
                {todayTasks.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                    <p className="text-sm text-slate-400">
                      No unfinished tasks due today.
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      You're clear for today.
                    </p>
                  </div>
                ) : (
                  todayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 rounded-xl border border-white/10 bg-slate-950/50 p-4"
                    >
                      <Circle
                        size={18}
                        className="shrink-0 text-slate-500"
                      />

                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {task.title}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">
                    Active goals
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    Current objectives
                  </p>
                </div>

                <Link
                  to="/goals"
                  className="text-slate-500 transition hover:text-white"
                >
                  <ArrowRight size={18} />
                </Link>
              </div>

              <div className="mt-5 space-y-4">
                {activeGoals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/10 p-5 text-center">
                    <p className="text-sm text-slate-400">
                      No active goals.
                    </p>

                    <Link
                      to="/goals"
                      className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-white hover:underline"
                    >
                      Create a goal
                      <ArrowRight size={15} />
                    </Link>
                  </div>
                ) : (
                  activeGoals.map((goal) => (
                    <div key={goal.id}>
                      <div className="flex items-center justify-between gap-4">
                        <span className="min-w-0 truncate text-sm font-medium text-slate-200">
                          {goal.title}
                        </span>

                        <span className="shrink-0 text-xs text-slate-500">
                          {goal.progress}%
                        </span>
                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-white transition-all"
                          style={{
                            width: `${goal.progress}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">
                  Recent tasks
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Your latest execution activity
                </p>
              </div>

              <Link
                to="/tasks"
                className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
              >
                View all
                <ArrowRight size={15} />
              </Link>
            </div>

            <div className="mt-5 divide-y divide-white/5">
              {recentTasks.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-500">
                  No tasks yet.
                </div>
              ) : (
                recentTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-4 py-4"
                  >
                    {task.is_completed ? (
                      <CheckCircle2
                        size={19}
                        className="shrink-0 text-slate-500"
                      />
                    ) : (
                      <Circle
                        size={19}
                        className="shrink-0 text-slate-600"
                      />
                    )}

                    <div className="min-w-0 flex-1">
                      <p
                        className={[
                          "truncate text-sm font-medium",
                          task.is_completed
                            ? "text-slate-500 line-through"
                            : "text-slate-200",
                        ].join(" ")}
                      >
                        {task.title}
                      </p>

                      {task.due_date && (
                        <p className="mt-1 text-xs text-slate-600">
                          Due {task.due_date}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-slate-600">
                      {task.is_completed
                        ? "Completed"
                        : "Open"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
