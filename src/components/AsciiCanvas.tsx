"use client";

import { useRef, useEffect, useState, useCallback } from "react";

const GLYPHS = "░▒▓█#@%&*+=-:.·";
const GRID_ROWS = 12;
const GRID_COLS = 36;

function LoadingAnimation() {
  const [grid, setGrid] = useState("");
  const [dots, setDots] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      let result = "";
      for (let r = 0; r < GRID_ROWS; r++) {
        for (let c = 0; c < GRID_COLS; c++) {
          if (Math.random() < 0.35) {
            result += GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          } else {
            result += " ";
          }
        }
        if (r < GRID_ROWS - 1) result += "\n";
      }
      setGrid(result);
    }, 100);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d + 1) % 4);
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const label = "GENERATING" + ".".repeat(dots);

  return (
    <div className="flex flex-col items-center gap-4">
      <pre className="font-mono text-[10px] leading-[1.15] text-zinc-700 select-none animate-pulse" style={{ letterSpacing: "0.1em" }}>
        {grid}
      </pre>
      <span
        className="text-zinc-500 tracking-[0.25em] text-xs select-none w-[140px] text-center"
        style={{ fontFamily: "var(--font-geist-pixel-square)" }}
      >
        {label}
      </span>
    </div>
  );
}

const IDLE_ART = [
"                                                 #    #",
"                                            %%% ##   ##",
"                                         %%%%% ###%%###",
"                                        %%%%% ### %%% #",
"                                      %%%%%% ### %%% ###",
"                                       %%%% ## %% #######",
"                                      %%%%% # %% #O#####",
"                                    %%%%%% # % #########",
"                                   %%%%% ##### #########",
"                         ###        %% ####### #########",
"                %%% ############    ########### ########",
"             %%%% ############################### #######",
"           %%%%% ################################## ######",
"         %%%%%% #################################### #C###",
"        %%%%%% #####################################  ###",
"        %%%%% #######################################",
"       %%%%%% ########################################",
"    % %%%%%%% ########################################",
"     %%%%%%%%% #######################################",
"    %%%%%%%%%% ########################################",
" %%% %%%%%%%%   ###### ################################",
"   %%%%%%%%      ###### #################### ##########",
"% %%%%%%%%        ####### ########### ###### ##########",
" %%%%%%%%%         #######  ########### ###### ########",
"%%%%%%%%%%          ##### ###  ######### ####### ######",
" %%%%%%%%%%          #### ##               ####### ####",
" %%%%%%%%%%%           ## #                  ##### ###",
"  %%  %% % %%         # ##                      ## ###",
"    %   %    %        # ###                      # ###",
"                       # ###                     ## ###",
"                       # ###                     ## ###",
"                       # ####                   #### ##",
"                      ### ###                  ##### ###",
"                     ####  ###                 ####   ##",
"                    #####   ###                 ##    ##",
"                   #####    ####                      ###",
"                    ##        ###                     ###",
"                               ####                     ##",
"                                ####                    ###",
"                                                        ####",
].join("\n");

interface AsciiCanvasProps {
  ascii: string;
  loading?: boolean;
}

export default function AsciiCanvas({ ascii, loading }: AsciiCanvasProps) {
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fontSize, setFontSize] = useState(11);
  const [visible, setVisible] = useState(false);

  const displayArt = ascii || IDLE_ART;
  const isIdle = !ascii;

  const computeFontSize = useCallback(() => {
    if (!containerRef.current) return;
    const lines = displayArt.split("\n");
    const maxCols = Math.max(...lines.map((l) => l.length));
    const numRows = lines.length;
    if (maxCols === 0 || numRows === 0) return;

    const container = containerRef.current;
    const reservedH = isIdle ? 80 : 0;
    const availW = container.clientWidth - 32;
    const availH = container.clientHeight - 32 - reservedH;

    const charAspect = 0.6;
    const sizeByW = availW / (maxCols * charAspect);
    const sizeByH = availH / (numRows * 1.2);
    const maxFont = isIdle ? 7 : 14;
    const computed = Math.min(sizeByW, sizeByH, maxFont);
    setFontSize(Math.max(computed, 3));
  }, [displayArt, isIdle]);

  useEffect(() => {
    setVisible(false);
    computeFontSize();
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, [displayArt, computeFontSize]);

  useEffect(() => {
    window.addEventListener("resize", computeFontSize);
    return () => window.removeEventListener("resize", computeFontSize);
  }, [computeFontSize]);

  return (
    <div ref={containerRef} className="flex-1 flex flex-col items-center justify-center overflow-auto px-4">
      {isIdle && (
        <h1 className="text-zinc-600 tracking-[0.3em] text-lg mb-12 select-none" style={{ fontFamily: "var(--font-geist-pixel-square)" }}>
          ASCII GENERATOR
        </h1>
      )}
      <pre
        ref={preRef}
        className={`font-mono whitespace-pre leading-[1.2] transition-opacity duration-500 ${
          isIdle ? "text-zinc-800 select-none -translate-x-6" : "text-zinc-300 select-all"
        } ${visible && !loading ? "opacity-100" : "opacity-0"}`}
        style={{ fontSize: `${fontSize}px` }}
      >
        {displayArt}
      </pre>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <LoadingAnimation />
        </div>
      )}
    </div>
  );
}
