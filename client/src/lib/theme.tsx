import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

export type Theme = "dark" | "light";
export type AccentColor = "olive" | "blue" | "yellow" | "orange" | "red";

interface ThemeContextType {
  theme: Theme;
  accent: AccentColor;
  toggleTheme: () => void;
  setAccent: (accent: AccentColor) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export const ACCENT_COLORS: { id: AccentColor; label: string; color: string }[] = [
  { id: "olive", label: "Maslinasto-zelena", color: "#6b8c42" },
  { id: "blue", label: "Plava", color: "#3b82f6" },
  { id: "yellow", label: "Žuta", color: "#eab308" },
  { id: "orange", label: "Narandžasta", color: "#f97316" },
  { id: "red", label: "Crvena", color: "#ef4444" },
];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem("straxor-theme") as Theme) || "dark";
  });
  const [accent, setAccentState] = useState<AccentColor>(() => {
    return (localStorage.getItem("straxor-accent") as AccentColor) || "olive";
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
    <ThemeContext.Provider value={{ theme, accent, toggleTheme, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
