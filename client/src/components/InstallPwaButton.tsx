import { useInstallPrompt } from "../lib/pwa.js";
import { t, useLang } from "../lib/i18n.js";

export default function InstallPwaButton() {
  const { canInstall, promptInstall } = useInstallPrompt();
  useLang();
  if (!canInstall) return null;

  return (
    <button
      onClick={promptInstall}
      className="fixed bottom-4 left-4 z-40 flex items-center gap-2 px-3 py-2 rounded-xl border border-accent-border bg-accent/10 text-accent text-[12px] font-medium shadow-lg shadow-black/20 hover:bg-accent/20 transition-colors backdrop-blur-sm"
      title={t("pwa.install.title")}
    >
      <span className="text-sm leading-none">⬇</span>
      <span>{t("pwa.install")}</span>
      <span className="hidden sm:inline text-[10px] text-accent/70">({t("pwa.install.title")})</span>
    </button>
  );
}
