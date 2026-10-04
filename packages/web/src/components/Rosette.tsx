"use client";

import React, { useMemo } from "react";
import { bandPath, type Band } from "@/lib/guilloche";

// The brand mark from the trailer's outro (packages/promo/src/acts/Act3Outro.tsx): the
// program's flower and the rope ring around it.
const MARK: Band = { pattern: "core", r0: 120, r1: 330, curves: 8, lobes: 7 };
const MARK_RING: Band = { pattern: "rope", r0: 360, r1: 384, curves: 4, lobes: 40 };

export function Rosette({ className = "" }: { className?: string }) {
  const [mark, ring] = useMemo(() => [bandPath(MARK), bandPath(MARK_RING)], []);
  return (
    <svg viewBox="-392 -392 784 784" className={className} aria-hidden fill="none">
      <path d={mark} stroke="#34d399" strokeOpacity={0.55} strokeWidth={1.1} vectorEffect="non-scaling-stroke" />
      <path d={ring} stroke="#efe6d2" strokeOpacity={0.4} strokeWidth={0.9} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
