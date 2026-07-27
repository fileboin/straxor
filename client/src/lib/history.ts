export type ChangeSource = "user" | "agent" | "system";

export interface ChangeEntry {
  id: string;
  timestamp: number;
  filePath: string;
  fileName: string;
  source: ChangeSource;
  description: string;
  contentBefore: string;
  contentAfter: string;
  lineCount: number;
}

interface HistoryState {
  entries: ChangeEntry[];
  pointer: number; // index of the current state (-1 = at start)
}

const MAX_ENTRIES = 200;
const STORAGE_KEY = "straxor_history";

class ChangeHistoryManager {
  private state: HistoryState = { entries: [], pointer: -1 };
  private listeners: Set<() => void> = new Set();
  private fileIdCounter = 0;

  constructor() {
    this.load();
  }

  // ── Public API ──

  /**
   * Record a change. If we're in the middle of the history (after undo),
   * truncate future entries.
   */
  record(
    filePath: string,
    fileName: string,
    contentBefore: string,
    contentAfter: string,
    source: ChangeSource,
    description: string
  ): void {
    // Don't record no-ops
    if (contentBefore === contentAfter) return;

    const entry: ChangeEntry = {
      id: `ch_${Date.now()}_${++this.fileIdCounter}`,
      timestamp: Date.now(),
      filePath,
      fileName,
      source,
      description,
      contentBefore,
      contentAfter,
      lineCount: contentAfter.split("\n").length,
    };

    // Truncate any "future" entries after pointer
    if (this.state.pointer < this.state.entries.length - 1) {
      this.state.entries = this.state.entries.slice(0, this.state.pointer + 1);
    }

    this.state.entries.push(entry);

    // Cap total entries
    if (this.state.entries.length > MAX_ENTRIES) {
      this.state.entries = this.state.entries.slice(-MAX_ENTRIES);
    }

    this.state.pointer = this.state.entries.length - 1;
    this.save();
    this.notify();
  }

  /**
   * Undo: go back one step. Returns the entry to apply, or null.
   */
  undo(): ChangeEntry | null {
    if (this.state.pointer < 0) return null;
    const entry = this.state.entries[this.state.pointer];
    this.state.pointer--;
    this.save();
    this.notify();
    return entry;
  }

  /**
   * Redo: go forward one step. Returns the entry to apply, or null.
   */
  redo(): ChangeEntry | null {
    if (this.state.pointer >= this.state.entries.length - 1) return null;
    this.state.pointer++;
    const entry = this.state.entries[this.state.pointer];
    this.save();
    this.notify();
    return entry;
  }

  canUndo(): boolean {
    return this.state.pointer >= 0;
  }

  canRedo(): boolean {
    return this.state.pointer < this.state.entries.length - 1;
  }

  getEntries(limit?: number): ChangeEntry[] {
    const entries = limit
      ? this.state.entries.slice(-limit)
      : this.state.entries;
    return entries.map((e) => ({
      ...e,
      isCurrent: this.state.entries.indexOf(e) === this.state.pointer,
    } as ChangeEntry));
  }

  getCurrentPointer(): number {
    return this.state.pointer;
  }

  getTotalEntries(): number {
    return this.state.entries.length;
  }

  /**
   * Jump to a specific entry index (for clicking in history panel).
   * Returns { entriesToApply } in reverse order.
   */
  jumpTo(index: number): ChangeEntry[] {
    const target = Math.max(-1, Math.min(index, this.state.entries.length - 1));
    const toApply: ChangeEntry[] = [];

    if (target < this.state.pointer) {
      // Undoing: collect entries from pointer down to target+1
      for (let i = this.state.pointer; i > target; i--) {
        toApply.push(this.state.entries[i]);
      }
    } else if (target > this.state.pointer) {
      // Redoing: collect entries from pointer+1 up to target
      for (let i = this.state.pointer + 1; i <= target; i++) {
        toApply.push(this.state.entries[i]);
      }
    }

    this.state.pointer = target;
    this.save();
    this.notify();
    return toApply;
  }

  clear(): void {
    this.state = { entries: [], pointer: -1 };
    this.save();
    this.notify();
  }

  // ── Subscriptions ──

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l());
  }

  // ── Persistence ──

  private save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch {
      // Storage full — trim oldest
      this.state.entries = this.state.entries.slice(-50);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch { /* give up */ }
    }
  }

  private load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as HistoryState;
        if (parsed.entries && Array.isArray(parsed.entries)) {
          this.state = parsed;
        }
      }
    } catch {
      // corrupted, start fresh
    }
  }
}

// Singleton
export const changeHistory = new ChangeHistoryManager();

// ── Helper: build description from diff ──

export function describeChange(before: string, after: string): string {
  const beforeLines = before.split("\n").length;
  const afterLines = after.split("\n").length;
  const lineDiff = afterLines - beforeLines;

  if (before === "") return "Nova datoteka";
  if (after === "") return "Datoteka obrisana";

  if (lineDiff > 0) return `+${lineDiff} redaka`;
  if (lineDiff < 0) return `${lineDiff} redaka`;
  return "Izmjena sadržaja";
}
