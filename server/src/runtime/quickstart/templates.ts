// ── QuickStart Template Types ──

export type QuickStartId =
  | "landing-page"
  | "dashboard"
  | "crm"
  | "marketplace"
  | "saas"
  | "blog"
  | "portfolio"
  | "mobile-app";

export interface QuickStartFile {
  path: string;       // relative to project root
  content: string;
}

export interface QuickStartDependency {
  name: string;
  version: string;
}

export interface QuickStartTemplate {
  id: QuickStartId;
  name: string;
  description: string;
  detailedDescription: string;
  icon: string;
  color: string;
  category: "web" | "app" | "business";
  framework: string;
  installCommand: string;
  devCommand: string;
  buildCommand?: string;
  port: number;
  dependencies: QuickStartDependency[];
  devDependencies?: QuickStartDependency[];
  files: QuickStartFile[];
}

// ── Helper to build package.json ──

function buildPackageJson(
  name: string,
  deps: QuickStartDependency[],
  devDeps: QuickStartDependency[] | undefined,
  scripts: Record<string, string>,
  extra?: Record<string, unknown>
): string {
  return JSON.stringify(
    {
      name: name.toLowerCase().replace(/\s+/g, "-"),
      version: "1.0.0",
      private: true,
      type: "module",
      scripts,
      dependencies: Object.fromEntries(deps.map((d) => [d.name, d.version])),
      devDependencies: devDeps
        ? Object.fromEntries(devDeps.map((d) => [d.name, d.version]))
        : undefined,
      ...extra,
    },
    null,
    2
  );
}

// ══════════════════════════════════════════════════════
// 1. LANDING PAGE
// ══════════════════════════════════════════════════════

const landingPageFiles: QuickStartFile[] = [
  {
    path: "package.json",
    content: buildPackageJson("landing-page", [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
      { name: "framer-motion", version: "^11.0.0" },
    ], [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ], {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    }),
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Landing Page</title>
    <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🚀</text></svg>" />
  </head>
  <body class="bg-black text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5173 },
});
`,
  },
  {
    path: "tsconfig.json",
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
`,
  },
  {
    path: "src/main.tsx",
    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
  },
  {
    path: "src/index.css",
    content: `@import "tailwindcss";

:root {
  --accent: #ff4d2e;
}

body {
  margin: 0;
  font-family: "Inter", system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
`,
  },
  {
    path: "src/App.tsx",
    content: `import { useState } from "react";
import { Menu, X, ChevronRight, Sparkles, Shield, Zap, ArrowRight } from "lucide-react";

const features = [
  { icon: Zap, title: "Brzina", desc: "Optimizovano za performanse" },
  { icon: Shield, title: "Sigurnost", desc: "Enterprise-grade security" },
  { icon: Sparkles, title: "AI Powered", desc: "Pametne funkcionalnosti" },
];

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Nav */}
      <nav className="fixed top-0 w-full z-50 border-b border-white/10 bg-black/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="text-xl font-bold">
            <span className="text-[#ff4d2e]">Logo</span>
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm text-white/60">
            <a href="#features" className="hover:text-white transition">Značajke</a>
            <a href="#pricing" className="hover:text-white transition">Cijene</a>
            <a href="#contact" className="hover:text-white transition">Kontakt</a>
            <button className="px-4 py-2 bg-[#ff4d2e] text-white rounded-lg text-sm font-medium hover:bg-[#e63f24] transition">
              Počni
            </button>
          </div>
          <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden">
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4 text-center">
        <div className="max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[#ff4d2e]/30 bg-[#ff4d2e]/10 text-[#ff4d2e] text-sm mb-6">
            <Sparkles className="w-4 h-4" /> Nova era razvoja
          </div>
          <h1 className="text-5xl md:text-7xl font-bold leading-tight mb-6">
            Stvorite{" "}
            <span className="bg-gradient-to-r from-[#ff4d2e] to-[#ff8a5c] bg-clip-text text-transparent">
              nešto izvanredno
            </span>
          </h1>
          <p className="text-lg text-white/50 max-w-2xl mx-auto mb-8">
            Platforma koja spaja moć AI-a sa vašom kreativnošću. Pravimo budućnost,
            jedan projekat po jedan.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button className="px-6 py-3 bg-[#ff4d2e] text-white rounded-xl font-medium hover:bg-[#e63f24] transition flex items-center gap-2">
              Započni besplatno <ArrowRight className="w-4 h-4" />
            </button>
            <button className="px-6 py-3 border border-white/20 rounded-xl text-white/70 hover:text-white transition">
              Saznaj više
            </button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Zašto baš mi?</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((f) => (
              <div key={f.title} className="p-6 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <f.icon className="w-8 h-8 text-[#ff4d2e] mb-4" />
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-white/50">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 text-center">
        <div className="max-w-2xl mx-auto p-8 rounded-3xl border border-[#ff4d2e]/30 bg-[#ff4d2e]/5">
          <h2 className="text-3xl font-bold mb-4">Spremni za početak?</h2>
          <p className="text-white/50 mb-6">Pridružite se hiljadama zadovoljnih korisnika.</p>
          <button className="px-6 py-3 bg-[#ff4d2e] text-white rounded-xl font-medium hover:bg-[#e63f24] transition">
            Započni odmah
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-sm text-white/30">
        © 2025 Logo. Sva prava pridržana.
      </footer>
    </div>
  );
}
`,
  },
];

