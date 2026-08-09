import { useEffect, useState } from "react";

const RESUME_TOKEN_KEY = "straxor.pwa.resumeToken";
const RESUME_META_KEY = "straxor.pwa.resumeMeta";

export function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function makeResumeToken(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function updateResumeMeta(reason: string): void {
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
      })
    );
  } catch {
    // Ignore localStorage failures.
  }
}

export function getResumeToken(): string | null {
  try {
    return localStorage.getItem(RESUME_TOKEN_KEY);
  } catch {
    return null;
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
