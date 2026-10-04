"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { Address, Instruction } from "@solana/kit";
import { ArrowLeft, Copy, HandCoins, Lock, Repeat, ShieldCheck, Users, Vault } from "lucide-react";
import { LoanStatus, type Kasa, type Member } from "@/generated";
import { fetchTokenBalance, type WithAddress } from "@/lib/chain";
import {
  approveMandateIx,
  depositIx,
  joinIx,
  memberPda,
  requestLoanIx,
  revokeMandateIx,
  setContributionIx,
  withdrawIxs,
} from "@/lib/instructions";
import { describeError, formatZl, maxLoan, memberFree, outstanding, parseZl, utf8Length } from "@/lib/kasa";
import { useChainNow, useKasa } from "./KasaProvider";
import { CreditHistoryLine } from "./History";
import { KasaHistory } from "./KasaHistory";
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
          <h1 className="rise text-3xl font-extrabold text-white tracking-[-0.03em]">{k.data.name}</h1>
          <div className="rule-glow mt-2 mb-2 w-64 max-w-full" aria-hidden />
          <p className="text-xs text-slate-500">
            Kasa <AddressLink address={kasa} /> · założyciel: {names.get(k.data.founder) ?? "członek"} (zwykły członek, bez specjalnych praw)
          </p>
        </div>
        <ShareButton kasa={kasa} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          <MyPanel kasa={k} me={me} />
          {me && <StandingOrderCard kasa={k} me={me} />}
          {me && me.data.openLoans === 0 && <RequestLoanForm kasa={k} me={me} />}
          <section aria-labelledby="loans-heading" className="space-y-3">
            <h2 id="loans-heading" className="kicker font-semibold text-[11px] flex items-center gap-1.5">
              <HandCoins className="w-4 h-4" aria-hidden /> Pożyczki
            </h2>
            {open.length === 0 && <EmptyState>Brak otwartych pożyczek w tej kasie.</EmptyState>}
            {open.map((l) => (
              <LoanCard key={l.address} loan={l} kasa={k} names={names} me={me} />
            ))}
            {closed.length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Zakończone pożyczki ({closed.length})</summary>
                <div className="space-y-3 mt-3">
                  {closed.map((l) => (
                    <LoanCard key={l.address} loan={l} kasa={k} names={names} me={me} />
                  ))}
                </div>
              </details>
            )}
          </section>
          <KasaHistory kasa={k} names={names} />
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
      <h2 className="kicker font-semibold text-[11px] mb-3 flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden /> Zasady tej kasy
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <dt className="text-slate-500">Ile można pożyczyć</dt>
        <dd className="font-semibold text-slate-900">do {d.loanMultiplierBps / 10_000}× tego, co masz odłożone</dd>
        <dt className="text-slate-500">Warunek wypłaty</dt>
        <dd className="font-semibold text-slate-900">Twoje oszczędności + poręczenia innych pokrywają całą kwotę</dd>
        <dt className="text-slate-500">Raty</dt>
        <dd className="font-semibold text-slate-900">do {d.maxInstallments}, co {formatDuration(d.periodSecs)}</dd>
        <dt className="text-slate-500">Czas na spóźnienie</dt>
        <dd className="font-semibold text-slate-900">{formatDuration(d.graceSecs)}</dd>
        <dt className="text-slate-500">Odsetki i prowizje</dt>
        <dd className="font-semibold text-emerald-700">0 zł</dd>
        <dt className="text-slate-500">Kto zatwierdza pożyczki</dt>
        <dd className="font-semibold text-slate-900">nikt</dd>
      </dl>
      <p className="text-[11px] text-slate-500 mt-3">
        Zasady ustalono przy zakładaniu kasy i nikt ich nie zmieni: nie ma zarządu ani administratora. (Uczciwie: w wersji
        testowej autorzy mogą jeszcze podmienić kod programu – szczegóły w zakładce „Gdzie znika pośrednik?”.)
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
      <h2 className="kicker font-semibold text-[11px] mb-2 flex items-center gap-1.5">
        <Vault className="w-4 h-4" aria-hidden /> Pieniądze kasy
      </h2>
      <div className="text-2xl font-bold text-emerald-900">{vaultBalance === null ? "…" : formatZl(vaultBalance)}</div>
      <p className="text-[11px] text-emerald-900 mt-1">
        = odłożone {formatZl(kasa.data.totalSavings)} − pożyczone {formatZl(kasa.data.totalOutstanding)}{" "}
        {vaultBalance !== null && (vaultBalance === expected ? "✓" : "(odświeżam…)")}
      </p>
      <p className="text-[11px] text-emerald-800 mt-2">
        Leżą na koncie programu, nie u skarbnika ani w banku. Każda pożyczka jest w całości pokryta zablokowanymi
        oszczędnościami, więc wolne pieniądze każdego członka zawsze tu są – wyjmujesz je, kiedy chcesz, bez pytania kogokolwiek.
      </p>
      <div className="mt-2">
        <AddressLink address={kasa.data.vault} label="sprawdź konto kasy w eksploratorze" />
      </div>
    </Card>
  );
}

