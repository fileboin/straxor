import type { SearchAdapter, SearchQuery, SearchResponse, SearchResult, SearchStats } from "./adapter.js";

export function createSSHSearchAdapter(
  exec: (machineId: string, cmd: string) => Promise<string>
): SearchAdapter {
  return {
    async search(query: SearchQuery): Promise<SearchResponse> {
      const start = Date.now();
      const root = query.rootPath || ".";
      const max = query.maxResults || 100;

      let cmd = "";
      const flags = query.caseSensitive ? "" : "i";

      switch (query.mode) {
        case "filename": {
          cmd = `find ${root} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/__pycache__/*' -not -path '*/.venv/*' -not -path '*/target/*' 2>/dev/null | grep -${flags} "${escRegex(query.query)}" | head -${max}`;
          break;
        }
        case "text": {
          const includeFlag = query.filePattern ? `--include='${query.filePattern}'` : "--include='*'";
          cmd = `grep -rn ${includeFlag} -I${query.caseSensitive ? "" : ""} "${escGrep(query.query)}" ${root} 2>/dev/null | grep -v node_modules | grep -v '.git/' | head -${max}`;
          break;
        }
        case "regex": {
          const includeFlag = query.filePattern ? `--include='${query.filePattern}'` : "--include='*'";
          cmd = `grep -rEn ${includeFlag} "${query.query}" ${root} 2>/dev/null | grep -v node_modules | grep -v '.git/' | head -${max}`;
          break;
        }
      }

      const output = await exec(query.machineId, cmd);
      const results = parseSearchOutput(output, query.mode);
      const duration = Date.now() - start;

      return {
        results,
        stats: {
          totalMatches: results.length,
          filesSearched: new Set(results.map((r) => r.path)).size,
          duration,
        },
      };
    },

    async searchFilename(machineId: string, pattern: string, rootPath?: string): Promise<SearchResult[]> {
      const root = rootPath || ".";
      const cmd = `find ${root} -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/.next/*' -not -path '*/__pycache__/*' -not -path '*/.venv/*' 2>/dev/null | grep -i "${escRegex(pattern)}" | head -50`;

      const output = await exec(machineId, cmd);
      return output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((path) => ({ path, line: 0, content: path }));
    },
  };
}

// ── Helpers ──

function parseSearchOutput(output: string, mode: string): SearchResult[] {
  if (!output.trim()) return [];

  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      // For filename mode, lines are just paths
      if (mode === "filename") {
        const name = line.split("/").pop() || line;
        return { path: line, line: 0, content: name };
      }

      // For text/regex: file:line:content format (or file:line:col:content)
      const parts = line.split(":");
      const filePath = parts[0] || "";
      const lineNum = parseInt(parts[1] || "0", 10);
      const colOrContent = parts.slice(2).join(":");

      // Check if third part is a number (column number)
      const maybeCol = parseInt(parts[2] || "", 10);
      if (!isNaN(maybeCol) && parts.length > 3) {
        return {
          path: filePath,
          line: lineNum,
          column: maybeCol,
          content: parts.slice(3).join(":").trim(),
        };
      }

      return {
        path: filePath,
        line: lineNum,
        content: colOrContent.trim(),
      };
    })
    .filter((r) => r.path); // Filter empty paths
}

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escGrep(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
