"use client";

import React, { useState } from "react";
import type { Address } from "@solana/kit";
import { ArrowRight, Landmark, Plus, Users } from "lucide-react";
import { LoanStatus } from "@/generated";
import { createKasaIxs } from "@/lib/instructions";
import { describeError, formatZl, MINT, randomId, utf8Length } from "@/lib/kasa";
import { NetworkCard } from "./History";
import { useKasa } from "./KasaProvider";
import { Badge, Button, Card, EmptyState, ErrorText, formatDuration, Input, Label, Select } from "./ui";

const PRESETS = {
  demo: { label: "Pokaz na żywo: rata co minutę, 15 s na spóźnienie", period: 60, grace: 15, installments: 6 },
  real: { label: "Na co dzień: rata co miesiąc, 7 dni na spóźnienie", period: 30 * 86_400, grace: 7 * 86_400, installments: 24 },
} as const;

export function KasyList({ onOpen }: { onOpen: (kasa: Address) => void }) {
  const { chain, loading, wallet } = useKasa();
  const myKasas = new Set(chain.members.filter((m) => m.data.wallet === wallet).map((m) => m.data.kasa));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      <section className="lg:col-span-7 space-y-3" aria-labelledby="kasy-heading">
        <Intro />
        <NetworkCard />
        <h2 id="kasy-heading" className="font-bold text-slate-900 text-sm uppercase tracking-wider">
          Wszystkie kasy
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
                    Pożyczka do {data.loanMultiplierBps / 10_000}× odłożonej kwoty · do {data.maxInstallments} rat co{" "}
                    {formatDuration(data.periodSecs)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden />
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-slate-700">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" aria-hidden /> {data.memberCount} członków
                </span>
                <span>Odłożone: <strong>{formatZl(data.totalSavings)}</strong></span>
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
            Oglądać możesz bez portfela. Żeby założyć kasę albo dołączyć, połącz portfel Solana (Phantom, Solflare albo Backpack)
            w sieci testowej devnet.
          </p>
        )}
      </div>
    </div>
  );
}

function Intro() {
  const steps = [
    { title: "Odkładacie razem", text: "Każdy wpłaca do wspólnej kasy. Swoje wolne pieniądze wyjmujesz, kiedy chcesz." },
    { title: "Pożyczacie bez odsetek", text: "Możesz pożyczyć kilka razy tyle, ile masz odłożone. Nikt tego nie zatwierdza – wystarczy, że inni za Ciebie poręczą." },
    { title: "Raty płacą się same", text: "W dniu terminu rata schodzi z Twojego portfela automatycznie. Możesz to wyłączyć w każdej chwili." },
    { title: "Kasa nigdy nie traci", text: "Kto nie zapłaci, traci swoje zablokowane oszczędności; jeśli to za mało – ci, którzy za tę osobę poręczyli. Pieniądze reszty są bezpieczne." },
  ];
  return (
    <Card className="bg-slate-900 border-slate-900 text-white">
      <h1 className="text-xl font-bold tracking-tight">Wspólna kasa bez skarbnika i bez banku</h1>
      <p className="text-xs text-slate-300 mt-1 leading-relaxed">
        Dla grup, które już zrzucają się na wspólną kasę: współpracowników, szkół, znajomych, rodzin. Pieniędzy nie trzyma żaden
        skarbnik ani bank, tylko program, którego zasad nikt nie może zmienić – ani założyciel, ani my, autorzy.
      </p>
      <ol className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        {steps.map((s, i) => (
          <li key={s.title} className="bg-white/10 rounded-xl p-3">
            <div className="text-emerald-300 text-[11px] font-bold">{i + 1}.</div>
            <div className="text-sm font-semibold">{s.title}</div>
            <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{s.text}</p>
          </li>
        ))}
      </ol>
    </Card>
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
        Zasady ustalasz raz i potem nikt ich nie zmieni, także Ty. Założyciel jest zwykłym członkiem.
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
            <Label htmlFor="kasa-mult">Ile można pożyczyć</Label>
            <Select id="kasa-mult" value={multiplier} onChange={(e) => setMultiplier(e.target.value)}>
              <option value="10000">tyle, ile się odłożyło</option>
              <option value="20000">2× tyle</option>
              <option value="30000">3× tyle</option>
              <option value="50000">5× tyle</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="kasa-preset">Jak często raty</Label>
            <Select id="kasa-preset" value={preset} onChange={(e) => setPreset(e.target.value as keyof typeof PRESETS)}>
              <option value="demo">Pokaz (co minutę)</option>
              <option value="real">Co miesiąc</option>
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
