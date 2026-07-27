import { useRef, useEffect } from "react";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection, dropCursor, rectangularSelection, crosshairCursor, highlightSpecialChars } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { indentOnInput, bracketMatching, foldGutter, foldKeymap, syntaxHighlighting, defaultHighlightStyle, HighlightStyle } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { autocompletion, completionKeymap, closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { lintKeymap } from "@codemirror/lint";
import { tags } from "@lezer/highlight";

// OLED-friendly dark theme
const straxorTheme = EditorView.theme({
  "&": {
    backgroundColor: "#000000",
    color: "#e5e5e5",
    fontSize: "12px",
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  },
  ".cm-content": {
    caretColor: "#6b8c42",
    padding: "8px 0",
  },
  ".cm-cursor, .cm-dropCursor": {
    borderLeftColor: "#6b8c42",
    borderLeftWidth: "2px",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "#6b8c42",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(107, 140, 66, 0.05)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "rgba(107, 140, 66, 0.08)",
  },
  ".cm-gutters": {
    backgroundColor: "#000000",
    color: "#555555",
    border: "none",
    borderRight: "1px solid #1a1a1a",
  },
  ".cm-gutter": {
    minWidth: "32px",
  },
  ".cm-lineNumbers .cm-gutterElement": {
    padding: "0 8px 0 4px",
    fontSize: "11px",
  },
  ".cm-foldGutter .cm-gutterElement": {
    padding: "0 4px",
    cursor: "pointer",
    color: "#6b8c42",
  },
  ".cm-selectionBackground": {
    backgroundColor: "rgba(107, 140, 66, 0.2) !important",
  },
  "&.cm-focused .cm-selectionBackground": {
    backgroundColor: "rgba(107, 140, 66, 0.3) !important",
  },
  ".cm-matchingBracket": {
    backgroundColor: "rgba(107, 140, 66, 0.15)",
    outline: "1px solid rgba(107, 140, 66, 0.4)",
  },
  ".cm-searchMatch": {
    backgroundColor: "rgba(255, 200, 0, 0.15)",
    outline: "1px solid rgba(255, 200, 0, 0.4)",
  },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "rgba(107, 140, 66, 0.25)",
  },
  ".cm-tooltip": {
    backgroundColor: "#111111",
    border: "1px solid #333333",
    color: "#e5e5e5",
  },
  ".cm-tooltip-autocomplete": {
    "& > ul > li": {
      padding: "2px 8px",
    },
    "& > ul > li[aria-selected]": {
      backgroundColor: "rgba(107, 140, 66, 0.2)",
      color: "#e5e5e5",
    },
  },
  ".cm-panels": {
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
  },
  ".cm-panels.cm-panels-bottom": {
    borderTop: "1px solid #1a1a1a",
  },
  ".cm-panels.cm-panels-top": {
    borderBottom: "1px solid #1a1a1a",
  },
  ".cm-panel.cm-search": {
    backgroundColor: "#0a0a0a",
    color: "#e5e5e5",
  },
  ".cm-textfield": {
    backgroundColor: "#111111",
    color: "#e5e5e5",
    border: "1px solid #333333",
  },
  ".cm-button": {
    backgroundColor: "#1a1a1a",
    color: "#e5e5e5",
    border: "1px solid #333333",
  },
}, { dark: true });

// Syntax highlighting for OLED
const straxorHighlightStyle = HighlightStyle.define([
  { tag: tags.keyword, color: "#c586c0" },
  { tag: tags.operator, color: "#d4d4d4" },
  { tag: tags.special(tags.variableName), color: "#9cdcfe" },
  { tag: tags.typeName, color: "#4ec9b0" },
  { tag: tags.atom, color: "#b5cea8" },
  { tag: tags.number, color: "#b5cea8" },
  { tag: tags.definition(tags.variableName), color: "#4fc1ff" },
  { tag: tags.string, color: "#ce9178" },
  { tag: tags.special(tags.string), color: "#ce9178" },
  { tag: tags.comment, color: "#6a9955", fontStyle: "italic" },
  { tag: tags.variableName, color: "#9cdcfe" },
  { tag: tags.tagName, color: "#569cd6" },
  { tag: tags.bracket, color: "#808080" },
  { tag: tags.meta, color: "#569cd6" },
  { tag: tags.link, color: "#569cd6", textDecoration: "underline" },
  { tag: tags.heading, color: "#569cd6", fontWeight: "bold" },
  { tag: tags.emphasis, fontStyle: "italic", color: "#dcdcaa" },
  { tag: tags.strong, fontWeight: "bold", color: "#dcdcaa" },
  { tag: tags.strikethrough, textDecoration: "line-through" },
  { tag: tags.bool, color: "#569cd6" },
  { tag: tags.null, color: "#569cd6" },
  { tag: tags.className, color: "#4ec9b0" },
  { tag: tags.propertyName, color: "#9cdcfe" },
  { tag: tags.function(tags.variableName), color: "#dcdcaa" },
  { tag: tags.regexp, color: "#d16969" },
  { tag: tags.self, color: "#569cd6" },
  { tag: tags.processingInstruction, color: "#6a9955" },
  { tag: tags.labelName, color: "#9cdcfe" },
  { tag: tags.namespace, color: "#4ec9b0" },
]);

function getLanguage(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "js":
    case "jsx":
    case "ts":
    case "tsx":
    case "mjs":
    case "cjs":
      return javascript({ jsx: ext === "jsx" || ext === "tsx", typescript: ext === "ts" || ext === "tsx" });
    case "html":
    case "htm":
    case "vue":
    case "svelte":
      return html();
    case "css":
    case "scss":
    case "less":
      return css();
    case "json":
    case "jsonc":
      return json();
    case "py":
    case "pyw":
      return python();
    default:
      return javascript();
  }
}

interface CodeEditorProps {
  content: string;
  filename: string;
  onChange?: (content: string) => void;
  readOnly?: boolean;
  height?: string;
}

export default function CodeEditor({
  content,
  filename,
  onChange,
  readOnly = false,
  height = "100%",
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const contentRef = useRef(content);
  contentRef.current = content;

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && onChangeRef.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const lang = getLanguage(filename);

    const state = EditorState.create({
      doc: content,
      extensions: [
        // Line numbers & gutter
        lineNumbers(),
        highlightActiveLineGutter(),
        foldGutter({
          openText: "▾",
          closedText: "▸",
        }),

        // History (undo/redo)
        history(),

        // Drawing & cursor
        drawSelection(),
        dropCursor(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSpecialChars(),

        // Indentation
        indentOnInput(),

        // Bracket matching
        bracketMatching(),
        closeBrackets(),

        // Selection
        highlightSelectionMatches(),

        // Language
        lang,
        syntaxHighlighting(straxorHighlightStyle),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),

        // Autocomplete
        autocompletion({
          override: [],
        }),

        // Keymaps
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...searchKeymap,
          ...completionKeymap,
          ...closeBracketsKeymap,
          ...lintKeymap,
          indentWithTab,
        ] as any),

        // Theme
        straxorTheme,

        // Read-only
        readOnly ? EditorState.readOnly.of(true) : [],

        // Update listener
        updateListener,
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
  }, [filename]); // Recreate editor when file changes

  // Update content if it changes externally
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentContent = view.state.doc.toString();
    if (currentContent !== content) {
      view.dispatch({
        changes: {
          from: 0,
          to: currentContent.length,
          insert: content,
        },
      });
    }
  }, [content]);

  return (
    <div
      ref={containerRef}
      className="h-full overflow-hidden"
      style={{ height }}
    />
  );
}
