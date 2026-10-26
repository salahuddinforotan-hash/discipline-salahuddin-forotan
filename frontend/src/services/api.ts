const API_BASE_URL = "http://127.0.0.1:8000";

function getToken(): string | null {
  return localStorage.getItem("access_token");
}

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
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
    let message = `Request failed with status ${response.status}`;

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

  return response.json();
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  is_completed: boolean;
  due_date: string | null;
  created_at: string;
  user_id: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string | null;
  due_date?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string | null;
  is_completed?: boolean;
  due_date?: string | null;
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
  target_date: string | null;
  progress: number;
  is_completed: boolean;
  created_at: string;
  user_id: number;
}

export interface CreateGoalInput {
  title: string;
  description?: string | null;
  target_date?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  target_date?: string | null;
  progress?: number;
  is_completed?: boolean;
}

export interface Habit {
  id: number;
  name: string;
  description: string | null;
  frequency: "daily" | "weekly";
  is_active: boolean;
  current_streak: number;
  longest_streak: number;
  created_at: string;
  user_id: number;
}

export interface CreateHabitInput {
  name: string;
  description?: string | null;
  frequency: "daily" | "weekly";
}

export interface UpdateHabitInput {
  name?: string;
  description?: string | null;
  frequency?: "daily" | "weekly";
  is_active?: boolean;
}

export interface HabitCompletion {
  id: number;
  habit_id: number;
  completion_date: string;
  created_at: string;
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

  logout(): void {
    localStorage.removeItem("access_token");
  },

  getTasks(): Promise<Task[]> {
    return request<Task[]>("/api/tasks/");
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

  getHabits(): Promise<Habit[]> {
    return request<Habit[]>("/api/habits/");
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
};