// ══════════════════════════════════════════════════════
// 2. DASHBOARD
// ══════════════════════════════════════════════════════

const dashboardExtraFiles: QuickStartFile[] = [
  {
    path: "package.json",
    content: buildPackageJson("dashboard", [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "recharts", version: "^2.15.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ], [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ], {
      dev: "vite",
      build: "vite build",
      preview: "vite preview",
    }),
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Dashboard</title>
  </head>
  <body class="bg-gray-950 text-white">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5173 },
});
`,
  },
  {
    path: "tsconfig.json",
    content: `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
`,
  },
  {
    path: "src/main.tsx",
    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
  },
  {
    path: "src/index.css",
    content: `@import "tailwindcss";`,
  },
  {
    path: "src/App.tsx",
    content: `import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Users, DollarSign, ShoppingCart, TrendingUp, Bell, Search, Menu,
} from "lucide-react";

const stats = [
  { icon: Users, label: "Korisnika", value: "2,847", change: "+12%", color: "text-blue-400" },
  { icon: DollarSign, label: "Prihod", value: "$48,290", change: "+8%", color: "text-green-400" },
  { icon: ShoppingCart, label: "Narudžbe", value: "1,294", change: "+23%", color: "text-purple-400" },
  { icon: TrendingUp, label: "Konverzija", value: "3.24%", change: "+2%", color: "text-yellow-400" },
];

