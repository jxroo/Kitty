"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Address } from "@solana/kit";
import { ArrowLeft, Copy, HandCoins, Lock, ShieldCheck, Users, Vault } from "lucide-react";
import { LoanStatus, type Kasa, type Member } from "@/generated";
import { fetchTokenBalance, type WithAddress } from "@/lib/chain";
import { depositIx, joinIx, requestLoanIx, withdrawIxs } from "@/lib/instructions";
import { describeError, formatZl, maxLoan, memberFree, parseZl, utf8Length } from "@/lib/kasa";
import { useKasa } from "./KasaProvider";
import { LoanCard } from "./LoanCard";
import { AddressLink, Badge, Button, Card, EmptyState, ErrorText, formatDuration, Input, Label, Select, Stat } from "./ui";

export function KasaView({ kasa, onBack }: { kasa: Address; onBack: () => void }) {
  const { chain, wallet, loading } = useKasa();
  const k = chain.kasas.find((x) => x.address === kasa);
  const members = useMemo(() => chain.members.filter((m) => m.data.kasa === kasa), [chain, kasa]);
  const loans = useMemo(() => chain.loans.filter((l) => l.data.kasa === kasa), [chain, kasa]);
  const names = useMemo(() => new Map(members.map((m) => [m.data.wallet as string, m.data.displayName])), [members]);
  const me = members.find((m) => m.data.wallet === wallet);

  if (!k) {
    return (
      <div className="space-y-3">
        <BackLink onBack={onBack} />
        <EmptyState>{loading ? "Czytam kasę z łańcucha…" : "Nie znaleziono tej kasy na devnecie."}</EmptyState>
      </div>
    );
  }

  const open = loans.filter((l) => l.data.status === LoanStatus.Pending || l.data.status === LoanStatus.Active);
  const closed = loans.filter((l) => l.data.status === LoanStatus.Repaid || l.data.status === LoanStatus.Cancelled);

  return (
    <div className="space-y-4">
      <BackLink onBack={onBack} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{k.data.name}</h1>
          <p className="text-xs text-slate-500">
            Kasa <AddressLink address={kasa} /> · założyciel: {names.get(k.data.founder) ?? "członek"} (bez żadnych uprawnień)
          </p>
        </div>
        <ShareButton kasa={kasa} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <MyPanel kasa={k} me={me} />
          {me && me.data.openLoans === 0 && <RequestLoanForm kasa={k} me={me} />}
          <section aria-labelledby="loans-heading" className="space-y-3">
            <h2 id="loans-heading" className="font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-1.5">
              <HandCoins className="w-4 h-4" aria-hidden /> Pożyczki
            </h2>
            {open.length === 0 && <EmptyState>Brak otwartych pożyczek w tej kasie.</EmptyState>}
            {open.map((l) => (
              <LoanCard key={l.address} loan={l} kasa={k} names={names} me={me} />
            ))}
            {closed.length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Rozliczone i anulowane ({closed.length})</summary>
                <div className="space-y-3 mt-3">
                  {closed.map((l) => (
                    <LoanCard key={l.address} loan={l} kasa={k} names={names} me={me} />
                  ))}
                </div>
              </details>
            )}
          </section>
        </div>
        <div className="lg:col-span-4 space-y-4">
          <RulesCard kasa={k} />
          <VaultCard kasa={k} />
          <MembersCard members={members} />
        </div>
      </div>
    </div>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button onClick={onBack} className="text-xs text-slate-600 hover:text-slate-900 inline-flex items-center gap-1">
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Wszystkie kasy
    </button>
  );
}

