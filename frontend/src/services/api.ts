import { Capacitor } from "@capacitor/core";

// Browser traffic stays on the frontend origin and is proxied by Vercel.
// Capacitor cannot use that Vercel rewrite, so native builds call the API URL
// supplied at build time.
const API_BASE_URL = Capacitor.isNativePlatform()
  ? (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "")
  : "";

export const appDataUpdatedEventName = "discipline:data-updated";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  if (!API_BASE_URL && Capacitor.isNativePlatform()) {
    throw new Error("Set VITE_API_BASE_URL to your deployed HTTPS Discipline API before building the Android app.");
  }
  const token = getToken();

  const headers = new Headers(options.headers);
  headers.set("Content-Type", "application/json");

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    if (
      response.status === 401 &&
      token &&
      localStorage.getItem("access_token") === token
    ) {
      localStorage.removeItem("access_token");
      if (window.location.pathname !== "/login") {
        window.location.assign("/login");
      }
    }

    let message = `Request to ${path} failed with status ${response.status}`;

    try {
      const data = await response.json();

      if (typeof data.detail === "string") {
        message = data.detail;
      }
    } catch {
      // Keep the default error.
    }

    throw new Error(message);
  }

  const result = await response.json();
  if (
    token &&
    options.method &&
    options.method.toUpperCase() !== "GET" &&
    !path.startsWith("/api/notifications/") &&
    path !== "/api/account/delete"
  ) {
    window.dispatchEvent(new Event(appDataUpdatedEventName));
  }
  return result;
}

async function uploadRequest<T>(path: string, body: FormData): Promise<T> {
  if (!API_BASE_URL && Capacitor.isNativePlatform()) {
    throw new Error("Set VITE_API_BASE_URL to your deployed HTTPS Discipline API before importing a bank statement.");
  }
  const token = getToken();
  const headers = new Headers();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`${API_BASE_URL}${path}`, { method: "POST", headers, body });
  if (!response.ok) {
    let message = `Request to ${path} failed with status ${response.status}`;
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch { /* Keep the default error. */ }
    throw new Error(message);
  }
  const result = await response.json() as T;
  if (token) window.dispatchEvent(new Event(appDataUpdatedEventName));
  return result;
}


export interface Task {
  id: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  completed_at?: string | null;
  due_date: string | null;
  due_time?: string | null;
  created_at: string;
  user_id: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
  due_time?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  is_completed?: boolean;
  due_date?: string | null;
  due_time?: string | null;
}

export interface AuthUser {
  id: number;
  email: string;
  full_name: string;
  is_active?: boolean;
}

export interface LoginResponse {
  message: string;
  access_token: string;
  token_type: string;
  user: AuthUser;
}

export interface RegisterInput {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface Goal {
  id: number;
  title: string;
  description: string | null;
  start_date?: string | null;
  target_date: string | null;
  target_time?: string | null;
  target_amount?: number | null;
  current_amount?: number | null;
  unit?: string | null;
  progress: number;
  is_completed: boolean;
  completed_at?: string | null;
  created_at: string;
  user_id: number;
}

export interface CreateGoalInput {
  title: string;
  description?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  target_time?: string | null;
  target_amount?: number | null;
  unit?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  start_date?: string | null;
  target_date?: string | null;
  target_time?: string | null;
  target_amount?: number | null;
  unit?: string | null;
  progress?: number;
  is_completed?: boolean;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly" | "monthly";
  reminder_time?: string | null;
  day_of_month?: number | null;
  tracking_type: "yes_no" | "measurable";
  daily_target: number | null;
  target_unit: string | null;
  is_active: boolean;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  user_id: number;
}

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  frequency: "daily" | "weekly" | "monthly";
  reminder_time?: string | null;
  day_of_month?: number | null;
  tracking_type?: "yes_no" | "measurable";
  daily_target?: number | null;
  target_unit?: string | null;
}

export interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  frequency?: "daily" | "weekly" | "monthly";
  reminder_time?: string | null;
  day_of_month?: number | null;
  is_active?: boolean;
  tracking_type?: "yes_no" | "measurable";
  daily_target?: number | null;
  target_unit?: string | null;
}

export interface HabitCompletion {
  id: number;
  habit_id: number;
  completion_date: string;
  created_at: string;
}

export interface GoalProgressEntry {
  id: number;
  goal_id: number;
  amount: number;
  unit: string;
  entry_date: string;
  note: string | null;
  created_at: string;
}

export interface HabitProgressEntry {
  id: number;
  habit_id: number;
  amount: number;
  unit: string;
  entry_date: string;
  note: string | null;
  created_at: string;
}

export interface SolarHistoryMonth {
  solar_year: number;
  solar_month: number;
  month_name: string;
}

export interface TaskHistoryMonth extends SolarHistoryMonth {
  total_tasks: number;
  completed_tasks: number;
  incomplete_tasks: number;
}

export interface TaskHistoryDetail extends TaskHistoryMonth {
  tasks: Task[];
}

export interface GoalHistoryMonth extends SolarHistoryMonth {
  started_count: number;
  completed_count: number;
}

export interface GoalHistoryDetail extends GoalHistoryMonth {
  goals: Goal[];
  progress_entries?: GoalProgressEntry[];
}

