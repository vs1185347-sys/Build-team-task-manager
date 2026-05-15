import type { DashboardData, Paginated, Project, ProjectDetail, Role, Task, TaskStatus, User } from "../types";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

type ApiOptions = RequestInit & {
  skipJson?: boolean;
};

export class ApiError extends Error {
  status: number;
  details: unknown;

  constructor(message: string, status: number, details: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function apiFetch<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: "include",
    headers,
  });

  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json") ? await response.json() : null;

  if (!response.ok) {
    throw new ApiError(extractMessage(data), response.status, data);
  }

  return data as T;
}

function extractMessage(payload: unknown) {
  if (!payload || typeof payload !== "object") return "Something went wrong.";
  if ("detail" in payload && typeof payload.detail === "string") return payload.detail;
  if ("message" in payload && typeof payload.message === "string") return payload.message;
  const firstValue = Object.values(payload as Record<string, unknown>)[0];
  if (Array.isArray(firstValue)) return String(firstValue[0]);
  if (typeof firstValue === "string") return firstValue;
  return "Please check the form and try again.";
}

export function getResults<T>(payload: Paginated<T> | T[]) {
  return Array.isArray(payload) ? payload : payload.results;
}

export const authApi = {
  me: () => apiFetch<{ user: User; csrfToken: string }>("/auth/me/"),
  register: (payload: { name: string; email: string; role: Role; password: string; confirm_password: string }) =>
    apiFetch<{ user: User }>("/auth/register/", { method: "POST", body: JSON.stringify(payload) }),
  login: (payload: { email: string; password: string }) =>
    apiFetch<{ user: User }>("/auth/login/", { method: "POST", body: JSON.stringify(payload) }),
  logout: () => apiFetch<{ message: string }>("/auth/logout/", { method: "POST", body: JSON.stringify({}) }),
  users: () => apiFetch<Paginated<User> | User[]>("/auth/users/"),
  updateRole: (id: number, role: Role) =>
    apiFetch<User>(`/auth/users/${id}/role/`, { method: "PUT", body: JSON.stringify({ role }) }),
};

export const dashboardApi = {
  get: () => apiFetch<DashboardData>("/dashboard/"),
};

export const projectApi = {
  list: (query = "") => apiFetch<Paginated<Project> | Project[]>(`/projects/${query}`),
  create: (payload: ProjectPayload) => apiFetch<Project>("/projects/", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<ProjectPayload>) =>
    apiFetch<Project>(`/projects/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/projects/${id}/`, { method: "DELETE", skipJson: true }),
  detail: (id: number) => apiFetch<ProjectDetail>(`/projects/${id}/detail/`),
};

export const taskApi = {
  list: (query = "") => apiFetch<Paginated<Task> | Task[]>(`/tasks/${query}`),
  create: (payload: TaskPayload) => apiFetch<Task>("/tasks/", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: number, payload: Partial<TaskPayload> | { status: TaskStatus }) =>
    apiFetch<Task>(`/tasks/${id}/`, { method: "PATCH", body: JSON.stringify(payload) }),
  remove: (id: number) => apiFetch<void>(`/tasks/${id}/`, { method: "DELETE", skipJson: true }),
};

export interface ProjectPayload {
  title: string;
  description: string;
  due_date: string;
  member_ids: number[];
}

export interface TaskPayload {
  title: string;
  description: string;
  status: TaskStatus;
  priority: "LOW" | "MEDIUM" | "HIGH";
  due_date: string;
  assigned_to_id: number | null;
  project_id: number;
}
