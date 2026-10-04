"use client";

import React, { useState } from "react";
import { Coins, LogOut, RefreshCw, Wallet } from "lucide-react";
import { useConnect, useDisconnect, useWallets, WalletReadyGate } from "@solana/kit-plugin-wallet/react";
import { describeError, formatSol, formatZl, shortAddress } from "@/lib/kasa";
import { useKasa } from "./KasaProvider";
import { Rosette } from "./Rosette";
import { Button } from "./ui";

export function Header({ onHome }: { onHome: () => void }) {
  const { client, refresh } = useKasa();
  return (
    <header className="bg-void/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        <button onClick={onHome} className="flex items-center gap-3 text-left">
          <div className="w-10 h-10 shrink-0 flex items-center justify-center">
            <Rosette size={40} preset="mark" engraveMs={1600} className="turn-slow" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-white text-lg tracking-[-0.03em]">Boardless</span>
              <span className="text-[10px] font-mono font-semibold uppercase tracking-[0.12em] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                Solana devnet
              </span>
            </div>
            <p className="text-xs text-slate-500">A shared fund for your group: save together and lend to each other interest-free – no treasurer, no bank</p>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={() => refresh()}
            title="Refresh from the chain"
            aria-label="Refresh from the chain"
            className="p-2 text-slate-500 hover:text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 rounded-lg border border-slate-300 transition"
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
          </button>
          <WalletReadyGate client={client} fallback={<span className="text-xs text-slate-400">Looking for wallets…</span>}>
            <WalletButton />
          </WalletReadyGate>
        </div>
      </div>
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
        <Button variant="ghost" onClick={requestFaucet} disabled={!!busy} title="Test tPLN (and a little SOL for fees) from the devnet faucet">
          <Coins className="w-3.5 h-3.5" aria-hidden />
          Get test PLN
        </Button>
        <div className="text-right">
          <div className="font-mono text-xs font-semibold text-slate-900">{shortAddress(wallet)}</div>
          <div className="text-[11px] text-slate-500">
            {tokenBalance !== null ? formatZl(tokenBalance) : "0 PLN"} · {solBalance !== null ? `${formatSol(solBalance)} SOL` : "…"}
          </div>
        </div>
        <Button variant="ghost" onClick={() => disconnect.dispatch()} title="Disconnect wallet" aria-label="Disconnect wallet">
          <LogOut className="w-3.5 h-3.5" aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Button variant="secondary" onClick={() => setOpen((v) => !v)} disabled={connect.isRunning}>
        <Wallet className="w-3.5 h-3.5" aria-hidden />
        {connect.isRunning ? "Connecting…" : "Connect wallet"}
      </Button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-panel border border-slate-200 rounded-xl shadow-lg p-2 z-50">
          {wallets.length === 0 && (
            <p className="text-xs text-slate-600 p-2">
              No wallet detected. Install Phantom, Solflare or Backpack and switch it to devnet.
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
        <p className="absolute right-0 mt-1 text-[11px] text-rose-600 w-64 text-right">{describeError(connect.error)}</p>
      )}
    </div>
  );
}
