import type { AssetType, AssetSpec, ImageGenerationRequest } from "./types.js";
import { ASSET_SPECS } from "./types.js";

export class AssetManager {
  getSpec(type: AssetType): AssetSpec {
    return ASSET_SPECS[type];
  }

  listTypes(): { type: AssetType; spec: AssetSpec }[] {
    return (Object.entries(ASSET_SPECS) as [AssetType, AssetSpec][]).map(([type, spec]) => ({ type, spec }));
  }

  buildRequest(type: AssetType, prompt: string, projectId?: string, tags?: string[]): ImageGenerationRequest {
    const spec = ASSET_SPECS[type];
    return {
      prompt,
      width: spec.width,
      height: spec.height,
      format: spec.format,
      assetType: type,
      projectId,
      tags: [...(tags ?? []), type],
    };
  }

  getPromptForType(type: AssetType, brand?: string, subject?: string): string {
    const prompts: Record<AssetType, string> = {
      "logo": `Professional logo design for ${brand || "company"}, ${subject || "modern technology"}, clean scalable vector style, transparent background`,
      "icon": `Application icon for ${brand || "app"}, ${subject || "minimal design"}, 256x256, rounded corners, modern`,
      "favicon": `Favicon for ${brand || "website"}, ${subject || "simple symbol"}, 64x64, minimal, recognizable at small size`,
      "banner": `Hero banner for ${brand || "website"}, ${subject || "professional landscape"}, wide format 1200x400, space for text overlay`,
      "og-image": "Open Graph share image, 1200x630, social media preview, " + (subject || "professional") + ", branded",
      "github-cover": `GitHub repository cover for ${brand || "project"}, ${subject || "tech"}, 1280x640, dark mode friendly`,
      "readme-image": `README illustration for ${brand || "project"}, ${subject || "architecture diagram style"}, 800x400`,
      "blog-cover": `Blog cover about ${subject || "technology"}, 1200x675, professional, space for title overlay`,
      "doc-graphic": `Documentation graphic explaining ${subject || "concept"}, 800x600, clean diagram style`,
      "ui-mockup": `UI mockup of ${subject || "dashboard"}, ${brand || "app"} interface, 1440x900, modern design system`,
      "app-screenshot": `Mobile app screenshot of ${brand || "app"}, ${subject || "main screen"}, 390x844, iOS design language`,
      "marketing-graphic": `Marketing graphic for ${brand || "campaign"}, ${subject || "promotion"}, 1200x800, professional`,
      "social-media-graphic": `Social media graphic for ${brand || "brand"}, ${subject || "announcement"}, 1080x1080 square, engaging`,
      "presentation-slide": `Presentation slide about ${subject || "topic"}, ${brand || "company"} branding, 1920x1080, professional layout`,
    };

    return prompts[type] || `Generate ${type} image: ${subject || "professional design"}`;
  }
}
