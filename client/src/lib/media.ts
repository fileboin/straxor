import { getLang } from "./i18n.js";

interface RecognitionEventLike {
  resultIndex?: number;
  results?: ArrayLike<{
    isFinal?: boolean;
    0?: { transcript?: string } | null;
  }>;
}

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
}

interface SpeechRecognitionCtorLike {
  new (): SpeechRecognitionLike;
}

type WindowWithSpeech = Window & {
  SpeechRecognition?: SpeechRecognitionCtorLike;
  webkitSpeechRecognition?: SpeechRecognitionCtorLike;
};

export function hasSpeechRecognition(): boolean {
  const w = window as WindowWithSpeech;
  return typeof w.SpeechRecognition !== "undefined" || typeof w.webkitSpeechRecognition !== "undefined";
}

// Web Speech API accepts BCP-47 tags. Map the app's 2-letter language codes to
// concrete regional tags for more reliable recognition; the bare 2-letter code
// itself is a valid fallback for every supported language.
const SPEECH_LANG_TAGS: Record<string, string> = {
  en: "en-US",
  sr: "sr-RS",
  sv: "sv-SE",
  de: "de-DE",
  fr: "fr-FR",
  es: "es-ES",
  it: "it-IT",
  pt: "pt-PT",
  nl: "nl-NL",
  pl: "pl-PL",
  ru: "ru-RU",
  uk: "uk-UA",
  zh: "zh-CN",
  ja: "ja-JP",
  ko: "ko-KR",
  ar: "ar-SA",
  hi: "hi-IN",
  tr: "tr-TR",
  el: "el-GR",
  cs: "cs-CZ",
  da: "da-DK",
  fi: "fi-FI",
  no: "nb-NO",
  ro: "ro-RO",
  hu: "hu-HU",
  sk: "sk-SK",
  bg: "bg-BG",
};

export function createSpeechRecognition(): SpeechRecognitionLike | null {
  const w = window as WindowWithSpeech;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) return null;
  const rec = new Ctor();
  const appLang = getLang();
  // Always follow the app's selected language (default: English). We never
  // bind recognition to the device/browser language so SR, SV and any other
  // language keep working regardless of the phone's locale.
  rec.lang = SPEECH_LANG_TAGS[appLang] || appLang || "en-US";
  rec.interimResults = true;
  rec.maxAlternatives = 1;
  return rec;
}

export interface RecordAudioCallbacks {
  onStart?: () => void;
  onBlob?: (blob: Blob) => void;
  onError?: (err: unknown) => void;
}

export function recordAudio(cbs: RecordAudioCallbacks): () => void {
  let stop = () => {};
  let cancelled = false;

  (async () => {
    let stream: MediaStream | null = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      cbs.onError?.(err);
      return;
    }
    if (cancelled) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const mimeTypes = ["audio/webm", "audio/ogg", "audio/mp4"];
    const mimeType = mimeTypes.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) || "";
    let recorder: MediaRecorder | null = null;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch (err) {
      cbs.onError?.(err);
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      stream?.getTracks().forEach((t) => t.stop());
      if (!cancelled) {
        cbs.onBlob?.(new Blob(chunks, { type: recorder?.mimeType || "audio/webm" }));
      }
    };

    recorder.start();
    cbs.onStart?.();

    stop = () => {
      try {
        if (recorder && recorder.state !== "inactive") recorder.stop();
      } catch {
        stream?.getTracks().forEach((t) => t.stop());
      }
    };
  })();

  return () => {
    cancelled = true;
    stop();
  };
}

export function openCameraStream(
  video: HTMLVideoElement,
  cbs: { onReady?: () => void; onError?: (err: unknown) => void }
): () => void {
  let stream: MediaStream | null = null;
  let closed = false;

  (async () => {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
    } catch (err) {
      cbs.onError?.(err);
      return;
    }
    if (closed) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }
    video.srcObject = stream;
    await video.play().catch(() => {});
    cbs.onReady?.();
  })();

  return () => {
    closed = true;
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    if (video.srcObject) {
      video.srcObject = null;
    }
  };
}

export function capturePhoto(video: HTMLVideoElement): Promise<Blob | null> {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 640;
  canvas.height = video.videoHeight || 480;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Promise.resolve(null);
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), "image/jpeg", 0.92);
  });
}
