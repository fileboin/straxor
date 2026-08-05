import { FluxProvider } from "./providers/flux.js";
import { GPTImageProvider } from "./providers/gpt-image.js";
import { GeminiImageProvider } from "./providers/gemini-image.js";
import { ComfyUIProvider } from "./providers/comfy-ui.js";
import { StableDiffusionProvider } from "./providers/stable-diffusion.js";
import { PresentonGenerator } from "./presenton.js";
import { MediaLibrary } from "./media-library.js";
import { DesignSystemGenerator } from "./design-system.js";
import { BaseImageProvider } from "./image-provider.js";
import type {
  ImageProviderId,
  ImageGenerationRequest,
  ImageGenerationResult,
  DesignGenerationRequest,
  GeneratedWebsite,
  GeneratedUIComponent,
  GeneratedPresentation,
  DesignSystem,
} from "./types.js";

export class DesignOrchestrator {
  private imageProviders: Map<ImageProviderId, BaseImageProvider>;
  private presenton: PresentonGenerator;
  private mediaLibrary: MediaLibrary;
  private designSystem: DesignSystemGenerator;
  private websites: Map<string, GeneratedWebsite> = new Map();
  private uiComponents: Map<string, GeneratedUIComponent> = new Map();

  constructor() {
    this.imageProviders = new Map();
    const providers: BaseImageProvider[] = [
      new FluxProvider(),
      new GPTImageProvider(),
      new GeminiImageProvider(),
      new ComfyUIProvider(),
      new StableDiffusionProvider(),
    ];
    for (const p of providers) {
      this.imageProviders.set(p.id, p);
    }
    this.presenton = new PresentonGenerator();
    this.mediaLibrary = new MediaLibrary();
    this.designSystem = new DesignSystemGenerator();
  }

  getImageProviders() {
    return Array.from(this.imageProviders.keys());
  }

  getImageProvider(id: ImageProviderId): BaseImageProvider | undefined {
    return this.imageProviders.get(id);
  }

  async generateImage(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const provider = this.imageProviders.get(req.provider);
    if (!provider) throw new Error(`Unknown image provider: ${req.provider}`);
    const result = await provider.generate(req);

    await this.mediaLibrary.add({
      name: `ai_${Date.now()}`,
      type: "image",
      mime: "image/png",
      size: 0,
      url: result.url,
      tags: [req.provider, "ai-generated"],
      folder: "ai-generated",
      provider: req.provider,
      prompt: req.prompt,
      width: result.width,
      height: result.height,
    });

    return result;
  }

