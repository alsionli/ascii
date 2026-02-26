"use client";

import { useState, useRef, useEffect } from "react";

interface InputBarProps {
  onSubmit: (prompt: string) => void;
  loading: boolean;
}

export default function InputBar({ onSubmit, loading }: InputBarProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || loading) return;
    onSubmit(trimmed);
  };

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
          className="w-full bg-white/[0.04] border border-white/[0.08] rounded-full px-5 py-3.5 pr-12 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-white/20 focus:bg-white/[0.06] transition-all disabled:opacity-50"
        />
        <button
          onClick={handleSubmit}
          disabled={loading || !value.trim()}
          className="absolute right-2 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 disabled:opacity-30 disabled:hover:bg-white/10 transition-all cursor-pointer"
        >
          {loading ? (
            <span className="block w-4 h-4 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-zinc-300"
            >
              <path
                d="M3 8h10M9 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
