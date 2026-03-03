"use client";

import { useState, useCallback, useRef } from "react";
import InputBar from "@/components/InputBar";
import AsciiCanvas from "@/components/AsciiCanvas";
import Toolbar, { type Density } from "@/components/Toolbar";

export default function Home() {
  const [ascii, setAscii] = useState("");
  const [loading, setLoading] = useState(false);
  const [density, setDensity] = useState<Density>("medium");
  const [lastPrompt, setLastPrompt] = useState("");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const generate = useCallback(
    async (prompt: string, d: Density) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, density: d }),
          signal: controller.signal,
        });
        const data = await res.json();
        if (data.error) {
          setError(data.error);
        } else {
          setAscii(data.ascii);
          setLastPrompt(prompt);
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Network error. Please try again.");
      } finally {
        if (abortRef.current === controller) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    []
  );

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setLoading(false);
  };

  const handleSubmit = (prompt: string) => {
    generate(prompt, density);
  };

  const handleDensityChange = (d: Density) => {
    setDensity(d);
    if (lastPrompt) generate(lastPrompt, d);
  };

  const handleRegenerate = () => {
    if (lastPrompt) generate(lastPrompt, density);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(ascii);
  };

  const handleDownload = () => {
    const blob = new Blob([ascii], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ascii-art.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#09090b]">
      <AsciiCanvas ascii={ascii} loading={loading} />

      {error && (
        <div className="text-center px-4 pb-2">
          <p className="text-red-400/80 text-xs">{error}</p>
        </div>
      )}

      <div className="shrink-0 pb-16 pt-3 flex flex-col gap-3">
        <InputBar onSubmit={handleSubmit} loading={loading} onStop={handleStop} />

        {ascii && (
          <Toolbar
            density={density}
            onDensityChange={handleDensityChange}
            onRegenerate={handleRegenerate}
            onCopy={handleCopy}
            onDownload={handleDownload}
            loading={loading}
          />
        )}
      </div>
    </div>
  );
}
