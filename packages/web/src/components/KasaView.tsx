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
        <EmptyState>{loading ? "Reading the fund from the chain…" : "This fund was not found on devnet."}</EmptyState>
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
            Fund <AddressLink address={kasa} /> · founder: {names.get(k.data.founder) ?? "a member"} (an ordinary member with no special rights)
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
              <HandCoins className="w-4 h-4" aria-hidden /> Loans
            </h2>
            {open.length === 0 && <EmptyState>No open loans in this fund.</EmptyState>}
            {open.map((l) => (
              <LoanCard key={l.address} loan={l} kasa={k} names={names} me={me} />
            ))}
            {closed.length > 0 && (
              <details className="group">
                <summary className="text-xs font-semibold text-slate-600 cursor-pointer">Closed loans ({closed.length})</summary>
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
      <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> All funds
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
      <Copy className="w-3.5 h-3.5" aria-hidden /> {copied ? "Link copied" : "Invite: copy link"}
    </Button>
  );
}

function RulesCard({ kasa }: { kasa: WithAddress<Kasa> }) {
  const d = kasa.data;
  return (
    <Card>
      <h2 className="kicker font-semibold text-[11px] mb-3 flex items-center gap-1.5">
        <ShieldCheck className="w-4 h-4 text-emerald-600" aria-hidden /> This fund's rules
      </h2>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
        <dt className="text-slate-500">How much you can borrow</dt>
        <dd className="font-semibold text-slate-900">up to {d.loanMultiplierBps / 10_000}× what you have saved</dd>
        <dt className="text-slate-500">Payout condition</dt>
        <dd className="font-semibold text-slate-900">your savings + others' guarantees cover the full amount</dd>
        <dt className="text-slate-500">Installments</dt>
        <dd className="font-semibold text-slate-900">up to {d.maxInstallments}, every {formatDuration(d.periodSecs)}</dd>
        <dt className="text-slate-500">Grace period</dt>
        <dd className="font-semibold text-slate-900">{formatDuration(d.graceSecs)}</dd>
        <dt className="text-slate-500">Interest and fees</dt>
        <dd className="font-semibold text-emerald-700">0 PLN</dd>
        <dt className="text-slate-500">Who approves loans</dt>
        <dd className="font-semibold text-slate-900">nobody</dd>
      </dl>
      <p className="text-[11px] text-slate-500 mt-3">
        The rules were set when the fund was created and nobody can change them: there is no board and no admin. (To be fair: in
        this test version the authors can still replace the program code – details in the “Where did the middleman go?” tab.)
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
        <Vault className="w-4 h-4" aria-hidden /> The fund's money
      </h2>
      <div className="text-2xl font-bold text-emerald-900">{vaultBalance === null ? "…" : formatZl(vaultBalance)}</div>
      <p className="text-[11px] text-emerald-900 mt-1">
        = saved {formatZl(kasa.data.totalSavings)} − lent {formatZl(kasa.data.totalOutstanding)}{" "}
        {vaultBalance !== null && (vaultBalance === expected ? "✓" : "(refreshing…)")}
      </p>
      <p className="text-[11px] text-emerald-800 mt-2">
        It sits in a program account, not with a treasurer or a bank. Every loan is fully covered by locked savings, so every
        member's free money is always here – you take it out whenever you want, without asking anyone.
      </p>
      <div className="mt-2">
        <AddressLink address={kasa.data.vault} label="check the fund's account in the explorer" />
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
        <Users className="w-4 h-4" aria-hidden /> Members ({members.length})
      </h2>
      {members.length === 0 && <p className="text-xs text-slate-500">Nobody has joined yet.</p>}
      <table className="w-full text-[11px]">
        <thead>
          <tr className="text-slate-500 text-left">
            <th className="font-medium pb-1">Name</th>
            <th className="font-medium pb-1 text-right">Savings</th>
            <th className="font-medium pb-1 text-right">Locked</th>
          </tr>
        </thead>
        <tbody>
          {members.map(({ address, data }) => (
            <React.Fragment key={address}>
            <tr className="border-t border-slate-100">
              <td className="py-1.5">
                <span className="font-semibold text-slate-900">{data.displayName}</span>
                {data.wallet === wallet && <span className="text-emerald-700"> (you)</span>}
                {data.contribution > 0n && (
                  <div className="text-emerald-700">standing contribution: {formatZl(data.contribution)}</div>
                )}
                {data.totalSeized > 0n && (
                  <div className="text-rose-600">lost to missed installments: {formatZl(data.totalSeized)}</div>
                )}
                <button
                  className="block text-slate-500 hover:text-slate-800 underline decoration-dotted"
                  aria-expanded={open === address}
                  onClick={() => setOpen(open === address ? null : address)}
                >
                  history
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
        <p className="text-xs text-slate-600">Connect your wallet (top right corner) to join the fund.</p>
      </Card>
    );
  }

  if (!me) {
    return (
      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-1">Join the fund</h2>
        <p className="text-[11px] text-slate-500 mb-3">
          Nobody has to accept you. You only risk your own money, and you only get a loan if someone chooses to guarantee
          it for you.
        </p>
        <form
          className="flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            setError(null);
            if (utf8Length(displayName) < 1 || utf8Length(displayName) > 24) return setError("Name: 1–24 bytes.");
            const ix = await joinIx(client.identity, kasa.address, displayName);
            await run(`Joining “${kasa.data.name}”`, () => client.sendTransaction([ix]));
          }}
        >
          <Input aria-label="Your name in the fund" placeholder="Your name, e.g. Bart" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={24} />
          <Button type="submit" disabled={!!busy}>Join</Button>
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
    if (amount <= 0n) return setError("The amount must be greater than zero.");
    if (tokenBalance !== null && amount > tokenBalance) return setError("You don't have enough tPLN in your wallet. Use “Get test PLN”.");
    const ix = await depositIx(client.identity, kasa.address, kasa.data, amount);
    await run(`Deposit ${formatZl(amount)}`, () => client.sendTransaction([ix]));
  }

  async function withdraw() {
    setError(null);
    let amount: bigint;
    try {
      amount = parseZl(withdrawAmount || "0");
    } catch (err) {
      return setError(describeError(err));
    }
    if (amount <= 0n) return setError("The amount must be greater than zero.");
    const ixs = await withdrawIxs(client.identity, kasa.address, kasa.data, amount);
    await run(`Withdrawal ${formatZl(amount)}`, () => client.sendTransaction(ixs));
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold text-slate-900 text-sm">My savings · {me.data.displayName}</h2>
        <span className="text-[11px] text-slate-500">in wallet: {tokenBalance !== null ? formatZl(tokenBalance) : "0 PLN"}</span>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Stat label="Saved in the fund" value={formatZl(me.data.savings)} />
        <Stat
          label="Locked"
          value={<span className="inline-flex items-center gap-1">{me.data.locked > 0n && <Lock className="w-3.5 h-3.5" aria-hidden />}{formatZl(me.data.locked)}</span>}
          hint="securing loans until they are repaid"
          tone={me.data.locked > 0n ? "amber" : "slate"}
        />
        <Stat label="Free (you can withdraw)" value={formatZl(free)} tone="emerald" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="dep">Deposit into the fund (PLN)</Label>
          <div className="flex gap-2">
            <Input id="dep" inputMode="decimal" value={depositAmount} onChange={(e) => setDepositAmount(e.target.value)} />
            <Button onClick={deposit} disabled={!!busy}>Deposit</Button>
          </div>
        </div>
        <div>
          <Label htmlFor="wd">Withdraw free money (PLN)</Label>
          <div className="flex gap-2">
            <Input id="wd" inputMode="decimal" placeholder={formatZl(free, false)} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
            <Button variant="ghost" onClick={withdraw} disabled={!!busy || free === 0n}>Withdraw</Button>
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
    await run(value > 0n ? `Standing contribution ${formatZl(value)} every ${formatDuration(kasa.data.periodSecs)}` : "Turning off the contribution", () =>
      client.sendTransaction(ixs)
    );
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1 flex items-center gap-1.5">
        <Repeat className="w-4 h-4 text-emerald-600" aria-hidden /> Automatic payments
      </h2>
      <p className="text-[11px] text-slate-600 mb-1">
        Approve once and stop worrying about due dates: every period the program moves your standing contribution from your wallet
        into the fund, and on the due date – your loan installment. It takes only what is due. You can turn it off with one click.
      </p>
      <details className="text-[11px] text-slate-500 mb-3">
        <summary className="cursor-pointer">How does it work technically?</summary>
        <p className="mt-1">
          It is a standard capped allowance (SPL <code>approve</code>) for your account in this fund. The program can use it to take only
          an installment or contribution that is due, and only from your wallet. Transactions are sent by a bot that has no special
          permissions – it only pays the network fee. If you turn the allowance off, installments are still secured by your locked savings.
        </p>
      </details>
      <div className="flex flex-wrap gap-2 mb-3 text-[11px]">
        {mine ? (
          <span className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
            On · limit {formatZl(walletToken!.delegatedAmount)}
          </span>
        ) : (
          <span className="px-2 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-600">Off in this fund</span>
        )}
        {me.data.contribution > 0n && (
          <span className="px-2 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-800">
            Standing contribution {formatZl(me.data.contribution)} every {formatDuration(kasa.data.periodSecs)} ·{" "}
            {next > now ? `next in ${formatDuration(next - now)}` : mine ? "now – the bot is collecting it" : "waiting for automatic payments to be turned on"}
          </span>
        )}
      </div>
      {elsewhere && (
        <p className="text-[11px] text-amber-800 mb-2">
          You have automatic payments turned on in another fund. They can only be on in one fund at a time – a new approval will replace that one.
        </p>
      )}
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor="contrib">Standing contribution per period (PLN)</Label>
          <Input id="contrib" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-28" />
        </div>
        <Button onClick={save} disabled={!!busy}>
          {me.data.contribution > 0n ? "Change contribution" : "Turn on standing contribution"}
        </Button>
        {me.data.contribution > 0n && (
          <Button
            variant="ghost"
            disabled={!!busy}
            onClick={async () => {
              const ix = await setContributionIx(client.identity, kasa.address, 0n);
              await run("Turning off the contribution", () => client.sendTransaction([ix]));
            }}
          >
            Turn off contribution
          </Button>
        )}
        {mine && (
          <Button
            variant="danger"
            disabled={!!busy}
            onClick={async () => {
              const ix = await revokeMandateIx(client.identity, kasa.data.mint);
              await run("Turning off automatic payments", () => client.sendTransaction([ix]));
            }}
          >
            Turn off automatic payments
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
    if (parsed === null || parsed <= 0n) return setError("Enter the loan amount.");
    if (parsed > limit) return setError(`The limit in this fund is ${formatZl(limit)} (${kasa.data.loanMultiplierBps / 10_000}× your savings).`);
    const ix = await requestLoanIx(client.identity, kasa.address, me.data.loanCount, parsed, Number(installments));
    await run(`Loan request ${formatZl(parsed)}`, () => client.sendTransaction([ix]));
    setAmount("");
  }

  return (
    <Card>
      <h2 className="font-bold text-slate-900 text-sm mb-1">Request a loan</h2>
      <p className="text-[11px] text-slate-500 mb-3">
        You can borrow up to <strong>{formatZl(limit)}</strong>, interest-free. Nobody approves it. Your savings will be locked
        until the loan is repaid, and other members have to guarantee the rest.
      </p>
      <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div>
          <Label htmlFor="loan-amount">Amount (PLN)</Label>
          <Input id="loan-amount" inputMode="decimal" placeholder={formatZl(limit, false)} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="loan-inst">Number of installments</Label>
          <Select id="loan-inst" value={installments} onChange={(e) => setInstallments(e.target.value)}>
            {Array.from({ length: kasa.data.maxInstallments }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} × every {formatDuration(kasa.data.periodSecs)}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit" disabled={!!busy || limit === 0n}>
          Request a loan
        </Button>
      </form>
      {parsed !== null && parsed > 0n && (
        <div className="flex flex-wrap gap-2 mt-3">
          <Badge tone="emerald">You lock your own: {formatZl(own)}</Badge>
          <Badge tone={fromGuarantors > 0n ? "sky" : "emerald"}>
            {fromGuarantors > 0n ? `Others must guarantee: ${formatZl(fromGuarantors)}` : "No guarantees needed – paid out right away"}
          </Badge>
        </div>
      )}
      {limit === 0n && <p className="text-[11px] text-slate-500 mt-2">Save something first – you can borrow several times what you have in the fund.</p>}
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
