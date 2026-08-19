import { memo } from "react";

/**
 * Minimal, dependency-free markdown-ish renderer for chat messages.
 *
 * The model frequently returns fenced code blocks (```bash ... ```). Rendering
 * them as raw pre-wrap text produced the "bash" spam — bare fences and command
 * dumps flooding the bubble. This splits the content into fenced code cards and
 * plain paragraphs so every block is a clean, readable "kocka".
 */

function parseFences(content: string): Array<{ kind: "text" | "code"; lang?: string; code?: string; text?: string }> {
  const parts: Array<{ kind: "text" | "code"; lang?: string; code?: string; text?: string }> = [];
  const fenceRe = /```([^\n`]*)\n([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = fenceRe.exec(content)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", text: content.slice(last, m.index) });
    }
    parts.push({ kind: "code", lang: m[1].trim(), code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < content.length) {
    parts.push({ kind: "text", text: content.slice(last) });
  }
  return parts.length ? parts : [{ kind: "text", text: content }];
}

const LANG_LABELS: Record<string, string> = {
  bash: "Bash",
  sh: "Shell",
  shell: "Shell",
  zsh: "Shell",
  powershell: "PowerShell",
  js: "JavaScript",
  jsx: "JSX",
  ts: "TypeScript",
  tsx: "TSX",
  json: "JSON",
  python: "Python",
  py: "Python",
  sql: "SQL",
  html: "HTML",
  css: "CSS",
  yaml: "YAML",
  yml: "YAML",
  go: "Go",
  rust: "Rust",
  c: "C",
  cpp: "C++",
  java: "Java",
  ruby: "Ruby",
  php: "PHP",
  markdown: "Markdown",
  md: "Markdown",
  diff: "Diff",
  text: "Text",
  txt: "Text",
};

function CodeCard({ lang, code }: { lang: string; code: string }) {
  const label = LANG_LABELS[lang] || lang || "Code";
  const trimmed = code.replace(/\n+$/, "");
  return (
    <div className="my-1.5 rounded-xl border border-border bg-[#0c0f1a] overflow-hidden text-[12px]">
      <div className="flex items-center gap-1.5 px-2.5 py-1 border-b border-border bg-surface-2">
        <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-accent/70" />
          {label}
        </span>
      </div>
      <pre className="px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-[#E6EDF3] whitespace-pre-wrap break-words max-h-72 overflow-y-auto">
        {trimmed}
      </pre>
    </div>
  );
}

function FormattedContentImpl({ content }: { content: string }) {
  const parts = parseFences(content);
  return (
    <>
      {parts.map((part, i) =>
        part.kind === "code" ? (
          <CodeCard key={i} lang={part.lang || ""} code={part.code || ""} />
        ) : (
          <span key={i} className="whitespace-pre-wrap break-words">
            {part.text}
          </span>
        )
      )}
    </>
  );
}

export const FormattedContent = memo(FormattedContentImpl);
