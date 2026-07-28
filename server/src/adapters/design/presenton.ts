import type { GeneratedPresentation, PresentationSlide } from "./types.js";

interface PresentonConfig {
  apiKey?: string;
  baseUrl?: string;
}

export class PresentonGenerator {
  private config: PresentonConfig;

  constructor(config?: PresentonConfig) {
    this.config = {
      apiKey: config?.apiKey || process.env.PRESENTON_API_KEY,
      baseUrl: config?.baseUrl || process.env.PRESENTON_URL || "https://api.presenton.com",
    };
  }

  async generate(prompt: string, theme?: string): Promise<GeneratedPresentation> {
    if (this.config.apiKey) {
      try {
        const resp = await fetch(`${this.config.baseUrl}/v1/presentations`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            topic: prompt,
            theme: theme || "dark",
            slides: 6,
          }),
        });
        if (resp.ok) {
          const data: any = await resp.json();
          return {
            id: `pres_${Date.now()}`,
            prompt,
            title: data.title || prompt,
            slides: (data.slides || []).map((s: any, i: number) => ({
              title: s.title || `Slide ${i + 1}`,
              content: s.content || "",
              notes: s.notes,
            })),
            html: data.html || this.buildHtml(prompt, data.slides || []),
            theme: theme || "dark",
            createdAt: new Date().toISOString(),
          };
        }
      } catch {}
    }

    const slides = this.generateSlides(prompt);
    return {
      id: `pres_${Date.now()}`,
      prompt,
      title: this.extractTitle(prompt),
      slides,
      html: this.buildHtml(prompt, slides),
      theme: theme || "dark",
      createdAt: new Date().toISOString(),
    };
  }

  private extractTitle(prompt: string): string {
    const words = prompt.split(" ").slice(0, 6);
    return words.join(" ") + (words.length >= 6 ? "..." : "");
  }

  private generateSlides(prompt: string): PresentationSlide[] {
    return [
      { title: this.extractTitle(prompt), content: `Overview of ${prompt}` },
      { title: "Key Features", content: "Core capabilities and benefits" },
      { title: "Architecture", content: "System design and components" },
      { title: "Implementation", content: "Step-by-step deployment guide" },
      { title: "Results", content: "Expected outcomes and metrics" },
      { title: "Next Steps", content: "Future roadmap and improvements" },
    ];
  }

  private buildHtml(prompt: string, slides: PresentationSlide[]): string {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>${this.extractTitle(prompt)}</title>
<style>
  body { margin: 0; background: #000; color: #fafafa; font-family: system-ui; }
  .slide { display: flex; flex-direction: column; justify-content: center; align-items: center; height: 100vh; padding: 4rem; text-align: center; border-bottom: 1px solid #262626; }
  .slide h1 { font-size: 3rem; font-weight: 800; margin-bottom: 1rem; background: linear-gradient(135deg, #6b8c42, #8bc34a); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .slide p { font-size: 1.25rem; color: #a3a3a3; max-width: 600px; line-height: 1.6; }
  .slide-num { position: fixed; bottom: 2rem; right: 2rem; font-size: 0.75rem; color: #525252; }
</style></head><body>
${slides.map((s, i) => `
<div class="slide">
  <h1>${s.title}</h1>
  <p>${s.content}</p>
  <div class="slide-num">${i + 1} / ${slides.length}</div>
</div>`).join("\n")}
</body></html>`;
  }
}
