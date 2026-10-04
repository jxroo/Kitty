"use client";

import React, { useCallback, useEffect, useState } from "react";
import type { Address } from "@solana/kit";
import { HelpCircle, Landmark } from "lucide-react";
import { ActivityFeed } from "@/components/ActivityFeed";
import { Header } from "@/components/Header";
import { HowItWorks } from "@/components/HowItWorks";
import { KasaProvider, useKasa } from "@/components/KasaProvider";
import { KasaView } from "@/components/KasaView";
import { KasyList } from "@/components/KasyList";
import { PROGRAM_ID } from "@/lib/kasa";

export default function Home() {
  return (
    <KasaProvider>
      <App />
    </KasaProvider>
  );
}

type Tab = "kasy" | "how";

function App() {
  const [tab, setTab] = useState<Tab>("kasy");
  const [kasa, setKasa] = useState<Address | null>(null);
  const { lastError } = useKasa();

  // A shared invite link is /?kasa=<address>.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get("kasa");
    if (fromUrl) setKasa(fromUrl as Address);
    if (params.get("tab") === "how") setTab("how");
  }, []);

  const open = useCallback((address: Address | null) => {
    setKasa(address);
    setTab("kasy");
    const url = address ? `/?kasa=${address}` : "/";
    window.history.replaceState(null, "", url);
  }, []);

  const tabs = [
    { id: "kasy" as const, label: "Funds", icon: Landmark },
    { id: "how" as const, label: "Where did the middleman go?", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen text-slate-700 flex flex-col">
      <Header onHome={() => open(null)} />
      <div className="border-b border-slate-200 bg-void/40">
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-2 py-2 overflow-x-auto" aria-label="Sections">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                tab === id
                  ? id === "how"
                    ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300 shadow-glow"
                    : "bg-slate-100 text-slate-900 ring-1 ring-slate-300"
                  : id === "how"
                    ? "text-emerald-700 hover:bg-emerald-50"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {lastError && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3" role="status">
            Devnet RPC problem: {lastError} The data will refresh automatically.
          </div>
        )}
        {tab === "kasy" && (kasa ? <KasaView kasa={kasa} onBack={() => open(null)} /> : <KasyList onOpen={open} />)}
        {tab === "how" && <HowItWorks />}
        {tab === "kasy" && <ActivityFeed />}
      </main>

      <footer className="border-t border-slate-200 bg-void/60 py-4 text-xs text-slate-500">
        <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>
            <strong className="text-slate-900">Kitty</strong> · a mutual savings and loan fund on Solana · HackYeah 2026 · Superteam Poland
          </span>
          <span className="font-mono text-[11px] tracking-[0.04em]"><span className="text-emerald-700">program</span> {PROGRAM_ID}</span>
        </div>
      </footer>
    </div>
  );
}
