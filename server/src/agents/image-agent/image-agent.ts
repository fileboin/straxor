import { PromptEngine } from "./prompt-engine.js";
import * as DomainModes from "./domain-modes.js";
import * as BrandPresets from "./brand-presets.js";
import * as SessionManager from "./session-manager.js";
import type {
  DomainMode,
  BrandPreset,
  ImageAgentRequest,
  ImageAgentMessage,
  ImageAgentGenerateResponse,
  ImageAgentSession,
  ImageAgentImageResult,
  PromptComponents,
} from "./types.js";
import type { ImageEngine } from "../../image/core/ImageEngine.js";
import type { ImageGenerationRequest } from "../../image/core/types.js";

export class ImageAgent {
  private promptEngine: PromptEngine;
  private imageEngine: ImageEngine;

  constructor(imageEngine: ImageEngine) {
    this.promptEngine = new PromptEngine();
    this.imageEngine = imageEngine;
  }

  async generate(req: ImageAgentRequest): Promise<ImageAgentGenerateResponse> {
    const {
      prompt: rawPrompt,
      domainMode,
      brandPresetId,
      aspectRatio,
      resolution,
      model,
      n = 1,
      sessionId,
      projectId,
    } = req;

    const mode = domainMode ? DomainModes.resolveDomainConfig(domainMode) : null;
    const brand = brandPresetId ? BrandPresets.getBrandPreset(brandPresetId) : null;

    const components = this.promptEngine.decompose(rawPrompt);

    let finalPrompt = this.promptEngine.buildPrompt(components, mode || undefined);
    if (brand) {
      finalPrompt = this.promptEngine.applyBrandKeywords(finalPrompt, brand.styleKeywords);
    }

    const prompts = n > 1 ? this.promptEngine.generateVariations(finalPrompt, n) : [finalPrompt];

    const imageResults: ImageAgentImageResult[] = [];
    for (let i = 0; i < prompts.length; i++) {
      const genReq: ImageGenerationRequest = {
        prompt: prompts[i],
        projectId,
        ...(aspectRatio ? { options: { aspectRatio } } : {}),
        ...(resolution ? { options: { imageSize: resolution } } : {}),
        ...(model ? { options: { model } } : {}),
      };

      if (!aspectRatio && mode) {
        genReq.options = { ...genReq.options, aspectRatio: mode.defaultAspectRatio };
      }
      if (!resolution && mode) {
        genReq.options = { ...genReq.options, imageSize: mode.defaultResolution };
      }

      try {
        const results = await this.imageEngine.generate(genReq);
        for (const r of results) {
          imageResults.push({
            id: r.id,
            url: r.url,
            b64: r.b64,
            width: r.width,
            height: r.height,
            format: r.format,
            provider: r.provider,
            model: r.model,
            duration: r.duration,
            cost: r.cost,
            seed: r.seed,
            variationIndex: prompts.length > 1 ? i : undefined,
          });
        }
      } catch (err: any) {
        imageResults.push({
          id: `error-${Date.now()}-${i}`,
          url: "",
          width: 0,
          height: 0,
          format: "png",
          provider: "error",
          duration: 0,
          cost: 0,
        });
      }
    }

    let session: ImageAgentSession;
    if (sessionId) {
      const existing = SessionManager.getSession(sessionId);
      if (existing) {
        session = existing;
      } else {
        session = SessionManager.createSession(projectId, rawPrompt.slice(0, 80));
      }
    } else {
      session = SessionManager.createSession(projectId, rawPrompt.slice(0, 80));
    }

    const userMsg: ImageAgentMessage = {
      role: "user",
      content: rawPrompt,
      promptComponents: components,
      domainMode: domainMode || undefined,
      createdAt: Date.now(),
    };
    SessionManager.addMessage(session.id, userMsg);

    const assistantMsg: ImageAgentMessage = {
      role: "assistant",
      content: `Generated ${imageResults.length} image(s) using ${imageResults[0]?.provider || "unknown"} provider`,
      promptComponents: components,
      domainMode: domainMode || undefined,
      imageResults,
      promptText: finalPrompt,
      createdAt: Date.now(),
    };
    session = SessionManager.addMessage(session.id, assistantMsg)!;

    return { message: assistantMsg, session };
  }

  getSession(id: string): ImageAgentSession | undefined {
    return SessionManager.getSession(id);
  }

  listSessions(projectId: string): ImageAgentSession[] {
    return SessionManager.listSessions(projectId);
  }

  deleteSession(id: string): boolean {
    return SessionManager.deleteSession(id);
  }

  clearMessages(sessionId: string): ImageAgentSession | undefined {
    return SessionManager.clearMessages(sessionId);
  }

  getPromptComponents(raw: string): PromptComponents {
    return this.promptEngine.decompose(raw);
  }

  listDomainModes() {
    return DomainModes.listDomainModes();
  }

  listBrandPresets(): BrandPreset[] {
    return BrandPresets.listBrandPresets();
  }
}