export interface HabitHistoryMonth extends SolarHistoryMonth {
  added_habits: number;
  completion_count: number;
  completed_habits: number;
  progress_count?: number;
}

export interface HabitHistoryDetail extends HabitHistoryMonth {
  habits: Habit[];
  completions: HabitCompletion[];
  progress_entries?: HabitProgressEntry[];
}

export type FinanceEntryKind = "income" | "expense";
export type FinanceCurrency = string;

export interface FinanceEntry {
  id: number;
  kind: FinanceEntryKind;
  title: string;
  category: string;
  amount: number;
  currency: FinanceCurrency;
  entry_date: string;
  notes: string | null;
  source: string;
  account_id: number | null;
  created_at: string;
  updated_at: string;
  user_id: number;
}

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

export type FinanceBudgetStatus = "on_track" | "approaching" | "over_budget" | "inactive";

export interface FinanceBudget {
  id: number;
  category: string;
  amount: number;
  currency: string;
  period: "weekly" | "monthly" | "yearly" | "custom";
  start_date: string;
  end_date: string;
  is_active: boolean;
  spent: number;
  remaining: number;
  percent_used: number;
  status: FinanceBudgetStatus;
  created_at: string;
  updated_at: string;
}

export interface FinanceCategory {
  id: number | null;
  kind: FinanceEntryKind;
  name: string;
  is_active: boolean;
  is_default: boolean;
}

const defaultFinanceCategoryNames: Record<FinanceEntryKind, string[]> = {
  income: ["Salary", "Freelance", "Business", "Investment", "Gift", "Bonus", "Other Income"],
  expense: ["Housing", "Food", "Transport", "Utilities", "Health", "Education", "Shopping", "Bills", "Entertainment", "Other"],
};

export function getDefaultFinanceCategories(kind?: FinanceEntryKind): FinanceCategory[] {
  return (kind ? [kind] : ["income", "expense"] as const).flatMap((categoryKind) =>
    defaultFinanceCategoryNames[categoryKind].map((name) => ({
      id: null,
      kind: categoryKind,
      name,
      is_active: true,
      is_default: true,
    })),
  );
}

export interface FinanceOverview {
  solar_year: number;
  solar_month: number;
  month_name: string;
  current_balances: CurrencyTotal[];
  month_income: CurrencyTotal[];
  month_expenses: CurrencyTotal[];
  savings_total: CurrencyTotal[];
  budget_status: FinanceBudget[];
}

export interface FinanceSavingsActivity {
  id: number;
  goal_id: number;
  amount: number;
  direction: "contribution" | "withdrawal";
  activity_date: string;
  notes: string | null;
  created_at: string;
}

export interface FinanceSavingsGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline: string | null;
  description: string | null;
  is_active: boolean;
  progress: number;
  created_at: string;
  updated_at: string;
  activities: FinanceSavingsActivity[];
}

export interface FinancialGoalProgress {
  id: number;
  goal_id: number;
  amount: number;
  direction: "contribution" | "withdrawal";
  activity_date: string;
  notes: string | null;
  created_at: string;
}

export interface FinancialGoal {
  id: number;
  name: string;
  target_amount: number;
  current_amount: number;
  currency: string;
  deadline: string | null;
  description: string | null;
  is_completed: boolean;
  progress: number;
  created_at: string;
  updated_at: string;
  progress_history: FinancialGoalProgress[];
}

