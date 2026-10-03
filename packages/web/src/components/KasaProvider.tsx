"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createClient, type Address } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { walletSigner } from "@solana/kit-plugin-wallet";
import { useConnectedWallet } from "@solana/kit-plugin-wallet/react";
import { ClientProvider } from "@solana/react";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import { kasaProgram } from "@/generated";
import { fetchChainState, fetchTokenBalance, type ChainState } from "@/lib/chain";
import { describeError, MINT, RPC_URL } from "@/lib/kasa";
import { sendWithFallback } from "@/lib/send";

function createAppClient() {
  return (
    createClient()
      // The connected browser wallet (Phantom, Solflare, Backpack… via Wallet Standard) signs everything.
      .use(walletSigner({ chain: "solana:devnet" }))
      // v0 transactions: ours are small, and v0 is what every wallet can sign today.
      .use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig: { version: 0 } }))
      .use(kasaProgram())
  );
}
export type AppClient = ReturnType<typeof createAppClient>;

export type Activity = {
  id: number;
  label: string;
  at: number;
  signature?: string;
  error?: string;
};

type Sent = { context: { signature: string } };

type KasaContextValue = {
  client: AppClient;
  wallet: Address | null;
  /** The connected wallet's tPLN token account (may not exist yet). */
  walletAta: Address | null;
  solBalance: bigint | null;
  tokenBalance: bigint | null;
  chain: ChainState;
  loading: boolean;
  lastError: string | null;
  refresh: () => Promise<void>;
  /** Sends a transaction, logs it in the activity feed and refreshes chain state. */
  run: (label: string, send: () => Promise<Sent>) => Promise<string | null>;
  busy: string | null;
  activity: Activity[];
  requestFaucet: () => Promise<void>;
};

const KasaContext = createContext<KasaContextValue | null>(null);

export function useKasa() {
  const ctx = useContext(KasaContext);
  if (!ctx) throw new Error("useKasa must be used inside <KasaProvider>");
  return ctx;
}

export function KasaProvider({ children }: { children: React.ReactNode }) {
  // Wallet discovery only exists in the browser, so the client is created after mount.
  const [client, setClient] = useState<AppClient | null>(null);
  useEffect(() => setClient(createAppClient()), []);
  if (!client) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-slate-500">Ładowanie…</div>;
  }
  return (
    <ClientProvider client={client}>
      <KasaState client={client}>{children}</KasaState>
    </ClientProvider>
  );
}

const EMPTY: ChainState = { kasas: [], members: [], loans: [] };

function KasaState({ client, children }: { client: AppClient; children: React.ReactNode }) {
  const connected = useConnectedWallet(client);
  const wallet = (connected?.account.address as Address | undefined) ?? null;
  const [walletAta, setWalletAta] = useState<Address | null>(null);
  const [solBalance, setSolBalance] = useState<bigint | null>(null);
  const [tokenBalance, setTokenBalance] = useState<bigint | null>(null);
  const [chain, setChain] = useState<ChainState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [activity, setActivity] = useState<Activity[]>([]);
  const activityId = useRef(0);

  useEffect(() => {
    if (!wallet) return setWalletAta(null);
    findAssociatedTokenPda({ owner: wallet, mint: MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS }).then(([ata]) =>
      setWalletAta(ata)
    );
  }, [wallet]);

  const refresh = useCallback(async () => {
    try {
      const [state, sol, tokens] = await Promise.all([
        fetchChainState(client.rpc),
        wallet ? client.rpc.getBalance(wallet, { commitment: "confirmed" }).send() : Promise.resolve(null),
        walletAta ? fetchTokenBalance(client.rpc, walletAta) : Promise.resolve(null),
      ]);
      setChain(state);
      setSolBalance(sol ? BigInt(sol.value) : null);
      setTokenBalance(tokens);
      setLastError(null);
    } catch (err) {
      setLastError(describeError(err));
    } finally {
      setLoading(false);
    }
  }, [client, wallet, walletAta]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 8_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const log = useCallback((entry: Omit<Activity, "id" | "at">) => {
    activityId.current += 1;
    const item = { ...entry, id: activityId.current, at: Date.now() };
    setActivity((prev) => [item, ...prev].slice(0, 30));
  }, []);

  const run = useCallback<KasaContextValue["run"]>(
    async (label, send) => {
      setBusy(label);
      try {
        const signature = await sendWithFallback(client.rpc, send);
        log({ label, signature });
        return signature;
      } catch (err) {
        log({ label, error: describeError(err) });
        console.error(err);
        return null;
      } finally {
        setBusy(null);
        await refresh();
        // RPC nodes can lag a moment behind the confirmed transaction; read once more shortly after.
        setTimeout(refresh, 2_500);
      }
    },
    [client, log, refresh]
  );

  const requestFaucet = useCallback(async () => {
    if (!wallet) return;
    const label = "Testowe złotówki z faucetu";
    setBusy(label);
    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: wallet }),
      });
      const body = (await res.json()) as { signature?: string; error?: string };
      if (!res.ok || !body.signature) throw new Error(body.error ?? `HTTP ${res.status}`);
      log({ label, signature: body.signature });
    } catch (err) {
      log({ label, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(null);
      await refresh();
    }
  }, [wallet, log, refresh]);

  const value = useMemo<KasaContextValue>(
    () => ({
      client,
      wallet,
      walletAta,
      solBalance,
      tokenBalance,
      chain,
      loading,
      lastError,
      refresh,
      run,
      busy,
      activity,
      requestFaucet,
    }),
    [client, wallet, walletAta, solBalance, tokenBalance, chain, loading, lastError, refresh, run, busy, activity, requestFaucet]
  );
  return <KasaContext.Provider value={value}>{children}</KasaContext.Provider>;
}
