import { useEffect, useState } from "react";

export type Lang = "en" | "bs";

export const LANGS: { code: Lang; label: string; short: string }[] = [
  { code: "en", label: "English", short: "EN" },
  { code: "bs", label: "Srpski", short: "SR" },
];

const STORAGE_KEY = "straxor.lang";

const DICT: Record<string, { en: string; bs: string }> = {
  // ── Common ──
  "common.loading": { en: "Loading...", bs: "Učitavanje..." },
  "common.error": { en: "Error", bs: "Greška" },
  "common.save": { en: "Save", bs: "Sačuvaj" },
  "common.cancel": { en: "Cancel", bs: "Odustani" },
  "common.delete": { en: "Delete", bs: "Obriši" },
  "common.close": { en: "Close", bs: "Zatvori" },
  "common.confirm": { en: "Confirm", bs: "Potvrdi" },

  // ── Install PWA button ──
  "pwa.install": { en: "Install App", bs: "Instaliraj aplikaciju" },
  "pwa.install.title": {
    en: "Install Straxor as an app",
    bs: "Instaliraj Straxor kao aplikaciju",
  },

  // ── Chat input / toolbar ──
  "toolbar.attach": { en: "Add attachment", bs: "Dodaj prilog" },
  "toolbar.connectVps": { en: "Connect VPS", bs: "Poveži VPS" },
  "toolbar.connectVpsInfo": {
    en: "Optional — connect a VPS server to unlock the full agent (files, deploy, todos). Not required to chat.",
    bs: "Opcionalno — poveži VPS server za puni agent (fajlovi, deploy, zadaci). Nije potrebno za čet.",
  },
  "toolbar.githubRepo": { en: "GitHub repo", bs: "GitHub repo" },
  "toolbar.githubRepoInfo": {
    en: "Connect GitHub with a token, browse your repositories, create/fork repos and manage PRs and issues.",
    bs: "Poveži GitHub tokenom, pregledaj svoje repozitorijume, kreiraj/forkuj repo-ove i upravljaj PR-ovima i issue-ima.",
  },
  "toolbar.mic": { en: "Microphone", bs: "Mikrofon" },
  "toolbar.mic.stop": { en: "Stop recording", bs: "Zaustavi snimanje" },
  "toolbar.mic.recording": { en: "Recording…", bs: "Snimanje…" },
  "toolbar.mic.processing": { en: "Processing audio…", bs: "Obrada zvuka…" },
  "toolbar.mic.unsupported": { en: "Speech recognition not supported in this browser", bs: "Prepoznavanje govora nije podržano u ovom pregledniku" },
  "toolbar.camera": { en: "Camera", bs: "Kamera" },
  "toolbar.camera.alt": { en: "Camera capture", bs: "Snimanje kamerom" },
  "toolbar.camera.take": { en: "Capture photo", bs: "Snimi fotografiju" },
  "toolbar.camera.close": { en: "Close camera", bs: "Zatvori kameru" },
  "toolbar.file": { en: "File", bs: "Fajl" },
  "toolbar.image": { en: "Image", bs: "Slika" },
  "upload.uploading": { en: "Uploading…", bs: "Prijenos…" },
  "upload.failed": { en: "Upload failed", bs: "Prijenos nije uspio" },
  "upload.remove": { en: "Remove", bs: "Ukloni" },
  "upload.reject": { en: "File type not allowed", bs: "Tip datoteke nije dozvoljen" },
  "upload.camera.error": { en: "Camera unavailable. Check browser permission.", bs: "Kamera nije dostupna. Provjeri dozvolu preglednika." },
  "upload.mic.error": { en: "Microphone unavailable. Check browser permission.", bs: "Mikrofon nije dostupan. Provjeri dozvolu preglednika." },
  "upload.attach.hint": { en: "attached", bs: "priloženo" },
  "toolbar.menu": { en: "Options", bs: "Opcije" },
  "toolbar.model": { en: "Model", bs: "Model" },
  "toolbar.modelInfo": { en: "Choose the AI model and sub-model for this panel.", bs: "Izaberi AI model i podmodel za ovaj panel." },
  "toolbar.prompts": { en: "Prompts & templates", bs: "Promptovi i šabloni" },
  "toolbar.promptsInfo": { en: "Use predefined prompts and templates, or leave empty for free text.", bs: "Koristi predefinisane promptove i šablone, ili ostavi prazno za slobodan tekst." },
  "toolbar.cameraInfo": { en: "Capture a photo with your camera and attach it to the message.", bs: "Snimi fotografiju kamerom i priloži je uz poruku." },
  "toolbar.fileInfo": { en: "Attach a file from your device to the message.", bs: "Priloži fajl sa uređaja uz poruku." },
  "toolbar.imageInfo": { en: "Attach an image from your device.", bs: "Priloži sliku sa uređaja." },
  "toolbar.micInfo": { en: "Speak instead of typing. Requires browser permission.", bs: "Diktiraj umjesto kucanja. Zahtijeva dozvolu preglednika." },
  "toolbar.budget": { en: "Project budget estimate", bs: "Proračun projekta" },
  "toolbar.budgetInfo": { en: "Optional — rough cost estimate for the project. Never runs automatically.", bs: "Opcionalno — okvirna procjena troškova projekta. Nikad se ne pokreće automatski." },
  "budget.title": { en: "Project budget estimate", bs: "Proračun projekta" },
  "budget.desc": { en: "Rough estimate based on the current message or last task.", bs: "Okvirna procjena na osnovu trenutne poruke ili posljednjeg zadatka." },
  "budget.empty": { en: "Type a message first so we can estimate it.", bs: "Prvo ukucaj poruku da bismo mogli procijeniti." },
  "budget.cost": { en: "Est. cost", bs: "Proc. trošak" },
  "budget.tokens": { en: "Tokens", bs: "Tokeni" },
  "budget.steps": { en: "Steps", bs: "Koraci" },
  "budget.duration": { en: "Duration", bs: "Trajanje" },
  "budget.send": { en: "Send detailed budget request", bs: "Pošalji detaljan zahtjev za proračun" },
  "budget.close": { en: "Close", bs: "Zatvori" },
  "agent.panel1": { en: "Agent 1", bs: "Agent 1" },
  "agent.panel2": { en: "Agent 2", bs: "Agent 2" },
  "chat.copy.other": { en: "Copy to other panel", bs: "Kopiraj u drugi panel" },
  "chat.placeholder": {
    en: "Ask Straxor anything...",
    bs: "Pitajte Straxor bilo šta...",
  },
  "chat.placeholder.plan": {
    en: "Describe your feature request...",
    bs: "Opišite zahtjev za funkcionalnost...",
  },
  "chat.steer.placeholder": {
    en: "Instruction for the active agent...",
    bs: "Instrukcija za aktivnog agenta...",
  },
  "chat.steer.active": {
    en: "Agent is active — send an instruction to steer",
    bs: "Agent je aktivan — pošalji instrukciju za preusmjeravanje",
  },
  "chat.plan.title": {
    en: "Plan Preview",
    bs: "Pregled plana",
  },
  "chat.copy.agent": {
    en: "Copy to Agent",
    bs: "Kopiraj u Agent",
  },
  "chat.copy.ask": {
    en: "Copy to Ask",
    bs: "Kopiraj u Ask",
  },
  "chat.ask.any": { en: "Ask anything...", bs: "Pitaj bilo šta..." },
  "chat.ask.noKey": {
    en: "Enter an API key first...",
    bs: "Prvo unesi API key...",
  },
  "chat.agent.command": {
    en: "Tell the agent what to do...",
    bs: "Naredi agentu šta da napravi...",
  },
  "chat.agent.connect": {
    en: "Connect a VPS to use the Agent...",
    bs: "Poveži VPS za agenta...",
  },
  "chat.steer.steps": {
    en: "Agent is executing {n} steps — send an instruction",
    bs: "Agent izvršava {n} koraka — pošalji instrukciju",
  },
  "chat.steer.sent": {
    en: "Instruction sent to the agent.",
    bs: "Instrukcija poslana agentu. Agent nastavlja sa smjernicama.",
  },
  "chat.steer.error": {
    en: "Failed to send instruction to the agent.",
    bs: "Slanje instrukcije agentu nije uspjelo.",
  },

  // ── Welcome / prompt hero ──
  "welcome.title": {
    en: "What will you build today?",
    bs: "Šta ćete danas napraviti?",
  },
  "welcome.subtitle": {
    en: "Describe what you want to create and Straxor will build it for you.",
    bs: "Opišite šta želite da napravite, a Straxor će to izgraditi za vas.",
  },
  "welcome.placeholder": {
    en: "e.g. Build a responsive landing page with a booking form...",
    bs: "npr. Napravi responzivnu landing stranicu sa formom za rezervacije...",
  },
  "welcome.startFrom": {
    en: "or start from",
    bs: "ili počni od",
  },
  "welcome.pillFigma": { en: "Figma", bs: "Figma" },
  "welcome.pillTemplate": {
    en: "Team template",
    bs: "Timski šablon",
  },
  "welcome.model": {
    en: "Choose model",
    bs: "Izaberi model",
  },
  "welcome.ideas": {
    en: "Ideas & templates",
    bs: "Ideje i šabloni",
  },
  "welcome.send": { en: "Send", bs: "Pošalji" },

  // ── Model picker ──
  "models.title": { en: "Select Model", bs: "Odaberi model" },
  "models.search": { en: "Search models...", bs: "Pretraži modele..." },
  "models.provider": { en: "Provider", bs: "Provajder" },
  "models.thinking": { en: "Thinking budget", bs: "Budget razmišljanja" },
  "models.setup": {
    en: "Set up API key",
    bs: "Postavi API ključ",
  },
  "models.addKey": { en: "Add key", bs: "Dodaj key" },
  "models.addApiKey": { en: "Add API key", bs: "Dodaj API ključ" },
  "models.keyReady": { en: "Key configured", bs: "Ključ konfigurisan" },
  "models.keyNeeded": { en: "API key required", bs: "API ključ je potreban" },
  "models.keyOpenRouterPrefix": {
    en: "OpenRouter keys start with sk-or-v1-",
    bs: "OpenRouter ključevi počinju sa sk-or-v1-",
  },
  "models.keyTooShort": {
    en: "Key is too short",
    bs: "Ključ je prekratak",
  },
  "models.keyPlaceholder": {
    en: "Paste {provider} API key...",
    bs: "Zalijepi {provider} API ključ...",
  },
  "models.enabled": { en: "Enabled", bs: "Omogućeno" },
  "models.notConfigured": { en: "Not configured", bs: "Nije konfigurisano" },
  "models.count": { en: "{n} models", bs: "{n} modela" },
  "models.noResults": { en: "No results", bs: "Nema rezultata" },
  "models.pickerTitle": {
    en: "Model picker (full catalog)",
    bs: "Model picker (kompletan katalog)",
  },
  "models.modalTitle": {
    en: "{title} — model picker",
    bs: "{title} — odabir modela",
  },
  "panel.expand.exit": {
    en: "Exit fullscreen (Esc)",
    bs: "Izađi iz punog ekrana (Esc)",
  },
  "panel.expand.enter": {
    en: "Expand to fullscreen",
    bs: "Proširi na puni ekran",
  },
  "zoom.title": { en: "Panel zoom", bs: "Zoom panela" },
  "zoom.decrease": { en: "Zoom out", bs: "Smanji zoom" },
  "zoom.increase": { en: "Zoom in", bs: "Povećaj zoom" },
  "zoom.presets": { en: "Preset size", bs: "Predložena veličina" },
  "zoom.reset": { en: "Reset to 100%", bs: "Vrati na 100%" },
  "zoom.tiny": { en: "Very small", bs: "Skroz mali" },
  "zoom.small": { en: "Small", bs: "Mali" },
  "zoom.medium": { en: "Medium", bs: "Srednji" },
  "zoom.large": { en: "Large", bs: "Veliki" },
  "zoom.xlarge": { en: "Extra large", bs: "Ekstra veliki" },
  "panelMenu.title": { en: "Panel settings", bs: "Podešavanja panela" },
  "panelMenu.role": { en: "Agent role", bs: "Uloga agenta" },
  "panelMenu.model": { en: "Choose model", bs: "Izaberi model" },
  "panelMenu.prompts": { en: "Ideas & templates", bs: "Ideje i šabloni" },
  "panelMenu.gitOpen": { en: "Git platforms", bs: "Git platforme" },
  "panelMenu.gitActivate": { en: "Activate this token", bs: "Aktiviraj ovaj token" },
  "panelMenu.gitRename": { en: "Rename", bs: "Preimenuj" },
  "panelMenu.gitDelete": { en: "Delete", bs: "Obriši" },
  "panelMenu.gitAdd": { en: "Add token", bs: "Dodaj token" },
  "panelMenu.gitName": { en: "Label (e.g. Work / Personal)", bs: "Naziv (npr. Posao / Osobno)" },
  "panelMenu.noTokens": { en: "No tokens yet", bs: "Još nema tokena" },
  "layout.side": {
    en: "Side-by-side (Ask | Agent)",
    bs: "Jedan pored drugog (Ask | Agent)",
  },
  "layout.stack": {
    en: "Stacked (Ask / Agent)",
    bs: "Jedan ispod drugog (Ask / Agent)",
  },
  "layout.sideLabel": {
    en: "side-by-side",
    bs: "jedan pored drugog",
  },
  "layout.stackLabel": {
    en: "stacked",
    bs: "jedan ispod drugog",
  },
  "layout.resize": {
    en: "Drag to resize panels",
    bs: "Povuci za promjenu širine panela",
  },
  "layout.resizeHeight": {
    en: "Drag to resize panel height",
    bs: "Povuci za promjenu visine panela",
  },

  // ── Auth pages ──
  "auth.login": { en: "Log in", bs: "Prijava" },
  "auth.register": { en: "Register", bs: "Registracija" },
  "auth.logout": { en: "Log out", bs: "Odjava" },
  "auth.email": { en: "Email", bs: "Email" },
  "auth.password": { en: "Password", bs: "Lozinka" },
  "auth.forgot": { en: "Forgot password?", bs: "Zaboravili ste lozinku?" },
  "auth.noAccount": {
    en: "Don't have an account?",
    bs: "Nemate račun?",
  },
  "auth.haveAccount": {
    en: "Already have an account?",
    bs: "Već imate račun?",
  },
  "auth.verifyTitle": {
    en: "Verify your email",
    bs: "Potvrdite email adresu",
  },
  "auth.verifySubtitle": {
    en: "We sent a confirmation link to your inbox.",
    bs: "Poslali smo vam link za potvrdu na email.",
  },
  "auth.resetTitle": {
    en: "Set a new password",
    bs: "Postavite novu lozinku",
  },
  "auth.forgotTitle": {
    en: "Reset password",
    bs: "Reset lozinke",
  },
  "auth.forgotSubtitle": {
    en: "Enter your email and we'll send you a reset link.",
    bs: "Unesite email i poslat ćemo vam link za reset.",
  },
  "auth.loginTab": { en: "Log in", bs: "Prijavi se" },
  "auth.registerTab": { en: "Register", bs: "Registruj se" },
  "auth.loginLoading": { en: "Logging in...", bs: "Prijavljivanje..." },
  "auth.registerLoading": { en: "Registering...", bs: "Registracija..." },
  "auth.firstAdmin": {
    en: "No administrator yet — the first registered account is created as Admin",
    bs: "Još nema administratora — prvi registrovani račun se kreira kao Administrator",
  },
  "auth.passwordMin": {
    en: "Min. 6 characters",
    bs: "Min. 6 karaktera",
  },
  "auth.verificationNotice": {
    en: "We sent you a verification email. Confirm your address from your inbox to activate the account.",
    bs: "Poslali smo vam verifikacioni email. Potvrdite email adresu iz inboxa da aktivirate račun.",
  },
  "auth.backToLogin": { en: "Back to login", bs: "Nazad na prijavu" },
  "auth.checkEmail": { en: "Check your email", bs: "Provjerite svoj email" },
  "auth.resetSent": {
    en: "If an account with that address exists, we sent a password reset link. The link is valid for 1 hour.",
    bs: "Ako račun sa tom adresom postoji, poslali smo link za reset lozinke. Link važi 1 sat.",
  },
  "auth.sendLink": { en: "Send reset link", bs: "Pošalji link" },
  "auth.sending": { en: "Sending...", bs: "Slanje..." },
  "auth.newPassword": { en: "New password", bs: "Nova lozinka" },
  "auth.confirmPassword": {
    en: "Confirm password",
    bs: "Potvrdi lozinku",
  },
  "auth.resetButton": { en: "Reset password", bs: "Resetuj lozinku" },
  "auth.resetting": { en: "Resetting...", bs: "Resetovanje..." },
  "auth.verificationSuccess": {
    en: "Your email has been verified.",
    bs: "Vaša email adresa je potvrđena.",
  },
  "auth.verificationFailed": {
    en: "The verification link is invalid or has expired.",
    bs: "Link za verifikaciju nije ispravan ili je istekao.",
  },
  "auth.passwordMismatch": {
    en: "Passwords do not match.",
    bs: "Lozinke se ne podudaraju.",
  },
  "auth.resetInvalid": {
    en: "Invalid password reset link.",
    bs: "Neispravan link za reset lozinke.",
  },
  "auth.requestNewLink": {
    en: "Request a new link",
    bs: "Zatražite novi link",
  },
  "auth.resetDoneTitle": {
    en: "Password changed",
    bs: "Lozinka promijenjena",
  },
  "auth.resetDoneSubtitle": {
    en: "You can now log in with your new password.",
    bs: "Sada se možete prijaviti s novom lozinkom.",
  },
  "auth.resetSubtitle": {
    en: "Set a new password for your account.",
    bs: "Postavite novu lozinku za svoj račun.",
  },
  "auth.saving": { en: "Saving...", bs: "Spremanje..." },
  "auth.changePassword": { en: "Change password", bs: "Promijeni lozinku" },
  "auth.verifying": { en: "Verifying...", bs: "Verifikacija u toku..." },
  "auth.verifyDone": { en: "Email verified", bs: "Email potvrđen" },
  "auth.verifyDoneSubtitle": {
    en: "Your email address has been verified successfully.",
    bs: "Vaša email adresa je uspješno potvrđena.",
  },
  "auth.verifyFailedTitle": {
    en: "Verification failed",
    bs: "Verifikacija nije uspjela",
  },
};

export function detectLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "bs") return stored;
    const nav = (navigator.language || "bs").toLowerCase();
    return nav.startsWith("en") ? "en" : "bs";
  } catch {
    return "bs";
  }
}

export function setLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore storage errors
  }
  currentLang = lang;
  document.documentElement.lang = lang === "en" ? "en" : "bs";
  listeners.forEach((l) => l(lang));
}

let currentLang: Lang = detectLang();
if (typeof document !== "undefined") {
  document.documentElement.lang = currentLang === "en" ? "en" : "bs";
}
const listeners = new Set<(l: Lang) => void>();

export function getLang(): Lang {
  return currentLang;
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const entry = DICT[key];
  let out = entry ? entry[currentLang] : key;
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      out = out.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
    }
  }
  return out;
}

export function useLang(): Lang {
  const [lang, setState] = useState<Lang>(currentLang);
  useEffect(() => {
    const listener = (l: Lang) => setState(l);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return lang;
}
