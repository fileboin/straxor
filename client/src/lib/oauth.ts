export async function startGitHubOAuth(returnTo = "/"): Promise<void> {
  const res = await fetch(`/api/auth/github?returnTo=${encodeURIComponent(returnTo)}`, {
    method: "GET",
    redirect: "manual",
    credentials: "include",
  });

  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get("Location") || res.headers.get("location");
    if (!location) throw new Error("GitHub OAuth redirect nije vraćen sa servera");
    window.location.assign(location);
    return;
  }

  const data = await res.json().catch(() => ({ error: "GitHub OAuth nije dostupan" }));
  throw new Error(data.error || "GitHub OAuth nije dostupan");
}
