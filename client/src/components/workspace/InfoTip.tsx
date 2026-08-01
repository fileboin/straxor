import { useState, useEffect, useRef } from "react";

interface Props {
  text: string;
  side?: "left" | "right";
  placement?: "top" | "bottom";
  className?: string;
}

// Small "(i)" info circle — hover or click shows a short non-blocking tooltip.
export default function InfoTip({ text, side = "left", placement = "top", className = "" }: Props) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!show) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setShow(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShow(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [show]);

  return (
    <span
      ref={ref}
      className={`relative inline-flex items-center shrink-0 ${className}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          setShow((s) => !s);
        }}
        aria-label="Info"
        className="w-4 h-4 rounded-full border border-border text-text-muted text-[9px] font-bold leading-none flex items-center justify-center hover:text-text hover:border-border-light transition-colors select-none"
      >
        i
      </button>
      {show && (
        <span
          className={`absolute ${placement === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5"} ${side === "left" ? "right-0" : "left-0"} w-52 rounded-lg border border-border bg-surface-3 p-2 text-[11px] text-text leading-snug shadow-xl shadow-black/40 z-[70] pointer-events-none`}
        >
          {text}
        </span>
      )}
    </span>
  );
}