const chartData = [
  { month: "Jan", value: 400 }, { month: "Feb", value: 300 },
  { month: "Mar", value: 600 }, { month: "Apr", value: 800 },
  { month: "May", value: 500 }, { month: "Jun", value: 900 },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 border-r border-white/10 p-4 gap-2">
        <span className="text-lg font-bold text-[#ff4d2e] mb-6">Dashboard</span>
        {["Overview", "Analytics", "Users", "Orders", "Settings"].map((item) => (
          <button key={item} className="text-left px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition">
            {item}
          </button>
        ))}
      </aside>

      {/* Main */}
      <main className="flex-1">
        <header className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <button className="md:hidden"><Menu className="w-5 h-5" /></button>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
              <input className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm w-64" placeholder="Pretraži..." />
            </div>
          </div>
          <button className="relative">
            <Bell className="w-5 h-5 text-white/60" />
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </header>

        <div className="p-6 space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((s) => (
              <div key={s.label} className="p-4 rounded-xl border border-white/10 bg-white/5">
                <div className="flex items-center justify-between mb-3">
                  <s.icon className={"w-5 h-5 " + s.color} />
                  <span className="text-xs text-green-400">{s.change}</span>
                </div>
                <div className="text-2xl font-bold">{s.value}</div>
                <div className="text-xs text-white/40">{s.label}</div>
              </div>
            ))}
          </div>

          {/* Chart */}
          <div className="p-4 rounded-xl border border-white/10 bg-white/5">
            <h3 className="text-sm font-medium mb-4">Mjesečni prihod</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="month" stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={12} />
                <Tooltip />
                <Bar dataKey="value" fill="#ff4d2e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </main>
    </div>
  );
}
`,
  },
];

// ══════════════════════════════════════════════════════
// 3. CRM
// ══════════════════════════════════════════════════════

const crmExtraFiles: QuickStartFile[] = [
  {
    path: "package.json",
    content: buildPackageJson("crm-app", [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ], [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ], {
      dev: "vite",
      build: "vite build",
    }),
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>CRM</title>
  </head>
  <body class="bg-gray-950 text-white"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body>
</html>`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5173 },
});
`,
  },
  {
    path: "tsconfig.json",
    content: `{ "compilerOptions": { "target": "ES2022", "lib": ["ES2023", "DOM", "DOM.Iterable"], "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true }, "include": ["src"] }`,
  },
  {
    path: "src/main.tsx",
    content: `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.js";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`,
  },
  {
    path: "src/index.css",
    content: `@import "tailwindcss";`,
  },
  {
    path: "src/App.tsx",
    content: `import { useState } from "react";
import { Plus, Search, Phone, Mail, Building2, Filter } from "lucide-react";

interface Contact {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  status: "active" | "lead" | "inactive";
}

const initialContacts: Contact[] = [
  { id: "1", name: "Marko Marković", company: "Tech d.o.o.", email: "marko@tech.hr", phone: "+385 91 234 5678", status: "active" },
  { id: "2", name: "Ana Anić", company: "Startup j.d.o.o.", email: "ana@startup.hr", phone: "+385 98 876 5432", status: "lead" },
  { id: "3", name: "Ivan Ivić", company: "Agency d.d.", email: "ivan@agency.hr", phone: "+385 99 111 2222", status: "inactive" },
  { id: "4", name: "Maja Majić", company: "Solutions Inc.", email: "maja@solutions.com", phone: "+385 92 333 4444", status: "active" },
];

export default function App() {
  const [contacts] = useState<Contact[]>(initialContacts);
  const [search, setSearch] = useState("");

  const filtered = contacts.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.company.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">CRM</h1>
            <p className="text-sm text-white/50">Upravljajte kontaktima</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-[#ff4d2e] text-white rounded-xl text-sm font-medium hover:bg-[#e63f24] transition">
            <Plus className="w-4 h-4" /> Dodaj kontakt
          </button>
        </div>

        {/* Search */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm"
              placeholder="Pretraži kontakte..."
            />
          </div>
          <button className="p-2 border border-white/10 rounded-lg hover:bg-white/5 transition">
            <Filter className="w-4 h-4 text-white/60" />
          </button>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-white/40 uppercase">
                <th className="p-3 font-medium">Ime</th>
                <th className="p-3 font-medium">Tvrtka</th>
                <th className="p-3 font-medium hidden md:table-cell">Email</th>
                <th className="p-3 font-medium hidden md:table-cell">Telefon</th>
                <th className="p-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="p-3 text-sm">{c.name}</td>
                  <td className="p-3 text-sm text-white/60">{c.company}</td>
                  <td className="p-3 text-sm text-white/60 hidden md:table-cell">
                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</span>
                  </td>
                  <td className="p-3 text-sm text-white/60 hidden md:table-cell">
                    <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</span>
                  </td>
                  <td className="p-3">
                    <span className={\`text-xs px-2 py-0.5 rounded-full \${
                      c.status === "active" ? "bg-green-500/10 text-green-400" :
                      c.status === "lead" ? "bg-yellow-500/10 text-yellow-400" :
                      "bg-gray-500/10 text-gray-400"
                    }\`}>
                      {c.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`,
  },
];

