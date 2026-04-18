"use client";

import { useRef, useState } from "react";
import { imageToAscii } from "@/lib/imageToAscii";
import type { Density, Style } from "./Toolbar";

interface SourceActionsProps {
  onImageConvert: (ascii: string, file: File) => void;
  onOpenLive: () => void;
  loading: boolean;
  density: Density;
  style: Style;
}

export default function SourceActions({
  onImageConvert,
  onOpenLive,
  loading,
  density,
  style,
}: SourceActionsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [converting, setConverting] = useState(false);
  const disabled = loading || converting;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || disabled) return;
    if (!file.type.startsWith("image/")) return;
    setConverting(true);
    try {
      const ascii = await imageToAscii(file, { density, style });
      onImageConvert(ascii, file);
    } catch {
    } finally {
      setConverting(false);
      e.target.value = "";
    }
  };

  return (
    <div className="flex items-center justify-center gap-2">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload image"
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="M21 15l-5-5L5 21" />
        </svg>
        {converting ? "Converting…" : "Upload image"}
      </button>

      <button
        type="button"
        onClick={onOpenLive}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
      >
        <svg
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M23 7l-7 5 7 5V7z" />
          <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
        </svg>
        Live camera
      </button>
    </div>
  );
}
