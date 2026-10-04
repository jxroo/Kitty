"use client";

// Rose-engine guilloche, ported from the promo film: the security engraving of banknotes,
// cut by the program instead of a lathe. The vault is a rosette with an open eye; each band
// is a family of closed curves whose phases are offset, weaving rope, lattice or petals.

import React, { useEffect, useRef } from "react";

type Pattern = "rope" | "lattice" | "petal" | "core";
type Band = { pattern: Pattern; r0: number; r1: number; curves: number; lobes: number; color: string; alpha: number };

const TAU = Math.PI * 2;
const LINE = "#34D399";
const CREAM = "#EFE6D2";

const radius = (b: Band, i: number, theta: number): number => {
  const mid = (b.r0 + b.r1) / 2;
  const half = (b.r1 - b.r0) / 2;
  const phase = (i / b.curves) * TAU;
  switch (b.pattern) {
    case "rope":
      return mid + half * 0.92 * Math.sin(b.lobes * theta + phase);
    case "lattice":
      return mid + half * 0.92 * Math.sin(b.lobes * theta + (i % 2 === 0 ? 1 : -1) * phase);
    case "petal":
      return b.r0 + (b.r1 - b.r0) * (0.08 + 0.84 * Math.abs(Math.sin((b.lobes * theta) / 2 + phase / 2)) * (0.85 + 0.15 * Math.cos(theta * 3 + phase)));
    case "core":
      return mid + half * (0.62 * Math.sin(b.lobes * theta + phase) + 0.3 * Math.sin(3 * b.lobes * theta - 2 * phase));
  }
};

const geometry = (b: Band, scale: number) => {
  const steps = Math.max(360, b.lobes * 18);
  const curves: Float32Array[] = [];
  for (let i = 0; i < b.curves; i++) {
    const pts = new Float32Array((steps + 1) * 2);
    for (let s = 0; s <= steps; s++) {
      const theta = (s / steps) * TAU;
      const r = radius(b, i, theta) * scale;
      pts[s * 2] = r * Math.cos(theta - Math.PI / 2);
      pts[s * 2 + 1] = r * Math.sin(theta - Math.PI / 2);
    }
    curves.push(pts);
  }
  return { curves, steps };
};

/** Stroke a band from 12 o'clock clockwise up to `sweep`, with the alpha swelling like a burin cut. */
const engrave = (ctx: CanvasRenderingContext2D, geo: ReturnType<typeof geometry>, b: Band, width: number, sweep: number) => {
  const { steps, curves } = geo;
  const end = Math.floor(steps * sweep);
  if (end <= 0) return;
  const per = Math.max(1, Math.ceil(steps / 96));
  ctx.strokeStyle = b.color;
  ctx.lineWidth = width;
  ctx.lineCap = "butt";
  ctx.lineJoin = "round";
  for (let c = 0; c < end; c += per) {
    const e = Math.min(end, c + per);
    const mid = (c + e) / 2 / steps;
    ctx.globalAlpha = b.alpha * (0.7 + 0.3 * (0.5 + 0.5 * Math.sin(mid * TAU * 3 + 0.7)));
    ctx.beginPath();
    for (const pts of curves) {
      ctx.moveTo(pts[c * 2], pts[c * 2 + 1]);
      for (let s = c + 1; s <= e; s++) ctx.lineTo(pts[s * 2], pts[s * 2 + 1]);
    }
    ctx.stroke();
  }
};

// Radii are fractions of the rosette's outer radius.
const PRESETS: Record<"vault" | "mark", Band[]> = {
  // The vault from the film: the program's core, three members' bands and the cream coverage ring.
  vault: [
    { pattern: "core", r0: 0.1, r1: 0.37, curves: 18, lobes: 9, color: LINE, alpha: 0.42 },
    { pattern: "lattice", r0: 0.416, r1: 0.56, curves: 12, lobes: 16, color: LINE, alpha: 0.55 },
    { pattern: "rope", r0: 0.59, r1: 0.7, curves: 12, lobes: 22, color: LINE, alpha: 0.55 },
    { pattern: "petal", r0: 0.728, r1: 0.832, curves: 10, lobes: 18, color: LINE, alpha: 0.55 },
    { pattern: "rope", r0: 0.92, r1: 1, curves: 8, lobes: 48, color: CREAM, alpha: 0.5 },
  ],
  // The outro lockup's core rosette, without its outer ring.
  mark: [{ pattern: "core", r0: 0.34, r1: 1, curves: 8, lobes: 7, color: LINE, alpha: 0.8 }],
};

export function Rosette({
  size,
  preset = "vault",
  microprint,
  engraveMs = 2400,
  className = "",
  style,
}: {
  size: number;
  preset?: keyof typeof PRESETS;
  /** Text engraved around the inside of the outer ring. */
  microprint?: string;
  engraveMs?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const R = size / 2 - 2;
    const bands = PRESETS[preset];
    const geos = bands.map((b) => geometry(b, R));
    const width = Math.max(0.6, Math.min(1.15, size / 600));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;

    const draw = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / engraveMs);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      ctx.translate(size / 2, size / 2);
      ctx.globalCompositeOperation = "lighter";
      bands.forEach((b, i) => {
        // bands are cut one after another, overlapping, from the core outwards
        const local = Math.max(0, Math.min(1, t * (1 + bands.length * 0.35) - i * 0.35));
        const eased = local < 0.5 ? 4 * local ** 3 : 1 - (-2 * local + 2) ** 3 / 2;
        engrave(ctx, geos[i], b, width, eased);
        if (eased > 0 && eased < 1) {
          // the bright engraving head
          const theta = eased * TAU - Math.PI / 2;
          const r = ((b.r0 + b.r1) / 2) * R;
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.fillStyle = "#D1FAE5";
          ctx.shadowColor = "#10B981";
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(r * Math.cos(theta), r * Math.sin(theta), Math.max(1.5, size / 260), 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      });
      if (microprint) {
        const mr = R * 0.875;
        ctx.save();
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 0.55 * Math.max(0, Math.min(1, (t - 0.7) / 0.3));
        ctx.font = `600 ${Math.max(6, size / 90)}px "JetBrains Mono", monospace`;
        ctx.fillStyle = CREAM;
        let angle = 0;
        const text = microprint.repeat(6);
        for (const ch of text) {
          const w = ctx.measureText(ch).width;
          if (angle > TAU - 0.02) break;
          ctx.save();
          ctx.rotate(angle + w / 2 / mr);
          ctx.fillText(ch, -w / 2, -mr);
          ctx.restore();
          angle += (w + 0.5) / mr;
        }
        ctx.restore();
      }
      if (t < 1) raf = requestAnimationFrame(draw);
    };
    // fonts must be in before the microprint is cut
    document.fonts?.ready.then(() => (raf = requestAnimationFrame(draw)));
    return () => cancelAnimationFrame(raf);
  }, [size, preset, microprint, engraveMs]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className={`pointer-events-none select-none ${className}`}
      style={{ width: size, height: size, filter: "drop-shadow(0 0 6px rgba(16,185,129,0.45))", ...style }}
    />
  );
}
