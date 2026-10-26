import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { LocalNotificationSchema } from "@capacitor/local-notifications";

import { api } from "./api";
import type { AppSettings, HabitCompletion } from "./api";

const localNotificationSource = "discipline-planner";
const maximumScheduledDays = 14;
const alarmSoundFile = "discipline_alarm.wav";
const alarmChannelId = "discipline_alarm_v2";
const systemChannelId = "discipline_system_v2";

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function dateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatReminderDate(day: string) {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
    .format(new Date(`${day}T12:00:00`));
}

function dateTime(day: string, time: string) {
  const [year, month, date] = day.split("-").map(Number);
  const [hour, minute] = time.slice(0, 5).split(":").map(Number);
  return new Date(year, month - 1, date, hour, minute, 0, 0);
}

function stableId(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash & 0x7fffffff) || 1;
}

function completionDates(completions: HabitCompletion[]) {
  return new Set(completions.map((completion) => completion.completion_date));
}

function monthCompletion(completions: HabitCompletion[], month: string) {
  return completions.some((completion) => completion.completion_date.startsWith(month));
}

function weekCompletion(completions: HabitCompletion[], date: Date) {
  const monday = new Date(date);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const start = dateString(monday);
  const end = dateString(addDays(monday, 7));
  return completions.some((completion) => completion.completion_date >= start && completion.completion_date < end);
}

function monthOccurrence(year: number, month: number, day: number) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

function reminderEnabled(settings: AppSettings, type: string) {
  if (type.startsWith("task_")) return settings.notifications.late_tasks;
  if (type.startsWith("goal_")) return settings.notifications.goal_deadlines;
  if (type.startsWith("habit_")) return settings.notifications.missed_habits;
  if (type === "journal_reminder") return settings.notifications.journal_reminder;
  return settings.notifications.daily_discipline;
}

export function isNativeNotificationsAvailable() {
  return Capacitor.isNativePlatform();
}

async function ensureNotificationChannels() {
  if (Capacitor.getPlatform() !== "android") return;
  await Promise.all([
    LocalNotifications.createChannel({
      id: alarmChannelId,
      name: "Discipline alarm reminders",
      description: "Audible reminders for tasks, habits, goals, and daily check-ins.",
      importance: 4,
      sound: alarmSoundFile,
      vibration: true,
    }),
    LocalNotifications.createChannel({
      id: systemChannelId,
      name: "Discipline reminders",
      description: "Reminders using the phone's default notification sound.",
      importance: 4,
      vibration: true,
    }),
  ]);
}

function soundOptions(sound: AppSettings["notifications"]["sound"]): Pick<LocalNotificationSchema, "channelId" | "sound"> {
  if (Capacitor.getPlatform() === "android") {
    return sound === "alarm"
      ? { channelId: alarmChannelId, sound: alarmSoundFile }
      : { channelId: systemChannelId };
  }
  return { sound: "default" };
}

export async function testNativeNotificationSound(sound: AppSettings["notifications"]["sound"]) {
  if (!isNativeNotificationsAvailable()) throw new Error("Install the Android app to test phone notification sounds.");
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    const requested = await LocalNotifications.requestPermissions();
    if (requested.display !== "granted") throw new Error("Allow notifications in Android settings before testing the sound.");
  }
  if (Capacitor.getPlatform() === "android") {
    const exactPermission = await LocalNotifications.checkExactNotificationSetting();
    if (exactPermission.exact_alarm !== "granted") {
      await LocalNotifications.changeExactNotificationSetting();
    }
  }
  await ensureNotificationChannels();
  const id = stableId("discipline-sound-test");
  await LocalNotifications.cancel({ notifications: [{ id }] });
  await LocalNotifications.schedule({
    notifications: [{
      id,
      title: "DISCIPLINE · Sound test",
      body: "Your reminder sound is ready.",
      schedule: { at: new Date(Date.now() + 1500) },
      isExactNotification: false,
      ...soundOptions(sound),
      extra: { source: localNotificationSource, key: "sound-test" },
    }],
  });
}

