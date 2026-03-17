"use client";

import { useState, useRef, useEffect } from "react";
import { imageToAscii } from "@/lib/imageToAscii";
import type { Density } from "./Toolbar";

interface InputBarProps {
  onSubmit: (prompt: string) => void;
  onStop: () => void;
  onImageConvert?: (ascii: string, file: File) => void;
  loading: boolean;
  density?: Density;
}

export default function InputBar({
  onSubmit,
  onStop,
  onImageConvert,
  loading,
  density = "medium",
}: InputBarProps) {
  const [value, setValue] = useState("");
  const [imageConverting, setImageConverting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onImageConvert || loading || imageConverting) return;
    if (!file.type.startsWith("image/")) return;

    setImageConverting(true);
    try {
      const ascii = await imageToAscii(file, { density });
      onImageConvert(ascii, file);
    } catch {
      // Silently ignore conversion errors for now
    } finally {
      setImageConverting(false);
      e.target.value = "";
    }
  };

  const hasUpload = !!onImageConvert;
  const inputPaddingLeft = hasUpload ? "pl-12" : "pl-5";
  const inputPaddingRight = "pr-12";

  return (
    <div className="w-full max-w-[620px] mx-auto px-4">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder="Describe anything… e.g. a cat, mountains, a spaceship"
          disabled={loading}
          className={`w-full bg-white/[0.04] border border-white/[0.08] rounded-full py-3.5 ${inputPaddingLeft} ${inputPaddingRight} text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all disabled:opacity-50`}
        />
        {hasUpload && (
          <>
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
              disabled={loading || imageConverting}
              title="Upload image to convert to ASCII"
              className="absolute left-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all disabled:opacity-50 cursor-pointer group"
              aria-label="Upload image to convert to ASCII"
            >
              <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 px-2 py-1 text-xs text-zinc-300 bg-zinc-800/95 border border-white/10 rounded opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-150 whitespace-nowrap">
                Upload image to ASCII
              </span>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-zinc-400"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="M21 15l-5-5L5 21" />
              </svg>
            </button>
          </>
        )}
        {loading ? (
          <button
            onClick={onStop}
            className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-all cursor-pointer"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-zinc-300">
              <rect x="2" y="2" width="10" height="10" rx="1.5" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!value.trim()}
            className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-all cursor-pointer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-zinc-300">
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
