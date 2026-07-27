import { useState, useEffect, useRef, useMemo } from "react";
import {
  COMMAND_GROUPS,
  getShortcutDisplay,
  type Command,
} from "../../lib/commands.js";

interface Props {
  commands: Command[];
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ commands, open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter + group commands
  const filtered = useMemo(() => {
    if (!query.trim()) return commands.filter((c) => !c.disabled);
    const q = query.toLowerCase();
    return commands.filter((c) => {
      if (c.disabled) return false;
      return (
        c.label.toLowerCase().includes(q) ||
        c.description?.toLowerCase().includes(q) ||
        c.keywords?.some((k) => k.toLowerCase().includes(q))
      );
    });
  }, [commands, query]);

  const grouped = useMemo(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filtered) {
      if (!groups[cmd.category]) groups[cmd.category] = [];
      groups[cmd.category].push(cmd);
    }
    return groups;
  }, [filtered]);

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
        break;
      case "Escape":
        e.preventDefault();
        onClose();
        break;
    }
  }

  if (!open) return null;

  // Flatten grouped commands for indexed navigation
  let flatIndex = 0;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[520px] mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <span className="text-text-muted text-sm">→</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pretraži komande..."
            className="flex-1 bg-transparent text-[14px] text-text placeholder:text-text-muted focus:outline-none"
          />
          <kbd className="text-[10px] text-text-muted bg-surface-2 border border-border px-1.5 py-0.5 rounded shrink-0">
            ESC
          </kbd>
        </div>

        {/* Command list */}
        <div
          ref={listRef}
          className="max-h-[400px] overflow-y-auto py-1"
        >
          {filtered.length === 0 && (
            <div className="text-center py-8 text-text-muted text-[12px]">
              Nema rezultata za "{query}"
            </div>
          )}

          {COMMAND_GROUPS.map((group) => {
            const cmds = grouped[group.category];
            if (!cmds || cmds.length === 0) return null;

            return (
              <div key={group.category}>
                <div className="px-4 py-1.5 text-[9px] text-text-muted uppercase tracking-wider font-medium flex items-center gap-1.5">
                  <span>{group.icon}</span>
                  {group.label}
                </div>
                {cmds.map((cmd) => {
                  const idx = flatIndex++;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      data-index={idx}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                        isSelected
                          ? "bg-surface-2"
                          : "hover:bg-surface-2/50"
                      }`}
                    >
                      <span className={`text-sm w-5 text-center shrink-0 ${
                        isSelected ? "text-accent" : "text-text-muted"
                      }`}>
                        {cmd.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className={`text-[12px] font-medium ${
                          isSelected ? "text-text" : "text-text-secondary"
                        }`}>
                          {cmd.label}
                        </div>
                        {cmd.description && (
                          <div className="text-[10px] text-text-muted truncate">
                            {cmd.description}
                          </div>
                        )}
                      </div>
                      {cmd.shortcut && (
                        <kbd className="text-[9px] text-text-muted bg-surface-2 border border-border px-1.5 py-0.5 rounded shrink-0 font-mono">
                          {getShortcutDisplay(cmd.shortcut)}
                        </kbd>
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-[9px] text-text-muted">
          <span>↑↓ navigacija</span>
          <span>↵ odabir</span>
          <span>esc zatvori</span>
        </div>
      </div>
    </div>
  );
}
