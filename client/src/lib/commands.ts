export type CommandCategory =
  | "navigation"
  | "panel"
  | "model"
  | "action"
  | "settings"
  | "file";

export interface Command {
  id: string;
  label: string;
  description?: string;
  icon: string;
  category: CommandCategory;
  shortcut?: string;
  keywords?: string[];
  action: () => void;
  disabled?: boolean;
}

export interface CommandGroup {
  category: CommandCategory;
  label: string;
  icon: string;
}

export const COMMAND_GROUPS: CommandGroup[] = [
  { category: "navigation", label: "Navigacija", icon: "→" },
  { category: "panel", label: "Paneli", icon: "⊞" },
  { category: "model", label: "Modeli", icon: "◆" },
  { category: "action", label: "Akcije", icon: "⚡" },
  { category: "settings", label: "Postavke", icon: "⚙" },
  { category: "file", label: "Datoteke", icon: "📄" },
];

export function getPlatformModifier(): string {
  const isMac = typeof navigator !== "undefined" && navigator.platform.includes("Mac");
  return isMac ? "⌘" : "Ctrl";
}

export function getShortcutDisplay(shortcut: string): string {
  const mod = getPlatformModifier();
  return shortcut.replace("MOD", mod);
}
