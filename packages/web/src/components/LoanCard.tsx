"use client";

import React, { useEffect, useState } from "react";
import { AlertTriangle, Bot, Check, Clock, Gavel, Repeat } from "lucide-react";
import { LoanStatus, type Kasa, type Loan, type Member } from "@/generated";
import { fetchWalletToken, type WithAddress } from "@/lib/chain";
import {
  approveMandateIx,
  ataOf,
  cancelLoanIx,
  collectOverdueIx,
  disburseIxs,
  guaranteeIx,
  memberPda,
  pullInstallmentIx,
  repayIx,
  revokeMandateIx,
  withdrawGuaranteeIx,
} from "@/lib/instructions";
import {
  collateral,
  describeError,
  formatZl,
  LOAN_STATUS_LABEL,
  mandateAvailable,
  memberFree,
  outstanding,
  overdueNow,
  owedNow,
  parseZl,
  plural,
  schedule,
  shortAddress,
  type WalletToken,
} from "@/lib/kasa";
import { CreditHistoryLine } from "./History";
import { useChainNow, useKasa } from "./KasaProvider";
import { AddressLink, Badge, Button, ErrorText, formatDuration, Input } from "./ui";

const STATUS_TONE = {
  [LoanStatus.Pending]: "sky",
  [LoanStatus.Active]: "amber",
  [LoanStatus.Repaid]: "emerald",
  [LoanStatus.Cancelled]: "slate",
} as const;

const GUARANTOR_COLORS = ["bg-sky-500", "bg-indigo-500", "bg-violet-500"];

type Props = {
  loan: WithAddress<Loan>;
  kasa: WithAddress<Kasa>;
  names: Map<string, string>;
  me: WithAddress<Member> | undefined;
};

export function LoanCard({ loan, kasa, names, me }: Props) {
  const l = loan.data;
  const name = (wallet: string) => names.get(wallet) ?? shortAddress(wallet);
  const isBorrower = me?.data.wallet === l.borrower;

  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3" aria-label={`Pożyczka ${name(l.borrower)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">
            {name(l.borrower)} pożycza {formatZl(l.amount)}
            {isBorrower && <span className="text-emerald-700 text-xs font-semibold"> (Twoja)</span>}
          </div>
          <div className="text-[11px] text-slate-500">
            {l.installments} {plural(l.installments, "rata", "raty", "rat")} po ok. {formatZl(l.amount / BigInt(l.installments))} · co{" "}
            {formatDuration(kasa.data.periodSecs)} · <AddressLink address={loan.address} label="konto pożyczki" />
          </div>
        </div>
        <Badge tone={STATUS_TONE[l.status]}>{LOAN_STATUS_LABEL[l.status]}</Badge>
      </div>

      <CollateralBar loan={l} name={name} />

      {l.status === LoanStatus.Pending && <PendingActions loan={loan} kasa={kasa} me={me} nameOf={name} />}
      {l.status === LoanStatus.Active && <ActiveSection loan={loan} kasa={kasa} me={me} name={name} />}
      {(l.status === LoanStatus.Repaid || l.status === LoanStatus.Cancelled) && <ClosedSummary loan={l} name={name} />}
    </article>
  );
}

