"use client";

import { useState, useCallback, useRef } from "react";
import InputBar from "@/components/InputBar";
import AsciiCanvas from "@/components/AsciiCanvas";
import Toolbar, {
  type BackgroundMode,
  type Density,
  type Style,
} from "@/components/Toolbar";
import LiveAscii from "@/components/LiveAscii";
import SourceActions from "@/components/SourceActions";

type ResultSource = "prompt" | "image" | "snapshot";

export default function Home() {
  const [ascii, setAscii] = useState("");
  const [loading, setLoading] = useState(false);
  const [density, setDensity] = useState<Density>("medium");
  const [style, setStyle] = useState<Style>("hybrid");
  const [background, setBackground] = useState<BackgroundMode>("clean");
  const [source, setSource] = useState<ResultSource | null>(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [error, setError] = useState("");
  const [liveOpen, setLiveOpen] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const uploadedImageRef = useRef<File | null>(null);

  const inputVisible = source === null || source === "prompt";

  const generate = useCallback(
    async (
      prompt: string,
      d: Density,
      s: Style,
      b: BackgroundMode
    ) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const data = await res.json();
          setError(
            data.error || "Failed to generate an image. Please try again."
          );
        } else {
          const blob = await res.blob();
          const imageType = blob.type.startsWith("image/")
            ? blob.type
            : "image/jpeg";
          const file = new File([blob], "generated-source-image", {
            type: imageType,
          });
          const { imageToAscii } = await import("@/lib/imageToAscii");
          const result = await imageToAscii(file, {
            density: d,
            style: s,
            background: b,
          });

          setAscii(result);
          setLastPrompt(prompt);
          setSource("prompt");
          uploadedImageRef.current = file;
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        console.error("Generated image processing failed:", err);
        setError("Could not process the generated image. Please try again.");
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
    generate(prompt, density, style, background);
  };

  const regenFromImage = useCallback(
    async (d: Density, s: Style, b: BackgroundMode) => {
      if (!uploadedImageRef.current) return;
      const { imageToAscii } = await import("@/lib/imageToAscii");
      const result = await imageToAscii(uploadedImageRef.current, {
        density: d,
        style: s,
        background: b,
      });
      setAscii(result);
    },
    []
  );

  const handleDensityChange = useCallback(
    async (d: Density) => {
      setDensity(d);
      if (source === "prompt" || source === "image") {
        regenFromImage(d, style, background);
      }
    },
    [source, regenFromImage, style, background]
  );

  const handleStyleChange = useCallback(
    (s: Style) => {
      setStyle(s);
      if (source === "prompt" || source === "image") {
        regenFromImage(density, s, background);
      }
    },
    [source, density, regenFromImage, background]
  );

  const handleBackgroundChange = useCallback(
    (b: BackgroundMode) => {
      setBackground(b);
      if (source === "prompt" || source === "image") {
        regenFromImage(density, style, b);
      }
    },
    [source, density, style, regenFromImage]
  );

  const handleRegenerate = () => {
    if (source === "prompt" && lastPrompt) {
      generate(lastPrompt, density, style, background);
    } else if (source === "image") {
      regenFromImage(density, style, background);
    }
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

  const handleImageConvert = useCallback((result: string, file: File) => {
    setAscii(result);
    setSource("image");
    setLastPrompt("");
    uploadedImageRef.current = file;
    setError("");
  }, []);

  const handleEnhance = useCallback(async () => {
    const file = uploadedImageRef.current;
    if (!file || loading) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("image", file);
      formData.append("density", density);

      const res = await fetch("/api/generate-from-image", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setAscii(data.ascii);
        setSource("snapshot");
        setLastPrompt("");
        uploadedImageRef.current = null;
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
  }, [density, loading]);

  const handleLiveSnapshot = useCallback((snapshot: string) => {
    setAscii(snapshot);
    setSource("snapshot");
    setLastPrompt("");
    uploadedImageRef.current = null;
    setError("");
    setLiveOpen(false);
  }, []);

  const handleNew = useCallback(() => {
    setAscii("");
    setSource(null);
    setLastPrompt("");
    uploadedImageRef.current = null;
    setError("");
  }, []);

  const toolbarProps =
    source === "image"
      ? {
          density,
          onDensityChange: handleDensityChange,
          style,
          onStyleChange: handleStyleChange,
          background,
          onBackgroundChange: handleBackgroundChange,
          onEnhance: handleEnhance,
          onNew: handleNew,
        }
      : source === "prompt"
      ? {
          density,
          onDensityChange: handleDensityChange,
          style,
          onStyleChange: handleStyleChange,
          background,
          onBackgroundChange: handleBackgroundChange,
          onRegenerate: handleRegenerate,
          onNew: handleNew,
        }
      : source === "snapshot"
      ? { onNew: handleNew }
      : null;

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-[#09090b]">
      <AsciiCanvas ascii={ascii} loading={loading} />

      {error && (
        <div className="text-center px-4 pb-2">
          <p className="text-red-400/80 text-xs">{error}</p>
        </div>
      )}

      <div className="shrink-0 pb-16 pt-3 flex flex-col gap-3">
        {inputVisible && (
          <InputBar
            onSubmit={handleSubmit}
            onStop={handleStop}
            loading={loading}
          />
        )}

        {source === null && (
          <SourceActions
            onImageConvert={handleImageConvert}
            onOpenLive={() => setLiveOpen(true)}
            loading={loading}
            density={density}
            style={style}
            background={background}
          />
        )}

        {toolbarProps && (
          <Toolbar
            {...toolbarProps}
            onCopy={handleCopy}
            onDownload={handleDownload}
            loading={loading}
          />
        )}
      </div>

      {liveOpen && (
        <LiveAscii
          onClose={() => setLiveOpen(false)}
          onSnapshot={handleLiveSnapshot}
          initialDensity={density}
        />
      )}
    </div>
  );
}
