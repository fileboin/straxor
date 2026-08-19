type ApiOptions = Omit<RequestInit, "body"> & { body?: unknown };

// Current call style: api<T>("/path", { method, body, ... })
export async function api<T>(path: string, options?: ApiOptions): Promise<T>;
// Legacy call style used by several lib modules: api<T>("GET", "/api/path", body?)
export async function api<T>(method: string, path: string, body?: unknown): Promise<T>;
export async function api<T>(arg1: string, arg2?: ApiOptions | string, arg3?: unknown): Promise<T> {
  // Legacy 3-arg form (method, "/api/path", body?). Normalize it to the
  // new (path, options) form. The /api prefix is stripped because this helper
  // always prepends it itself.
  if (typeof arg2 === "string") {
    const options: ApiOptions = { method: arg1 };
    if (arg3 !== undefined) options.body = arg3;
    return api<T>(arg2.replace(/^\/api/, ""), options);
  }

  const path = arg1;
  const options: ApiOptions = arg2 ?? {};
  const base = import.meta.env.VITE_API_URL || "";
  const token = localStorage.getItem("token");

  const body = options.body !== undefined
    ? (typeof options.body === "object" && !(options.body instanceof FormData) && !(options.body instanceof URLSearchParams)
        ? JSON.stringify(options.body)
        : options.body as BodyInit)
    : undefined;

  const isForm = body instanceof FormData;
  const isUrlEncoded = body instanceof URLSearchParams;

  const res = await fetch(`${base}/api${path}`, {
    ...options,
    body,
    headers: {
      ...(!isForm && !isUrlEncoded ? { "Content-Type": "application/json" } : {}),
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
