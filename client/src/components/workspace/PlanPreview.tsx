import { useMemo } from "react";
import {
  estimatePlan, formatCost, formatTokens, getModelName, getProviderName,
} from "../../lib/plan-preview.js";
import type { ThinkingBudget } from "../../lib/models.js";

interface Props {
  prompt: string;
  providerId: string;
  modelId: string;
  thinking: ThinkingBudget;
  onConfirm: () => void;
  onCancel: () => void;
  onModelChange: (providerId: string, modelId: string) => void;
  loading?: boolean;
}

export default function PlanPreview({
  prompt,
  providerId,
  modelId,
  thinking,
  onConfirm,
  onCancel,
  onModelChange,
  loading,
}: Props) {
  const estimate = useMemo(
    () => estimatePlan(prompt, providerId, modelId, thinking),
    [prompt, providerId, modelId, thinking]
  );

  const isRecommended =
    estimate.recommendedModel.providerId === providerId &&
    estimate.recommendedModel.modelId === modelId;

  return (
    <div className="border border-accent/30 bg-accent/5 rounded-2xl p-3 space-y-2.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">📊</span>
          <span className="text-[11px] font-semibold text-text">Procjena plana</span>
        </div>
        {isRecommended && (
          <span className="text-[8px] text-accent bg-accent/10 px-1.5 py-0.5 rounded font-medium">
            ✓ Preporučeni model
          </span>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2">
        <StatCard
          icon="📝"
          label="Input tokeni"
          value={formatTokens(estimate.inputTokens)}
        />
        <StatCard
          icon="💬"
          label="Output tokeni"
          value={formatTokens(estimate.outputTokens)}
        />
        <StatCard
          icon="🔢"
          label="Koraci"
          value={String(estimate.estimatedSteps)}
        />
        <StatCard
          icon="⏱"
          label="Trajanje"
          value={estimate.estimatedDuration}
        />
      </div>

      {/* Cost */}
      <div className="flex items-center justify-between bg-[#0d0d0d] rounded-lg px-2.5 py-2 border border-[#222]">
        <div className="flex items-center gap-1.5">
          <span className="text-[11px]">💰</span>
          <span className="text-[10px] text-text-muted">Procijenjena cijena</span>
        </div>
        <span className="text-[13px] font-bold text-accent font-mono">
          {formatCost(estimate.costUSD)}
        </span>
      </div>

      {/* Model info */}
      <div className="text-[10px] text-text-muted">
        Model: <span className="text-text-secondary font-medium">{getModelName(modelId)}</span>
        <span className="text-text-muted/40 mx-1">·</span>
        {getProviderName(providerId)}
      </div>

      {/* Recommendation */}
      {!isRecommended && (
        <button
          onClick={() => onModelChange(estimate.recommendedModel.providerId, estimate.recommendedModel.modelId)}
          className="w-full flex items-center justify-between bg-[#0d0d0d] rounded-lg px-2.5 py-2 border border-accent/20 hover:border-accent/40 transition-colors text-left"
        >
          <div>
            <div className="text-[10px] text-accent font-medium">Preporuka: {getModelName(estimate.recommendedModel.modelId)}</div>
            <div className="text-[9px] text-text-muted mt-0.5">{estimate.recommendedModel.reason}</div>
          </div>
          <span className="text-[9px] text-accent/60">→</span>
        </button>
      )}

      {/* Alternatives */}
      {estimate.alternatives.length > 0 && (
        <div className="space-y-1">
          <div className="text-[9px] text-text-muted uppercase tracking-wider">Alternative</div>
          {estimate.alternatives.map((alt) => (
            <button
              key={`${alt.providerId}-${alt.modelId}`}
              onClick={() => onModelChange(alt.providerId, alt.modelId)}
              className="w-full flex items-center justify-between bg-[#0d0d0d] rounded-lg px-2.5 py-1.5 border border-[#222] hover:border-[#444] transition-colors text-left"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-[10px] text-text-secondary truncate">{getModelName(alt.modelId)}</span>
                <span className="text-[8px] text-text-muted/40">{alt.reason}</span>
              </div>
              <span className="text-[10px] text-text-muted font-mono shrink-0">{formatCost(alt.costUSD)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={onCancel}
          className="flex-1 py-1.5 text-[11px] font-medium rounded-xl border border-border bg-surface-2 text-text-secondary hover:bg-surface hover:text-text transition-colors"
        >
          Otkaži
        </button>
        <button
          onClick={onConfirm}
          disabled={loading}
          className="flex-1 py-1.5 text-[11px] font-medium rounded-xl bg-accent text-white hover:bg-accent-light disabled:opacity-30 transition-colors"
        >
          {loading ? "Šaljem…" : "Potvrdi i pošalji"}
        </button>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-[#0d0d0d] rounded-lg px-2.5 py-2 border border-[#222]">
      <div className="flex items-center gap-1 mb-0.5">
        <span className="text-[10px]">{icon}</span>
        <span className="text-[9px] text-text-muted">{label}</span>
      </div>
      <div className="text-[12px] font-bold text-text font-mono">{value}</div>
    </div>
  );
}
