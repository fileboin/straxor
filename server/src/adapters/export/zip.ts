import type {
  ExportAdapter,
  ExportOptions,
  ExportResult,
  ExportManifest,
  ExportFileEntry,
  ExportScope,
} from "./adapter.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const archiver: any = require("archiver");
import { createWriteStream, mkdirSync, existsSync, statSync, readdirSync, readFileSync } from "fs";
import { join, extname, relative } from "path";
import { tmpdir } from "os";
import { pipeline } from "stream/promises";

const SOURCE_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs",
  ".css", ".scss", ".less", ".styl",
  ".html", ".htm", ".vue", ".svelte",
  ".py", ".rb", ".go", ".rs", ".java",
  ".sql", ".graphql", ".gql",
  ".sh", ".bash", ".zsh",
]);

const ASSET_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp", ".ico", ".bmp",
  ".woff", ".woff2", ".ttf", ".otf", ".eot",
  ".mp3", ".mp4", ".webm", ".ogg", ".wav",
  ".pdf", ".doc", ".docx",
]);

const CONFIG_NAMES = new Set([
  "package.json", "tsconfig.json", "tsconfig.*.json",
  "vite.config.ts", "vite.config.js", "vite.config.mts",
  "tailwind.config.ts", "tailwind.config.js",
  "postcss.config.js", "postcss.config.mjs",
  ".eslintrc.js", ".eslintrc.json", ".eslintrc.cjs",
  ".prettierrc", ".prettierrc.json", ".prettierrc.js",
  ".env.example", ".env.local.example",
  "drizzle.config.ts", "drizzle.config.js",
  "next.config.js", "next.config.mjs",
  "nuxt.config.ts",
  "astro.config.mjs",
  "webpack.config.js",
  ".gitignore", ".dockerignore",
  "Dockerfile", "docker-compose.yml", "docker-compose.yaml",
  "Makefile", "CMakeLists.txt",
  "Cargo.toml", "go.mod", "go.sum",
  "requirements.txt", "pyproject.toml", "setup.py",
]);

const DOC_NAMES = new Set([
  "README.md", "README.txt", "README",
  "CHANGELOG.md", "CHANGELOG",
  "CONTRIBUTING.md", "LICENSE", "LICENSE.md",
  "SECURITY.md", "CODE_OF_CONDUCT.md",
]);

const DOC_DIRS = new Set(["docs", "doc", "documentation", ".github"]);

const SKIP_DIRS = new Set([
  "node_modules", ".git", ".next", ".nuxt", "dist", "build",
  "__pycache__", ".venv", "venv", ".cache",
]);

export function createZipExportAdapter(): ExportAdapter {
  return {
    async export(options: ExportOptions): Promise<ExportResult> {
      const exportDir = join(tmpdir(), `straxor-export-${Date.now()}`);
      mkdirSync(exportDir, { recursive: true });

      const zipPath = join(exportDir, `${options.projectId}.zip`);
      const manifest = await this.getManifest(options);

      return new Promise((resolve, reject) => {
        const output = createWriteStream(zipPath);
        const archive = archiver("zip", { zlib: { level: 6 } });

        output.on("close", () => {
          const fileSize = archive.pointer();
          resolve({
            success: true,
            manifest,
            downloadUrl: `/api/export/download/${options.projectId}`,
            fileSize,
          });
        });

        archive.on("error", (err: Error) => {
          reject(err);
        });

        archive.pipe(output);

        // Add files based on scopes
        if (options.machineId) {
          // VPS export — files come via SSH (handled by route)
          // For now, add manifest
          archive.append(JSON.stringify(manifest, null, 2), {
            name: "EXPORT_MANIFEST.json",
          });
        } else {
          // Local project export — generate synthetic files
          generateLocalExport(archive, options, manifest);
        }

        archive.finalize();
      });
    },

    async getManifest(options: ExportOptions): Promise<ExportManifest> {
      const files: ExportFileEntry[] = [];
      const scopes = options.scopes.includes("all")
        ? (["source", "assets", "config", "docs"] as ExportScope[])
        : options.scopes;

      // Generate manifest based on what we know about the project
      // In real implementation, this would scan the VPS via SSH
      const sampleFiles = generateSampleManifest(options.projectId, scopes);
      files.push(...sampleFiles);

      return {
        projectName: options.projectId,
        exportedAt: new Date().toISOString(),
        scopes,
        files,
        totalSize: files.reduce((sum, f) => sum + f.size, 0),
        totalFiles: files.length,
      };
    },
  };
}

function generateSampleManifest(projectId: string, scopes: ExportScope[]): ExportFileEntry[] {
  const files: ExportFileEntry[] = [];

  if (scopes.includes("source")) {
    files.push(
      { path: "src/index.ts", size: 1024, scope: "source" },
      { path: "src/App.tsx", size: 2048, scope: "source" },
      { path: "src/components/Button.tsx", size: 512, scope: "source" },
      { path: "src/styles/globals.css", size: 1024, scope: "source" },
    );
  }
  if (scopes.includes("config")) {
    files.push(
      { path: "package.json", size: 256, scope: "config" },
      { path: "tsconfig.json", size: 128, scope: "config" },
      { path: "vite.config.ts", size: 128, scope: "config" },
      { path: ".gitignore", size: 64, scope: "config" },
    );
  }
  if (scopes.includes("assets")) {
    files.push(
      { path: "public/logo.svg", size: 1024, scope: "assets" },
      { path: "public/favicon.ico", size: 512, scope: "assets" },
    );
  }
  if (scopes.includes("docs")) {
    files.push(
      { path: "README.md", size: 2048, scope: "docs" },
      { path: "LICENSE", size: 1024, scope: "docs" },
    );
  }

  return files;
}

function generateLocalExport(
  archive: any,
  options: ExportOptions,
  manifest: ExportManifest
) {
  // Add the manifest
  archive.append(JSON.stringify(manifest, null, 2), {
    name: "EXPORT_MANIFEST.json",
  });

  // Add a summary README
  const readme = `# ${options.projectId}

Exported from Straxor on ${new Date().toLocaleDateString("hr-HR")}

## Sadržaj
${manifest.scopes.map((s) => `- **${s}**`).join("\n")}

## Datoteke
${manifest.files.map((f) => `- \`${f.path}\` (${formatBytes(f.size)})`).join("\n")}

---
Generirano od Straxor AI Development Platform
`;

  archive.append(readme, { name: "EXPORT_README.md" });

  // Add sample source files
  if (manifest.scopes.includes("source")) {
    archive.append('// Source code placeholder\nexport {};', {
      name: "src/index.ts",
    });
  }

  if (manifest.scopes.includes("config")) {
    archive.append(
      JSON.stringify(
        {
          name: options.projectId,
          version: "1.0.0",
          private: true,
        },
        null,
        2
      ),
      { name: "package.json" }
    );
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
