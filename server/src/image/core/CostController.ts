import type { ImageGenerationRequest, CostRecord, CostOptimizationStrategy, ImageQuality } from "./types.js";

export class CostController {
  private records: CostRecord[] = [];
  private budgets = new Map<string, number>();

  setBudget(projectId: string, maxCost: number): void {
    this.budgets.set(projectId, maxCost);
  }

  getBudget(projectId: string): number | undefined {
    return this.budgets.get(projectId);
  }

  getProjectCost(projectId: string): number {
    return this.records
      .filter(r => r.projectId === projectId)
      .reduce((sum, r) => sum + r.totalCost, 0);
  }

  isWithinBudget(projectId: string, estimatedCost: number): boolean {
    const budget = this.budgets.get(projectId);
    if (!budget) return true;
    return this.getProjectCost(projectId) + estimatedCost <= budget;
  }

  recordCost(provider: string, imageCount: number, cost: number, duration: number, width: number, height: number, quality: ImageQuality, projectId?: string): CostRecord {
    const record: CostRecord = {
      id: `cost-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      projectId,
      provider,
      imageCount,
      totalCost: cost,
      totalDuration: duration,
      width,
      height,
      quality,
      createdAt: new Date().toISOString(),
    };

    this.records.push(record);
    return record;
  }

  getStrategyCost(strategy: CostOptimizationStrategy, costs: Map<string, number>): string | undefined {
    if (costs.size === 0) return undefined;

    switch (strategy) {
      case "lowest-cost": {
        let min = Infinity;
        let minProvider: string | undefined;
        for (const [provider, cost] of costs) {
          if (cost < min) { min = cost; minProvider = provider; }
        }
        return minProvider;
      }
      case "highest-quality": {
        let max = -Infinity;
        let maxProvider: string | undefined;
        for (const [provider, cost] of costs) {
          if (cost > max) { max = cost; maxProvider = provider; }
        }
        return maxProvider;
      }
      default:
        return undefined;
    }
  }

  getRecords(projectId?: string, provider?: string, limit = 100): CostRecord[] {
    let filtered = this.records;
    if (projectId) filtered = filtered.filter(r => r.projectId === projectId);
    if (provider) filtered = filtered.filter(r => r.provider === provider);
    return filtered.slice(0, limit);
  }

  getTotalCost(): number {
    return this.records.reduce((sum, r) => sum + r.totalCost, 0);
  }

  getCostByProvider(): Map<string, number> {
    const byProvider = new Map<string, number>();
    for (const r of this.records) {
      byProvider.set(r.provider, (byProvider.get(r.provider) ?? 0) + r.totalCost);
    }
    return byProvider;
  }

  reset(): void {
    this.records = [];
  }
}
