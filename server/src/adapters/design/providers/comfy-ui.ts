import { BaseImageProvider } from "../image-provider.js";
import type { ImageProviderId, ImageGenerationRequest, ImageGenerationResult } from "../types.js";

export class ComfyUIProvider extends BaseImageProvider {
  id: ImageProviderId = "comfy-ui";
  name = "ComfyUI";

  private get baseUrl() {
    return process.env.COMFYUI_URL || "http://localhost:8188";
  }

  async generate(req: ImageGenerationRequest): Promise<ImageGenerationResult> {
    const start = Date.now();
    const { width, height } = this.validateDimensions(req);
    const seed = req.seed ?? Math.floor(Math.random() * 2147483647);

    const prompt_template = {
      3: {
        class_type: "KSampler",
        inputs: {
          seed,
          steps: req.steps || 20,
          cfg: 7,
          sampler_name: "euler",
          scheduler: "normal",
          denoise: 1,
          model: ["4", 0],
          positive: ["6", 0],
          negative: ["7", 0],
          latent_image: ["5", 0],
        },
      },
      4: { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: req.model || "sd_xl_base.safetensors" } },
      5: { class_type: "EmptyLatentImage", inputs: { width, height, batch_size: 1 } },
      6: { class_type: "CLIPTextEncode", inputs: { text: req.prompt, clip: ["4", 1] } },
      7: {
        class_type: "CLIPTextEncode",
        inputs: { text: req.negativePrompt || "", clip: ["4", 1] },
      },
      8: { class_type: "VAEDecode", inputs: { samples: ["3", 0], vae: ["4", 2] } },
      9: { class_type: "SaveImage", inputs: { images: ["8", 0], filename_prefix: "straxor" } },
    };

    try {
      const queueResp = await fetch(`${this.baseUrl}/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt_template }),
      });
      const queueData: any = await queueResp.json();
      const promptId = queueData.prompt_id;

      // Poll for completion
      let output: any = null;
      for (let i = 0; i < 120; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const histResp = await fetch(`${this.baseUrl}/history/${promptId}`);
        const histData: any = await histResp.json();
        if (histData[promptId]?.outputs?.["9"]?.images) {
          output = histData[promptId].outputs["9"].images[0];
          break;
        }
      }

      const url = output
        ? `${this.baseUrl}/view?filename=${output.filename}&subfolder=${output.subfolder || ""}&type=output`
        : `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=ComfyUI`;

      return {
        id: this.makeId(),
        url,
        provider: "comfy-ui",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    } catch {
      return {
        id: this.makeId(),
        url: `https://placehold.co/${width}x${height}/0e1422/ff4d2e?text=ComfyUI+Error`,
        provider: "comfy-ui",
        prompt: req.prompt,
        width,
        height,
        seed,
        cost: 0,
        durationMs: Date.now() - start,
        createdAt: new Date().toISOString(),
      };
    }
  }
}