// ══════════════════════════════════════════════════════
// Template Registry
// ══════════════════════════════════════════════════════

// Build minimal shared files for remaining templates
const sharedFiles = (appName: string, appContent: string): QuickStartFile[] => [
  {
    path: "package.json",
    content: buildPackageJson(appName, [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ], [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ], {
      dev: "vite",
      build: "vite build",
    }),
  },
  {
    path: "index.html",
    content: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /><title>${appName}</title></head><body class="bg-black text-white"><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>`,
  },
  {
    path: "vite.config.ts",
    content: `import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { host: "0.0.0.0", port: 5173 },
});`,
  },
  {
    path: "tsconfig.json",
    content: `{ "compilerOptions": { "target": "ES2022", "lib": ["ES2023", "DOM", "DOM.Iterable"], "module": "ESNext", "moduleResolution": "bundler", "jsx": "react-jsx", "strict": true }, "include": ["src"] }`,
  },
  {
    path: "src/main.tsx",
    content: `import { StrictMode } from "react";\nimport { createRoot } from "react-dom/client";\nimport App from "./App.js";\nimport "./index.css";\ncreateRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);`,
  },
  {
    path: "src/index.css",
    content: `@import "tailwindcss";`,
  },
  {
    path: "src/App.tsx",
    content: appContent,
  },
];

const marketplaceApp = `import { useState } from "react";
import { Search, ShoppingCart, Heart, Star } from "lucide-react";

const products = [
  { id: 1, name: "Pro Planer", price: 29.99, rating: 4.5, image: "📒" },
  { id: 2, name: "Digital Kit", price: 49.99, rating: 4.8, image: "📦" },
  { id: 3, name: "Premium Template", price: 19.99, rating: 4.2, image: "🎨" },
  { id: 4, name: "E-Book Bundle", price: 39.99, rating: 4.6, image: "📚" },
  { id: 5, name: "Design System", price: 89.99, rating: 4.9, image: "⚡" },
  { id: 6, name: "Icon Pack", price: 14.99, rating: 4.3, image: "◆" },
];

export default function App() {
  const [search, setSearch] = useState("");
  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Marketplace</h1>
          <button className="relative p-2"><ShoppingCart className="w-5 h-5" /><span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full" /></button>
        </div>
        <div className="relative mb-6">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm" placeholder="Pretraži proizvode..." />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <div key={p.id} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
              <div className="text-4xl mb-3">{p.image}</div>
              <h3 className="font-medium text-sm mb-1">{p.name}</h3>
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-white/50">{p.rating}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#ff4d2e]">\${p.price.toFixed(2)}</span>
                <button className="p-1.5 rounded-lg hover:bg-[#ff4d2e]/20 text-[#ff4d2e] transition"><Heart className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}`;

const saasApp = `import { useState } from "react";
import { BarChart3, Users, CreditCard, Settings, Bell, LogOut } from "lucide-react";

