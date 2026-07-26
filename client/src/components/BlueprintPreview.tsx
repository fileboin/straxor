import { TEMPLATES, type TemplateId } from "../lib/projects.js";

const PRESET_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#6b7280",
];

interface Props {
  name: string;
  description: string;
  template: TemplateId;
  color: string;
  onColorChange: (color: string) => void;
}

export default function BlueprintPreview({
  name,
  description,
  template,
  color,
  onColorChange,
}: Props) {
  const templateInfo = TEMPLATES.find((t) => t.id === template)!;

  return (
    <div className="rounded-xl border border-gray-700 overflow-hidden">
      <div
        className="h-32 flex items-end p-4"
        style={{ backgroundColor: color }}
      >
        <div className="bg-black/40 backdrop-blur-sm rounded-lg px-3 py-1.5">
          <span className="text-sm font-medium">{name || "Naziv projekta"}</span>
        </div>
      </div>

      <div className="p-4 bg-gray-900 space-y-4">
        <div>
          <h3 className="font-semibold text-lg">{name || "Naziv projekta"}</h3>
          {description && (
            <p className="text-sm text-gray-400 mt-1">{description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span>{templateInfo.icon}</span>
          <span className="text-gray-300">{templateInfo.name}</span>
          <span className="text-gray-600">·</span>
          <span className="text-gray-500">{templateInfo.description}</span>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Primarna boja</p>
          <div className="flex gap-2">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => onColorChange(c)}
                className={`w-7 h-7 rounded-full border-2 transition-transform ${
                  color === c ? "border-white scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <label className="w-7 h-7 rounded-full border border-gray-600 flex items-center justify-center cursor-pointer overflow-hidden">
              <span className="text-xs text-gray-500">+</span>
              <input
                type="color"
                value={color}
                onChange={(e) => onColorChange(e.target.value)}
                className="absolute opacity-0 w-0 h-0"
              />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
