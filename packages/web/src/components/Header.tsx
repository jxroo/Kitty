"use client";

import React, { useState } from "react";
import { Coins, LogOut, RefreshCw, Wallet } from "lucide-react";
import { useConnect, useDisconnect, useWallets, WalletReadyGate } from "@solana/kit-plugin-wallet/react";
import { describeError, formatSol, formatZl, shortAddress } from "@/lib/kasa";
import { useKasa } from "./KasaProvider";
import { Button } from "./ui";

export function Header({ onHome, children }: { onHome: () => void; children?: React.ReactNode }) {
  const { client, refresh } = useKasa();
  return (
    <header className="bg-navy sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button onClick={onHome} className="flex items-center gap-3 text-left">
          <img src="/logo.png" alt="" width={36} height={36} className="w-9 h-9 rounded-full" />
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-cream text-lg tracking-[-0.03em]">Kasa bez zarządu</span>
              <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-mint px-1.5 py-0.5 rounded border border-mint/30">
                Solana devnet
              </span>
            </div>
            <p className="text-xs text-slate-400">Wspólna kasa dla grupy: odkładacie i pożyczacie sobie bez odsetek – bez skarbnika i bez banku</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            title="Odśwież stan z łańcucha"
            aria-label="Odśwież stan z łańcucha"
            className="p-2 text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg border border-white/15"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
          </button>
          <WalletReadyGate client={client} fallback={<span className="text-xs text-slate-400">Szukam portfeli…</span>}>
            <WalletButton />
          </WalletReadyGate>
        </div>
      </div>
      {children}
      <div className="kasa-line" aria-hidden />
    </header>
  );
}

function WalletButton() {
  const { client, wallet, solBalance, tokenBalance, requestFaucet, busy } = useKasa();
  const wallets = useWallets(client);
  const connect = useConnect(client);
  const disconnect = useDisconnect(client);
  const [open, setOpen] = useState(false);

  if (wallet) {
    return (
      <div className="flex items-center gap-2">
        <Button variant="ghostDark" className="whitespace-nowrap" onClick={requestFaucet} disabled={!!busy} title="Testowe tPLN (i trochę SOL na opłaty) z faucetu devnet">
          <Coins className="w-3.5 h-3.5" aria-hidden />
          Dobierz testowe zł
        </Button>
        <div className="text-right">
          <div className="font-mono text-xs font-semibold text-cream">{shortAddress(wallet)}</div>
          <div className="text-[11px] text-slate-400 tabular-nums">
            {tokenBalance !== null ? formatZl(tokenBalance) : "0 zł"} · {solBalance !== null ? `${formatSol(solBalance)} SOL` : "…"}
          </div>
        </div>
        <Button variant="ghostDark" onClick={() => disconnect.dispatch()} title="Rozłącz portfel" aria-label="Rozłącz portfel">
          <LogOut className="w-3.5 h-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button className="whitespace-nowrap" onClick={() => setOpen((v) => !v)} disabled={connect.isRunning}>
        <Wallet className="w-3.5 h-3.5" aria-hidden />
        {connect.isRunning ? "Łączenie…" : "Połącz portfel"}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-xl shadow-lg p-2 z-50">
          {wallets.length === 0 && (
            <p className="text-xs text-slate-600 p-2">
              Nie wykryto portfela. Zainstaluj Phantom, Solflare lub Backpack i przełącz go na devnet.
            </p>
          )}
          {wallets.map((w) => (
            <button
              key={w.name}
              onClick={() => {
                setOpen(false);
                connect.dispatch(w);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-50 text-xs font-medium text-slate-800"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {w.icon && <img src={w.icon} alt="" className="w-5 h-5" />}
              {w.name}
            </button>
          ))}
        </div>
      )}
      {connect.error != null && (
        <p className="absolute right-0 mt-1 text-[11px] text-rose-300 w-64 text-right">{describeError(connect.error)}</p>
      )}
    </div>
  );
}