const sidebarItems = [
  { icon: BarChart3, label: "Overview" },
  { icon: Users, label: "Team" },
  { icon: CreditCard, label: "Billing" },
  { icon: Settings, label: "Settings" },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-56 border-r border-white/10 p-4 flex flex-col gap-1">
        <span className="text-lg font-bold text-[#ff4d2e] mb-6">SaaS</span>
        {sidebarItems.map((item) => (
          <button key={item.label} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition">
            <item.icon className="w-4 h-4" /> {item.label}
          </button>
        ))}
        <div className="mt-auto pt-4 border-t border-white/10">
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-500/10 transition"><LogOut className="w-4 h-4" /> Logout</button>
        </div>
      </aside>
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-1">Welcome back!</h1>
        <p className="text-sm text-white/50 mb-6">Evo šta se događa sa tvojim SaaS platformom.</p>
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[{ label: "MRR", value: "$12,430" }, { label: "Korisnika", value: "1,247" }, { label: "Churn", value: "2.1%" }].map((s) => (
            <div key={s.label} className="p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="text-sm text-white/40">{s.label}</div>
              <div className="text-2xl font-bold mt-1">{s.value}</div>
            </div>
          ))}
        </div>
        {/* Activity placeholder */}
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h2 className="text-sm font-medium mb-3">Nedavna aktivnost</h2>
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs">U{i}</div>
              <div><div className="text-sm">Korisnik je kreirao novi projekat</div><div className="text-xs text-white/30">Prije {i * 5} min</div></div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}`;

const blogApp = `import { useState } from "react";
import { Calendar, Clock, Search, ChevronRight } from "lucide-react";

const posts = [
  { title: "Kako izgraditi modernu web aplikaciju", excerpt: "Vodič kroz najbolje prakse i tehnologije za 2025.", date: "2025-01-15", readTime: "5 min", tag: "Tech" },
  { title: "AI u svakodnevnom razvoju", excerpt: "Kako AI alati mijenjaju način na koji radimo.", date: "2025-01-10", readTime: "8 min", tag: "AI" },
  { title: "Najbolje prakse za Tailwind CSS", excerpt: "Optimizacija i organizacija Tailwind projekata.", date: "2025-01-05", readTime: "4 min", tag: "CSS" },
  { title: "TypeScript savjeti i trikovi", excerpt: "Napredne tehnike za produktivniji rad.", date: "2024-12-28", readTime: "6 min", tag: "TypeScript" },
];

