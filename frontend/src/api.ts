export interface Project {
  id: string;
  name: string;
  path: string;
  has_session: boolean;
  session_id: string | null;
}

const TOKEN_KEY = "kv_token";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (res.status === 401 && !url.includes("/login") && !url.includes("/me")) {
    clearToken();
    window.location.reload();
    throw new Error("Not authenticated");
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.detail || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  login: (username: string, password: string) =>
    request<{ token: string; username: string }>("/api/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  me: () => request<{ username: string }>("/api/me"),

  listProjects: () => request<Project[]>("/api/projects"),

  createProject: (path: string) =>
    request<Project>("/api/projects", {
      method: "POST",
      body: JSON.stringify({ path }),
    }),

  deleteProject: (id: string) =>
    request<{ status: string }>(`/api/projects/${id}`, { method: "DELETE" }),

  startSession: (projectId: string) =>
    request<{ session_id: string; project_id: string }>(
      `/api/projects/${projectId}/session`,
      { method: "POST" },
    ),

  stopSession: (projectId: string) =>
    request<{ status: string }>(`/api/projects/${projectId}/session`, {
      method: "DELETE",
    }),
};
