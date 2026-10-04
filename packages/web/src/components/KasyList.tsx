"use client";

import React, { useState } from "react";
import type { Address } from "@solana/kit";
import { ArrowRight, Landmark, Plus, Users } from "lucide-react";
import { LoanStatus } from "@/generated";
import { createKasaIxs } from "@/lib/instructions";
import { describeError, formatZl, MINT, plural, PROGRAM_ID, randomId, utf8Length } from "@/lib/kasa";
import { NetworkCard } from "./History";
import { useKasa } from "./KasaProvider";
import { Rosette } from "./Rosette";
import { Badge, Button, Card, EmptyState, ErrorText, formatDuration, Input, Label, Select } from "./ui";

const PRESETS = {
  demo: { label: "Live demo: an installment every minute, 15 s grace period", period: 60, grace: 15, installments: 6 },
  real: { label: "Everyday use: an installment every month, 7 days grace period", period: 30 * 86_400, grace: 7 * 86_400, installments: 24 },
} as const;

export function KasyList({ onOpen }: { onOpen: (kasa: Address) => void }) {
  const { chain, loading, wallet } = useKasa();
  const myKasas = new Set(chain.members.filter((m) => m.data.wallet === wallet).map((m) => m.data.kasa));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 space-y-3" aria-labelledby="kasy-heading">
        <Intro />
        <NetworkCard />
        <h2 id="kasy-heading" className="kicker font-semibold text-xs pt-2">
          All funds
        </h2>
        {loading && <EmptyState>Reading funds from the chain…</EmptyState>}
        {!loading && chain.kasas.length === 0 && <EmptyState>There are no funds yet. Create the first one on the right.</EmptyState>}
        {chain.kasas.map(({ address, data }) => {
          const active = chain.loans.filter((l) => l.data.kasa === address && l.data.status === LoanStatus.Active).length;
          return (
            <button
              key={address}
              onClick={() => onOpen(address)}
              className="w-full text-left bg-panel/80 border border-slate-200 hover:border-emerald-300 hover:shadow-glow rounded-2xl p-4 shadow-sm transition"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-600" aria-hidden />
                    {data.name}
                    {myKasas.has(address) && <Badge tone="emerald">you're a member</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Loans up to {data.loanMultiplierBps / 10_000}× your savings · up to {data.maxInstallments} installments, every{" "}
                    {formatDuration(data.periodSecs)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-700">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" aria-hidden /> {data.memberCount} {plural(data.memberCount, "member", "members")}
                </span>
                <span>Saved: <strong>{formatZl(data.totalSavings)}</strong></span>
                <span>Lent: <strong>{formatZl(data.totalOutstanding)}</strong></span>
                <span>Active loans: <strong>{active}</strong></span>
              </div>
            </button>
          );
        })}
      </section>
      <div className="lg:col-span-5 space-y-4">
        <CreateKasaForm onCreated={onOpen} />
        {!wallet && (
          <p className="text-[11px] text-slate-500">
            You can look around without a wallet. To create or join a fund, connect a Solana wallet (Phantom, Solflare or Backpack)
            on the devnet test network.
          </p>
        )}
      </div>
    </div>
  );
}

function Intro() {
  const steps = [
    { title: "Save together", text: "Everyone pays into a shared fund. You take out your free money whenever you want." },
    { title: "Borrow interest-free", text: "You can borrow several times what you have saved. Nobody approves it – others just need to guarantee it for you." },
    { title: "Installments pay themselves", text: "On the due date the installment leaves your wallet automatically. You can turn this off at any time." },
    { title: "The fund never loses", text: "Whoever doesn't pay loses their locked savings; if that's not enough, so do the people who guaranteed for them. Everyone else's money is safe." },
  ];
  return (
    <Card className="relative overflow-hidden bg-navy border-emerald-200 text-white">
      {/* the vault from the film: an engraved rosette with an open eye */}
      <div className="absolute -right-24 -top-20 sm:-right-16 sm:-top-24 opacity-70 sm:opacity-90" aria-hidden>
        <Rosette size={360} microprint={`KITTY · NO BOARD · NO TREASURER · NO BANK · PROGRAM ${PROGRAM_ID} · `} className="turn-slow" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-navy via-navy/70 to-transparent pointer-events-none" aria-hidden />
      <div className="relative">
      <h1 className="rise text-2xl font-extrabold tracking-[-0.03em] max-w-md">A shared fund with no treasurer and no bank</h1>
      <div className="rule-glow mt-3 max-w-sm" aria-hidden />
      <p className="text-xs text-slate-700 mt-3 leading-relaxed max-w-lg">
        For groups that already pool money together: coworkers, schools, friends, families. No treasurer or bank holds the money –
        only a program whose rules nobody can change: not the founder, and not us, the authors.
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {steps.map((s, i) => (
          <li key={s.title} className="bg-void/60 backdrop-blur-sm border border-slate-200 rounded-xl p-3">
            <div className="kicker text-[11px] font-bold">{i + 1}.</div>
            <div className="text-sm font-semibold text-slate-900">{s.title}</div>
            <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{s.text}</p>
          </li>
        ))}
      </ol>
      </div>
    </Card>
  );
}

function CreateKasaForm({ onCreated }: { onCreated: (kasa: Address) => void }) {
  const { client, wallet, run, busy } = useKasa();
  const [name, setName] = useState("IT Team Fund");
  const [displayName, setDisplayName] = useState("Anna");
  const [multiplier, setMultiplier] = useState("20000");
  const [preset, setPreset] = useState<keyof typeof PRESETS>("demo");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet) return setError("Connect your wallet first.");
    if (utf8Length(name) < 1 || utf8Length(name) > 40) return setError("Name: 1–40 bytes (accented characters count double).");
    if (utf8Length(displayName) < 1 || utf8Length(displayName) > 24) return setError("Your name: 1–24 bytes.");
    const p = PRESETS[preset];
    let built;
    try {
      built = await createKasaIxs(client.identity, MINT, {
        kasaId: randomId(),
        name,
        loanMultiplierBps: Number(multiplier),
        maxInstallments: p.installments,
        periodSecs: p.period,
        graceSecs: p.grace,
        displayName,
      });
    } catch (err) {
      return setError(describeError(err));
    }
    const signature = await run(`Creating the fund “${name}”`, () => client.sendTransaction(built.instructions));
    if (signature) onCreated(built.kasa);
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
        <Plus className="w-4 h-4" aria-hidden /> Create a fund
      </h2>
      <p className="text-[11px] text-slate-500 mb-3">
        You set the rules once and after that nobody can change them, not even you. The founder is an ordinary member.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="kasa-name">Fund name</Label>
          <Input id="kasa-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div>
          <Label htmlFor="kasa-me">Your name in the fund</Label>
          <Input id="kasa-me" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="kasa-mult">How much you can borrow</Label>
            <Select id="kasa-mult" value={multiplier} onChange={(e) => setMultiplier(e.target.value)}>
              <option value="10000">as much as you saved</option>
              <option value="20000">2× your savings</option>
              <option value="30000">3× your savings</option>
              <option value="50000">5× your savings</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="kasa-preset">Installment frequency</Label>
            <Select id="kasa-preset" value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}>
              <option value="demo">Demo (every minute)</option>
              <option value="real">Monthly</option>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{PRESETS[preset].label}, up to {PRESETS[preset].installments} installments.</p>
        <Button type="submit" className="w-full py-2.5" disabled={!!busy || !wallet}>
          {busy?.startsWith("Creating the fund") ? "Sign in your wallet…" : "Create the fund and join"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}
