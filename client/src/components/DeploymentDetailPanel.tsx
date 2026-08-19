export function DeploymentDetailPanel({ deployment, onClose }: { deployment: any; onClose?: () => void }): JSX.Element | null {
  if (!deployment) return null;
  const id = deployment.id?.slice ? deployment.id.slice(0, 8) : String(deployment.id).slice(0, 8);
  const status = deployment.status ?? "unknown";
  return (
    <div className="p-4 rounded-xl bg-surface-2 border border-border space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-[12px] font-semibold text-text">Deployment #{id}</h4>
        {onClose && (
          <button onClick={onClose} className="text-[10px] text-text-muted hover:text-text">Close</button>
        )}
      </div>
      <div className="text-[11px] text-text-muted">Status: {status}</div>
    </div>
  );
}
