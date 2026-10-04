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
    <article className="bg-panel/80 border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3" aria-label={`Loan ${name(l.borrower)}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="font-bold text-slate-900">
            {name(l.borrower)} borrows {formatZl(l.amount)}
            {isBorrower && <span className="text-emerald-700 text-xs font-semibold"> (yours)</span>}
          </div>
          <div className="text-[11px] text-slate-500">
            {l.installments} {plural(l.installments, "installment", "installments")} of about {formatZl(l.amount / BigInt(l.installments))} · every{" "}
            {formatDuration(kasa.data.periodSecs)} · <AddressLink address={loan.address} label="loan account" />
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
        Locked savings for {loan.status === LoanStatus.Pending ? "this loan" : "the rest to repay"}: {formatZl(covered)} of{" "}
        {formatZl(total)}
      </div>
      <div className="h-3 w-full rounded-full bg-slate-100 ring-1 ring-slate-200 overflow-hidden flex shadow-[0_0_14px_-4px_rgba(16,185,129,0.6)]" role="img" aria-label={`Locked ${formatZl(covered)} of ${formatZl(total)}`}>
        <div className="bg-amber-400 h-full" style={{ width: `${pct(loan.ownCollateral)}%` }} />
        {guarantors.map((g, i) => (
          <div key={g.wallet} className={`${GUARANTOR_COLORS[i]} h-full`} style={{ width: `${pct(g.amount)}%` }} />
        ))}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-slate-700">
        <li className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" aria-hidden /> {name(loan.borrower)} (own): {formatZl(loan.ownCollateral)}
        </li>
        {guarantors.map((g, i) => (
          <li key={g.wallet} className="flex items-center gap-1">
            <span className={`w-2.5 h-2.5 rounded-sm ${GUARANTOR_COLORS[i]}`} aria-hidden /> {name(g.wallet)} guarantees: {formatZl(g.amount)}
            {g.seized > 0n && <span className="text-rose-600"> (lost: {formatZl(g.seized)})</span>}
          </li>
        ))}
        {missing > 0n && <li className="text-slate-500">missing: {formatZl(missing)}</li>}
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
    if (amount <= 0n) return setError("Enter the guarantee amount.");
    const ix = await guaranteeIx(client.identity, kasa.address, loan.address, amount);
    await run(`Guarantee ${formatZl(amount)}`, () => client.sendTransaction([ix]));
  }

  return (
    <div className="space-y-2">
      {!isBorrower && <CreditHistoryLine wallet={l.borrower} name={nameOf(l.borrower)} />}
      {missing > 0n ? (
        <p className="text-xs text-slate-700">
          <strong>{formatZl(missing)}</strong> in guarantees is still missing. To <strong>guarantee</strong> means locking part of your
          savings until the loan is repaid. If the borrower doesn't pay and their own savings run out, the missing
          installments are covered from yours – at most up to the amount you guaranteed.
        </p>
      ) : (
        <p className="text-xs text-emerald-700 font-semibold flex items-center gap-1">
          <Check className="w-3.5 h-3.5" aria-hidden /> The loan is fully covered. The borrower can take it out – nobody has to agree.
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {me && !isBorrower && missing > 0n && (
          <div className="flex gap-2">
            <Input aria-label="Guarantee amount in PLN" inputMode="decimal" value={pledge} onChange={(e) => setPledge(e.target.value)} className="w-28" />
            <Button onClick={guarantee} disabled={!!busy}>Guarantee</Button>
          </div>
        )}
        {myPledge && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={async () => {
              const ix = await withdrawGuaranteeIx(client.identity, kasa.address, loan.address);
              await run("Withdrawing the guarantee", () => client.sendTransaction([ix]));
            }}
          >
            Withdraw my guarantee
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
                  `Loan payout ${formatZl(l.amount)}${mandate ? " + automatic repayment" : ""}`,
                  () => client.sendTransaction(ixs)
                );
              }}
            >
              Pay the loan out to my wallet
            </Button>
            <Button
              variant="danger"
              disabled={!!busy}
              onClick={async () => {
                const ix = await cancelLoanIx(client.identity, loan.address, l);
                await run("Cancelling the loan", () => client.sendTransaction([ix]));
              }}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
      {isBorrower && (
        <label className="flex items-start gap-2 text-[11px] text-slate-700 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={mandate} onChange={(e) => setMandate(e.target.checked)} />
          <span>
            <strong>Repay installments automatically:</strong> on the due date the installment leaves my wallet by itself, so I don't have to
            remember due dates. The program takes only the installment, nothing more. I can turn this off at any time.
          </span>
        </label>
      )}
      {!me && wallet && <p className="text-[11px] text-slate-500">Join the fund to guarantee.</p>}
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
    await run(`Installment ${formatZl(owed < available ? owed : available)} collected automatically`, () => client.sendTransaction([ix]));
  }

  async function toggleMandate() {
    const ix = hasMandate
      ? await revokeMandateIx(client.identity, kasa.data.mint)
      : await approveMandateIx(client.identity, kasa.address, kasa.data.mint, left);
    await run(hasMandate ? "Turning off automatic repayment" : `Turning on automatic repayment (up to ${formatZl(left)})`, () => client.sendTransaction([ix]));
  }

  async function repay() {
    setError(null);
    let value: bigint;
    try {
      value = amount ? parseZl(amount) : suggested;
    } catch (err) {
      return setError(describeError(err));
    }
    if (value <= 0n) return setError("Enter an amount.");
    const ix = await repayIx(client.identity, loan.address, l, kasa.data, value);
    await run(`Repayment ${formatZl(value)}`, () => client.sendTransaction([ix]));
    setAmount("");
  }

  async function collect() {
    const ix = await collectOverdueIx(loan.address, l);
    await run(`Overdue installment ${formatZl(overdue)} covered from savings`, () => client.sendTransaction([ix]));
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-xs text-slate-700">
        <span>Repaid: <strong>{formatZl(l.repaid)}</strong></span>
        {l.seized > 0n && (
          <span className="text-rose-700">Covered from locked savings: <strong>{formatZl(l.seized)}</strong></span>
        )}
        <span>Left: <strong>{formatZl(left)}</strong></span>
        {l.autopaid > 0n && (
          <span className="text-emerald-700">
            Repaid automatically: <strong>{formatZl(l.autopaid)}</strong>
          </span>
        )}
      </div>

      <MandateBanner name={name(l.borrower)} token={mandate?.token ?? null} active={hasMandate} isBorrower={isBorrower} />

      <ol className="grid grid-cols-2 sm:grid-cols-4 gap-2" aria-label="Installment schedule">
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
                  : "border-slate-200 bg-slate-50 text-slate-700";
          return (
            <li key={r.k} className={`border rounded-lg p-2 text-[11px] ${style}`}>
              <div className="font-semibold">Installment {r.k}: {formatZl(r.amount)}</div>
              <div>
                {r.state === "paid" && "repaid"}
                {r.state === "seized" && "covered from savings"}
                {(r.state === "open" || r.state === "partly") &&
                  (now < r.dueAt
                    ? `in ${formatDuration(r.dueAt - now)}${hasMandate ? " · pays itself" : ""}`
                    : available > 0n
                      ? "due – collecting from the wallet"
                      : collectible
                        ? "unpaid – ready to be covered"
                        : `grace period: ${formatDuration(r.collectibleAt - now)}`)}
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
              The installment is due and automatic repayment is on. The bot will shortly collect{" "}
              <strong>{formatZl(owed < available ? owed : available)}</strong>{" "}
              {isBorrower ? "from your wallet" : `from the borrower's wallet (${name(l.borrower)})`}. No need to wait for the bot:
            </span>
          </p>
          <Button variant="primary" onClick={pull} disabled={!!busy || !wallet}>
            <Repeat className="w-3.5 h-3.5" aria-hidden /> Collect installment now
          </Button>
        </div>
      )}
      {overdue > 0n && (
        <div className="border border-amber-300 bg-amber-50 rounded-xl p-3 flex flex-wrap items-center justify-between gap-2" role="status">
          <p className="text-xs text-amber-900 flex items-start gap-1.5">
            <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden />
            <span>
              Unpaid: <strong>{formatZl(overdue)}</strong>. Now <strong>anyone</strong> can cover this amount from locked
              savings: first the borrower's ({name(l.borrower)}), then the guarantors'. No debt collectors and nobody's
              permission needed. Usually the bot does it.
            </span>
          </p>
          <Button variant="warning" onClick={collect} disabled={!!busy || !wallet}>
            <Gavel className="w-3.5 h-3.5" aria-hidden /> Cover overdue installment
          </Button>
        </div>
      )}
      {overdue === 0n && next && now < next.collectibleAt && (
        <p className="text-[11px] text-slate-500 flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" aria-hidden /> If installment {next.k} isn't paid, in {formatDuration(next.collectibleAt - now)} it will
          be covered from locked savings.
        </p>
      )}

      {wallet && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor={`repay-${loan.address}`} className="block text-[11px] font-semibold text-slate-700 mb-1">
              {isBorrower ? "Repay (PLN)" : "Repay for the borrower (PLN)"}
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
            {isBorrower ? "Repay installment" : "Repay"}
          </Button>
          {isBorrower && (
            <Button onClick={toggleMandate} disabled={!!busy} variant={hasMandate ? "danger" : "secondary"}>
              {hasMandate ? "Turn off automatic repayment" : "Turn on automatic repayment"}
            </Button>
          )}
          {!me && <span className="text-[11px] text-slate-500">Anyone can repay, even someone outside the fund.</span>}
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
          <strong>Automatic repayment is on.</strong> On the due date the installment leaves{" "}
          {isBorrower ? "your wallet" : `the borrower's wallet (${name})`} by itself – no bank, no clicking. The program takes only the
          installment, nothing more (limit: {formatZl(token.delegatedAmount)}, in wallet: {formatZl(token.amount)}).
        </span>
      </p>
    );
  }
  return (
    <p className="text-[11px] text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5">
      Automatic repayment is off: {isBorrower ? "you repay" : `${name} repays`} by hand. If an installment isn't paid, after a short grace
      period it will be covered from locked savings.
    </p>
  );
}

function ClosedSummary({ loan, name }: { loan: Loan; name: (w: string) => string }) {
  if (loan.status === LoanStatus.Cancelled) {
    return <p className="text-xs text-slate-600">Cancelled before payout. All locked savings went back to their owners.</p>;
  }
  const guarantorSeized = loan.guarantors.slice(0, loan.guarantorCount).filter((g) => g.seized > 0n);
  return (
    <div className="text-xs text-slate-700 space-y-1">
      <p>
        Fully repaid: <strong>{formatZl(loan.repaid)}</strong> came from the borrower
        {loan.seized > 0n && (
          <>
            , <strong className="text-rose-700">{formatZl(loan.seized)}</strong> was covered from locked savings (
            {name(loan.borrower)}: {formatZl(loan.ownSeized)}
            {guarantorSeized.map((g) => `, ${name(g.wallet)}: ${formatZl(g.seized)}`).join("")})
          </>
        )}
        . The fund didn't lose a single grosz.
      </p>
    </div>
  );
}
