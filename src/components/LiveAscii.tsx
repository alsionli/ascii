"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  videoFrameToAscii,
  type Density,
  type Charset,
  type Style,
} from "@/lib/imageToAscii";

interface LiveAsciiProps {
  onClose: () => void;
  onSnapshot: (ascii: string) => void;
  initialDensity?: Density;
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

const CHARSETS: { value: Charset; label: string }[] = [
  { value: "ascii", label: "ASCII" },
  { value: "blocks", label: "Blocks" },
  { value: "braille", label: "Braille" },
];

const TARGET_FPS = 18;

export default function LiveAscii({
  onClose,
  onSnapshot,
  initialDensity = "medium",
}: LiveAsciiProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameTsRef = useRef(0);
  const settingsRef = useRef({
    density: initialDensity,
    style: "hybrid" as Style,
    charset: "ascii" as Charset,
    mirror: true,
    invert: false,
  });

  const [density, setDensity] = useState<Density>(initialDensity);
  const [style, setStyle] = useState<Style>("hybrid");
  const [charset, setCharset] = useState<Charset>("ascii");
  const [mirror, setMirror] = useState(true);
  const [invert, setInvert] = useState(false);
  const [status, setStatus] = useState<"starting" | "running" | "error">(
    "starting"
  );
  const [errorMsg, setErrorMsg] = useState("");
  const [fontSize, setFontSize] = useState(10);
  const [cols, setCols] = useState(100);

  useEffect(() => {
    settingsRef.current = { density, style, charset, mirror, invert };
  }, [density, style, charset, mirror, invert]);

  const computeCols = useCallback(() => {
    if (!containerRef.current) return;
    const w = containerRef.current.clientWidth;
    const target = Math.round(w / 7);
    const clamped = Math.max(60, Math.min(180, target));
    setCols(clamped);
  }, []);

  const computeFontSize = useCallback(() => {
    if (!containerRef.current || !preRef.current) return;
    const container = containerRef.current;
    const text = preRef.current.textContent || "";
    if (!text) return;
    const lines = text.split("\n");
    const maxCols = Math.max(...lines.map((l) => l.length)) || 1;
    const numRows = lines.length || 1;
    const availW = container.clientWidth - 32;
    const availH = container.clientHeight - 160;
    const sizeByW = availW / (maxCols * 0.6);
    const sizeByH = availH / (numRows * 1.15);
    const computed = Math.min(sizeByW, sizeByH, 16);
    setFontSize(Math.max(computed, 4));
  }, []);

  useEffect(() => {
    computeCols();
    const onResize = () => {
      computeCols();
      computeFontSize();
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [computeCols, computeFontSize]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: 640, height: 480 },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        setStatus("running");

        const loop = (ts: number) => {
          rafRef.current = requestAnimationFrame(loop);
          const minDelta = 1000 / TARGET_FPS;
          if (ts - lastFrameTsRef.current < minDelta) return;
          lastFrameTsRef.current = ts;
          if (!videoRef.current || !preRef.current) return;
          const s = settingsRef.current;
          const ascii = videoFrameToAscii(videoRef.current, {
            width: cols,
            density: s.density,
            style: s.style,
            charset: s.charset,
            invert: s.invert,
          });
          preRef.current.textContent = ascii;
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        if (err instanceof Error) setErrorMsg(err.message);
        else setErrorMsg("Failed to access camera");
      }
    }

    init();

    return () => {
      cancelled = true;
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [cols]);

  useEffect(() => {
    if (status !== "running") return;
    const id = window.setInterval(computeFontSize, 600);
    return () => window.clearInterval(id);
  }, [status, computeFontSize]);

  const handleSnapshot = useCallback(() => {
    if (!videoRef.current) return;
    const s = settingsRef.current;
    const ascii = videoFrameToAscii(videoRef.current, {
      width: cols,
      density: s.density,
      style: s.style,
      charset: s.charset,
      invert: s.invert,
    });
    if (ascii) onSnapshot(ascii);
  }, [cols, onSnapshot]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        handleSnapshot();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, handleSnapshot]);

  return (
    <div className="fixed inset-0 z-50 bg-[#09090b]/98 backdrop-blur-sm flex flex-col animate-fade-in">
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <span
            className="w-2 h-2 rounded-full bg-red-500 animate-pulse"
            aria-hidden
          />
          <span
            className="text-zinc-400 tracking-[0.25em] text-xs select-none"
            style={{ fontFamily: "var(--font-geist-pixel-square)" }}
          >
            LIVE ASCII
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-zinc-400 hover:text-zinc-200 transition-all cursor-pointer"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 3l8 8M11 3l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div
        ref={containerRef}
        className="flex-1 relative flex items-center justify-center overflow-hidden px-4"
      >
        <video
          ref={videoRef}
          className="sr-only"
          playsInline
          muted
          style={mirror ? { transform: "scaleX(-1)" } : undefined}
        />
        <pre
          ref={preRef}
          className="font-mono whitespace-pre leading-[1.15] text-zinc-200 select-all"
          style={{
            fontSize: `${fontSize}px`,
            transform: mirror ? "scaleX(-1)" : undefined,
          }}
        />

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-zinc-500 tracking-[0.25em] text-xs animate-pulse">
              REQUESTING CAMERA…
            </span>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
            <span className="text-red-400/80 text-sm">
              Camera unavailable
            </span>
            <span className="text-zinc-500 text-xs max-w-xs">{errorMsg}</span>
          </div>
        )}
      </div>

      <div className="shrink-0 px-4 pt-3 pb-6 flex flex-col items-center gap-3">
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <Segmented
            options={STYLES}
            value={style}
            onChange={setStyle}
            disabled={status !== "running"}
          />
          <Segmented
            options={CHARSETS}
            value={charset}
            onChange={setCharset}
            disabled={status !== "running"}
          />
          <Segmented
            options={DENSITIES}
            value={density}
            onChange={setDensity}
            disabled={status !== "running" || charset === "braille"}
          />
        </div>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          <ToggleChip
            label="Mirror"
            active={mirror}
            onToggle={() => setMirror((v) => !v)}
          />
          <ToggleChip
            label="Invert"
            active={invert}
            onToggle={() => setInvert((v) => !v)}
          />
          <button
            onClick={handleSnapshot}
            disabled={status !== "running"}
            className="px-3 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 bg-white/[0.04] border border-white/[0.08] rounded-full transition-all disabled:opacity-40 cursor-pointer"
          >
            Snapshot
          </button>
        </div>
      </div>
    </div>
  );
}

interface SegmentedProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  disabled?: boolean;
}

function Segmented<T extends string>({
  options,
  value,
  onChange,
  disabled,
}: SegmentedProps<T>) {
  return (
    <div className="flex items-center bg-white/[0.04] border border-white/[0.08] rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          disabled={disabled}
          className={`px-3 py-1.5 text-xs rounded-full transition-all cursor-pointer ${
            value === o.value
              ? "bg-white/10 text-zinc-100"
              : "text-zinc-500 hover:text-zinc-300"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ToggleChip({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className={`px-3 py-1.5 text-xs rounded-full border transition-all cursor-pointer ${
        active
          ? "bg-white/10 border-white/[0.14] text-zinc-100"
          : "bg-white/[0.04] border-white/[0.08] text-zinc-500 hover:text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}