export interface RecurringFinanceTransaction {
  id: number;
  name: string;
  kind: FinanceEntryKind;
  amount: number;
  currency: string;
  category: string;
  account_id: number | null;
  frequency: "weekly" | "monthly" | "yearly";
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransactionPage {
  items: FinanceEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface FinanceMonthlyReportSummary {
  solar_year: number;
  solar_month: number;
  month_name: string;
  total_income: number;
  total_expenses: number;
  balance: number;
  income_count: number;
  expense_count: number;
  totals_by_currency: Array<{
    currency: string;
    total_income: number;
    total_expenses: number;
    balance: number;
  }>;
}

export interface FinanceMonthlyReport extends FinanceMonthlyReportSummary {
  income_transactions: FinanceEntry[];
  expense_transactions: FinanceEntry[];
  transactions: FinanceEntry[];
}

type FinanceEntryResponse = Omit<FinanceEntry, "amount"> & {
  amount: number | string;
};

type BankAccountResponse = Omit<BankAccount, "current_balance"> & {
  current_balance: number | string | null;
};
type BankTransactionResponse = Omit<BankTransaction, "amount"> & { amount: number | string };
type BankStatementImportResponse = Omit<BankStatementImportResult, "account"> & { account: BankAccountResponse };

type FinanceMonthlyReportSummaryResponse = Omit<
  FinanceMonthlyReportSummary,
  "total_income" | "total_expenses" | "balance" | "totals_by_currency"
> & {
  total_income: number | string;
  total_expenses: number | string;
  balance: number | string;
  totals_by_currency: Array<{
    currency: string;
    total_income: number | string;
    total_expenses: number | string;
    balance: number | string;
  }>;
};

type FinanceMonthlyReportResponse = Omit<
  FinanceMonthlyReport,
  "total_income" | "total_expenses" | "balance" | "totals_by_currency" | "transactions" | "income_transactions" | "expense_transactions"
> & {
  total_income: number | string;
  total_expenses: number | string;
  balance: number | string;
  totals_by_currency: FinanceMonthlyReportSummaryResponse["totals_by_currency"];
  transactions: FinanceEntryResponse[];
  income_transactions: FinanceEntryResponse[];
  expense_transactions: FinanceEntryResponse[];
};

function normalizeFinanceEntry(entry: FinanceEntryResponse): FinanceEntry {
  const amount = Number(entry.amount);
  return {
    ...entry,
    amount: Number.isFinite(amount) ? amount : 0,
  };
}

function normalizeFinanceReportSummary(
  report: FinanceMonthlyReportSummaryResponse,
): FinanceMonthlyReportSummary {
  return {
    ...report,
    total_income: Number(report.total_income) || 0,
    total_expenses: Number(report.total_expenses) || 0,
    balance: Number(report.balance) || 0,
    totals_by_currency: (report.totals_by_currency ?? []).map((item) => ({
      currency: item.currency,
      total_income: Number(item.total_income) || 0,
      total_expenses: Number(item.total_expenses) || 0,
      balance: Number(item.balance) || 0,
    })),
  };
}

function normalizeFinanceReport(report: FinanceMonthlyReportResponse): FinanceMonthlyReport {
  return {
    ...normalizeFinanceReportSummary(report),
    income_transactions: report.income_transactions.map(normalizeFinanceEntry),
    expense_transactions: report.expense_transactions.map(normalizeFinanceEntry),
    transactions: report.transactions.map(normalizeFinanceEntry),
  };
}

export interface CreateFinanceEntryInput {
  kind: FinanceEntryKind;
  title: string;
  category: string;
  amount: number;
  currency?: FinanceCurrency;
  entry_date: string;
  notes?: string | null;
  source?: string;
  account_id?: number | null;
}

export interface BankAccount {
  id: number;
  provider: string;
  institution_name: string;
  account_name: string;
  masked_account_number: string | null;
  account_type: string | null;
  currency: string;
  current_balance: number | null;
  status: string;
  last_synced_at: string | null;
  last_imported_at: string | null;
  created_at: string;
}

export interface BankTransaction {
  id: number;
  bank_account_id: number;
  finance_entry_id: number | null;
  transaction_date: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: FinanceEntryKind;
  category: string;
  account_id: number | null;
  source: string;
  imported_at: string;
}

export interface BankConnectionStatus {
  status: "not_configured" | "adapter_unavailable";
  institution_name: string;
  message: string;
  statement_import_available: boolean;
}

export interface BankStatementPreviewRow {
  row_number: number;
  transaction_date: string;
  description: string;
  amount: number;
  currency: string;
  transaction_type: FinanceEntryKind;
  category: string;
  fingerprint: string;
  duplicate: boolean;
}

export interface BankStatementPreview {
  rows: BankStatementPreviewRow[];
  invalid_rows: string[];
}

export interface BankStatementImportResult {
  status: string;
  imported_transactions: number;
  duplicates_skipped: number;
  account: BankAccount;
  message: string;
}

export type UpdateFinanceEntryInput = Partial<CreateFinanceEntryInput>;

type FinanceEntryPageResponse = {
  items: FinanceEntryResponse[];
  total: number;
  limit: number;
  offset: number;
};

type FinanceOverviewWire = Omit<FinanceOverview, "current_balances" | "month_income" | "month_expenses" | "savings_total" | "budget_status"> & {
  current_balances: Array<{ currency: string; amount: number | string }>;
  month_income: Array<{ currency: string; amount: number | string }>;
  month_expenses: Array<{ currency: string; amount: number | string }>;
  savings_total: Array<{ currency: string; amount: number | string }>;
  budget_status: FinanceBudgetWire[];
};

type FinanceBudgetWire = Omit<FinanceBudget, "amount" | "spent" | "remaining"> & {
  amount: number | string;
  spent: number | string;
  remaining: number | string;
};

type FinanceSavingsGoalWire = Omit<FinanceSavingsGoal, "target_amount" | "current_amount" | "activities"> & {
  target_amount: number | string;
  current_amount: number | string;
  activities: Array<Omit<FinanceSavingsActivity, "amount"> & { amount: number | string }>;
};

type FinancialGoalWire = Omit<FinancialGoal, "target_amount" | "current_amount" | "progress_history"> & {
  target_amount: number | string;
  current_amount: number | string;
  progress_history: Array<Omit<FinancialGoalProgress, "amount"> & { amount: number | string }>;
};

type RecurringFinanceWire = Omit<RecurringFinanceTransaction, "amount"> & { amount: number | string };

function normalizeCurrencyTotals(values: Array<{ currency: string; amount: number | string }>): CurrencyTotal[] {
  return values.map((item) => ({ ...item, amount: Number(item.amount) || 0 }));
}

function normalizeBudget(budget: FinanceBudgetWire): FinanceBudget {
  return { ...budget, amount: Number(budget.amount) || 0, spent: Number(budget.spent) || 0, remaining: Number(budget.remaining) || 0 };
}

function normalizeSavingsGoal(goal: FinanceSavingsGoalWire): FinanceSavingsGoal {
  return {
    ...goal,
    target_amount: Number(goal.target_amount) || 0,
    current_amount: Number(goal.current_amount) || 0,
    activities: goal.activities.map((activity) => ({ ...activity, amount: Number(activity.amount) || 0 })),
  };
}

function normalizeFinancialGoal(goal: FinancialGoalWire): FinancialGoal {
  return {
    ...goal,
    target_amount: Number(goal.target_amount) || 0,
    current_amount: Number(goal.current_amount) || 0,
    progress_history: goal.progress_history.map((entry) => ({ ...entry, amount: Number(entry.amount) || 0 })),
  };
}

export interface LearningPlan {
  id: number;
  title: string;
  author: string | null;
  total_pages: number;
  current_page: number;
  started_on: string;
  target_date: string;
  study_start_time: string;
  study_end_time: string;
  study_days_per_week: number;
  created_at: string;
  user_id: number;
}

export interface LearningPlanInput {
  title: string;
  author?: string | null;
  total_pages: number;
  current_page: number;
  started_on: string;
  target_date: string;
  study_start_time: string;
  study_end_time: string;
  study_days_per_week: number;
}

export interface LearningProgress {
  id: number;
  learning_plan_id: number;
  from_page: number;
  to_page: number;
  activity_date: string;
  created_at: string;
}

export interface LearningHistoryMonth extends SolarHistoryMonth {
  plans_added: number;
  pages_advanced: number;
  progress_updates: number;
}

export interface LearningHistoryDetail extends LearningHistoryMonth {
  plans: LearningPlan[];
  progress_updates_detail: LearningProgress[];
}

export interface DisciplineSnapshot {
  entry_date: string;
  tasks_completed: number;
  tasks_total: number;
  habits_completed: number;
  habits_total: number;
  active_goals: number;
  goal_progress: number | null;
  journal_completed: boolean;
  discipline_score: number;
}

export interface JournalEntry {
  id: number;
  entry_date: string;
  mood: string | null;
  answers: Record<string, string>;
  tasks_completed: number;
  tasks_total: number;
  habits_completed: number;
  habits_total: number;
  active_goals: number;
  goal_progress: number | null;
  discipline_score: number;
  created_at: string;
  updated_at: string;
}

export interface JournalEntryInput {
  mood: string | null;
  answers: Record<string, string>;
}

export interface JournalHistoryMonth extends SolarHistoryMonth {
  entry_count: number;
  average_discipline_score: number | null;
}

export interface JournalHistoryDetail extends JournalHistoryMonth {
  entries: JournalEntry[];
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  message: string;
  related_item_type: string | null;
  related_item_id: number | null;
  is_read: boolean;
  created_at: string;
}

export interface NotificationList {
  items: Notification[];
  unread_count: number;
}

export type MoodPreference = "happy" | "calm" | "neutral" | "sad" | "frustrated" | "motivated";
export type ThemePreference = "dark" | "light" | "system";
export type AccentPreference = "indigo" | "violet" | "blue" | "emerald" | "rose";
export type LanguagePreference = "en" | "fa";

export interface AppSettings {
  account: { profile_picture: string | null };
  notifications: {
    late_tasks: boolean;
    missed_habits: boolean;
    goal_deadlines: boolean;
    daily_discipline: boolean;
    journal_reminder: boolean;
    sound: "alarm" | "system";
  };
  discipline: {
    reminder_time: string;
    daily_goal: number;
    streak_reminders: boolean;
  };
  appearance: {
    theme: ThemePreference;
    accent: AccentPreference;
    compact_sidebar: boolean;
    language: LanguagePreference;
    reduce_animations: boolean;
  };
  journal: { default_mood: MoodPreference | null };
  finance: {
    currency: "AFN";
    monthly_spending_alert: boolean;
    monthly_spending_limit: number;
  };
  date_calendar: { calendar: "solar" | "gregorian"; week_start: "monday" | "sunday" };
}

export const defaultAppSettings: AppSettings = {
  account: { profile_picture: null },
  notifications: {
    late_tasks: true,
    missed_habits: true,
    goal_deadlines: true,
    daily_discipline: true,
    journal_reminder: true,
    sound: "alarm",
  },
  discipline: { reminder_time: "20:00", daily_goal: 80, streak_reminders: true },
  appearance: { theme: "dark", accent: "indigo", compact_sidebar: false, language: "en", reduce_animations: false },
  journal: { default_mood: "calm" },
  finance: { currency: "AFN", monthly_spending_alert: true, monthly_spending_limit: 0 },
  date_calendar: { calendar: "solar", week_start: "monday" },
};

export interface AIStatus {
  configured: boolean;
  provider: string | null;
  model: string | null;
  local: boolean;
  data_sent_externally: boolean;
  message: string;
}

export interface AISettings {
  memory_enabled: boolean;
  journal_sharing_enabled: boolean;
  provider: "server-default" | "ollama" | "openai" | "openai-compatible";
  model: string | null;
}

export interface AIConversation {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface AIMessageRecord {
  id: number;
  role: "user" | "assistant";
  content: string;
  created_at: string;
}

export interface AIAction {
  type: string;
  title: string;
  due_date?: string | null;
  due_time?: string | null;
}

export interface AIChatResponse {
  conversation_id: number;
  reply: string;
  action: AIAction | null;
}

export const api = {
  login(data: LoginInput): Promise<LoginResponse> {
    return request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  register(data: RegisterInput): Promise<{
    message: string;
    user: AuthUser;
  }> {
    return request("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  me(): Promise<AuthUser> {
    return request<AuthUser>("/api/auth/me");
  },

  getAppSettings(): Promise<AppSettings> {
    return request<AppSettings>("/api/account/settings");
  },

  saveAppSettings(data: AppSettings): Promise<AppSettings> {
    return request<AppSettings>("/api/account/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  updateProfile(data: Pick<AuthUser, "full_name" | "email">): Promise<AuthUser> {
    return request<AuthUser>("/api/account/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  updatePassword(data: { current_password: string; new_password: string }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/account/password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  exportAccountData(): Promise<Record<string, unknown>> {
    return request<Record<string, unknown>>("/api/account/export");
  },

  deleteAccount(data: { current_password: string; confirmation: "DELETE" }): Promise<{ message: string }> {
    return request<{ message: string }>("/api/account/delete", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  logout(): void {
    localStorage.removeItem("access_token");
  },

  getTasks(): Promise<Task[]> {
    return request<Task[]>("/api/tasks/");
  },

  getCompletedTasks(): Promise<Task[]> {
    return request<Task[]>("/api/tasks/completed");
  },

  getTaskMonthlyHistory(): Promise<TaskHistoryMonth[]> {
    return request<TaskHistoryMonth[]>("/api/tasks/monthly-history");
  },

  getTaskMonthlyHistoryDetail(year: number, month: number): Promise<TaskHistoryDetail> {
    return request<TaskHistoryDetail>(`/api/tasks/monthly-history/${year}/${month}`);
  },

  createTask(data: CreateTaskInput): Promise<Task> {
    return request<Task>("/api/tasks/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateTask(
    id: number,
    data: UpdateTaskInput,
  ): Promise<Task> {
    return request<Task>(`/api/tasks/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteTask(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/tasks/${id}`, {
      method: "DELETE",
    });
  },

  getGoals(): Promise<Goal[]> {
    return request<Goal[]>("/api/goals/");
  },

  getGoalMonthlyHistory(): Promise<GoalHistoryMonth[]> {
    return request<GoalHistoryMonth[]>("/api/goals/monthly-history");
  },

  getGoalMonthlyHistoryDetail(year: number, month: number): Promise<GoalHistoryDetail> {
    return request<GoalHistoryDetail>(`/api/goals/monthly-history/${year}/${month}`);
  },

  createGoal(data: CreateGoalInput): Promise<Goal> {
    return request<Goal>("/api/goals/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateGoal(
    id: number,
    data: UpdateGoalInput,
  ): Promise<Goal> {
    return request<Goal>(`/api/goals/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteGoal(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/goals/${id}`, {
      method: "DELETE",
    });
  },

  getGoalProgress(id: number): Promise<GoalProgressEntry[]> {
    return request<GoalProgressEntry[]>(`/api/goals/${id}/progress`);
  },

  addGoalProgress(id: number, data: { amount: number; entry_date: string; note?: string | null }): Promise<GoalProgressEntry> {
    return request<GoalProgressEntry>(`/api/goals/${id}/progress`, { method: "POST", body: JSON.stringify(data) });
  },

  getHabits(): Promise<Habit[]> {
    return request<Habit[]>("/api/habits/");
  },

  getHabitMonthlyHistory(): Promise<HabitHistoryMonth[]> {
    return request<HabitHistoryMonth[]>("/api/habits/monthly-history");
  },

  getHabitMonthlyHistoryDetail(year: number, month: number): Promise<HabitHistoryDetail> {
    return request<HabitHistoryDetail>(`/api/habits/monthly-history/${year}/${month}`);
  },

  createHabit(data: CreateHabitInput): Promise<Habit> {
    return request<Habit>("/api/habits/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateHabit(
    id: number,
    data: UpdateHabitInput,
  ): Promise<Habit> {
    return request<Habit>(`/api/habits/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteHabit(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/habits/${id}`, {
      method: "DELETE",
    });
  },

  getHabitCompletions(id: number): Promise<HabitCompletion[]> {
    return request<HabitCompletion[]>(
      `/api/habits/${id}/completions`,
    );
  },

  getHabitProgress(id: number): Promise<HabitProgressEntry[]> {
    return request<HabitProgressEntry[]>(`/api/habits/${id}/progress`);
  },

  addHabitProgress(id: number, data: { amount: number; entry_date: string; note?: string | null }): Promise<HabitProgressEntry> {
    return request<HabitProgressEntry>(`/api/habits/${id}/progress`, { method: "POST", body: JSON.stringify(data) });
  },

  completeHabit(id: number): Promise<HabitCompletion> {
    return request<HabitCompletion>(
      `/api/habits/${id}/complete`,
      {
        method: "POST",
      },
    );
  },

  uncompleteHabit(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(
      `/api/habits/${id}/complete`,
      {
        method: "DELETE",
      },
    );
  },

  async getFinanceEntries(): Promise<FinanceEntry[]> {
    const entries = await request<FinanceEntryResponse[]>("/api/finance/");
    return entries.map(normalizeFinanceEntry);
  },

  async getFinanceOverview(): Promise<FinanceOverview> {
    const result = await request<FinanceOverviewWire>("/api/finance/overview");
    return {
      ...result,
      current_balances: normalizeCurrencyTotals(result.current_balances),
      month_income: normalizeCurrencyTotals(result.month_income),
      month_expenses: normalizeCurrencyTotals(result.month_expenses),
      savings_total: normalizeCurrencyTotals(result.savings_total),
      budget_status: result.budget_status.map(normalizeBudget),
    };
  },

  async getFinanceTransactions(filters: {
    kind?: FinanceEntryKind;
    category?: string;
    account_id?: number;
    start_date?: string;
    end_date?: string;
    min_amount?: number;
    max_amount?: number;
    source?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<FinanceTransactionPage> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== "") params.set(key, String(value));
    });
    const query = params.size ? `?${params.toString()}` : "";
    const result = await request<FinanceEntryPageResponse>(`/api/finance/transactions${query}`);
    return { ...result, items: result.items.map(normalizeFinanceEntry) };
  },

  async getBankAccounts(): Promise<BankAccount[]> {
    const rows = await request<BankAccountResponse[]>("/api/bank-accounts/");
    return rows.map((row) => ({ ...row, current_balance: row.current_balance == null ? null : Number(row.current_balance) }));
  },

  async getBankAccount(id: number): Promise<BankAccount> {
    const row = await request<BankAccountResponse>(`/api/bank-accounts/${id}`);
    return { ...row, current_balance: row.current_balance == null ? null : Number(row.current_balance) };
  },

  getAziziConnectionStatus(): Promise<BankConnectionStatus> {
    return request<BankConnectionStatus>("/api/bank-accounts/connect/status");
  },

  connectAziziBank(): Promise<BankConnectionStatus> {
    return request<BankConnectionStatus>("/api/bank-accounts/connect", { method: "POST" });
  },

  async previewAziziStatement(file: File, accountId?: number): Promise<BankStatementPreview> {
    const form = new FormData();
    form.set("file", file);
    if (accountId !== undefined) form.set("account_id", String(accountId));
    const result = await uploadRequest<BankStatementPreview>("/api/bank-accounts/statements/preview", form);
    return { ...result, rows: result.rows.map((row) => ({ ...row, amount: Number(row.amount) || 0 })) };
  },

  async importAziziStatement(file: File, accountName: string, lastFour = "", selectedRows?: number[]): Promise<BankStatementImportResult> {
    const form = new FormData();
    form.set("file", file);
    form.set("account_name", accountName);
    form.set("last_four", lastFour);
    if (selectedRows) form.set("selected_rows", selectedRows.join(","));
    const result = await uploadRequest<BankStatementImportResponse>("/api/bank-accounts/statements/import", form);
    return {
      ...result,
      account: { ...result.account, current_balance: result.account.current_balance == null ? null : Number(result.account.current_balance) },
    };
  },

  async getBankTransactions(id: number, filters: { kind?: FinanceEntryKind; search?: string; start_date?: string; end_date?: string } = {}): Promise<BankTransaction[]> {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
    const suffix = params.size ? `?${params.toString()}` : "";
    const rows = await request<BankTransactionResponse[]>(`/api/bank-accounts/${id}/transactions${suffix}`);
    return rows.map((row) => ({ ...row, amount: Number(row.amount) || 0 }));
  },

  async syncBankAccount(id: number): Promise<{ status: string; new_transactions: number; updated_transactions: number; duplicates_skipped: number; last_synced_at: string | null; message: string }> {
    return request(`/api/bank-accounts/${id}/sync`, { method: "POST" });
  },

  disconnectBankAccount(id: number): Promise<{ message: string }> {
    return request(`/api/bank-accounts/${id}`, { method: "DELETE" });
  },

  async getFinanceTransaction(id: number): Promise<FinanceEntry> {
    return normalizeFinanceEntry(await request<FinanceEntryResponse>(`/api/finance/${id}`));
  },

  async getFinanceCategories(kind?: FinanceEntryKind): Promise<FinanceCategory[]> {
    const query = kind ? `?kind=${encodeURIComponent(kind)}` : "";
    return request<FinanceCategory[]>(`/api/finance/categories${query}`);
  },

  createFinanceCategory(data: { kind: FinanceEntryKind; name: string }): Promise<FinanceCategory> {
    return request<FinanceCategory>("/api/finance/categories", { method: "POST", body: JSON.stringify(data) });
  },

  updateFinanceCategory(id: number, data: { name?: string; is_active?: boolean }): Promise<FinanceCategory> {
    return request<FinanceCategory>(`/api/finance/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) });
  },

  archiveFinanceCategory(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/categories/${id}`, { method: "DELETE" });
  },

  async getFinanceBudgets(): Promise<FinanceBudget[]> {
    return (await request<FinanceBudgetWire[]>("/api/finance/budgets")).map(normalizeBudget);
  },

  async getFinanceBudget(id: number): Promise<FinanceBudget & { expenses: FinanceEntry[] }> {
    const result = await request<FinanceBudgetWire & { expenses: FinanceEntryResponse[] }>(`/api/finance/budgets/${id}`);
    return { ...normalizeBudget(result), expenses: result.expenses.map(normalizeFinanceEntry) };
  },

  async createFinanceBudget(data: Omit<FinanceBudget, "id" | "spent" | "remaining" | "percent_used" | "status" | "created_at" | "updated_at"> & { amount: number }): Promise<FinanceBudget> {
    return normalizeBudget(await request<FinanceBudgetWire>("/api/finance/budgets", { method: "POST", body: JSON.stringify(data) }));
  },

  async updateFinanceBudget(id: number, data: Partial<Pick<FinanceBudget, "category" | "amount" | "currency" | "period" | "start_date" | "end_date" | "is_active">>): Promise<FinanceBudget> {
    return normalizeBudget(await request<FinanceBudgetWire>(`/api/finance/budgets/${id}`, { method: "PATCH", body: JSON.stringify(data) }));
  },

  deleteFinanceBudget(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/budgets/${id}`, { method: "DELETE" });
  },

  async getSavingsGoals(): Promise<FinanceSavingsGoal[]> {
    return (await request<FinanceSavingsGoalWire[]>("/api/finance/savings")).map(normalizeSavingsGoal);
  },

  async createSavingsGoal(data: { name: string; target_amount: number; initial_amount?: number; currency: string; deadline?: string | null; description?: string | null }): Promise<FinanceSavingsGoal> {
    return normalizeSavingsGoal(await request<FinanceSavingsGoalWire>("/api/finance/savings", { method: "POST", body: JSON.stringify(data) }));
  },

  async updateSavingsGoal(id: number, data: Partial<Pick<FinanceSavingsGoal, "name" | "target_amount" | "currency" | "deadline" | "description" | "is_active">>): Promise<FinanceSavingsGoal> {
    return normalizeSavingsGoal(await request<FinanceSavingsGoalWire>(`/api/finance/savings/${id}`, { method: "PATCH", body: JSON.stringify(data) }));
  },

  deleteSavingsGoal(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/savings/${id}`, { method: "DELETE" });
  },

  async addSavingsActivity(id: number, data: { amount: number; direction?: "contribution" | "withdrawal"; activity_date: string; notes?: string | null }): Promise<FinanceSavingsActivity> {
    const result = await request<Omit<FinanceSavingsActivity, "amount"> & { amount: number | string }>(`/api/finance/savings/${id}/contributions`, { method: "POST", body: JSON.stringify(data) });
    return { ...result, amount: Number(result.amount) || 0 };
  },

  async getFinancialGoals(): Promise<FinancialGoal[]> {
    return (await request<FinancialGoalWire[]>("/api/finance/financial-goals")).map(normalizeFinancialGoal);
  },

  async createFinancialGoal(data: { name: string; target_amount: number; initial_amount?: number; currency: string; deadline?: string | null; description?: string | null }): Promise<FinancialGoal> {
    return normalizeFinancialGoal(await request<FinancialGoalWire>("/api/finance/financial-goals", { method: "POST", body: JSON.stringify(data) }));
  },

  async updateFinancialGoal(id: number, data: Partial<Pick<FinancialGoal, "name" | "target_amount" | "currency" | "deadline" | "description" | "is_completed">>): Promise<FinancialGoal> {
    return normalizeFinancialGoal(await request<FinancialGoalWire>(`/api/finance/financial-goals/${id}`, { method: "PATCH", body: JSON.stringify(data) }));
  },

  deleteFinancialGoal(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/financial-goals/${id}`, { method: "DELETE" });
  },

  async addFinancialGoalProgress(id: number, data: { amount: number; direction?: "contribution" | "withdrawal"; activity_date: string; notes?: string | null }): Promise<FinancialGoalProgress> {
    const result = await request<Omit<FinancialGoalProgress, "amount"> & { amount: number | string }>(`/api/finance/financial-goals/${id}/progress`, { method: "POST", body: JSON.stringify(data) });
    return { ...result, amount: Number(result.amount) || 0 };
  },

  async getRecurringFinanceTransactions(): Promise<RecurringFinanceTransaction[]> {
    const result = await request<RecurringFinanceWire[]>("/api/finance/recurring-transactions");
    return result.map((item) => ({ ...item, amount: Number(item.amount) || 0 }));
  },

  async createRecurringFinanceTransaction(data: Omit<RecurringFinanceTransaction, "id" | "created_at" | "updated_at">): Promise<RecurringFinanceTransaction> {
    const result = await request<RecurringFinanceWire>("/api/finance/recurring-transactions", { method: "POST", body: JSON.stringify(data) });
    return { ...result, amount: Number(result.amount) || 0 };
  },

  async updateRecurringFinanceTransaction(id: number, data: Partial<Omit<RecurringFinanceTransaction, "id" | "created_at" | "updated_at">>): Promise<RecurringFinanceTransaction> {
    const result = await request<RecurringFinanceWire>(`/api/finance/recurring-transactions/${id}`, { method: "PATCH", body: JSON.stringify(data) });
    return { ...result, amount: Number(result.amount) || 0 };
  },

  deleteRecurringFinanceTransaction(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/recurring-transactions/${id}`, { method: "DELETE" });
  },

  async getFinanceMonthlyReports(): Promise<FinanceMonthlyReportSummary[]> {
    const reports = await request<FinanceMonthlyReportSummaryResponse[]>(
      "/api/finance/monthly-reports",
    );
    return reports.map(normalizeFinanceReportSummary);
  },

  async getFinanceMonthlyReport(year: number, month: number): Promise<FinanceMonthlyReport> {
    const report = await request<FinanceMonthlyReportResponse>(
      `/api/finance/monthly-reports/${year}/${month}`,
    );
    return normalizeFinanceReport(report);
  },

  getLearningMonthlyHistory(): Promise<LearningHistoryMonth[]> {
    return request<LearningHistoryMonth[]>("/api/learning/monthly-history");
  },

  getLearningMonthlyHistoryDetail(year: number, month: number): Promise<LearningHistoryDetail> {
    return request<LearningHistoryDetail>(`/api/learning/monthly-history/${year}/${month}`);
  },

  async createFinanceEntry(data: CreateFinanceEntryInput): Promise<FinanceEntry> {
    const entry = await request<FinanceEntryResponse>("/api/finance/", {
      method: "POST",
      body: JSON.stringify(data),
    });
    return normalizeFinanceEntry(entry);
  },

  deleteFinanceEntry(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/finance/${id}`, {
      method: "DELETE",
    });
  },

  async updateFinanceEntry(id: number, data: UpdateFinanceEntryInput): Promise<FinanceEntry> {
    const entry = await request<FinanceEntryResponse>(`/api/finance/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
    return normalizeFinanceEntry(entry);
  },

  getLearningPlans(): Promise<LearningPlan[]> {
    return request<LearningPlan[]>("/api/learning/");
  },

  createLearningPlan(data: LearningPlanInput): Promise<LearningPlan> {
    return request<LearningPlan>("/api/learning/", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateLearningPlan(
    id: number,
    data: Partial<LearningPlanInput>,
  ): Promise<LearningPlan> {
    return request<LearningPlan>(`/api/learning/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  },

  deleteLearningPlan(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/learning/${id}`, {
      method: "DELETE",
    });
  },

  getJournalEntries(startDate: string, endDate: string): Promise<JournalEntry[]> {
    const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
    return request<JournalEntry[]>(`/api/journal/?${params.toString()}`);
  },

  getJournalMonthlyHistory(): Promise<JournalHistoryMonth[]> {
    return request<JournalHistoryMonth[]>("/api/journal/monthly-history");
  },

  getJournalMonthlyHistoryDetail(year: number, month: number): Promise<JournalHistoryDetail> {
    return request<JournalHistoryDetail>(`/api/journal/monthly-history/${year}/${month}`);
  },

  getJournalEntry(date: string): Promise<JournalEntry> {
    return request<JournalEntry>(`/api/journal/${date}`);
  },

  saveJournalEntry(date: string, data: JournalEntryInput): Promise<JournalEntry> {
    return request<JournalEntry>(`/api/journal/${date}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getDisciplineSnapshot(date: string): Promise<DisciplineSnapshot> {
    return request<DisciplineSnapshot>(`/api/journal/discipline/${date}`);
  },

  getNotifications(limit = 30): Promise<NotificationList> {
    const params = new URLSearchParams({ limit: String(limit) });
    return request<NotificationList>(`/api/notifications/?${params.toString()}`);
  },

  markNotificationRead(id: number): Promise<Notification> {
    return request<Notification>(`/api/notifications/${id}/read`, { method: "PATCH" });
  },

  markAllNotificationsRead(): Promise<{ updated: number }> {
    return request<{ updated: number }>("/api/notifications/read-all", { method: "PATCH" });
  },

  getAIStatus(): Promise<AIStatus> {
    return request<AIStatus>("/api/ai/status");
  },

  testAIProvider(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/ai/test", { method: "POST" });
  },

  getAISettings(): Promise<AISettings> {
    return request<AISettings>("/api/ai/settings");
  },

  saveAISettings(data: AISettings): Promise<AISettings> {
    return request<AISettings>("/api/ai/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  getAIConversations(): Promise<AIConversation[]> {
    return request<AIConversation[]>("/api/ai/conversations");
  },

  createAIConversation(): Promise<{ id: number; title: string }> {
    return request<{ id: number; title: string }>("/api/ai/conversations", { method: "POST" });
  },

  getAIMessages(conversationId: number): Promise<AIMessageRecord[]> {
    return request<AIMessageRecord[]>(`/api/ai/conversations/${conversationId}/messages`);
  },

  deleteAIConversation(id: number): Promise<{ message: string }> {
    return request<{ message: string }>(`/api/ai/conversations/${id}`, { method: "DELETE" });
  },

  clearAIHistory(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/ai/conversations", { method: "DELETE" });
  },

  sendAIChat(data: { message: string; conversation_id?: number | null }): Promise<AIChatResponse> {
    return request<AIChatResponse>("/api/ai/chat", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  getAIDailyBriefing(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/ai/briefing/daily");
  },

  getAIWeeklyReview(): Promise<{ message: string }> {
    return request<{ message: string }>("/api/ai/briefing/weekly");
  },

  executeAICreateTask(data: { title: string; description?: string | null; due_date?: string | null; due_time?: string | null }): Promise<{ id: number; title: string; message: string }> {
    return request<{ id: number; title: string; message: string }>("/api/ai/actions/create-task", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
};
