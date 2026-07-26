import { TEMPLATES, type TemplateId } from "../lib/projects.js";

interface Props {
  selected: TemplateId;
  onSelect: (id: TemplateId) => void;
}

export default function TemplateSelector({ selected, onSelect }: Props) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          className={`text-left p-3 rounded-xl border transition-colors ${
            selected === t.id
              ? "border-accent bg-accent-dim"
              : "border-border bg-surface-2 hover:border-border-light"
          }`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{t.icon}</span>
            <span className="font-medium text-sm">{t.name}</span>
          </div>
          <p className="text-xs text-text-muted">{t.description}</p>
        </button>
      ))}
    </div>
  );
}