export default function App() {
  const [search, setSearch] = useState("");
  const filtered = posts.filter((p) => p.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-white/10 p-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-[#ff4d2e]">Blog</h1>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-1.5 text-sm w-48" placeholder="Pretraži..." />
          </div>
        </div>
      </header>
      <main className="max-w-3xl mx-auto p-4 space-y-4">
        {filtered.map((post) => (
          <article key={post.title} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition cursor-pointer">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#ff4d2e]/10 text-[#ff4d2e]">{post.tag}</span>
              <span className="text-xs text-white/30 flex items-center gap-1"><Calendar className="w-3 h-3" />{post.date}</span>
              <span className="text-xs text-white/30 flex items-center gap-1"><Clock className="w-3 h-3" />{post.readTime}</span>
            </div>
            <h2 className="text-lg font-semibold mb-1">{post.title}</h2>
            <p className="text-sm text-white/50">{post.excerpt}</p>
          </article>
        ))}
      </main>
    </div>
  );
}`;

const portfolioApp = `import { useState } from "react";
import { Github, Linkedin, Mail, ExternalLink } from "lucide-react";

const projects = [
  { title: "Projekt A", desc: "Modern web application built with React", tech: ["React", "Node.js", "PostgreSQL"] },
  { title: "Projekt B", desc: "Mobile-first SaaS platform", tech: ["Next.js", "TypeScript", "Prisma"] },
  { title: "Projekt C", desc: "Open-source developer tool", tech: ["Go", "Docker", "Kubernetes"] },
];

export default function App() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto p-6">
        {/* Hero */}
        <section className="text-center py-16">
          <div className="w-20 h-20 rounded-full bg-[#ff4d2e]/20 mx-auto mb-4 flex items-center justify-center text-3xl">👤</div>
          <h1 className="text-4xl font-bold mb-2">Ime Prezime</h1>
          <p className="text-white/50 mb-4">Full-Stack Developer & UI/UX Designer</p>
          <div className="flex items-center justify-center gap-3">
            {[{ icon: Github, href: "#" }, { icon: Linkedin, href: "#" }, { icon: Mail, href: "#" }].map((s) => (
              <a key={s.href} href={s.href} className="p-2 rounded-lg border border-white/10 hover:bg-white/5 transition"><s.icon className="w-4 h-4 text-white/60" /></a>
            ))}
          </div>
        </section>

        {/* Skills */}
        <section className="mb-12">
          <h2 className="text-xl font-bold mb-4">Vještine</h2>
          <div className="flex flex-wrap gap-2">
            {["React", "TypeScript", "Node.js", "Python", "PostgreSQL", "Docker", "AWS", "Figma", "Tailwind"].map((s) => (
              <span key={s} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm">{s}</span>
            ))}
          </div>
        </section>

        {/* Projects */}
        <section>
          <h2 className="text-xl font-bold mb-4">Projekti</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {projects.map((p) => (
              <div key={p.title} className="p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{p.title}</h3>
                  <ExternalLink className="w-4 h-4 text-white/30" />
                </div>
                <p className="text-sm text-white/50 mb-3">{p.desc}</p>
                <div className="flex flex-wrap gap-1">
                  {p.tech.map((t) => (<span key={t} className="text-xs px-2 py-0.5 rounded-full bg-[#ff4d2e]/10 text-[#ff4d2e]">{t}</span>))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}`;

const mobileApp = `import { useState } from "react";
import { Home, Search, Plus, Heart, User } from "lucide-react";

const tabs = [
  { icon: Home, label: "Home" },
  { icon: Search, label: "Search" },
  { icon: Plus, label: "Add", center: true },
  { icon: Heart, label: "Favorites" },
  { icon: User, label: "Profile" },
];

const items = [
  { id: 1, title: "Prva stavka", subtitle: "Opis stavke", color: "bg-blue-500" },
  { id: 2, title: "Druga stavka", subtitle: "Još jedan opis", color: "bg-green-500" },
  { id: 3, title: "Treća stavka", subtitle: "Treći opis", color: "bg-purple-500" },
  { id: 4, title: "Četvrta stavka", subtitle: "Četvrti opis", color: "bg-yellow-500" },
  { id: 5, title: "Peta stavka", subtitle: "Peti opis", color: "bg-red-500" },
  { id: 6, title: "Šesta stavka", subtitle: "Šesti opis", color: "bg-pink-500" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col max-w-md mx-auto relative">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <h1 className="text-xl font-bold">App</h1>
      </header>

      {/* Content */}
      <main className="flex-1 p-4 space-y-3">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
            <div className={\`w-10 h-10 rounded-xl \${item.color} flex items-center justify-center font-bold\`}>{item.id}</div>
            <div>
              <div className="text-sm font-medium">{item.title}</div>
              <div className="text-xs text-white/50">{item.subtitle}</div>
            </div>
            <Heart className="w-4 h-4 text-white/30 ml-auto" />
          </div>
        ))}
      </main>

      {/* Tab Bar */}
      <nav className="flex items-center justify-around px-4 py-2 border-t border-white/10 bg-gray-900">
        {tabs.map((tab, i) => (
          <button key={tab.label} onClick={() => setActiveTab(i)} className={\`flex flex-col items-center gap-0.5 \${tab.center ? "relative -top-3" : ""}\`}>
            {tab.center ? (
              <div className="w-12 h-12 rounded-full bg-[#ff4d2e] flex items-center justify-center"><tab.icon className="w-5 h-5 text-white" /></div>
            ) : (
              <tab.icon className={\`w-5 h-5 \${activeTab === i ? "text-[#ff4d2e]" : "text-white/40"}\`} />
            )}
            {!tab.center && <span className={\`text-[10px] \${activeTab === i ? "text-[#ff4d2e]" : "text-white/40"}\`}>{tab.label}</span>}
          </button>
        ))}
      </nav>
    </div>
  );
}`;

// ── Export all templates ──

export const QUICKSTART_TEMPLATES: QuickStartTemplate[] = [
  {
    id: "landing-page",
    name: "Landing Page",
    description: "Moderna prodajna stranica",
    detailedDescription: "Landing page sa hero sekcijom, features, CTA i footer-om. Spremna za Tailwind + dark temu.",
    icon: "🚀",
    color: "green",
    category: "web",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
      { name: "framer-motion", version: "^11.0.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: landingPageFiles,
  },
  {
    id: "dashboard",
    name: "Dashboard",
    description: "Analitička admin tabla",
    detailedDescription: "Dashboard sa sidebar-om, statističkim karticama, Recharts grafovima i pretragom.",
    icon: "📊",
    color: "blue",
    category: "web",
    framework: "React + Vite + Tailwind + Recharts",
    installCommand: "npm install",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "recharts", version: "^2.15.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: dashboardExtraFiles,
  },
  {
    id: "crm",
    name: "CRM",
    description: "Upravljanje kontaktima",
    detailedDescription: "Sistem za upravljanje odnosima s klijentima — tabela kontakata, pretraga, filtriranje, statusi.",
    icon: "👥",
    color: "purple",
    category: "business",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    buildCommand: "npm run build",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "react-router-dom", version: "^7.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: crmExtraFiles,
  },
  {
    id: "marketplace",
    name: "Marketplace",
    description: "Online prodavnica proizvoda",
    detailedDescription: "Marketplace sa grid-om proizvoda, pretragom, ocjenama i korpa funkcionalnostima.",
    icon: "🛒",
    color: "orange",
    category: "business",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: sharedFiles("marketplace", marketplaceApp),
  },
  {
    id: "saas",
    name: "SaaS Platform",
    description: "Više-korisnička platforma",
    detailedDescription: "SaaS dashboard sa sidebarom, statistikama (MRR, korisnici, churn) i nedavnom aktivnošću.",
    icon: "⚡",
    color: "yellow",
    category: "business",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: sharedFiles("saas-platform", saasApp),
  },
  {
    id: "blog",
    name: "Blog",
    description: "Blog sa člancima i pretragom",
    detailedDescription: "Blog sa listom članaka, tagovima, datumima, vremenom čitanja i pretragom.",
    icon: "📝",
    color: "emerald",
    category: "web",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: sharedFiles("blog", blogApp),
  },
  {
    id: "portfolio",
    name: "Portfolio",
    description: "Lični portfolio sajta",
    detailedDescription: "Portfolio sa hero sekcijom, vještinama, listom projekata i kontakt linkovima.",
    icon: "🎨",
    color: "pink",
    category: "web",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: sharedFiles("portfolio", portfolioApp),
  },
  {
    id: "mobile-app",
    name: "Mobile App",
    description: "Mobile-first aplikacija",
    detailedDescription: "Mobile-first dizajn sa tab navigacijom, listom stavki i donjom navigacijom.",
    icon: "📱",
    color: "indigo",
    category: "app",
    framework: "React + Vite + Tailwind",
    installCommand: "npm install",
    devCommand: "npm run dev",
    port: 5173,
    dependencies: [
      { name: "react", version: "^19.0.0" },
      { name: "react-dom", version: "^19.0.0" },
      { name: "lucide-react", version: "^0.460.0" },
    ],
    devDependencies: [
      { name: "vite", version: "^6.0.0" },
      { name: "@vitejs/plugin-react", version: "^4.0.0" },
      { name: "tailwindcss", version: "^4.0.0" },
      { name: "@tailwindcss/vite", version: "^4.0.0" },
      { name: "typescript", version: "^5.7.0" },
    ],
    files: sharedFiles("mobile-app", mobileApp),
  },
];

export function getTemplateById(id: QuickStartId): QuickStartTemplate | undefined {
  return QUICKSTART_TEMPLATES.find((t) => t.id === id);
}
