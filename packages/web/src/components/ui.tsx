"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import { explorerAddress, explorerTx, shortAddress } from "@/lib/kasa";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  // Tailwind resolves conflicting utilities by stylesheet order, not class order, so the
  // defaults are only applied when the caller does not set its own background/border colour.
  const bg = /\bbg-/.test(className) ? "" : "bg-white";
  const border = /\bborder-(?!\d)/.test(className) ? "" : "border-slate-200";
  return <div className={`border rounded-2xl p-5 shadow-sm ${bg} ${border} ${className}`}>{children}</div>;
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost" | "warning";
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const styles = {
    primary: "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
    secondary: "bg-slate-900 hover:bg-slate-800 text-white shadow-sm",
    danger: "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200",
    ghost: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-200",
    warning: "bg-amber-500 hover:bg-amber-600 text-white shadow-sm",
  }[variant];
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${props.className ?? ""}`}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={`w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-semibold text-slate-700 mb-1">
      {children}
    </label>
  );
}

export function AddressLink({ address, label }: { address: string; label?: string }) {
  return (
    <a
      href={explorerAddress(address)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11px] text-sky-700 hover:underline inline-flex items-center gap-0.5"
      title={address}
    >
      {label ?? shortAddress(address)}
      <ExternalLink className="w-2.5 h-2.5" aria-hidden />
    </a>
  );
}

export function TxLink({ signature }: { signature: string }) {
  return (
    <a
      href={explorerTx(signature)}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[11px] text-sky-700 hover:underline inline-flex items-center gap-0.5"
    >
      {signature.slice(0, 10)}…
      <ExternalLink className="w-2.5 h-2.5" aria-hidden />
    </a>
  );
}

export function useNow(intervalMs = 1_000) {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatDuration(secs: number) {
  if (secs <= 0) return "0 s";
  const d = Math.floor(secs / 86_400);
  const h = Math.floor((secs % 86_400) / 3_600);
  const m = Math.floor((secs % 3_600) / 60);
  const s = secs % 60;
  if (d) return h ? `${d} d ${h} h` : `${d} d`;
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  if (m) return s ? `${m} min ${s} s` : `${m} min`;
  return `${s} s`;
}

export function Stat({ label, value, hint, tone = "slate" }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "rose" }) {
  const color = { slate: "text-slate-900", emerald: "text-emerald-700", amber: "text-amber-700", rose: "text-rose-700" }[tone];
  return (
    <div>
      <div className="text-[11px] text-slate-500">{label}</div>
      <div className={`text-base font-bold ${color}`}>{value}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "emerald" | "amber" | "rose" | "sky" }) {
  const styles = {
    slate: "bg-slate-50 text-slate-700 border-slate-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    amber: "bg-amber-50 text-amber-800 border-amber-200",
    rose: "bg-rose-50 text-rose-700 border-rose-200",
    sky: "bg-sky-50 text-sky-700 border-sky-200",
  }[tone];
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${styles}`}>{children}</span>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="text-center text-xs text-slate-500 py-10 border border-dashed border-slate-300 rounded-2xl">{children}</div>;
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-[11px] text-rose-600 mt-1">
      {children}
    </p>
  );
}
