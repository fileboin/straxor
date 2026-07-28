import type { CircuitState } from "./adapter.js";

export interface CircuitBreakerConfig {
  failureThreshold: number; // trips after N failures
  recoveryTime: number; // ms before half-open
  halfOpenMax: number; // requests in half-open before closing
}

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5,
  recoveryTime: 30000,
  halfOpenMax: 3,
};

interface CircuitEntry {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailure: number;
  lastStateChange: number;
}

export class CircuitBreaker {
  private circuits: Map<string, CircuitEntry> = new Map();
  private config: CircuitBreakerConfig;

  constructor(config?: Partial<CircuitBreakerConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  private getEntry(id: string): CircuitEntry {
    if (!this.circuits.has(id)) {
      this.circuits.set(id, {
        state: "closed",
        failureCount: 0,
        successCount: 0,
        lastFailure: 0,
        lastStateChange: Date.now(),
      });
    }
    return this.circuits.get(id)!;
  }

  canExecute(id: string): boolean {
    const entry = this.getEntry(id);

    if (entry.state === "closed") return true;

    if (entry.state === "open") {
      const elapsed = Date.now() - entry.lastStateChange;
      if (elapsed >= this.config.recoveryTime) {
        entry.state = "half-open";
        entry.successCount = 0;
        entry.lastStateChange = Date.now();
        return true;
      }
      return false;
    }

    // half-open — allow limited requests
    return entry.successCount < this.config.halfOpenMax;
  }

  recordSuccess(id: string): void {
    const entry = this.getEntry(id);

    if (entry.state === "half-open") {
      entry.successCount++;
      if (entry.successCount >= this.config.halfOpenMax) {
        entry.state = "closed";
        entry.failureCount = 0;
        entry.lastStateChange = Date.now();
      }
    } else {
      entry.failureCount = Math.max(0, entry.failureCount - 1);
    }
  }

  recordFailure(id: string): void {
    const entry = this.getEntry(id);
    entry.failureCount++;
    entry.lastFailure = Date.now();

    if (entry.state === "half-open") {
      entry.state = "open";
      entry.lastStateChange = Date.now();
    } else if (entry.failureCount >= this.config.failureThreshold) {
      entry.state = "open";
      entry.lastStateChange = Date.now();
    }
  }

  getState(id: string): CircuitState {
    return this.getEntry(id).state;
  }

  getFailureCount(id: string): number {
    return this.getEntry(id).failureCount;
  }

  reset(id: string): void {
    this.circuits.set(id, {
      state: "closed",
      failureCount: 0,
      successCount: 0,
      lastFailure: 0,
      lastStateChange: Date.now(),
    });
  }

  resetAll(): void {
    this.circuits.clear();
  }
}

// ── Retry with exponential backoff ──

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number; // ms
  maxDelay: number; // ms
  jitter: boolean;
}

const DEFAULT_RETRY: RetryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  jitter: true,
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const cfg = { ...DEFAULT_RETRY, ...config };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;

      if (attempt < cfg.maxRetries) {
        let delay = Math.min(cfg.baseDelay * Math.pow(2, attempt), cfg.maxDelay);
        if (cfg.jitter) {
          delay = delay * (0.5 + Math.random() * 0.5);
        }
        await new Promise((r) => setTimeout(r, delay));
      }
    }
  }

  throw lastError || new Error("Retry failed");
}
