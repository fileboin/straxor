import path from "path";
import fs from "fs/promises";
import { UPLOADS_DIR } from "../routes/upload.js";

export interface AttachmentRef {
  url?: string;
  name?: string;
  mimeType?: string;
}

export interface TextContentBlock {
  type: "text";
  text: string;
}

export interface ImageContentBlock {
  type: "image";
  image: { mediaType: string; data: string };
}

export type ContentBlock = TextContentBlock | ImageContentBlock;

export interface EngineAttachment {
  mime: string;
  filename?: string;
  data: string;
}

export interface ResolvedAttachments {
  contentBlocks: ContentBlock[];
  engineAttachments: EngineAttachment[];
  notes: string[];
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

const EXT_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

function parseDataUrl(url: string): { mediaType: string; data: string } | null {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(url);
  if (!m) return null;
  const mediaType = m[1] || "text/plain";
  if (m[2]) return { mediaType, data: m[3] };
  try {
    return {
      mediaType,
      data: Buffer.from(decodeURIComponent(m[3]), "latin1").toString("base64"),
    };
  } catch {
    return null;
  }
}

function extMimeOf(name: string | undefined): string | null {
  if (!name) return null;
  return EXT_MIME[path.extname(name).toLowerCase()] || null;
}

function noteText(name?: string, mimeType?: string): string {
  return `[Prilog: ${name || "fajl"}${mimeType ? ` (${mimeType})` : ""}]`;
}

async function readImageBlock(
  url: string | undefined,
  mimeType?: string,
  name?: string
): Promise<ImageContentBlock | null> {
  if (!url) return null;

  if (url.startsWith("data:")) {
    const parsed = parseDataUrl(url);
    if (!parsed) return null;
    const mediaType = parsed.mediaType.startsWith("image/")
      ? parsed.mediaType
      : mimeType?.startsWith("image/")
      ? mimeType
      : extMimeOf(name) || "image/jpeg";
    return { type: "image", image: { mediaType, data: parsed.data } };
  }

  const fileName = path.basename(url.split("?")[0].split("#")[0]);
  if (!fileName || fileName === "." || fileName === ".." || fileName.includes("\\")) {
    return null;
  }
  const filePath = path.join(UPLOADS_DIR, fileName);
  if (!filePath.startsWith(UPLOADS_DIR + path.sep)) return null;

  try {
    const stat = await fs.stat(filePath);
    if (!stat.isFile() || stat.size > MAX_IMAGE_BYTES) return null;
    const buf = await fs.readFile(filePath);
    const mediaType = mimeType?.startsWith("image/")
      ? mimeType
      : extMimeOf(fileName) || mimeType || "image/jpeg";
    return { type: "image", image: { mediaType, data: buf.toString("base64") } };
  } catch {
    return null;
  }
}

export async function resolveAttachments(
  attachments?: AttachmentRef[]
): Promise<ResolvedAttachments> {
  const contentBlocks: ContentBlock[] = [];
  const engineAttachments: EngineAttachment[] = [];
  const notes: string[] = [];

  if (!attachments || attachments.length === 0) {
    return { contentBlocks, engineAttachments, notes };
  }

  for (const att of attachments) {
    const isImage = att.mimeType?.startsWith("image/") || extMimeOf(att.name) !== null;
    if (isImage) {
      const img = await readImageBlock(att.url, att.mimeType, att.name);
      if (img) {
        contentBlocks.push(img);
        engineAttachments.push({
          mime: img.image.mediaType,
          filename: att.name || "image",
          data: img.image.data,
        });
      } else {
        const note = noteText(att.name, att.mimeType);
        contentBlocks.push({ type: "text", text: note });
        notes.push(note);
      }
    } else {
      const note = noteText(att.name, att.mimeType);
      contentBlocks.push({ type: "text", text: note });
      notes.push(note);
    }
  }

  return { contentBlocks, engineAttachments, notes };
}

export function countImageBlocks(blocks: ContentBlock[]): number {
  return blocks.filter((b) => b.type === "image").length;
}
