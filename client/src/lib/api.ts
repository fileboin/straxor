type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

const API_BASE = "/api";

export async function api<T>(
  path: string,
  options: ApiOptions = {}
): Promise<T> {
  const token = localStorage.getItem("token");

  const body = options.body !== undefined
    ? (typeof options.body === "object" && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)
        ? JSON.stringify(options.body)
        : options.body as BodyInit)
    : undefined;

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    body,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers as Record<string, string>,
    },
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || "Greška");
  }

  return data as T;
}