function CollateralBar({ loan, name }: { loan: Loan; name: (w: string) => string }) {
  const covered = collateral(loan);
  const total = loan.status === LoanStatus.Pending ? loan.amount : outstanding(loan);
  if (loan.status === LoanStatus.Repaid || loan.status === LoanStatus.Cancelled) return null;
  const pct = (x: bigint) => (total === 0n ? 0 : Number((x * 10_000n) / total) / 100);
  const guarantors = loan.guarantors.slice(0, loan.guarantorCount);
  const missing = total > covered ? total - covered : 0n;
  return (
    <div>
      <div className="text-[11px] font-semibold text-slate-600 mb-1">
        Zabezpieczenie {loan.status === LoanStatus.Pending ? "pożyczki" : "pozostałej kwoty"}: {formatZl(covered)} z {formatZl(total)}
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex" role="img" aria-label={`Zabezpieczone ${formatZl(covered)} z ${formatZl(total)}`}>
        <div className="bg-amber-400 h-full" style={{ width: `${pct(loan.ownCollateral)}%` }} />
        {guarantors.map((g, i) => (
          <div key={g.wallet} className={`${GUARANTOR_COLORS[i]} h-full`} style={{ width: `${pct(g.amount)}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-700">
        <li className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" aria-hidden /> {name(loan.borrower)} (własne): {formatZl(loan.ownCollateral)}
        </li>
        {guarantors.map((g, i) => (
          <li key={g.wallet} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${GUARANTOR_COLORS[i]}`} aria-hidden /> {name(g.wallet)} poręcza: {formatZl(g.amount)}
            {g.seized > 0n && <span className="text-rose-600"> (pobrano {formatZl(g.seized)})</span>}
          </li>
        ))}
        {missing > 0n && <li className="text-slate-500">brakuje: {formatZl(missing)}</li>}
      </ul>
    </div>
  );
}

function PendingActions({ loan, kasa, me, nameOf }: Omit<Props, "names"> & { nameOf: (w: string) => string }) {
  const { client, wallet, run, busy } = useKasa();
  const l = loan.data;
  const missing = l.amount - collateral(l);
  const isBorrower = wallet === l.borrower;
  const myPledge = l.guarantors.slice(0, l.guarantorCount).find((g) => g.wallet === wallet);
  const myFree = me ? memberFree(me.data) : 0n;
  const suggested = missing < myFree ? missing : myFree;
  const [pledge, setPledge] = useState(suggested > 0n ? formatZl(suggested, false).replace(/ /g, "") : "");
  const [mandate, setMandate] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function guarantee() {
    setError(null);
    let amount: bigint;
    try {
      amount = parseZl(pledge);
    } catch (err) {
      return setError(describeError(err));
    }
    if (amount <= 0n) return setError("Podaj kwotę poręczenia.");
    const ix = await guaranteeIx(client.identity, kasa.address, loan.address, amount);
    await run(`Poręczenie ${formatZl(amount)}`, () => client.sendTransaction([ix]));
  }

  return (
    <div className="space-y-2">
      {!isBorrower && <CreditHistoryLine wallet={l.borrower} name={nameOf(l.borrower)} />}
      {missing > 0n ? (
        <p className="text-xs text-slate-700">
          Do wypłaty brakuje <strong>{formatZl(missing)}</strong> poręczeń. Poręczając, blokujesz tę część swoich oszczędności do
          czasu spłaty. Jeśli pożyczkobiorca nie spłaci, a jego oszczędności się skończą, raty zostaną pobrane z poręczeń.
        </p>
      ) : (
        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
          <Check className="w-3.5 h-3.5" aria-hidden /> Zabezpieczona w 100%. Pożyczkobiorca może ją wypłacić – nikt nie musi tego zatwierdzać.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {me && !isBorrower && missing > 0n && (
          <div className="flex gap-2">
            <Input aria-label="Kwota poręczenia w zł" inputMode="decimal" value={pledge} onChange={(e) => setPledge(e.target.value)} className="w-28" />
            <Button onClick={guarantee} disabled={!!busy}>Poręczam</Button>
          </div>
        )}
        {myPledge && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={async () => {
              const ix = await withdrawGuaranteeIx(client.identity, kasa.address, loan.address);
              await run("Wycofanie poręczenia", () => client.sendTransaction([ix]));
            }}
          >
            Wycofaj moje poręczenie
          </Button>
        )}
        {isBorrower && (
          <>
            <Button
              variant="primary"
              disabled={!!busy || missing > 0n}
              onClick={async () => {
                const ixs = await disburseIxs(client.identity, loan.address, l, kasa.data, { mandate });
                await run(
                  `Wypłata pożyczki ${formatZl(l.amount)}${mandate ? " + polecenie zapłaty" : ""}`,
                  () => client.sendTransaction(ixs)
                );
              }}
            >
              Wypłać pożyczkę na mój portfel
            </Button>
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={async () => {
                const ix = await cancelLoanIx(client.identity, loan.address, l);
                await run("Anulowanie wniosku", () => client.sendTransaction([ix]));
              }}
            >
              Anuluj wniosek
            </Button>
          </>
        )}
      </div>
      {isBorrower && (
        <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={mandate} onChange={(e) => setMandate(e.target.checked)} />
          <span>
            <strong>Włącz polecenie zapłaty:</strong> w dniu terminu rata sama zejdzie z mojego portfela (zgoda SPL do{" "}
            {formatZl(l.amount)} dla mojego konta w tej kasie). Bez banku i pracodawcy; mogę ją cofnąć w każdej chwili.
          </span>
        </label>
      )}
      {!me && wallet && <p className="text-[11px] text-slate-500">Dołącz do kasy, żeby poręczyć.</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

function ActiveSection({ loan, kasa, me, name }: Omit<Props, "names"> & { name: (w: string) => string }) {
  const { client, wallet, run, busy } = useKasa();
  const now = useChainNow();
  const l = loan.data;
  const rows = schedule(l, kasa.data);
  const overdue = overdueNow(l, kasa.data, now);
  const left = outstanding(l);
  const next = rows.find((r) => r.state === "open" || r.state === "partly");
  const nextPayment = next ? next.cumulative - (l.repaid + l.seized) : 0n;
  const suggested = nextPayment > 0n && nextPayment < left ? nextPayment : left;
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const isBorrower = wallet === l.borrower;
  const mandate = useBorrowerMandate(loan);
  const owed = owedNow(l, kasa.data, now);
  const available = mandate ? mandateAvailable(mandate.token, mandate.pda) : 0n;
  const hasMandate = mandate?.token?.delegate === mandate?.pda && (mandate?.token?.delegatedAmount ?? 0n) > 0n;

  async function pull() {
    const ix = await pullInstallmentIx(loan.address, l, kasa.data);
    await run(`Rata ${formatZl(owed < available ? owed : available)} z polecenia zapłaty`, () => client.sendTransaction([ix]));
  }

  async function toggleMandate() {
    const ix = hasMandate
      ? await revokeMandateIx(client.identity, kasa.data.mint)
      : await approveMandateIx(client.identity, kasa.address, kasa.data.mint, left);
    await run(hasMandate ? "Cofnięcie polecenia zapłaty" : `Polecenie zapłaty do ${formatZl(left)}`, () => client.sendTransaction([ix]));
  }

  async function repay() {
    setError(null);
    let value: bigint;
    try {
      value = amount ? parseZl(amount) : suggested;
    } catch (err) {
      return setError(describeError(err));
    }
    if (value <= 0n) return setError("Podaj kwotę.");
    const ix = await repayIx(client.identity, loan.address, l, kasa.data, value);
    await run(`Spłata ${formatZl(value)}`, () => client.sendTransaction([ix]));
    setAmount("");
  }

  async function collect() {
    const ix = await collectOverdueIx(loan.address, l);
    await run(`Egzekucja zaległej raty ${formatZl(overdue)}`, () => client.sendTransaction([ix]));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-700">
        <span>Spłacone: <strong>{formatZl(l.repaid)}</strong></span>
        {l.seized > 0n && (
          <span className="text-rose-700">Pobrane z zabezpieczeń: <strong>{formatZl(l.seized)}</strong></span>
        )}
        <span>Zostało: <strong>{formatZl(left)}</strong></span>
        {l.autopaid > 0n && (
          <span className="text-emerald-700">
            Z polecenia zapłaty: <strong>{formatZl(l.autopaid)}</strong>
          </span>
        )}
      </div>

      <MandateBanner name={name(l.borrower)} token={mandate?.token ?? null} active={hasMandate} isBorrower={isBorrower} />

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Harmonogram rat">
        {rows.map((r) => {
          const collectible = now >= r.collectibleAt;
          const late = (r.state === "open" || r.state === "partly") && now >= r.dueAt;
          const style =
            r.state === "paid"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : r.state === "seized"
                ? "border-rose-200 bg-rose-50 text-rose-800"
                : late
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-slate-200 bg-white text-slate-700";
          return (
            <li key={r.k} className={`border rounded-lg p-2 text-[11px] ${style}`}>
              <div className="font-semibold">Rata {r.k}: {formatZl(r.amount)}</div>
              <div>
                {r.state === "paid" && "spłacona"}
                {r.state === "seized" && "pobrana z zabezpieczeń"}
                {(r.state === "open" || r.state === "partly") &&
                  (now < r.dueAt
                    ? `termin za ${formatDuration(r.dueAt - now)}${hasMandate ? " · zejdzie z portfela" : ""}`
                    : available > 0n
                      ? "wymagalna – pobierana z portfela"
                      : collectible
                        ? "zaległa – do egzekucji"
                        : `karencja: ${formatDuration(r.collectibleAt - now)}`)}
              </div>
            </li>
          );
        })}
      </ol>

      {owed > 0n && available > 0n && (
        <div className="border border-emerald-300 bg-emerald-50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2" role="status">
          <p className="text-xs text-emerald-900 flex items-start gap-1.5">
            <Bot className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              Rata jest wymagalna i jest zgoda na pobieranie. Automat zaraz ściągnie{" "}
              <strong>{formatZl(owed < available ? owed : available)}</strong> z portfela {isBorrower ? "Twojego" : name(l.borrower)}, bez
              podpisu pożyczkobiorcy. Każdy może to zrobić od razu:
            </span>
          </p>
          <Button variant="primary" onClick={pull} disabled={!!busy || !wallet}>
            <Repeat className="w-3.5 h-3.5" aria-hidden /> Pobierz ratę z polecenia zapłaty
          </Button>
        </div>
      )}
      {overdue > 0n && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2" role="status">
          <p className="text-xs text-amber-900 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              Zaległe <strong>{formatZl(overdue)}</strong>. Program pozwala <strong>każdemu</strong> ściągnąć tę kwotę z zabezpieczeń:
              najpierw z oszczędności pożyczkobiorcy ({name(l.borrower)}), potem proporcjonalnie z poręczeń. Bez zarządu, windykacji i niczyjej zgody.
            </span>
          </p>
          <Button variant="warning" onClick={collect} disabled={!!busy || !wallet}>
            <Gavel className="w-3.5 h-3.5" aria-hidden /> Egzekwuj zaległą ratę
          </Button>
        </div>
      )}
      {overdue === 0n && next && now < next.collectibleAt && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" aria-hidden /> Jeśli rata {next.k} nie zostanie spłacona, egzekucja z zabezpieczeń będzie możliwa za{" "}
          {formatDuration(next.collectibleAt - now)}.
        </p>
      )}

      {wallet && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`repay-${loan.address}`} className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isBorrower ? "Spłać (zł)" : "Spłać za pożyczkobiorcę (zł)"}
            </label>
            <Input
              id={`repay-${loan.address}`}
              inputMode="decimal"
              placeholder={formatZl(suggested, false)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-32"
            />
          </div>
          <Button onClick={repay} disabled={!!busy || left === 0n} variant={isBorrower ? "primary" : "ghost"}>
            {isBorrower ? "Spłać ratę" : "Spłać"}
          </Button>
          {isBorrower && (
            <Button onClick={toggleMandate} disabled={!!busy} variant={hasMandate ? "danger" : "secondary"}>
              {hasMandate ? "Cofnij polecenie zapłaty" : "Włącz polecenie zapłaty"}
            </Button>
          )}
          {!me && <span className="text-[11px] text-slate-500">Spłacić może każdy, także osoba spoza kasy.</span>}
        </div>
      )}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

/** The borrower's token account and their Member PDA (the delegate a mandate must name), re-read with the chain. */
function useBorrowerMandate(loan: WithAddress<Loan>) {
  const { client, chain } = useKasa();
  const [state, setState] = useState<{ token: WalletToken | null; pda: string } | null>(null);
  const { kasa, borrower } = loan.data;
  const mint = chain.kasas.find((k) => k.address === kasa)?.data.mint;
  useEffect(() => {
    if (!mint) return;
    let live = true;
    (async () => {
      const [pda, ata] = await Promise.all([memberPda(kasa, borrower), ataOf(borrower, mint)]);
      const token = await fetchWalletToken(client.rpc, ata);
      if (live) setState({ token, pda });
    })();
    return () => {
      live = false;
    };
  }, [client, chain, kasa, borrower, mint]);
  return state;
}

function MandateBanner({
  name,
  token,
  active,
  isBorrower,
}: {
  name: string;
  token: WalletToken | null;
  active: boolean;
  isBorrower: boolean;
}) {
  if (active && token) {
    return (
      <p className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
        <Repeat className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden />
        <span>
          <strong>Polecenie zapłaty aktywne</strong>: zgoda do {formatZl(token.delegatedAmount)}, w portfelu {formatZl(token.amount)}. W dniu
          terminu rata zejdzie z portfela {isBorrower ? "Twojego" : name} sama: transakcję wysyła automat (albo ktokolwiek), bez podpisu{" "}
          {isBorrower ? "Twojego" : "pożyczkobiorcy"} i bez banku. Program weźmie tylko to, co wymagalne.
        </span>
      </p>
    );
  }
  return (
    <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      Bez polecenia zapłaty: {isBorrower ? "spłacasz" : `${name} spłaca`} ręcznie. Jeśli rata nie wpłynie, po terminie i karencji zejdzie z
      zabezpieczeń.
    </p>
  );
}

function ClosedSummary({ loan, name }: { loan: Loan; name: (w: string) => string }) {
  if (loan.status === LoanStatus.Cancelled) {
    return <p className="text-xs text-slate-600">Wniosek anulowany przed wypłatą. Wszystkie zabezpieczenia zostały odblokowane.</p>;
  }
  const guarantorSeized = loan.guarantors.slice(0, loan.guarantorCount).filter((g) => g.seized > 0n);
  return (
    <div className="text-xs text-slate-700 space-y-1">
      <p>
        Rozliczona w całości: <strong>{formatZl(loan.repaid)}</strong> spłacił pożyczkobiorca
        {loan.seized > 0n && (
          <>
            , <strong className="text-rose-700">{formatZl(loan.seized)}</strong> pobrano z zabezpieczeń (
            {name(loan.borrower)}: {formatZl(loan.ownSeized)}
            {guarantorSeized.map((g) => `, ${name(g.wallet)}: ${formatZl(g.seized)}`).join("")})
          </>
        )}
        . Kasa nie straciła ani grosza.
      </p>
    </div>
  );
}
