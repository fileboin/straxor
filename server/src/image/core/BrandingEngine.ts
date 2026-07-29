import type { BrandIdentity, BrandColor, BrandTypography } from "./types.js";

export class BrandingEngine {
  private brands = new Map<string, BrandIdentity>();

  createBrand(projectId: string, name: string): BrandIdentity {
    const brand: BrandIdentity = {
      id: `brand-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      name,
      colorPalette: this.suggestPalette(name),
      typography: { headingFont: "Inter", bodyFont: "Inter", weights: [400, 500, 600, 700] },
      iconStyle: "modern",
      visualIdentity: "minimal",
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.brands.set(projectId, brand);
    return brand;
  }

  getBrand(projectId: string): BrandIdentity | undefined {
    return this.brands.get(projectId);
  }

  updateBrand(projectId: string, updates: Partial<BrandIdentity>): BrandIdentity | undefined {
    const brand = this.brands.get(projectId);
    if (!brand) return undefined;

    const updated = { ...brand, ...updates, updatedAt: new Date().toISOString() };
    this.brands.set(projectId, updated);
    return updated;
  }

  deleteBrand(projectId: string): void {
    this.brands.delete(projectId);
  }

  addAsset(projectId: string, type: BrandIdentity["assets"][0]["type"], url: string): BrandIdentity | undefined {
    const brand = this.brands.get(projectId);
    if (!brand) return undefined;

    brand.assets.push({ type, url, createdAt: new Date().toISOString() });
    brand.updatedAt = new Date().toISOString();
    return brand;
  }

  suggestPalette(name: string): BrandColor[] {
    const hash = this.simpleHash(name);
    const hue = hash % 360;

    return [
      { name: "Primary", hex: this.hslToHex(hue, 70, 45), role: "primary" },
      { name: "Secondary", hex: this.hslToHex((hue + 200) % 360, 60, 50), role: "secondary" },
      { name: "Accent", hex: this.hslToHex((hue + 120) % 360, 80, 55), role: "accent" },
      { name: "Background", hex: "#FFFFFF", role: "background" },
      { name: "Text", hex: "#1A1A2E", role: "text" },
    ];
  }

  suggestTypography(_name: string): BrandTypography {
    return {
      headingFont: this.pickRandom(["Inter", "Poppins", "Space Grotesk", "Clash Display"]),
      bodyFont: "Inter",
      weights: [400, 500, 600, 700],
    };
  }

  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash) + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private hslToHex(h: number, s: number, l: number): string {
    s /= 100;
    l /= 100;
    const k = (n: number) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => l - a * Math.max(Math.min(k(n) - 3, 9 - k(n), 1), -1);
    const toHex = (x: number) => Math.round(255 * x).toString(16).padStart(2, "0");
    return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
  }

  private pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  listBrands(): BrandIdentity[] {
    return Array.from(this.brands.values());
  }
}
