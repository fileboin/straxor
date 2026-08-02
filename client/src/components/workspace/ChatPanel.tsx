import { useState, useRef, useEffect, type FormEvent, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import ProviderModelDropdown from "./ProviderModelDropdown.js";
import ModelPickerModal from "./ModelPickerModal.js";
import InputToolbar from "./InputToolbar.js";
import InfoTip from "./InfoTip.js";
import WelcomeHero from "./WelcomeHero.js";
import PanelMenu from "./PanelMenu.js";
import InlineApiKeyForm from "./InlineApiKeyForm.js";
import { useModelCatalog, type ThinkingBudget } from "../../lib/models.js";
import type { AgentRole } from "../../lib/roles.js";
import { t, useLang } from "../../lib/i18n.js";
import { estimatePlan, formatCost, formatTokens } from "../../lib/plan-preview.js";
import {
  type Attachment,
  type UploadResponse,
  uploadFile,
  isImageAttachment,
  isAudioAttachment,
  formatFileSize,
} from "../../lib/attachments.js";
import {
  hasSpeechRecognition,
  createSpeechRecognition,
  recordAudio,
  openCameraStream,
  capturePhoto,
} from "../../lib/media.js";

export interface ToolCall {
  id: string;
  name: string;
  args: Record<string, unknown> | string;
  result?: string;
  status: "pending" | "running" | "completed" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  label?: string;
  toolCalls?: ToolCall[];
  attachments?: Attachment[];
}

interface Props {
  title: string;
  icon: string;
  iconColor: "blue" | "accent";
  badge: string;
  badgeColor?: "blue" | "accent";
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  onProviderChange: (providerId: string) => void;
  onModelChange: (modelId: string) => void;
  onThinkingChange: (budget: ThinkingBudget) => void;
  messages: ChatMessage[];
  inputPlaceholder: string;
  onSend: (message: string, attachments?: Attachment[]) => void;
  onConnectVps?: () => void;
  onOpenGitRemote?: () => void;
  loading?: boolean;
  streamingMessageId?: string | null;
  onApiKeyChange?: () => void;
  headerContent?: React.ReactNode;
  headerLeft?: React.ReactNode;
  copyLabel?: string;
  onCopyTo?: (content: string) => void;
  prefill?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  zoom?: number;
  onZoomChange?: (z: number) => void;
  panelMenuKey?: string;
  role?: AgentRole;
  onRoleChange?: (role: AgentRole) => void;
  onOpenPromptLibrary?: () => void;
  isSteerable?: boolean;
  onSteerSend?: (message: string) => void;
  steerStatusText?: string;
  runtimeControl?: React.ReactNode;
  modelOrch?: boolean;
  onModelOrchChange?: (value: boolean) => void;
  modelOrchDisabled?: boolean;
  modelOrchHint?: string;
}

const ACCEPTED_EXT_RE = /\.(jpe?g|png|webp|gif|avif|mp3|wav|ogg|webm|m4a|pdf|txt|md|csv|json)$/i;

function ToolCallCard({ tool }: { tool: ToolCall }) {
  const [expanded, setExpanded] = useState(false);

  const argsStr = typeof tool.args === "string"
    ? tool.args
    : JSON.stringify(tool.args, null, 2);

  const statusIcon =
    tool.status === "running" ? "⟳" :
    tool.status === "completed" ? "✓" :
    tool.status === "error" ? "✗" : "○";

  const statusColor =
    tool.status === "running" ? "text-accent-blue animate-spin" :
    tool.status === "completed" ? "text-green-500" :
    tool.status === "error" ? "text-red-500" : "text-text-muted";

  return (
    <div className="mt-1.5 border border-border rounded-lg overflow-hidden text-[12px]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 bg-surface hover:bg-surface-2 transition-colors text-left"
      >
        <span className={`text-[11px] shrink-0 ${statusColor}`}>{statusIcon}</span>
        <span className="font-mono text-text-muted truncate">{tool.name}</span>
        <span className="ml-auto text-text-muted text-[10px] shrink-0">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-border">
          <div className="px-2.5 py-1.5">
            <div className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">args</div>
            <pre className="whitespace-pre-wrap break-all text-text font-mono text-[11px] max-h-32 overflow-y-auto">{argsStr}</pre>
          </div>
          {tool.result && (
            <div className="px-2.5 py-1.5 border-t border-border">
              <div className="text-[10px] text-text-muted uppercase tracking-wider mb-0.5">result</div>
              <pre className="whitespace-pre-wrap break-all text-text font-mono text-[11px] max-h-40 overflow-y-auto">{tool.result}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MessageAttachments({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {attachments.map((att) => (
        <a key={att.id} href={att.url} target="_blank" rel="noreferrer" title={`${att.name} (${formatFileSize(att.size)})`}>
          {isImageAttachment(att) ? (
            <img
              src={att.url}
              alt={att.name}
              loading="lazy"
              className="max-w-[180px] max-h-[160px] rounded-lg object-cover border border-border"
            />
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-border bg-surface-2 text-[11px] text-text-muted">
              <span>{isAudioAttachment(att) ? "🎵" : "📄"}</span>
              <span className="max-w-[140px] truncate">{att.name}</span>
            </span>
          )}
        </a>
      ))}
    </div>
  );
}

function AttachmentChips({
  attachments,
  uploadingCount,
  onRemove,
}: {
  attachments: Attachment[];
  uploadingCount: number;
  onRemove: (id: string) => void;
}) {
  if (attachments.length === 0 && uploadingCount === 0) return null;
  return (
    <div className="mb-2 flex flex-wrap gap-1.5">
      {attachments.map((att) => (
        <div key={att.id} className="group relative flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 rounded-lg border border-border bg-surface-2">
          {isImageAttachment(att) ? (
            <img src={att.url} alt={att.name} className="w-7 h-7 rounded-md object-cover" />
          ) : (
            <span className="w-7 h-7 rounded-md bg-surface-3 flex items-center justify-center text-xs">
              {isAudioAttachment(att) ? "🎵" : "📄"}
            </span>
          )}
          <span className="text-[11px] text-text-muted max-w-[120px] truncate">{att.name}</span>
          <button
            type="button"
            onClick={() => onRemove(att.id)}
            className="opacity-60 hover:opacity-100 text-[10px] text-text-muted hover:text-text"
            title={t("upload.remove")}
            aria-label={t("upload.remove")}
          >
            ✕
          </button>
        </div>
      ))}
      {uploadingCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-surface-2">
          <span className="w-3 h-3 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <span className="text-[11px] text-text-muted">{t("upload.uploading")}</span>
        </div>
      )}
    </div>
  );
}

export default function ChatPanel({
  title,
  icon,
  iconColor,
  badge,
  badgeColor,
  providerId,
  modelId,
  thinking,
  onProviderChange,
  onModelChange,
  onThinkingChange,
  messages,
  inputPlaceholder,
  onSend,
  onConnectVps,
  onOpenGitRemote,
  loading,
  streamingMessageId,
  onApiKeyChange,
  headerContent,
  headerLeft,
  copyLabel,
  onCopyTo,
  prefill,
  isExpanded,
  onToggleExpand,
  zoom = 1,
  onZoomChange,
  panelMenuKey = "ask",
  role,
  onRoleChange,
  onOpenPromptLibrary,
  isSteerable,
  onSteerSend,
  steerStatusText,
  runtimeControl,
  modelOrch,
  onModelOrchChange,
  modelOrchDisabled,
  modelOrchHint,
}: Props) {
  const [input, setInput] = useState("");
  useLang();
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [pendingAttachments, setPendingAttachments] = useState<Attachment[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [micState, setMicState] = useState<"idle" | "recording" | "processing">("idle");
  const [micError, setMicError] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [showKeyErrorForm, setShowKeyErrorForm] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { providers: catalogProviders, loading: catalogLoading } = useModelCatalog();
  const providerName =
    catalogProviders.find((p) => p.id === providerId)?.name || providerId;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<ReturnType<typeof createSpeechRecognition>>(null);
  const recorderStopRef = useRef<(() => void) | null>(null);
  const cameraCleanupRef = useRef<(() => void) | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Apply prefill from other panel
  useEffect(() => {
    if (prefill) {
      setInput(prefill);
    }
  }, [prefill]);

  // Camera stream lifecycle
  useEffect(() => {
    if (!cameraOpen) return;
    const video = cameraVideoRef.current;
    if (!video) return;
    setCameraError("");
    cameraCleanupRef.current = openCameraStream(video, {
      onError: () => setCameraError(t("upload.camera.error")),
    });
    return () => {
      cameraCleanupRef.current?.();
      cameraCleanupRef.current = null;
    };
  }, [cameraOpen]);

  // Auto-clear transient errors
  useEffect(() => {
    if (!micError && !uploadError) return;
    const timer = setTimeout(() => {
      setMicError("");
      setUploadError("");
    }, 4000);
    return () => clearTimeout(timer);
  }, [micError, uploadError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort?.();
      } catch {
        /* noop */
      }
      recorderStopRef.current?.();
      cameraCleanupRef.current?.();
    };
  }, []);

  // Close the budget popover on Escape / outside click (non-blocking)
  const budgetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!budgetOpen) return;
    const onDown = (e: MouseEvent) => {
      if (budgetRef.current && !budgetRef.current.contains(e.target as Node)) {
        setBudgetOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setBudgetOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [budgetOpen]);

  const addAttachment = (up: UploadResponse) => {
    setPendingAttachments((prev) => [
      ...prev,
      { id: up.id, url: up.url, name: up.name, size: up.size, mimeType: up.mimeType },
    ]);
  };

  const uploadFileList = async (files: FileList | File[]) => {
    const list = Array.from(files);
    const valid: File[] = [];
    let rejected = 0;
    for (const f of list) {
      if (ACCEPTED_EXT_RE.test(f.name)) valid.push(f);
      else rejected++;
    }
    if (rejected > 0) setUploadError(t("upload.reject"));
    setUploadingCount((n) => n + valid.length);
    for (const f of valid) {
      try {
        const up = await uploadFile(f);
        addAttachment(up);
      } catch {
        setUploadError(t("upload.failed"));
      } finally {
        setUploadingCount((n) => Math.max(0, n - 1));
      }
    }
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) uploadFileList(files);
    e.target.value = "";
  };

  const startMicFallback = () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(t("toolbar.mic.unsupported"));
      setMicState("idle");
      return;
    }
    setMicState("processing");
    recorderStopRef.current = recordAudio({
      onStart: () => setMicState("recording"),
      onBlob: (blob) => {
        const ext =
          blob.type.includes("ogg") ? "ogg" :
          blob.type.includes("mp4") ? "m4a" :
          "webm";
        const file = new File([blob], `mic-${Date.now()}.${ext}`, {
          type: blob.type || "audio/webm",
        });
        setMicState("processing");
        uploadFile(file)
          .then(addAttachment)
          .catch(() => setUploadError(t("upload.failed")))
          .finally(() => setMicState("idle"));
      },
      onError: () => {
        setMicError(t("upload.mic.error"));
        setMicState("idle");
      },
    });
  };

  const handleMicToggle = () => {
    if (micState !== "idle") {
      stopMic();
      return;
    }
    setMicError("");
    if (hasSpeechRecognition()) {
      const rec = createSpeechRecognition();
      if (!rec) {
        startMicFallback();
        return;
      }
      recognitionRef.current = rec;
      rec.onresult = (e) => {
        let text = "";
        const results = e.results;
        if (results) {
          for (let i = 0; i < results.length; i++) {
            const r = results[i];
            if (r && r[0]?.transcript) text += r[0].transcript;
          }
        }
        if (text) setInput((prev) => (prev ? `${prev} ${text}` : text));
      };
      rec.onerror = (ev) => {
        if (ev.error === "not-allowed" || ev.error === "service-not-allowed") {
          setMicError(t("upload.mic.error"));
        }
      };
      rec.onend = () => {
        recognitionRef.current = null;
        setMicState("idle");
      };
      try {
        rec.start();
        setMicState("recording");
      } catch {
        recognitionRef.current = null;
        setMicState("idle");
        startMicFallback();
      }
    } else {
      startMicFallback();
    }
  };

  const stopMic = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        /* noop */
      }
      recognitionRef.current = null;
    }
    recorderStopRef.current?.();
    recorderStopRef.current = null;
    setMicState("idle");
  };

  const handleToolbarAction = (actionId: string) => {
    if (actionId === "connect-vps") {
      onConnectVps?.();
      return;
    }
    if (actionId === "github") {
      onOpenGitRemote?.();
      return;
    }
    if (actionId === "mic") {
      handleMicToggle();
      return;
    }
    if (actionId === "camera") {
      setCameraOpen(true);
      return;
    }
    if (actionId === "file") {
      fileInputRef.current?.click();
      return;
    }
    if (actionId === "image") {
      imageInputRef.current?.click();
      return;
    }
    if (actionId === "model") {
      setShowModelPicker(true);
      return;
    }
    if (actionId === "prompts") {
      onOpenPromptLibrary?.();
      return;
    }
    if (actionId === "budget") {
      setBudgetOpen((b) => !b);
      return;
    }
  };

  const handleSendBudget = () => {
    const text = input.trim() || lastUserContent();
    if (!text) return;
    setBudgetOpen(false);
    const request =
      `Napravi detaljan proračun i budžet za ovaj projekat na osnovu sljedećeg zadatka. ` +
      `Daj procjenu troškova (tokens/cijena), koraka i vremena, te prijedlog modela.\n\n---\n\n${text}`;
    handleSubmitForBudget(request);
  };

  // Best available text for the budget estimate: current input, else last user message.
  const lastUserContent = () => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.role === "user" && m.content.trim()) return m.content.trim();
    }
    return "";
  };

  const handleSubmitForBudget = (msg: string) => {
    if (loading) return;
    onSend(msg);
    setInput("");
    setPendingAttachments([]);
  };

  const handleCameraClose = () => setCameraOpen(false);

  const handleCameraCapture = async () => {
    const video = cameraVideoRef.current;
    if (!video) return;
    const blob = await capturePhoto(video);
    if (!blob) return;
    const file = new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" });
    setUploadingCount((n) => n + 1);
    uploadFile(file)
      .then(addAttachment)
      .catch(() => setUploadError(t("upload.failed")))
      .finally(() => {
        setUploadingCount((n) => Math.max(0, n - 1));
        setCameraOpen(false);
      });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed && pendingAttachments.length === 0) return;

    // Steer mode — send instruction to running agent
    if (isSteerable && onSteerSend) {
      onSteerSend(trimmed);
      setInput("");
      return;
    }

    if (loading) return;

    onSend(trimmed, pendingAttachments);
    setInput("");
    setPendingAttachments([]);
  };

  const budgetText = input.trim() || lastUserContent();
  const budgetEstimate = budgetText ? estimatePlan(budgetText, providerId, modelId, thinking) : null;

  const isEmpty = messages.length === 0;

  const budgetPopover = budgetOpen && (
    <div ref={budgetRef} className="mb-2 rounded-xl border border-border bg-surface-2 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-[12px] font-semibold text-text">💰 {t("budget.title")}</span>
        <div className="flex items-center gap-2">
          <InfoTip text={t("toolbar.budgetInfo")} placement="bottom" />
          <button
            type="button"
            onClick={() => setBudgetOpen(false)}
            className="text-[10px] text-text-muted hover:text-text"
          >
            {t("budget.close")} ✕
          </button>
        </div>
      </div>
      {budgetEstimate ? (
        <>
          <div className="px-3 py-2.5">
            <p className="text-[11px] text-text-muted mb-2">{t("budget.desc")}</p>
            <div className="grid grid-cols-2 gap-2 text-[11px]">
              <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">{t("budget.cost")}</div>
                <div className="font-semibold text-accent">{formatCost(budgetEstimate.costUSD)}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">{t("budget.tokens")}</div>
                <div className="font-semibold">{formatTokens(budgetEstimate.totalTokens)}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">{t("budget.steps")}</div>
                <div className="font-semibold">{budgetEstimate.estimatedSteps}</div>
              </div>
              <div className="rounded-lg border border-border bg-surface px-2.5 py-1.5">
                <div className="text-[10px] text-text-muted uppercase tracking-wider">{t("budget.duration")}</div>
                <div className="font-semibold">{budgetEstimate.estimatedDuration}</div>
              </div>
            </div>
          </div>
          <div className="px-3 pb-2.5">
            <button
              type="button"
              onClick={handleSendBudget}
              disabled={loading}
              className="w-full py-1.5 text-[11px] font-medium rounded-lg bg-accent text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
            >
              {t("budget.send")}
            </button>
          </div>
        </>
      ) : (
        <div className="px-3 py-3 text-[12px] text-text-muted">{t("budget.empty")}</div>
      )}
    </div>
  );

  const micStatusBar = (micState === "recording" || micState === "processing") && (
    <div className="mb-2 flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] text-red-500">
      <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
      <span className="flex-1 min-w-0 truncate">
        {micState === "processing" ? t("toolbar.mic.processing") : t("toolbar.mic.recording")}
      </span>
      <button type="button" onClick={stopMic} className="shrink-0 hover:opacity-70">
        ■ {t("toolbar.mic.stop")}
      </button>
    </div>
  );

  const errorBar = (micError || uploadError) && (
    <div className="mb-2 px-2.5 py-1.5 rounded-lg border border-red-500/30 bg-red-500/10 text-[11px] text-red-500">
      {micError || uploadError}
    </div>
  );

  const attachmentChips = (
    <AttachmentChips
      attachments={pendingAttachments}
      uploadingCount={uploadingCount}
      onRemove={(id) =>
        setPendingAttachments((prev) => prev.filter((a) => a.id !== id))
      }
    />
  );

  const panelMenuNode = onZoomChange ? (
    <PanelMenu
      role={role || "developer"}
      onRoleChange={(r) => onRoleChange?.(r)}
      zoom={zoom}
      onZoomChange={onZoomChange}
      onOpenModelPicker={() => setShowModelPicker(true)}
      onOpenPromptLibrary={() => onOpenPromptLibrary?.()}
      onOpenGitRemote={() => onOpenGitRemote?.()}
      storageKey={panelMenuKey}
    />
  ) : null;

  return (
    <div className={`flex flex-col h-full min-h-0 overflow-hidden rounded-2xl ${isEmpty ? "border border-white/10" : "border border-border bg-surface shadow-lg shadow-black/30"}`}>
      {isEmpty ? (
        <WelcomeHero
          icon={icon}
          iconColor={iconColor}
          title={t("welcome.title")}
          subtitle={t("welcome.subtitle")}
          placeholder={inputPlaceholder}
          input={input}
          onInputChange={setInput}
          loading={loading}
          isSteerable={isSteerable}
          canSend={!!input.trim() || pendingAttachments.length > 0}
          onSubmit={handleSubmit}
          onOpenModelPicker={() => setShowModelPicker(true)}
          onOpenPromptLibrary={() => onOpenPromptLibrary?.()}
          onToolbarAction={handleToolbarAction}
          roleSelector={headerLeft}
          panelMenu={panelMenuNode}
          micState={micState}
          budgetPopover={budgetPopover}
          micStatusBar={micStatusBar}
          errorBar={errorBar}
          attachmentChips={attachmentChips}
        />
      ) : (
        <>
      {/* Header — title bar */}
      <div className="flex items-center justify-between px-2 py-2 border-b border-border bg-surface-2 shrink-0 gap-2 sm:px-3">
        <div className="flex items-center gap-1.5 min-w-0 sm:gap-2">
          <div
            className={`w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
              iconColor === "blue"
                ? "bg-accent-blue-dim text-accent-blue"
                : "bg-accent-dim text-accent"
            }`}
          >
            {icon}
          </div>
          <span className="font-semibold text-[13px]">{title}</span>
          <span
            className={`hidden sm:inline text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
              (badgeColor || iconColor) === "blue"
                ? "bg-accent-blue-dim text-accent-blue"
                : "bg-accent-dim text-accent"
            }`}
          >
            {badge}
          </span>
          {headerLeft}
        </div>
        <div className="flex items-center gap-1 shrink-0 sm:gap-2">
          {runtimeControl}
          {onModelOrchChange && (
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => !modelOrchDisabled && onModelOrchChange(!modelOrch)}
                disabled={modelOrchDisabled}
                className={`flex items-center gap-1 px-1.5 h-7 rounded-md border text-[10px] font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  modelOrch
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-transparent text-text-muted hover:text-text-secondary hover:border-border-light"
                }`}
                title={modelOrchHint || (modelOrch ? "Model orkestracija uključena" : "Model orkestracija isključena")}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${modelOrch ? "bg-accent" : "bg-text-muted"}`} />
                <span className="hidden lg:inline">M-Orch</span>
                <span className="lg:hidden">M</span>
              </button>
              <InfoTip text={modelOrchHint || "Model orkestracija — task se automatski rutira na najbolji model prema težini"} placement="bottom" />
            </div>
          )}
          {onToggleExpand && (
            <div className="flex items-center gap-0.5">
              <button
                onClick={onToggleExpand}
                className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border transition-colors"
                title={isExpanded ? t("panel.expand.exit") : t("panel.expand.enter")}
              >
                {isExpanded ? "⊟" : "⊞"}
              </button>
              <InfoTip text={isExpanded ? t("panel.expand.exit") : t("panel.expand.enter")} placement="bottom" />
            </div>
          )}
          {panelMenuNode}
          <button
            onClick={() => setShowModelPicker(true)}
            className="w-7 h-7 rounded-md flex items-center justify-center text-text-muted hover:text-text hover:bg-surface-2 border border-transparent hover:border-border transition-colors"
            title={t("models.pickerTitle")}
            aria-label="Model picker"
          >
            ✦
          </button>
          <InfoTip text={t("toolbar.modelInfo")} placement="bottom" />
          <ProviderModelDropdown
            providerId={providerId}
            modelId={modelId}
            thinking={thinking}
            onProviderChange={onProviderChange}
            onModelChange={onModelChange}
            onThinkingChange={onThinkingChange}
            onApiKeyChange={onApiKeyChange}
          />
        </div>
      </div>

      {/* Optional header content (e.g. TodoList) */}
      {headerContent}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 flex flex-col gap-2.5 sm:gap-3 min-h-0">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`group relative max-w-[90%] sm:max-w-[85%] px-3 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
              msg.role === "user"
                ? "self-end bg-accent text-white rounded-br-sm"
                : `self-start bg-surface-2 border border-border rounded-bl-sm ${
                    iconColor === "blue" ? "border-accent-blue-border/30" : ""
                  }`
            }`}
          >
            {msg.label && (
              <div className="text-[11px] font-semibold mb-1 opacity-60">
                {msg.label}
              </div>
            )}
            <div className="whitespace-pre-wrap">
              {msg.content}
              {streamingMessageId === msg.id && !msg.toolCalls?.length && (
                <span className="inline-block w-2 h-4 ml-0.5 bg-accent animate-pulse" />
              )}
            </div>
            {/* Missing API key error → inline "Add key" action */}
            {msg.role === "assistant" &&
              msg.content.includes("API key not configured") && (
                <div className="mt-1.5">
                  <button
                    onClick={() => setShowKeyErrorForm((v) => !v)}
                    className="text-[11px] font-medium px-2 py-1 rounded-lg border border-yellow-500/40 bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20 transition-colors"
                  >
                    {showKeyErrorForm ? t("common.cancel") : t("models.addApiKey")}
                  </button>
                  {showKeyErrorForm && (
                    <InlineApiKeyForm
                      providerId={providerId}
                      providerName={providerName}
                      autoFocus
                      onSaved={() => {
                        setShowKeyErrorForm(false);
                        onApiKeyChange?.();
                      }}
                    />
                  )}
                </div>
              )}
            {/* Message attachments */}
            {msg.attachments && msg.attachments.length > 0 && (
              <MessageAttachments attachments={msg.attachments} />
            )}
            {/* Tool calls */}
            {msg.toolCalls && msg.toolCalls.length > 0 && (
              <div className="mt-1">
                {msg.toolCalls.map((tc) => (
                  <ToolCallCard key={tc.id} tool={tc} />
                ))}
                {streamingMessageId === msg.id && (
                  <span className="inline-block w-2 h-4 mt-1 bg-accent animate-pulse" />
                )}
              </div>
            )}
            {/* Copy to other panel button — only on assistant messages */}
            {msg.role === "assistant" && onCopyTo && copyLabel && msg.content && (
              <button
                onClick={() => onCopyTo(msg.content)}
                className="absolute -bottom-3 left-0 opacity-0 group-hover:opacity-100 px-2 py-0.5 text-[10px] font-medium rounded-md border border-border bg-surface text-text-muted hover:text-text hover:border-border-light transition-all shadow-sm"
                title={copyLabel}
              >
                {copyLabel}
              </button>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Steer status bar */}
      {isSteerable && (
        <div className="px-3 py-1.5 border-t border-accent/30 bg-accent/5 flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
          <span className="text-[11px] text-accent font-medium">
            {steerStatusText || t("chat.steer.active")}
          </span>
        </div>
      )}

      {/* Input */}
      <div className="px-2 py-2 border-t border-border bg-surface shrink-0 sm:px-3 sm:py-2.5">
        {budgetPopover}
        {micStatusBar}
        {errorBar}
        {attachmentChips}

        <form
          onSubmit={handleSubmit}
          className={`flex items-center gap-2 px-2.5 py-1.5 rounded-[20px] border border-border bg-surface-2 transition-colors focus-within:border-accent sm:px-3 ${
            iconColor === "blue" ? "focus-within:border-accent-blue" : ""
          }`}
        >
          <InputToolbar
            onAction={handleToolbarAction}
            micState={micState}
          />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isSteerable ? t("chat.steer.placeholder") : inputPlaceholder}
            disabled={loading && !isSteerable}
            className="flex-1 bg-transparent text-text text-[13px] placeholder-text-muted outline-none border-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={(loading && !isSteerable) || (!input.trim() && pendingAttachments.length === 0)}
            className={`w-[30px] h-[30px] rounded-full border-none text-white text-sm flex items-center justify-center transition-opacity shrink-0 disabled:opacity-30 ${
              isSteerable ? "bg-accent" : iconColor === "blue" ? "bg-accent-blue" : "bg-accent"
            } hover:opacity-85`}
          >
            {isSteerable ? "\u2191" : "\u2191"}
          </button>
        </form>

        {/* Hidden file pickers */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFilesSelected}
          accept=".jpg,.jpeg,.png,.webp,.gif,.avif,.pdf,.txt,.md,.csv,.json,.mp3,.wav,.ogg,.webm,.m4a"
        />
        <input
          ref={imageInputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={handleFilesSelected}
        />
      </div>
        </>
      )}

      {/* Model picker modal */}
      {createPortal(
        <ModelPickerModal
          open={showModelPicker}
          title={t("models.modalTitle", { title })}
          providerId={providerId}
          modelId={modelId}
          thinking={thinking}
          providers={catalogProviders}
          loading={catalogLoading}
          onProviderChange={onProviderChange}
          onModelChange={onModelChange}
          onThinkingChange={onThinkingChange}
          onApiKeyChange={onApiKeyChange}
          onClose={() => setShowModelPicker(false)}
        />,
        document.body
      )}

      {/* Camera overlay */}
      {cameraOpen &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-black/90 p-4">
            <div className="flex items-center justify-between mb-3 shrink-0">
              <span className="text-[13px] font-semibold text-white">
                {t("toolbar.camera.alt")}
              </span>
              <button
                type="button"
                onClick={handleCameraClose}
                className="w-8 h-8 rounded-full bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-colors"
                title={t("toolbar.camera.close")}
                aria-label={t("toolbar.camera.close")}
              >
                ✕
              </button>
            </div>
            <div className="flex-1 flex items-center justify-center min-h-0">
              <video
                ref={cameraVideoRef}
                playsInline
                muted
                autoPlay
                className="max-w-full max-h-full rounded-xl object-contain"
              />
            </div>
            {cameraError && (
              <div className="text-red-400 text-[12px] text-center py-2 shrink-0">
                {cameraError}
              </div>
            )}
            <div className="flex items-center justify-center py-4 shrink-0">
              <button
                type="button"
                onClick={handleCameraCapture}
                className="w-14 h-14 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-colors"
                title={t("toolbar.camera.take")}
                aria-label={t("toolbar.camera.take")}
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
