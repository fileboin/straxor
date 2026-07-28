// ── Usage Engine Types ──

export type UsageBackend = "openmeter" | "lago" | "custom";

export type UsagePeriod = "hourly" | "daily" | "weekly" | "monthly";

export interface UsageEvent {
  id: string;
  timestamp: string;
  userId: string;
  projectId?: string;
  machineId?: string;

  provider: string;
  model: string;

  inputTokens: number;
  outputTokens: number;
  totalTokens: number;

  costUsd: number;

  latencyMs?: number;
  success: boolean;
  errorMessage?: string;

  metadata?: Record<string, string>;
}

export interface UsageAggregate {
  dimension: "provider" | "model" | "project" | "machine" | "day" | "hour";
  label: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  requestCount: number;
  avgLatencyMs: number;
  errorRate: number;
}

export interface CostSummary {
  totalCostUsd: number;
  totalTokens: number;
  totalRequests: number;
  period: { from: string; to: string };

  byProvider: UsageAggregate[];
  byModel: UsageAggregate[];
  byProject: UsageAggregate[];
  byDay: UsageAggregate[];
}

export interface UsageBudget {
  id: string;
  name: string;
  monthlyLimitUsd: number;
  currentSpendUsd: number;
  alertThresholdPercent: number; // e.g. 80 = alert at 80%
  isHardLimit: boolean; // true = block, false = warn only
  createdAt: string;
}

export interface BillingPeriod {
  id: string;
  name: string;
  from: string;
  to: string;
  totalCostUsd: number;
  totalTokens: number;
  invoiceUrl?: string;
}

export interface ModelPricing {
  provider: string;
  model: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  label: string;
}

export interface UsageAdapter {
  // Core
  logEvent(event: Omit<UsageEvent, "id">): Promise<UsageEvent>;
  getEvents(params: {
    from?: string;
    to?: string;
    provider?: string;
    model?: string;
    projectId?: string;
    limit?: number;
    offset?: number;
  }): Promise<UsageEvent[]>;

  // Aggregation
  getAggregate(params: {
    dimension: UsageAggregate["dimension"];
    from?: string;
    to?: string;
    provider?: string;
    model?: string;
  }): Promise<UsageAggregate[]>;

  getCostSummary(params: {
    from?: string;
    to?: string;
  }): Promise<CostSummary>;

  // Budgets
  listBudgets(): Promise<UsageBudget[]>;
  createBudget(budget: Omit<UsageBudget, "id" | "currentSpendUsd" | "createdAt">): Promise<UsageBudget>;
  deleteBudget(id: string): Promise<void>;

  // Periods
  listPeriods(): Promise<BillingPeriod[]>;

  // Pricing
  getPricing(): Promise<ModelPricing[]>;
  estimateCost(provider: string, model: string, inputTokens: number, outputTokens: number): Promise<number>;
}
