"use client";

import { useState } from "react";

export type Density = "sparse" | "medium" | "dense";

interface ToolbarProps {
  density: Density;
  onDensityChange: (d: Density) => void;
  onRegenerate: () => void;
  onCopy: () => void;
  onDownload: () => void;
  loading: boolean;
}

const DENSITIES: { value: Density; label: string }[] = [
  { value: "sparse", label: "Sparse" },
  { value: "medium", label: "Medium" },
  { value: "dense", label: "Dense" },
];

export default function Toolbar({
  density,
  onDensityChange,
  onRegenerate,
  onCopy,
  onDownload,
  loading,
}: ToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="animate-slide-up flex items-center justify-center gap-3 flex-wrap px-4">
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
  );
}