function MembersCard({ members }: { members: WithAddress<Member>[] }) {
  const { wallet } = useKasa();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card>
      <h2 className="kicker font-semibold text-[11px] mb-3 flex items-center gap-1.5">
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
            <React.Fragment key={address}>
            <tr className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="font-semibold text-slate-900">{data.displayName}</span>
                {data.wallet === wallet && <span className="text-emerald-700"> (Ty)</span>}
                {data.contribution > 0n && (
                  <div className="text-emerald-700">składka stała: {formatZl(data.contribution)}</div>
                )}
                {data.totalSeized > 0n && (
                  <div className="text-rose-600">stracone na niezapłacone raty: {formatZl(data.totalSeized)}</div>
                )}
                <button
                  className="block text-slate-500 hover:text-slate-800 underline decoration-dotted"
                  aria-expanded={open === address}
                  onClick={() => setOpen(open === address ? null : address)}
                >
                  historia
                </button>
              </td>
              <td className="py-1.5 text-right font-semibold text-slate-900">{formatZl(data.savings)}</td>
              <td className="py-1.5 text-right text-slate-700">{data.locked > 0n ? formatZl(data.locked) : "–"}</td>
            </tr>
            {open === address && (
              <tr>
                <td colSpan={3} className="pb-2">
                  <CreditHistoryLine wallet={data.wallet} name={data.displayName} />
                </td>
              </tr>
            )}
            </React.Fragment>
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
          Nikt nie musi Cię przyjmować. Ryzykujesz tylko własne pieniądze, a pożyczkę dostaniesz tylko wtedy, gdy ktoś sam zechce
          za Ciebie poręczyć.
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
        <Stat label="Odłożone w kasie" value={formatZl(me.data.savings)} />
        <Stat
          label="Zablokowane"
          value={<span className="inline-flex items-center gap-1">{me.data.locked > 0n && <Lock className="w-3.5 h-3.5" aria-hidden />}{formatZl(me.data.locked)}</span>}
          hint="chronią pożyczki, do czasu spłaty"
          tone={me.data.locked > 0n ? "amber" : "slate"}
        />
        <Stat label="Wolne (możesz wyjąć)" value={formatZl(free)} tone="emerald" />
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
          <Label htmlFor="wd">Wyjmij wolne pieniądze (zł)</Label>
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

/**
 * Standing order and direct-debit mandate for this kasa, both without a bank: the
 * member approves their own Member PDA (SPL delegate) and the program pulls only
 * what is due: the contribution once per period, installments of their own loan.
 */
function StandingOrderCard({ kasa, me }: { kasa: WithAddress<Kasa>; me: WithAddress<Member> }) {
  const { client, run, busy, walletToken, chain } = useKasa();
  const now = useChainNow();
  const [pda, setPda] = useState<string | null>(null);
  const [amount, setAmount] = useState(me.data.contribution > 0n ? formatZl(me.data.contribution, false) : "100");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    memberPda(kasa.address, me.data.wallet).then(setPda);
  }, [kasa.address, me.data.wallet]);

  const delegate = walletToken?.delegate ?? null;
  const mine = pda !== null && delegate === pda && (walletToken?.delegatedAmount ?? 0n) > 0n;
  const elsewhere = delegate !== null && delegate !== pda;
  const myLoan = chain.loans.find((l) => l.data.kasa === kasa.address && l.data.borrower === me.data.wallet && l.data.status === LoanStatus.Active);
  const owedOnLoan = myLoan ? outstanding(myLoan.data) : 0n;
  const next = Number(me.data.nextContributionAt);

  async function save() {
    setError(null);
    let value: bigint;
    try {
      value = parseZl(amount || "0");
    } catch (err) {
      return setError(describeError(err));
    }
    // One allowance covers a year of contributions plus what the member's own loan still owes.
    const limit = value * 12n + owedOnLoan;
    const ixs: Instruction[] = [await setContributionIx(client.identity, kasa.address, value)];
    if (value > 0n) ixs.push(await approveMandateIx(client.identity, kasa.address, kasa.data.mint, limit));
    await run(value > 0n ? `Składka stała ${formatZl(value)} co ${formatDuration(kasa.data.periodSecs)}` : "Wyłączenie składki", () =>
      client.sendTransaction(ixs)
    );
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
        <Repeat className="w-4 h-4 text-emerald-600" aria-hidden /> Płatności automatyczne
      </h2>
      <p className="text-[11px] text-slate-600 mb-1">
        Jedna zgoda i nie musisz pamiętać o terminach: co okres program sam przeleje Twoją stałą składkę z portfela do kasy, a w
        dniu raty – ratę Twojej pożyczki. Weźmie tylko tyle, ile trzeba. Zgodę wyłączasz jednym kliknięciem.
      </p>
      <details className="text-[11px] text-slate-500 mb-3">
        <summary className="cursor-pointer">Jak to działa technicznie?</summary>
        <p className="mt-1">
          To standardowa zgoda z limitem kwoty (SPL <code>approve</code>) dla Twojego konta w tej kasie. Program może z niej pobrać tylko
          wymagalną ratę albo składkę, tylko z Twojego portfela. Transakcje wysyła automat, który nie ma żadnych uprawnień – płaci
          tylko opłatę sieci. Gdy zgodę wyłączysz, raty nadal są chronione Twoimi zablokowanymi oszczędnościami.
        </p>
      </details>
      <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
        {mine ? (
          <span className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
            Włączone · limit {formatZl(walletToken!.delegatedAmount)}
          </span>
        ) : (
          <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600">Wyłączone w tej kasie</span>
        )}
        {me.data.contribution > 0n && (
          <span className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
            Stała składka {formatZl(me.data.contribution)} co {formatDuration(kasa.data.periodSecs)} ·{" "}
            {next > now ? `następna za ${formatDuration(next - now)}` : mine ? "teraz – automat pobiera" : "czeka na włączenie płatności"}
          </span>
        )}
      </div>
      {elsewhere && (
        <p className="text-[11px] text-amber-800 mb-2">
          Masz włączone płatności automatyczne w innej kasie. Można je mieć tylko w jednej kasie naraz – nowa zgoda zastąpi tamtą.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="contrib">Stała składka co okres (zł)</Label>
          <Input id="contrib" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
        </div>
        <Button onClick={save} disabled={!!busy}>
          {me.data.contribution > 0n ? "Zmień składkę" : "Włącz stałą składkę"}
        </Button>
        {me.data.contribution > 0n && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={async () => {
              const ix = await setContributionIx(client.identity, kasa.address, 0n);
              await run("Wyłączenie składki", () => client.sendTransaction([ix]));
            }}
          >
            Wyłącz składkę
          </Button>
        )}
        {mine && (
          <Button
            variant="danger"
            disabled={!!busy}
            onClick={async () => {
              const ix = await revokeMandateIx(client.identity, kasa.data.mint);
              await run("Wyłączenie płatności automatycznych", () => client.sendTransaction([ix]));
            }}
          >
            Wyłącz płatności automatyczne
          </Button>
        )}
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
    await run(`Prośba o pożyczkę ${formatZl(parsed)}`, () => client.sendTransaction([ix]));
    setAmount("");
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1">Poproś o pożyczkę</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        Możesz pożyczyć do <strong>{formatZl(limit)}</strong>, bez odsetek. Nikt tego nie zatwierdza. Twoje oszczędności zostaną
        zablokowane do czasu spłaty, a resztę kwoty muszą poręczyć inni członkowie.
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
          Poproś o pożyczkę
        </Button>
      </form>
      {parsed !== null && parsed > 0n && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge tone="emerald">Zablokujesz swoje: {formatZl(own)}</Badge>
          <Badge tone={fromGuarantors > 0n ? "sky" : "emerald"}>
            {fromGuarantors > 0n ? `Inni muszą poręczyć: ${formatZl(fromGuarantors)}` : "Bez poręczeń – wypłata od razu"}
          </Badge>
        </div>
      )}
      {limit === 0n && <p className="text-[11px] text-slate-500 mt-2">Najpierw coś odłóż – pożyczyć możesz kilka razy tyle, ile masz w kasie.</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