function ShareButton({ kasa }: { kasa: Address }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      onClick={async () => {
        await navigator.clipboard.writeText(`${window.location.origin}/?kasa=${kasa}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      <Copy className="w-3.5 h-3.5" aria-hidden /> {copied ? "Skopiowano link" : "Zaproś: skopiuj link"}
    </Button>
  );
}

function RulesCard({ kasa }: { kasa: WithAddress<Kasa> }) {
  const d = kasa.data;
  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden /> Zasady zapisane w programie
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <dt className="text-slate-500">Pożyczka maksymalnie</dt>
        <dd className="font-semibold text-slate-900">{d.loanMultiplierBps / 10_000}× Twoich oszczędności</dd>
        <dt className="text-slate-500">Zabezpieczenie</dt>
        <dd className="font-semibold text-slate-900">100%: Twoje oszczędności + poręczenia</dd>
        <dt className="text-slate-500">Raty</dt>
        <dd className="font-semibold text-slate-900">do {d.maxInstallments}, co {formatDuration(d.periodSecs)}</dd>
        <dt className="text-slate-500">Karencja</dt>
        <dd className="font-semibold text-slate-900">{formatDuration(d.graceSecs)}</dd>
        <dt className="text-slate-500">Odsetki i prowizje</dt>
        <dd className="font-semibold text-emerald-700">0 zł</dd>
        <dt className="text-slate-500">Kto zatwierdza pożyczki</dt>
        <dd className="font-semibold text-slate-900">nikt – wystarczą poręczenia</dd>
      </dl>
      <p className="text-[11px] text-slate-500 mt-3">
        Program nie ma instrukcji, która zmienia te zasady, ani klucza admina czy zarządu. (Na devnecie kod programu może jeszcze zaktualizować klucz autorów – szczegóły w zakładce „Gdzie znika pośrednik?”.)
      </p>
    </Card>
  );
}

function VaultCard({ kasa }: { kasa: WithAddress<Kasa> }) {
  const { client, chain } = useKasa();
  const [vaultBalance, setVaultBalance] = useState<bigint | null>(null);
  useEffect(() => {
    fetchTokenBalance(client.rpc, kasa.data.vault).then(setVaultBalance);
  }, [client, kasa.data.vault, chain]);
  const expected = kasa.data.totalSavings - kasa.data.totalOutstanding;
  return (
    <Card className="bg-emerald-50 border-emerald-200">
      <h2 className="font-bold text-emerald-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
        <Vault className="w-4 h-4" aria-hidden /> Skarbiec (konto programu, nie skarbnika)
      </h2>
      <div className="text-2xl font-bold text-emerald-900">{vaultBalance === null ? "…" : formatZl(vaultBalance)}</div>
      <p className="text-[11px] text-emerald-900 mt-1">
        = oszczędności {formatZl(kasa.data.totalSavings)} − pożyczone {formatZl(kasa.data.totalOutstanding)}{" "}
        {vaultBalance !== null && (vaultBalance === expected ? "✓" : "(odświeżam…)")}
      </p>
      <p className="text-[11px] text-emerald-800 mt-2">
        Każda pożyczka jest w 100% pokryta zablokowanymi oszczędnościami, więc w skarbcu zawsze leżą wszystkie wolne
        oszczędności. Każdy może je wypłacić w dowolnej chwili, bez pytania kogokolwiek.
      </p>
      <div className="mt-2">
        <AddressLink address={kasa.data.vault} label="skarbiec w eksploratorze" />
      </div>
    </Card>
  );
}

function MembersCard({ members }: { members: WithAddress<Member>[] }) {
  const { wallet } = useKasa();
  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Users className="w-4 h-4" aria-hidden /> Członkowie ({members.length})
      </h2>
      {members.length === 0 && <p className="text-xs text-slate-500">Nikt jeszcze nie dołączył.</p>}
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="font-medium pb-1">Imię</th>
            <th className="font-medium pb-1 text-right">Oszczędności</th>
            <th className="font-medium pb-1 text-right">Zablokowane</th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ address, data }) => (
            <tr key={address} className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="font-semibold text-slate-900">{data.displayName}</span>
                {data.wallet === wallet && <span className="text-emerald-700"> (Ty)</span>}
                {data.totalSeized > 0n && (
                  <div className="text-rose-600">pokryło zaległości: {formatZl(data.totalSeized)}</div>
                )}
              </td>
              <td className="py-1.5 text-right font-semibold text-slate-900">{formatZl(data.savings)}</td>
              <td className="py-1.5 text-right text-slate-700">{data.locked > 0n ? formatZl(data.locked) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function MyPanel({ kasa, me }: { kasa: WithAddress<Kasa>; me: WithAddress<Member> | undefined }) {
  const { client, wallet, run, busy, tokenBalance } = useKasa();
  const [displayName, setDisplayName] = useState("");
  const [depositAmount, setDepositAmount] = useState("500");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!wallet) {
    return (
      <Card>
        <p className="text-xs text-slate-600">Połącz portfel (prawy górny róg), żeby dołączyć do kasy.</p>
      </Card>
    );
  }

  if (!me) {
    return (
      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-1">Dołącz do kasy</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          Nikt nie musi Cię zatwierdzać: ryzykujesz tylko własne oszczędności, a pożyczkę dostaniesz wyłącznie wtedy, gdy ktoś
          sam zdecyduje się za Ciebie poręczyć.
        </p>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (utf8Length(displayName) < 1 || utf8Length(displayName) > 24) return setError("Imię: 1–24 bajty.");
            const ix = await joinIx(client.identity, kasa.address, displayName);
            await run(`Dołączenie do „${kasa.data.name}”`, () => client.sendTransaction([ix]));
          }}
        >
          <Input aria-label="Twoje imię w kasie" placeholder="Twoje imię, np. Bartek" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
          <Button type="submit" disabled={!!busy}>Dołącz</Button>
        </form>
        <ErrorText>{error}</ErrorText>
      </Card>
    );
  }

  const free = memberFree(me.data);

  async function deposit() {
    setError(null);
    let amount: bigint;
    try {
      amount = parseZl(depositAmount);
    } catch (err) {
      return setError(describeError(err));
    }
    if (amount <= 0n) return setError("Kwota musi być większa od zera.");
    if (tokenBalance !== null && amount > tokenBalance) return setError("Masz za mało tPLN w portfelu. Użyj „Dobierz testowe zł”.");
    const ix = await depositIx(client.identity, kasa.address, kasa.data, amount);
    await run(`Wpłata ${formatZl(amount)}`, () => client.sendTransaction([ix]));
  }

  async function withdraw() {
    setError(null);
    let amount: bigint;
    try {
      amount = parseZl(withdrawAmount || "0");
    } catch (err) {
      return setError(describeError(err));
    }
    if (amount <= 0n) return setError("Kwota musi być większa od zera.");
    const ixs = await withdrawIxs(client.identity, kasa.address, kasa.data, amount);
    await run(`Wypłata ${formatZl(amount)}`, () => client.sendTransaction(ixs));
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-900 text-sm">Moje oszczędności · {me.data.displayName}</h2>
        <span className="text-[11px] text-slate-500">w portfelu: {tokenBalance !== null ? formatZl(tokenBalance) : "0 zł"}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Oszczędności w kasie" value={formatZl(me.data.savings)} />
        <Stat
          label="Zablokowane"
          value={<span className="inline-flex items-center gap-1">{me.data.locked > 0n && <Lock className="w-3.5 h-3.5" aria-hidden />}{formatZl(me.data.locked)}</span>}
          hint="zabezpieczają pożyczki"
          tone={me.data.locked > 0n ? "amber" : "slate"}
        />
        <Stat label="Wolne (do wypłaty)" value={formatZl(free)} tone="emerald" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dep">Wpłać do kasy (zł)</Label>
          <div className="flex gap-2">
            <Input id="dep" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            <Button onClick={deposit} disabled={!!busy}>Wpłać</Button>
          </div>
        </div>
        <div>
          <Label htmlFor="wd">Wypłać wolne oszczędności (zł)</Label>
          <div className="flex gap-2">
            <Input id="wd" inputMode="decimal" placeholder={formatZl(free, false)} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            <Button variant="ghost" onClick={withdraw} disabled={!!busy || free === 0n}>Wypłać</Button>
          </div>
        </div>
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function RequestLoanForm({ kasa, me }: { kasa: WithAddress<Kasa>; me: WithAddress<Member> }) {
  const { client, run, busy } = useKasa();
  const limit = maxLoan(kasa.data, me.data.savings);
  const [amount, setAmount] = useState("");
  const [installments, setInstallments] = useState(String(Math.min(4, kasa.data.maxInstallments)));
  const [error, setError] = useState<string | null>(null);

  let parsed: bigint | null = null;
  try {
    parsed = amount ? parseZl(amount) : null;
  } catch {
    parsed = null;
  }
  const free = memberFree(me.data);
  const own = parsed !== null ? (parsed < free ? parsed : free) : 0n;
  const fromGuarantors = parsed !== null && parsed > own ? parsed - own : 0n;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (parsed === null || parsed <= 0n) return setError("Podaj kwotę pożyczki.");
    if (parsed > limit) return setError(`Limit w tej kasie to ${formatZl(limit)} (${kasa.data.loanMultiplierBps / 10_000}× Twoich oszczędności).`);
    const ix = await requestLoanIx(client.identity, kasa.address, me.data.loanCount, parsed, Number(installments));
    await run(`Wniosek o pożyczkę ${formatZl(parsed)}`, () => client.sendTransaction([ix]));
    setAmount("");
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1">Poproś o pożyczkę</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Twój limit: <strong>{formatZl(limit)}</strong>. Bez odsetek. Nikt jej nie zatwierdza: Twoje wolne oszczędności blokują się
        jako zabezpieczenie, a brakującą część muszą poręczyć inni członkowie.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="loan-amount">Kwota (zł)</Label>
          <Input id="loan-amount" inputMode="decimal" placeholder={formatZl(limit, false)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="loan-inst">Liczba rat</Label>
          <Select id="loan-inst" value={installments} onChange={(e) => setInstallments(e.target.value)}>
            {Array.from({ length: kasa.data.maxInstallments }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} × co {formatDuration(kasa.data.periodSecs)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={!!busy || limit === 0n}>
          Złóż wniosek
        </Button>
      </form>
      {parsed !== null && parsed > 0n && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge tone="amber">Twoje zabezpieczenie: {formatZl(own)}</Badge>
          <Badge tone={fromGuarantors > 0n ? "sky" : "emerald"}>
            {fromGuarantors > 0n ? `Potrzeba poręczeń: ${formatZl(fromGuarantors)}` : "Bez poręczycieli – wypłata od razu"}
          </Badge>
        </div>
      )}
      {limit === 0n && <p className="text-[11px] text-slate-500 mt-2">Najpierw wpłać oszczędności – limit to ich wielokrotność.</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
