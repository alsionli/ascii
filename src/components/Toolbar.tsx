"use client";

import { useState } from "react";

export type Density = "sparse" | "medium" | "dense";
export type Style = "luminance" | "edge" | "hybrid";

interface ToolbarProps {
  density?: Density;
  onDensityChange?: (d: Density) => void;
  style?: Style;
  onStyleChange?: (s: Style) => void;
  onRegenerate?: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onEnhance?: () => void;
  onNew?: () => void;
  loading: boolean;
}

const DENSITIES: { value: Density; label: string }[] = [
  { value: "sparse", label: "Sparse" },
  { value: "medium", label: "Medium" },
  { value: "dense", label: "Dense" },
];

const STYLES: { value: Style; label: string }[] = [
  { value: "luminance", label: "Fill" },
  { value: "edge", label: "Edge" },
  { value: "hybrid", label: "Hybrid" },
];

export default function Toolbar({
  density,
  onDensityChange,
  style,
  onStyleChange,
  onRegenerate,
  onCopy,
  onDownload,
  onEnhance,
  onNew,
  loading,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasSettingsRow =
    (onDensityChange && density) || (onStyleChange && style);

  return (
    <div className="animate-slide-up flex flex-col items-center gap-2 px-4">
      {hasSettingsRow && (
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {onDensityChange && density && (
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5">
              {DENSITIES.map((d) => (
                <button
                  key={d.value}
                  onClick={() => onDensityChange(d.value)}
                  disabled={loading}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
                    density === d.value
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  } disabled:opacity-50`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {onStyleChange && style && (
            <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5">
              {STYLES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => onStyleChange(s.value)}
                  disabled={loading}
                  className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
                    style === s.value
                      ? "bg-white/10 text-zinc-100"
                      : "text-zinc-500 hover:text-zinc-300"
                  } disabled:opacity-50`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-center gap-2 flex-wrap">
        {onNew && (
          <button
            onClick={onNew}
            disabled={loading}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] transition-all disabled:opacity-50 cursor-pointer"
            aria-label="Back to home"
            title="Back to home"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
              <path
                d="M6 3L3 8l3 5M3 8h10"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {onEnhance && (
          <button
            onClick={onEnhance}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-full transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2l2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2z" />
            </svg>
            Enhance with AI
          </button>
        )}

        {onRegenerate && (
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-full transition-all disabled:opacity-50 cursor-pointer"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 8a6 6 0 0 1 10.3-4.2M14 8a6 6 0 0 1-10.3 4.2"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M12.5 1v3h-3M3.5 15v-3h3"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Regenerate
          </button>
        )}

        <button
          onClick={handleCopy}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-full transition-all cursor-pointer"
        >
          {copied ? "Copied!" : "Copy"}
        </button>

        <button
          onClick={onDownload}
          className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-full transition-all cursor-pointer"
        >
          Download
        </button>
      </div>
    </div>
  );
}