export async function requestNativeNotificationPermission() {
  if (!isNativeNotificationsAvailable()) return { notifications: false, exactAlarms: false };
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return { notifications: false, exactAlarms: false };
  let exactAlarms = true;
  if (Capacitor.getPlatform() === "android") {
    let exactPermission = await LocalNotifications.checkExactNotificationSetting();
    if (exactPermission.exact_alarm !== "granted") {
      exactPermission = await LocalNotifications.changeExactNotificationSetting();
    }
    exactAlarms = exactPermission.exact_alarm === "granted";
  }
  await syncNativeNotifications();
  return { notifications: true, exactAlarms };
}

export async function syncNativeNotifications(settingsOverride?: AppSettings) {
  if (!isNativeNotificationsAvailable()) return;
  const permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted") return;
  await ensureNotificationChannels();
  const exactAlarms = Capacitor.getPlatform() === "android"
    ? (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted"
    : true;

  const today = dateString(new Date());
  const [settings, tasks, goals, habits, journalEntries, disciplineSnapshot] = await Promise.all([
    settingsOverride ? Promise.resolve(settingsOverride) : api.getAppSettings(),
    api.getTasks(),
    api.getGoals(),
    api.getHabits(),
    api.getJournalEntries(today, today).catch(() => []),
    api.getDisciplineSnapshot(today).catch(() => null),
  ]);
  const activeHabits = habits.filter((habit) => habit.is_active);
  const completionResults = await Promise.all(activeHabits.map(async (habit) => {
    try {
      return [habit.id, await api.getHabitCompletions(habit.id)] as const;
    } catch {
      return [habit.id, []] as const;
    }
  }));
  const completions: Record<number, HabitCompletion[]> = Object.fromEntries(completionResults);
  const now = new Date();
  const notifications: LocalNotificationSchema[] = [];

  const schedule = (
    key: string,
    type: string,
    title: string,
    body: string,
    at: Date,
  ) => {
    if (!reminderEnabled(settings, type) || at.getTime() <= now.getTime()) return;
    notifications.push({
      id: stableId(key),
      title: `DISCIPLINE 🔥 · ${title}`,
      body,
      schedule: { at },
      isExactNotification: exactAlarms,
      ...soundOptions(settings.notifications.sound),
      extra: { source: localNotificationSource, key },
    });
  };

  for (const task of tasks) {
    if (task.is_completed || !task.due_date) continue;
    const deadline = dateTime(task.due_date, task.due_time ?? "09:00");
    const dueLabel = ` on ${formatReminderDate(task.due_date)}${task.due_time ? ` at ${task.due_time.slice(0, 5)}` : ""}`;
    const key = `task-${task.id}-${task.due_date}-${task.due_time ?? "all-day"}`;
    schedule(`${key}-upcoming`, "task_upcoming", "Task coming up", `“${task.title}” is due${dueLabel}.`, new Date(deadline.getTime() - 24 * 60 * 60 * 1000));
    schedule(`${key}-due`, "task_due", "Task due", `“${task.title}” is due${dueLabel}.`, deadline);
    const overdueAt = task.due_time
      ? new Date(deadline.getTime() + 5 * 60 * 1000)
      : dateTime(dateString(addDays(new Date(`${task.due_date}T12:00:00`), 1)), "00:00");
    schedule(`${key}-overdue`, "task_overdue", "Task overdue", `“${task.title}” was due${dueLabel}.`, overdueAt);
  }

  for (const goal of goals) {
    if (goal.is_completed || !goal.target_date) continue;
    const deadline = dateTime(goal.target_date, goal.target_time ?? "23:59");
    const targetLabel = ` on ${formatReminderDate(goal.target_date)}${goal.target_time ? ` at ${goal.target_time.slice(0, 5)}` : ""}`;
    const key = `goal-${goal.id}-${goal.target_date}-${goal.target_time ?? "all-day"}`;
    schedule(`${key}-upcoming`, "goal_upcoming", "Goal deadline coming up", `“${goal.title}” is due${targetLabel}.`, new Date(deadline.getTime() - 24 * 60 * 60 * 1000));
    schedule(`${key}-due`, "goal_due", "Goal deadline reached", `“${goal.title}” reaches its target${targetLabel}.`, deadline);
    const overdueAt = goal.target_time
      ? new Date(deadline.getTime() + 5 * 60 * 1000)
      : dateTime(dateString(addDays(new Date(`${goal.target_date}T12:00:00`), 1)), "00:00");
    schedule(`${key}-overdue`, "goal_overdue", "Goal overdue", `“${goal.title}” passed its target${targetLabel}.`, overdueAt);
  }

  for (const habit of activeHabits) {
    const history = completions[habit.id] ?? [];
    const dates = completionDates(history);
    const reminderTime = habit.reminder_time?.slice(0, 5) ?? settings.discipline.reminder_time;
    if (habit.frequency === "daily") {
      for (let offset = 0; offset < maximumScheduledDays; offset += 1) {
        const occurrence = addDays(now, offset);
        const day = dateString(occurrence);
        if (dates.has(day)) continue;
        const key = `habit-${habit.id}-daily-${day}`;
        const reminder = dateTime(day, reminderTime);
        schedule(`${key}-reminder`, "habit_reminder", "Habit reminder", `It’s time for ${habit.name}.`, reminder);
        schedule(`${key}-missed`, "habit_missed", "Habit period missed", `“${habit.name}” was not completed today.`, dateTime(dateString(addDays(occurrence, 1)), "00:00"));
        if (settings.discipline.streak_reminders && habit.current_streak > 0) {
          schedule(`${key}-streak`, "habit_streak", "Keep your streak going", `Complete “${habit.name}” to protect your ${habit.current_streak}-period streak.`, dateTime(day, settings.discipline.reminder_time));
        }
      }
    } else if (habit.frequency === "weekly") {
      for (let offset = 0; offset < maximumScheduledDays; offset += 1) {
        const occurrence = addDays(now, offset);
        if (occurrence.getDay() !== 1 || weekCompletion(history, occurrence)) continue;
        const weekStart = new Date(occurrence);
        const monday = dateString(weekStart);
        const weekEnd = dateString(addDays(weekStart, 7));
        const key = `habit-${habit.id}-weekly-${monday}`;
        schedule(`${key}-reminder`, "habit_reminder", "Habit reminder", `It’s time for ${habit.name} this week.`, dateTime(monday, reminderTime));
        schedule(`${key}-missed`, "habit_missed", "Habit period missed", `“${habit.name}” was not completed this week.`, dateTime(weekEnd, "00:00"));
      }
    } else {
      for (let monthOffset = 0; monthOffset < 2; monthOffset += 1) {
        const monthDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
        const monthKey = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, "0")}`;
        if (monthCompletion(history, monthKey)) continue;
        const day = monthOccurrence(monthDate.getFullYear(), monthDate.getMonth(), habit.day_of_month ?? 1);
        const dayKey = dateString(day);
        const key = `habit-${habit.id}-monthly-${monthKey}`;
        schedule(`${key}-reminder`, "habit_reminder", "Habit reminder", `It’s time for ${habit.name} this month.`, dateTime(dayKey, reminderTime));
        schedule(`${key}-missed`, "habit_missed", "Habit period missed", `“${habit.name}” was not completed this month.`, dateTime(dateString(addDays(day, 1)), "00:00"));
      }
    }
  }

  if (settings.notifications.daily_discipline || settings.notifications.journal_reminder) {
    for (let offset = 0; offset < maximumScheduledDays; offset += 1) {
      const day = dateString(addDays(now, offset));
      if (settings.notifications.daily_discipline && (day !== today || (disciplineSnapshot?.discipline_score ?? 0) < settings.discipline.daily_goal)) {
        schedule(`discipline-${day}`, "daily_discipline", "Daily discipline check-in", "Review your plan and finish one meaningful action.", dateTime(day, settings.discipline.reminder_time));
      }
      if (settings.notifications.journal_reminder && (day !== today || journalEntries.length === 0)) {
        schedule(`journal-${day}`, "journal_reminder", "Journal reminder", "Take a moment to reflect on your day.", dateTime(day, settings.discipline.reminder_time));
      }
    }
  }

  const pending = await LocalNotifications.getPending();
  const owned = pending.notifications.filter((notification) => notification.extra?.source === localNotificationSource);
  if (owned.length) {
    await LocalNotifications.cancel({ notifications: owned.map((notification) => ({ id: notification.id })) });
  }
  if (notifications.length) {
    await LocalNotifications.schedule({ notifications });
  }
}
