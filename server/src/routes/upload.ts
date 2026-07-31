import { Router } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { fileURLToPath } from "url";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "../../uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

const EXT_WHITELIST = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif",
  ".mp3", ".wav", ".ogg", ".webm", ".m4a",
  ".pdf", ".txt", ".md", ".csv", ".json",
]);

function extFor(file: Express.Multer.File): string {
  const ext = path.extname(file.originalname).toLowerCase();
  if (EXT_WHITELIST.has(ext)) return ext;
  if (file.mimetype.startsWith("image/")) return ".img";
  if (file.mimetype.startsWith("audio/")) return ".audio";
  return ".bin";
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${randomUUID().slice(0, 8)}${extFor(file)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (EXT_WHITELIST.has(ext)) return cb(null, true);
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    if (file.mimetype.startsWith("audio/")) return cb(null, true);
    if (file.mimetype === "application/pdf" || file.mimetype === "text/plain" || file.mimetype === "text/markdown") return cb(null, true);
    cb(new Error(`Nepodržan tip fajla: ${file.mimetype}`));
  },
});

// POST /api/upload — single file upload (max 10 MB)
router.post("/", requireAuth, (req, res) => {
  upload.single("file")(req, res, (err: unknown) => {
    if (err) {
      const msg = err instanceof multer.MulterError
        ? err.code === "LIMIT_FILE_SIZE"
          ? "Fajl je prevelik (max 10 MB)"
          : "Greška pri upload-u fajla"
        : err instanceof Error
        ? err.message
        : "Greška pri upload-u fajla";
      return res.status(400).json({ error: msg });
    }

    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "Nedostaje fajl (polje 'file')" });
    }

    res.status(201).json({
      id: path.basename(file.filename, path.extname(file.filename)),
      url: `/uploads/${file.filename}`,
      name: file.originalname,
      size: file.size,
      mimeType: file.mimetype,
    });
  });
});

export default router;
