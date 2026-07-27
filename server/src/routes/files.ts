import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { getAdapters } from "../adapters/registry.js";

interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
  size?: number;
}

const router = Router();

function getExec(userId: string) {
  const runtime = getAdapters().runtime(userId);
  return (machineId: string, cmd: string) => runtime.executeCommand(machineId, cmd);
}

// GET /api/files/tree — list directory tree
router.get("/tree", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, rootPath } = req.query;
    if (!machineId) return res.status(400).json({ error: "machineId required" });

    const exec = getExec(userId);
    const path = rootPath || ".";

    const output = await exec(
      machineId,
      `find ${path} -maxdepth 4 -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/__pycache__/*' -not -path '*/.venv/*' -not -path '*/target/*' 2>/dev/null | head -500`
    );

    const lines = output.trim().split("\n").filter(Boolean);
    const entries = buildTree(lines, path);
    res.json(entries);
  } catch (error) {
    console.error("Error listing files:", error);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// GET /api/files/read — read file content
router.get("/read", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, path } = req.query;
    if (!machineId || !path) {
      return res.status(400).json({ error: "machineId and path required" });
    }

    const exec = getExec(userId);

    const sizeOutput = await exec(machineId, `wc -c < "${path}" 2>/dev/null || echo "0"`);
    const size = parseInt(sizeOutput.trim(), 10);
    if (size > 1024 * 1024) {
      return res.status(400).json({ error: "File too large (>1MB)" });
    }

    const output = await exec(machineId, `cat "${path}" 2>/dev/null || echo ""`);
    const content = output.replace(/\n$/, "");

    const hasBinary = /[\x00-\x08\x0e-\x1f]/.test(content);
    if (hasBinary) {
      return res.json({ content: "[Binary file]", binary: true });
    }

    res.json({ content, binary: false });
  } catch (error) {
    console.error("Error reading file:", error);
    res.status(500).json({ error: "Failed to read file" });
  }
});

// POST /api/files/write — write file content
router.post("/write", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, path: filePath, content } = req.body;
    if (!machineId || !filePath || content === undefined) {
      return res.status(400).json({ error: "machineId, path, and content required" });
    }

    const exec = getExec(userId);

    // Use printf for safe content writing (handles newlines, special chars)
    const escaped = content
      .replace(/\\/g, "\\\\")
      .replace(/%/g, "%%")
      .replace(/'/g, "'\\''")
      .replace(/\n/g, "\\n")
      .replace(/\r/g, "\\r")
      .replace(/\t/g, "\\t");

    await exec(machineId, `printf '%s' '${escaped}' > "${filePath}"`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error writing file:", error);
    res.status(500).json({ error: "Failed to write file" });
  }
});

// POST /api/files/delete — delete file or directory
router.post("/delete", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, path: filePath } = req.body;
    if (!machineId || !filePath) {
      return res.status(400).json({ error: "machineId and path required" });
    }

    const exec = getExec(userId);
    await exec(machineId, `rm -rf "${filePath}"`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error deleting file:", error);
    res.status(500).json({ error: "Failed to delete file" });
  }
});

// POST /api/files/mkdir — create directory
router.post("/mkdir", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, path: dirPath } = req.body;
    if (!machineId || !dirPath) {
      return res.status(400).json({ error: "machineId and path required" });
    }

    const exec = getExec(userId);
    await exec(machineId, `mkdir -p "${dirPath}"`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating directory:", error);
    res.status(500).json({ error: "Failed to create directory" });
  }
});

// POST /api/files/touch — create empty file
router.post("/touch", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, path: filePath } = req.body;
    if (!machineId || !filePath) {
      return res.status(400).json({ error: "machineId and path required" });
    }

    const exec = getExec(userId);
    await exec(machineId, `touch "${filePath}"`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error creating file:", error);
    res.status(500).json({ error: "Failed to create file" });
  }
});

// POST /api/files/rename — rename / move file or directory
router.post("/rename", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, oldPath, newPath } = req.body;
    if (!machineId || !oldPath || !newPath) {
      return res.status(400).json({ error: "machineId, oldPath, and newPath required" });
    }

    const exec = getExec(userId);
    await exec(machineId, `mv "${oldPath}" "${newPath}"`);
    res.json({ success: true });
  } catch (error) {
    console.error("Error renaming file:", error);
    res.status(500).json({ error: "Failed to rename file" });
  }
});

// GET /api/files/search — search file content
router.get("/search", requireAuth, async (req: any, res) => {
  try {
    const userId = req.userId;
    const { machineId, query, rootPath } = req.query;
    if (!machineId || !query) {
      return res.status(400).json({ error: "machineId and query required" });
    }

    const exec = getExec(userId);
    const path = rootPath || ".";

    const output = await exec(
      machineId,
      `grep -rn --include='*' -I "${query}" ${path} 2>/dev/null | grep -v node_modules | grep -v '.git/' | head -50`
    );

    const results = output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(":");
        return {
          path: parts[0] || "",
          line: parseInt(parts[1] || "0", 10),
          content: parts.slice(2).join(":").trim(),
        };
      });

    res.json(results);
  } catch (error) {
    console.error("Error searching files:", error);
    res.status(500).json({ error: "Failed to search files" });
  }
});

// ── Helpers ──

function buildTree(lines: string[], rootPath: string): FileEntry[] {
  const entries: FileEntry[] = [];
  const seen = new Set<string>();

  const sorted = [...lines].sort((a, b) => {
    const aIsDir = a.endsWith("/");
    const bIsDir = b.endsWith("/");
    if (aIsDir && !bIsDir) return -1;
    if (!aIsDir && bIsDir) return 1;
    return a.localeCompare(b);
  });

  for (const line of sorted) {
    const cleanPath = line.replace(/\/$/, "");
    const name = cleanPath.split("/").pop() || cleanPath;
    const isDir = line.endsWith("/");

    if (name === "node_modules" || name === ".git" || name === "dist" || name === ".next" || name === "__pycache__" || name === ".venv" || name === "target") continue;

    const relativePath = cleanPath.startsWith(rootPath + "/")
      ? cleanPath.slice(rootPath.length + 1)
      : cleanPath;
    const depth = relativePath.split("/").length - 1;

    if (depth > 3) continue;
    if (seen.has(cleanPath)) continue;
    seen.add(cleanPath);

    entries.push({
      name,
      path: cleanPath,
      type: isDir ? "directory" : "file",
    });
  }

  return entries;
}

export default router;
