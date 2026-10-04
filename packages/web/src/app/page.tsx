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
import { PROGRAM_ID, REPO_URL } from "@/lib/kasa";

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
    { id: "kasy" as const, label: "Kasy", icon: Landmark },
    { id: "how" as const, label: "Gdzie znika pośrednik?", icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      <Header onHome={() => open(null)}>
        <nav className="max-w-6xl mx-auto px-4 sm:px-6 flex gap-5 overflow-x-auto" aria-label="Sekcje">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`flex items-center gap-1.5 pt-1 pb-2.5 border-b-2 text-xs font-semibold whitespace-nowrap transition-colors ${
                tab === id ? "text-cream border-line" : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden />
              {label}
            </button>
          ))}
        </nav>
      </Header>

      <main className="flex-1 max-w-6xl mx-auto px-4 sm:px-6 py-6 w-full space-y-6">
        {lastError && (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl p-3" role="status">
            Problem z RPC devnetu: {lastError} Dane odświeżą się automatycznie.
          </div>
        )}
        {tab === "kasy" && (kasa ? <KasaView kasa={kasa} onBack={() => open(null)} /> : <KasyList onOpen={open} />)}
        {tab === "how" && <HowItWorks />}
        <ActivityFeed />
      </main>

      <footer className="bg-void py-6 text-xs text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div className="space-y-1.5">
            <div>
              <strong className="font-extrabold text-cream tracking-[-0.03em]">Kasa bez zarządu</strong> · kasa zapomogowo-pożyczkowa na
              Solanie · HackYeah 2026 · Superteam Poland
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[0.18em]">
              <span className="text-mint">Solana devnet · otwarty kod</span>{" "}
              <a href={REPO_URL} target="_blank" rel="noreferrer" className="normal-case tracking-normal text-slate-500 hover:text-slate-300">
                {REPO_URL.replace(/^https?:\/\//, "")}
              </a>
            </div>
          </div>
          <span className="font-mono text-[11px] text-slate-500 break-all">program {PROGRAM_ID}</span>
        </div>
      </footer>
    </div>
  );
}
