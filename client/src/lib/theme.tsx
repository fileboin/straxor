import {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  useRef,
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
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("straxor-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });
  const [accent, setAccentState] = useState<AccentColor>(() => {
    const stored = localStorage.getItem("straxor-accent");
    if (stored === "olive") return "burnt";
    return (stored as AccentColor) || "burnt";
  });
  const themeFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (themeFrameRef.current !== null) cancelAnimationFrame(themeFrameRef.current);
    themeFrameRef.current = requestAnimationFrame(() => {
      document.documentElement.setAttribute("data-theme", theme);
      localStorage.setItem("straxor-theme", theme);
      themeFrameRef.current = null;
    });
    return () => {
      if (themeFrameRef.current !== null) {
        cancelAnimationFrame(themeFrameRef.current);
        themeFrameRef.current = null;
      }
    };
  }, [theme]);

  // Follow OS theme when the user has never manually chosen one.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = (e: MediaQueryListEvent) => {
      const stored = localStorage.getItem("straxor-theme");
      if (stored === "dark" || stored === "light") return; // user chose manually
      setThemeState(e.matches ? "light" : "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accent);
    localStorage.setItem("straxor-accent", accent);
  }, [accent]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState((current) => (current === next ? current : next));
  }, []);
  const toggleTheme = useCallback(() => {
    setThemeState((current) => (current === "dark" ? "light" : "dark"));
  }, []);
  const setAccent = useCallback((next: AccentColor) => {
    setAccentState((current) => (current === next ? current : next));
  }, []);

  const value = useMemo(
    () => ({ theme, accent, toggleTheme, setTheme, setAccent }),
    [theme, accent, toggleTheme, setTheme, setAccent]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
