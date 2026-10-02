export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:3000/api";

export function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("merchant_token");
}

export function setToken(token: string) {
  localStorage.setItem("merchant_token", token);
}

export function clearToken() {
  localStorage.removeItem("merchant_token");
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/merchant/login")) {
      clearToken();
      window.location.href = "/login";
    }
    const message = data?.message;
    throw new Error(Array.isArray(message) ? message.join("；") : message || "请求失败");
  }
  return data as T;
}

export async function downloadAuthed(path: string, filename: string) {
  const token = getToken();
  const res = await fetch(`${API_BASE}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("下载失败");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
