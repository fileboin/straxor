import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";
export type AccentColor =
  | "burnt"
  | "blue"
  | "yellow"
  | "orange"
  | "red"
  | "gray"
  | "green"
  | "purple"
  | "white"
  | "black";

interface ThemeContextType {
  theme: Theme;
  accent: AccentColor;
  toggleTheme: () => void;
  setTheme: (t: Theme) => void;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: "yellow", label: "Žuta", color: "#F5C842" },
  { id: "burnt", label: "Narandžasta", color: "#FF4D2E" },
  { id: "blue", label: "Plava", color: "#3B82F6" },
  { id: "gray", label: "Siva", color: "#6B7280" },
  { id: "green", label: "Zelena", color: "#22C55E" },
  { id: "purple", label: "Ljubičasta", color: "#8B5CF6" },
  { id: "white", label: "Bijela", color: "#FFFFFF" },
  { id: "black", label: "OLED crna", color: "#000000" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("straxor-theme") as Theme) || "dark";
  });
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem("straxor-accent");
    if (stored === "olive") return "burnt";
    return (stored as AccentColor) || "burnt";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("straxor-theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("straxor-accent", accent);
  }, [accent]);

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"));
  const setAccent = (a: AccentColor) => setAccentState(a);

  return (
    <ThemeContext.Provider
      value={{ theme, accent, toggleTheme, setTheme, setAccent }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
