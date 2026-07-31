import { api } from "./api.js";

export interface Attachment {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export interface UploadResponse {
  id: string;
  url: string;
  name: string;
  size: number;
  mimeType: string;
}

export async function uploadFile(file: File): Promise<UploadResponse> {
  const form = new FormData();
  form.append("file", file);
  return api<UploadResponse>("/upload", { method: "POST", body: form });
}

export function isImageAttachment(att: Attachment): boolean {
  return att.mimeType.startsWith("image/");
}

export function isAudioAttachment(att: Attachment): boolean {
  return att.mimeType.startsWith("audio/");
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}
