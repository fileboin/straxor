import { useRef, type FormEvent, type ReactNode } from "react";
import InputToolbar from "./InputToolbar.js";
import { t } from "../../lib/i18n.js";

interface Props {
  icon: string;
  iconColor: "blue" | "accent";
  title: string;
  subtitle: string;
  placeholder: string;
  input: string;
  onInputChange: (value: string) => void;
  loading?: boolean;
  isSteerable?: boolean;
  canSend?: boolean;
  onSubmit: (e: FormEvent) => void;
  onOpenModelPicker: () => void;
  onOpenPromptLibrary: () => void;
  onToolbarAction: (actionId: string) => void;
  roleSelector?: ReactNode;
  micState?: "idle" | "recording" | "processing";
  budgetPopover?: ReactNode;
  micStatusBar?: ReactNode;
  errorBar?: ReactNode;
  attachmentChips?: ReactNode;
}

export default function WelcomeHero({
  icon,
  iconColor,
  title,
  subtitle,
  placeholder,
  input,
  onInputChange,
  loading,
  isSteerable,
  canSend,
  onSubmit,
  onOpenModelPicker,
  onOpenPromptLibrary,
  onToolbarAction,
  roleSelector,
  micState,
  budgetPopover,
  micStatusBar,
  errorBar,
  attachmentChips,
}: Props) {
  const formRef = useRef<HTMLFormElement>(null);

  const submitFromKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  const disabled = (loading && !isSteerable) || !canSend;

  return (
    <div
      className="relative flex-1 flex flex-col min-h-0 overflow-y-auto"
      style={{ background: "linear-gradient(150deg, #12182a 0%, #0a0e1a 55%, #1a2130 100%)" }}
    >
      <div
        className="absolute -top-24 -left-24 w-80 h-80 rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #ff4d2e 0%, transparent 70%)" }}
      />
      <div
        className="absolute -bottom-24 -right-16 w-80 h-80 rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)" }}
      />
      <div className="absolute inset-0 bg-black/10 backdrop-blur-[1px] pointer-events-none" />

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-6 gap-3 sm:gap-4">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold ${
            iconColor === "blue" ? "bg-accent-blue/20 text-accent-blue" : "bg-accent/20 text-accent"
          }`}
        >
          {icon}
        </div>

        <h1 className="text-[26px] sm:text-[32px] leading-tight font-bold text-white text-center max-w-lg">
          {title}
        </h1>
        <p className="text-[14px] sm:text-[16px] leading-relaxed text-[#B8C4D9] text-center max-w-md">
          {subtitle}
        </p>

        <form
          ref={formRef}
          onSubmit={onSubmit}
          className="w-full max-w-xl mt-1 rounded-[18px] p-4 sm:p-5 flex flex-col gap-3"
          style={{
            background: "#12182A",
            border: "1px solid rgba(255,255,255,0.09)",
            boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
          }}
        >
          {budgetPopover}
          {micStatusBar}
          {errorBar}
          {attachmentChips}

          <textarea
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={submitFromKey}
            rows={1}
            placeholder={placeholder}
            disabled={loading && !isSteerable}
            className="resize-none bg-transparent border-none outline-none text-[16px] leading-snug text-[#C5CCDA] placeholder:text-[#C5CCDA] min-h-[24px] max-h-[88px] disabled:opacity-50"
          />

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <InputToolbar onAction={onToolbarAction} micState={micState} />
              {roleSelector}
              <button
                type="button"
                onClick={onOpenModelPicker}
                title={t("welcome.model")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[20px] border border-white/15 text-[#C5CCDA] hover:text-white hover:border-white/30 transition-colors text-[12px]"
              >
                ✦ {t("welcome.model")}
              </button>
              <button
                type="button"
                onClick={onOpenPromptLibrary}
                title={t("welcome.ideas")}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[20px] border border-white/15 text-[#C5CCDA] hover:text-white hover:border-white/30 transition-colors text-[12px]"
              >
                💡 {t("welcome.ideas")}
              </button>
            </div>
            <button
              type="submit"
              disabled={disabled}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-white text-sm sm:text-base transition-opacity hover:opacity-85 disabled:opacity-30 shrink-0"
              style={{ background: "#ff4d2e", boxShadow: "0 4px 16px rgba(255,77,46,0.45)" }}
              title={t("welcome.send")}
            >
              ↑
            </button>
          </div>
        </form>

        <div className="flex flex-col items-center gap-2 mt-1">
          <span className="text-[13px] sm:text-[14px] text-[#8A93A8]">{t("welcome.startFrom")}</span>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onOpenPromptLibrary}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-[20px] text-[12px] sm:text-[13px] text-[#C5CCDA] hover:text-white transition-colors"
              style={{ background: "#1A2035", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              🎨 {t("welcome.pillFigma")}
            </button>
            <button
              type="button"
              onClick={onOpenPromptLibrary}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-[20px] text-[12px] sm:text-[13px] text-[#C5CCDA] hover:text-white transition-colors"
              style={{ background: "#1A2035", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              👥 {t("welcome.pillTemplate")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