  async generateWebsite(req: DesignGenerationRequest): Promise<GeneratedWebsite> {
    const q = req.prompt.toLowerCase();
    const isDark = q.includes("dark") || !q.includes("light");
    const accent = q.includes("green") ? "#22c55e"
      : q.includes("blue") ? "#3b82f6"
      : q.includes("purple") ? "#a855f7"
      : q.includes("red") ? "#ef4444"
      : q.includes("orange") ? "#f97316"
      : "#ff4d2e";

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${req.prompt}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui; background: ${isDark ? "#000" : "#fff"}; color: ${isDark ? "#fafafa" : "#0a0a0a"}; line-height: 1.6; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
    nav { padding: 1.5rem 0; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid ${isDark ? "#262626" : "#e5e5e5"}; }
    .logo { font-weight: 800; font-size: 1.5rem; }
    .nav-links { display: flex; gap: 2rem; }
    .nav-links a { color: ${isDark ? "#a3a3a3" : "#525252"}; text-decoration: none; }
    .hero { padding: 6rem 0; text-align: center; }
    .hero h1 { font-size: 4rem; font-weight: 800; margin-bottom: 1.5rem; background: linear-gradient(135deg, ${accent}, ${accent}88); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .hero p { font-size: 1.25rem; color: ${isDark ? "#737373" : "#a3a3a3"}; max-width: 600px; margin: 0 auto 2rem; }
    .btn { display: inline-block; background: ${accent}; color: #fff; padding: 0.75rem 2rem; border-radius: 8px; text-decoration: none; font-weight: 600; }
    .features { padding: 4rem 0; display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rem; }
    .feature { padding: 2rem; border-radius: 12px; border: 1px solid ${isDark ? "#262626" : "#e5e5e5"}; }
    .feature h3 { margin-bottom: 0.75rem; }
    .feature p { color: ${isDark ? "#737373" : "#a3a3a3"}; }
    footer { text-align: center; padding: 2rem 0; border-top: 1px solid ${isDark ? "#262626" : "#e5e5e5"}; color: ${isDark ? "#525252" : "#d4d4d4"}; }
  </style>
</head>
<body>
  <div class="container">
    <nav>
      <div class="logo">${req.prompt.split(" ").slice(0, 2).join(" ")}</div>
      <div class="nav-links">
        <a href="#">Features</a>
        <a href="#">Pricing</a>
        <a href="#">About</a>
        <a href="#">Contact</a>
      </div>
    </nav>
    <section class="hero">
      <h1>${req.prompt}</h1>
      <p>Beautiful, responsive website generated by AI from a simple prompt.</p>
      <a href="#" class="btn">Get Started</a>
    </section>
    <section class="features">
      <div class="feature"><h3>Fast</h3><p>Lightning-fast performance optimized for modern web.</p></div>
      <div class="feature"><h3>Responsive</h3><p>Looks great on every device, from mobile to desktop.</p></div>
      <div class="feature"><h3>Modern</h3><p>Built with cutting-edge web technologies.</p></div>
    </section>
    <footer><p>&copy; 2026 ${req.prompt}. All rights reserved.</p></footer>
  </div>
</body>
</html>`;

    const website: GeneratedWebsite = {
      id: `web_${Date.now()}`,
      prompt: req.prompt,
      html,
      css: "",
      createdAt: new Date().toISOString(),
    };
    this.websites.set(website.id, website);
    return website;
  }

  async generateUIComponent(req: DesignGenerationRequest): Promise<GeneratedUIComponent> {
    const q = req.prompt.toLowerCase();
    const isDark = q.includes("dark") || !q.includes("light");
    const isButton = q.includes("button") || q.includes("btn");
    const isCard = q.includes("card");
    const isForm = q.includes("form") || q.includes("input");
    const isNav = q.includes("nav") || q.includes("navbar") || q.includes("menu");
    const isModal = q.includes("modal") || q.includes("dialog");
    const isTable = q.includes("table") || q.includes("grid");
    const isBadge = q.includes("badge") || q.includes("tag");

    let name = "Component";
    let code = "";

    if (isButton) {
      name = "Button";
      code = this.generateButtonComponent(isDark);
    } else if (isCard) {
      name = "Card";
      code = this.generateCardComponent(isDark);
    } else if (isForm) {
      name = "Form";
      code = this.generateFormComponent(isDark);
    } else if (isNav) {
      name = "Navbar";
      code = this.generateNavbarComponent(isDark);
    } else if (isModal) {
      name = "Modal";
      code = this.generateModalComponent(isDark);
    } else if (isTable) {
      name = "DataTable";
      code = this.generateTableComponent(isDark);
    } else if (isBadge) {
      name = "Badge";
      code = this.generateBadgeComponent(isDark);
    } else {
      name = "Card";
      code = this.generateCardComponent(isDark);
    }

    return {
      id: `ui_${Date.now()}`,
      prompt: req.prompt,
      name,
      framework: "react",
      code,
      createdAt: new Date().toISOString(),
    };
  }

  async generatePresentation(req: DesignGenerationRequest): Promise<GeneratedPresentation> {
    return this.presenton.generate(req.prompt, req.style);
  }

  async generateDesignSystem(req: DesignGenerationRequest): Promise<DesignSystem> {
    return this.designSystem.generate(req.prompt);
  }

  async process(req: DesignGenerationRequest) {
    switch (req.type) {
      case "website":
        return this.generateWebsite(req);
      case "ui":
        return this.generateUIComponent(req);
      case "image":
        return this.generateImage({
          prompt: req.prompt,
          provider: req.provider || "flux",
          style: req.style,
        });
      case "presentation":
        return this.generatePresentation(req);
      case "design-system":
        return this.generateDesignSystem(req);
      default:
        throw new Error(`Unknown design type: ${req.type}`);
    }
  }

  private generateButtonComponent(isDark: boolean): string {
    return `import { ButtonHTMLAttributes } from "react";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
}

export default function Button({ variant = "primary", size = "md", className = "", children, ...props }: Props) {
  const base = "inline-flex items-center justify-center font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const variants = {
    primary: "bg-accent text-white hover:bg-accent/90 focus:ring-accent/50",
    secondary: "bg-surface border border-border text-text hover:bg-surface-2 focus:ring-border",
    ghost: "bg-transparent text-text-muted hover:text-text hover:bg-surface-2 focus:ring-border",
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs rounded-lg",
    md: "px-4 py-2 text-sm rounded-xl",
    lg: "px-6 py-3 text-base rounded-xl",
  };

  return (
    <button className={\`\${base} \${variants[variant]} \${sizes[size]} \${className}\`} {...props}>
      {children}
    </button>
  );
}`;
  }

  private generateCardComponent(isDark: boolean): string {
    return `import { ReactNode } from "react";

interface Props {
  title?: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export default function Card({ title, subtitle, children, className = "", onClick }: Props) {
  return (
    <div
      className={\`bg-surface border border-border rounded-xl p-4 \${
        onClick ? "cursor-pointer hover:border-accent/50 transition-colors" : ""
      } \${className}\`}
      onClick={onClick}
    >
      {title && <h3 className="text-sm font-semibold text-text mb-1">{title}</h3>}
      {subtitle && <p className="text-xs text-text-muted mb-3">{subtitle}</p>}
      {children}
    </div>
  );
}`;
  }

  private generateFormComponent(isDark: boolean): string {
    return `import { FormHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

function Field({ label, error, id, className = "", ...props }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-text">{label}</label>
      <input
        id={id}
        className={\`w-full bg-surface border border-border rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-muted/50 focus:outline-none focus:border-accent/50 transition-colors \${
          error ? "border-red-500" : ""
        } \${className}\`}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  title?: string;
  children: ReactNode;
}

export default function Form({ title, children, className = "", ...props }: FormProps) {
  return (
    <form className={\`space-y-4 \${className}\`} {...props}>
      {title && <h2 className="text-lg font-bold text-text">{title}</h2>}
      {children}
    </form>
  );
}

Form.Field = Field;`;
  }

  private generateNavbarComponent(isDark: boolean): string {
    return `import { useState } from "react";

interface NavItem {
  label: string;
  href: string;
  children?: NavItem[];
}

interface Props {
  brand: string;
  items: NavItem[];
  rightContent?: React.ReactNode;
}

export default function Navbar({ brand, items, rightContent }: Props) {
  const [open, setOpen] = useState(false);
  const [dropdown, setDropdown] = useState<string | null>(null);

  return (
    <nav className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
      <div className="text-lg font-bold text-text">{brand}</div>
      <div className="hidden md:flex items-center gap-6">
        {items.map((item) => (
          <div key={item.label} className="relative" onMouseEnter={() => setDropdown(item.label)} onMouseLeave={() => setDropdown(null)}>
            <a href={item.href} className="text-sm text-text-muted hover:text-text transition-colors">{item.label}</a>
            {item.children && dropdown === item.label && (
              <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-xl shadow-lg p-2 min-w-[180px]">
                {item.children.map((child) => (
                  <a key={child.label} href={child.href} className="block px-3 py-2 text-sm text-text-muted hover:text-text hover:bg-surface-2 rounded-lg transition-colors">{child.label}</a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        {rightContent}
        <button className="md:hidden text-text" onClick={() => setOpen(!open)}>{open ? "✕" : "☰"}</button>
      </div>
      {open && (
        <div className="absolute top-full left-0 right-0 bg-surface border-b border-border p-4 md:hidden">
          {items.map((item) => (
            <a key={item.label} href={item.href} className="block py-2 text-sm text-text-muted hover:text-text">{item.label}</a>
          ))}
        </div>
      )}
    </nav>
  );
}`;
  }

  private generateModalComponent(isDark: boolean): string {
    return `import { ReactNode, useEffect } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

export default function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg mx-4 bg-surface border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          {title && <h2 className="text-lg font-bold text-text">{title}</h2>}
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text hover:bg-surface-2 transition-colors">✕</button>
        </div>
        <div className="px-5 pb-5">{children}</div>
      </div>
    </div>
  );
}`;
  }

  private generateTableComponent(isDark: boolean): string {
    return `import { ReactNode } from "react";

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  data: T[];
  onRowClick?: (item: T) => void;
}

export default function DataTable<T extends Record<string, any>>({ columns, data, onRowClick }: Props<T>) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-surface-2 border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className="px-4 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={i}
              className={\`border-b border-border last:border-0 hover:bg-surface-2/50 transition-colors \${
                onRowClick ? "cursor-pointer" : ""
              }\`}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-text">
                  {col.render ? col.render(item) : item[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}`;
  }

  private generateBadgeComponent(isDark: boolean): string {
    return `import { ReactNode } from "react";

interface Props {
  variant?: "default" | "success" | "warning" | "error" | "info";
  children: ReactNode;
  className?: string;
}

const variants = {
  default: "bg-surface-2 text-text-muted border-border",
  success: "bg-green-500/10 text-green-400 border-green-500/20",
  warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  error: "bg-red-500/10 text-red-400 border-red-500/20",
  info: "bg-blue-500/10 text-blue-400 border-blue-500/20",
};

export default function Badge({ variant = "default", children, className = "" }: Props) {
  return (
    <span className={\`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full border \${variants[variant]} \${className}\`}>
      {children}
    </span>
  );
}`;
  }

  async getWebsites(): Promise<GeneratedWebsite[]> {
    return Array.from(this.websites.values());
  }

  async getUIComponents(): Promise<GeneratedUIComponent[]> {
    return Array.from(this.uiComponents.values());
  }
}
