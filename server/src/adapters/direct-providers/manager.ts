import { db } from "../../db/index.js";
import { userApiKeys } from "../../db/schema.js";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "../../lib/crypto.js";
import {
  DIRECT_PROVIDERS,
  type DirectProviderId,
  type DirectProviderStatus,
  type DirectProviderConfig,
  type DirectProviderDef,
} from "./types.js";

// In-memory provider configs (baseUrl overrides, isEnabled toggles)
// Persisted per-user in the future; for now global singleton
const providerConfigs: Map<string, DirectProviderConfig> = new Map();

// Health check cache
const healthCache: Map<string, { healthy: boolean; latencyMs: number; checkedAt: string; error?: string }> = new Map();

export class DirectProviderManager {
  // ── Get all providers with status ──
  async getAllStatuses(userId: string): Promise<DirectProviderStatus[]> {
    const statuses: DirectProviderStatus[] = [];

    for (const def of DIRECT_PROVIDERS) {
      const status = await this.getStatus(userId, def);
      statuses.push(status);
    }

    return statuses;
  }

  // ── Get single provider status ──
  async getStatus(userId: string, def: DirectProviderDef): Promise<DirectProviderStatus> {
    const config = providerConfigs.get(def.id) || {};
    const health = healthCache.get(def.id);

    // Check if key exists
    let hasKey = false;
    let keyPreview: string | null = null;

    if (def.authMethod === "none") {
      hasKey = true; // Ollama doesn't need a key
    } else {
      const rows = await db
        .select()
        .from(userApiKeys)
        .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, def.id)))
        .limit(1);

      if (rows.length > 0) {
        hasKey = true;
        try {
          const decrypted = decrypt(rows[0].encryptedKey);
          keyPreview = decrypted.slice(0, 6) + "••••" + decrypted.slice(-4);
        } catch { /* ok */ }
      }
    }

    return {
      providerId: def.id,
      hasKey,
      isEnabled: config.isEnabled ?? hasKey, // auto-enable if key is set
      isHealthy: health?.healthy ?? null,
      baseUrl: config.baseUrl || def.baseUrl,
      latencyMs: health?.latencyMs ?? null,
      lastChecked: health?.checkedAt ?? null,
      lastError: health?.error ?? null,
      keyPreview,
    };
  }

  // ── Save API key ──
  async saveKey(userId: string, providerId: string, key: string): Promise<void> {
    const encryptedKey = encrypt(key);

    const existing = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(userApiKeys)
        .set({ encryptedKey, updatedAt: new Date() })
        .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)));
    } else {
      await db.insert(userApiKeys).values({ userId, providerId, encryptedKey });
    }
  }

  // ── Delete API key ──
  async deleteKey(userId: string, providerId: string): Promise<boolean> {
    const result = await db
      .delete(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .returning();

    return result.length > 0;
  }

  // ── Get decrypted API key ──
  async getKey(userId: string, providerId: string): Promise<string | null> {
    const rows = await db
      .select()
      .from(userApiKeys)
      .where(and(eq(userApiKeys.userId, userId), eq(userApiKeys.providerId, providerId)))
      .limit(1);

    if (rows.length === 0) return null;
    try {
      return decrypt(rows[0].encryptedKey);
    } catch {
      return null;
    }
  }

  // ── Update provider config (baseUrl, isEnabled) ──
  updateConfig(providerId: string, config: DirectProviderConfig): void {
    const existing = providerConfigs.get(providerId) || {};
    providerConfigs.set(providerId, { ...existing, ...config });
  }

  // ── Health check ──
  async checkHealth(providerId: string): Promise<{ healthy: boolean; latencyMs: number; error?: string }> {
    const def = DIRECT_PROVIDERS.find((p) => p.id === providerId);
    if (!def) return { healthy: false, latencyMs: 0, error: "Unknown provider" };

    const config = providerConfigs.get(def.id) || {};
    const url = config.baseUrl || def.healthEndpoint;
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const headers: Record<string, string> = {};
      if (def.id === "ollama") {
        // Ollama health check — just hit the tags endpoint
      }

      const res = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const latencyMs = Date.now() - start;
      const healthy = res.ok || res.status === 401 || res.status === 403; // 401/403 means endpoint exists

      const result = {
        healthy,
        latencyMs,
        ...(healthy ? {} : { error: `HTTP ${res.status}` }),
      };

      healthCache.set(def.id, { ...result, checkedAt: new Date().toISOString() });
      return result;
    } catch (err) {
      const latencyMs = Date.now() - start;
      const error = (err as Error).message || "Connection failed";
      const result = { healthy: false, latencyMs, error };
      healthCache.set(def.id, { ...result, checkedAt: new Date().toISOString() });
      return result;
    }
  }

  // ── Toggle provider ──
  toggleEnabled(providerId: string, enabled: boolean): void {
    const existing = providerConfigs.get(providerId) || {};
    providerConfigs.set(providerId, { ...existing, isEnabled: enabled });
  }
}

// Singleton
let manager: DirectProviderManager | null = null;

export function getDirectProviderManager(): DirectProviderManager {
  if (!manager) manager = new DirectProviderManager();
  return manager;
}
