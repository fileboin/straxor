# Straxor — Tech Stack & Architecture Notes

## Backend
- **Runtime:** Node.js + Express
- **Database:** PostgreSQL (Neon) + Drizzle ORM
- **Auth:** bcryptjs + JWT (jsonwebtoken)
- **Module system:** ESM (`"type": "module"`)

## Frontend
- **Framework:** React (Vite) + TypeScript
- **Styling:** Tailwind CSS + CSS custom properties (design tokens)
- **PWA:** Manifest + service worker ready
- **State:** React Context (AuthContext, ThemeContext)

## AI Integration
- **Approach:** BYOK (Bring Your Own Key) — korisnik unosi svoje API key-ove
- **Key storage (trenutno):** localStorage (`straxor_key_{providerId}`)
- **Key storage (BUDUĆE):** Enkripcija + per-user DB storage (AES-256-GCM, server-side)
  - **VAŽNO:** Ne ostavljati permanentno u localStorage-u
  - Planirano za Block koji dodaje user settings / profile page
  - Potrebno: nova DB tabela `user_api_keys`, server-side enkripcija sa master key-om
- **Streaming:** SSE (Server-Sent Events) za real-time odgovore
- **Provideri:** Anthropic, OpenAI, Google Gemini, DeepSeek + OpenAI-kompatibilni (Ollama, OpenRouter, Qwen, Moonshot, MiniMax, Vertex, Bedrock, Azure, Custom)

## Design System
- **Tema:** OLED true black (`#000000`), light tema toggle
- **Primarna boja:** Military olive green (`#6b8c42`)
- **Tokeni:** CSS custom properties sa `[data-accent]` i `[data-theme]` selectorima
- **Layout:** Dual AI panels (Ask + Agent), mobile-first PWA
