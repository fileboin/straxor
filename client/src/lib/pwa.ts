import { useEffect, useState } from "react";

const RESUME_TOKEN_KEY = "straxor.pwa.resumeToken";
const RESUME_META_KEY = "straxor.pwa.resumeMeta";

export interface PwaResumeMeta {
  token: string;
  reason: string;
  href: string;
  path: string;
  standalone: boolean;
  savedAt: number;
}

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function makeResumeToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function updateResumeMeta(reason: string): void {
  try {
    const existing = localStorage.getItem(RESUME_TOKEN_KEY) || makeResumeToken();
    localStorage.setItem(RESUME_TOKEN_KEY, existing);
    localStorage.setItem(
      RESUME_META_KEY,
      JSON.stringify({
        token: existing,
        reason,
        href: window.location.href,
        path: `${window.location.pathname}${window.location.search}${window.location.hash}`,
        standalone: isStandalone(),
        savedAt: Date.now(),
      } satisfies PwaResumeMeta)
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function getResumeToken(): string | null {
  try {
    if (!localStorage.getItem(RESUME_TOKEN_KEY)) {
      localStorage.setItem(RESUME_TOKEN_KEY, makeResumeToken());
    }
  } catch {
    // Ignore localStorage failures.
  }
  try {
    return localStorage.getItem(RESUME_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getResumeMeta(): PwaResumeMeta | null {
  try {
    const raw = localStorage.getItem(RESUME_META_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PwaResumeMeta>;
    if (!parsed || typeof parsed !== "object") return null;
    if (typeof parsed.token !== "string" || typeof parsed.reason !== "string") return null;
    return {
      token: parsed.token,
      reason: parsed.reason,
      href: typeof parsed.href === "string" ? parsed.href : window.location.href,
      path: typeof parsed.path === "string" ? parsed.path : `${window.location.pathname}${window.location.search}${window.location.hash}`,
      standalone: parsed.standalone === true,
      savedAt: typeof parsed.savedAt === "number" ? parsed.savedAt : 0,
    };
  } catch {
    return null;
  }
}

export async function getServiceWorkerDiagnostics(): Promise<{
  supported: boolean;
  registered: boolean;
  controller: boolean;
  scope: string | null;
}> {
  if (!("serviceWorker" in navigator)) {
    return { supported: false, registered: false, controller: false, scope: null };
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    return {
      supported: true,
      registered: !!reg,
      controller: !!navigator.serviceWorker.controller,
      scope: reg?.scope || null,
    };
  } catch {
    return {
      supported: true,
      registered: false,
      controller: !!navigator.serviceWorker.controller,
      scope: null,
    };
  }
}

export function registerServiceWorker(): void {
  updateResumeMeta("boot");
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => {
        reg.update().catch(() => {});
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          updateResumeMeta("controllerchange");
          window.location.reload();
        });
      })
      .catch(() => {});
  });

  window.addEventListener("pagehide", () => updateResumeMeta("pagehide"));
  window.addEventListener("beforeunload", () => updateResumeMeta("beforeunload"));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") updateResumeMeta("hidden");
  });
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    updateResumeMeta("install-listener");
    if (isStandalone()) return;
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      updateResumeMeta("beforeinstallprompt");
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      updateResumeMeta("appinstalled");
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    updateResumeMeta("install-prompt-opened");
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    updateResumeMeta(`install-${outcome}`);
    if (outcome === "accepted") setDeferred(null);
  };

  return {
    canInstall: !!deferred && !installed && !isStandalone(),
    promptInstall,
    resumeToken: getResumeToken(),
  };
}
