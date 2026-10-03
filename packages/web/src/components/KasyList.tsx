"use client";

import React, { useState } from "react";
import type { Address } from "@solana/kit";
import { ArrowRight, Landmark, Plus, Users } from "lucide-react";
import { LoanStatus } from "@/generated";
import { createKasaIxs } from "@/lib/instructions";
import { describeError, formatZl, MINT, randomId, utf8Length } from "@/lib/kasa";
import { useKasa } from "./KasaProvider";
import { Badge, Button, Card, EmptyState, ErrorText, formatDuration, Input, Label, Select } from "./ui";

const PRESETS = {
  demo: { label: "Demo na żywo: rata co 60 s, karencja 15 s", period: 60, grace: 15, installments: 6 },
  real: { label: "Prawdziwa: rata co 30 dni, karencja 7 dni", period: 30 * 86_400, grace: 7 * 86_400, installments: 24 },
} as const;

export function KasyList({ onOpen }: { onOpen: (kasa: Address) => void }) {
  const { chain, loading, wallet } = useKasa();
  const myKasas = new Set(chain.members.filter((m) => m.data.wallet === wallet).map((m) => m.data.kasa));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 space-y-3" aria-labelledby="kasy-heading">
        <h2 id="kasy-heading" className="font-bold text-slate-900 text-sm uppercase tracking-wider">
          Kasy na łańcuchu
        </h2>
        {loading && <EmptyState>Czytam kasy z łańcucha…</EmptyState>}
        {!loading && chain.kasas.length === 0 && <EmptyState>Nie ma jeszcze żadnej kasy. Załóż pierwszą obok.</EmptyState>}
        {chain.kasas.map(({ address, data }) => {
          const active = chain.loans.filter((l) => l.data.kasa === address && l.data.status === LoanStatus.Active).length;
          return (
            <button
              key={address}
              onClick={() => onOpen(address)}
              className="w-full text-left bg-white border border-slate-200 hover:border-emerald-400 rounded-2xl p-4 shadow-sm transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-bold text-slate-900 flex items-center gap-2">
                    <Landmark className="w-4 h-4 text-emerald-600" aria-hidden />
                    {data.name}
                    {myKasas.has(address) && <Badge tone="emerald">jesteś członkiem</Badge>}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1">
                    Pożyczka do {data.loanMultiplierBps / 10_000}× oszczędności · do {data.maxInstallments} rat co{" "}
                    {formatDuration(data.periodSecs)} · karencja {formatDuration(data.graceSecs)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-700">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" aria-hidden /> {data.memberCount} członków
                </span>
                <span>Oszczędności: <strong>{formatZl(data.totalSavings)}</strong></span>
                <span>Pożyczone: <strong>{formatZl(data.totalOutstanding)}</strong></span>
                <span>Aktywne pożyczki: <strong>{active}</strong></span>
              </div>
            </button>
          );
        })}
      </section>
      <div className="lg:col-span-5 space-y-4">
        <CreateKasaForm onCreated={onOpen} />
        {!wallet && (
          <p className="text-[11px] text-slate-500">
            Przeglądać możesz bez portfela. Żeby założyć kasę lub dołączyć, połącz Phantom, Solflare albo Backpack (devnet).
          </p>
        )}
      </div>
    </div>
  );
}

function CreateKasaForm({ onCreated }: { onCreated: (kasa: Address) => void }) {
  const { client, wallet, run, busy } = useKasa();
  const [name, setName] = useState("Kasa Działu IT");
  const [displayName, setDisplayName] = useState("Anna");
  const [multiplier, setMultiplier] = useState("20000");
  const [preset, setPreset] = useState<keyof typeof PRESETS>("demo");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!wallet) return setError("Najpierw połącz portfel.");
    if (utf8Length(name) < 1 || utf8Length(name) > 40) return setError("Nazwa: 1–40 bajtów (polskie znaki liczą się podwójnie).");
    if (utf8Length(displayName) < 1 || utf8Length(displayName) > 24) return setError("Twoje imię: 1–24 bajty.");
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
    const signature = await run(`Założenie kasy „${name}”`, () => client.sendTransaction(built.instructions));
    if (signature) onCreated(built.kasa);
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
        <Plus className="w-4 h-4" aria-hidden /> Załóż kasę
      </h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Zasady zapisują się w programie na zawsze. Jako założyciel nie dostajesz żadnych uprawnień: jesteś zwykłym członkiem.
      </p>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <Label htmlFor="kasa-name">Nazwa kasy</Label>
          <Input id="kasa-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} />
        </div>
        <div>
          <Label htmlFor="kasa-me">Twoje imię w kasie</Label>
          <Input id="kasa-me" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="kasa-mult">Pożyczka maksymalnie</Label>
            <Select id="kasa-mult" value={multiplier} onChange={(e) => setMultiplier(e.target.value)}>
              <option value="10000">1× oszczędności</option>
              <option value="20000">2× oszczędności</option>
              <option value="30000">3× oszczędności</option>
              <option value="50000">5× oszczędności</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="kasa-preset">Harmonogram rat</Label>
            <Select id="kasa-preset" value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}>
              <option value="demo">Demo (60 s)</option>
              <option value="real">Miesięczny</option>
            </Select>
          </div>
        </div>
        <p className="text-[11px] text-slate-500">{PRESETS[preset].label}, do {PRESETS[preset].installments} rat.</p>
        <Button type="submit" className="w-full py-2.5" disabled={!!busy || !wallet}>
          {busy?.startsWith("Założenie") ? "Podpisz w portfelu…" : "Załóż kasę i dołącz"}
        </Button>
        <ErrorText>{error}</ErrorText>
      </form>
    </Card>
  );
}
