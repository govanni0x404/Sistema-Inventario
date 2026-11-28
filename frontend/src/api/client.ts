const BASE_URL = "/api";
const TOKEN_KEY = "inventario_token";

export class ApiError extends Error {
  status: number;
  detalles?: unknown;

  constructor(message: string, status: number, detalles?: unknown) {
    super(message);
    this.status = status;
    this.detalles = detalles;
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

let onSessionExpired: (() => void) | null = null;
export function setSessionExpiredHandler(fn: (() => void) | null) {
  onSessionExpired = fn;
}

async function request<T>(path: string, options: RequestInit = {}, formato: "json" | "blob" = "json"): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch (error) {
    // Una cancelación (AbortController) no es un error de red: se propaga tal cual.
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("Error de red", 0);
  }

  if (res.status === 204) return undefined as T;
  if (res.ok && formato === "blob") return await res.blob() as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 && token) {
      onSessionExpired?.();
    }
    throw new ApiError(body?.error || `Error del servidor (${res.status})`, res.status, body?.detalles);
  }

  return body as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  getBlob: (path: string, signal: AbortSignal) => request<Blob>(path, { signal }, "blob"),
  post: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(data) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
