/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        surface: {
          DEFAULT: "var(--surface)",
          2: "var(--surface-2)",
          3: "var(--surface-3)",
          dim: "var(--surface-dim)",
        },
        border: {
          DEFAULT: "var(--border)",
          light: "var(--border-light)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          hover: "var(--accent-hover)",
          dim: "var(--accent-dim)",
          border: "var(--accent-border)",
          light: "var(--accent-light)",
        },
        "accent-blue": "var(--accent-blue)",
        "accent-blue-dim": "var(--accent-blue-dim)",
        "accent-blue-border": "var(--accent-blue-border)",
        "accent-orange": "var(--accent-orange)",
        "accent-red": "var(--accent-red)",
        "accent-yellow": "var(--accent-yellow)",
        text: "var(--text)",
        "text-secondary": "var(--text-secondary)",
        "text-muted": "var(--text-muted)",
        danger: "var(--danger)",
      },
    },
  },
  plugins: [],
};
