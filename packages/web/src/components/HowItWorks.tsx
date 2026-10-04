"use client";

import React from "react";
import { ExternalLink } from "lucide-react";
import { PROGRAM_ID, REPO_URL } from "@/lib/kasa";
import { AddressLink, Card } from "./ui";

const SRC = `${REPO_URL}/blob/HEAD/packages/contracts/programs/kasa/src`;
const WEB = `${REPO_URL}/blob/HEAD/packages/web`;

function Code({ path, line, children, web = false }: { path: string; line: number; children: React.ReactNode; web?: boolean }) {
  return (
    <a href={`${web ? WEB : SRC}/${path}#L${line}`} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-sky-700 hover:underline inline-flex items-center gap-0.5">
      {children}
      <ExternalLink className="w-2.5 h-2.5" aria-hidden />
    </a>
  );
}

const ROLES: { today: string; now: React.ReactNode; code: React.ReactNode }[] = [
  {
    today: "A treasurer keeps the money in the fund's account (or their own private one)",
    now: "The vault is an account owned by the program. Only the code can pay out of it, by the rules.",
    code: <Code path="vault.rs" line={35}>vault.rs: pay_out</Code>,
  },
  {
    today: "A board (or a bank) decides who gets a loan",
    now: "Nobody approves. The loan pays out once locked savings (own + guarantees) cover 100% of the amount.",
    code: <Code path="instructions/loan.rs" line={248}>loan.rs: disburse</Code>,
  },
  {
    today: "The employer deducts installments from wages; a bank runs the direct debit",
    now: (
      <>
        The borrower gives an SPL approval to their own account in the fund. On the due date anyone (in practice, a bot) can take from their wallet{" "}
        <strong>only the installment that is due</strong>, only from their account and only within the approved limit. One click revokes it.
      </>
    ),
    code: (
      <span className="flex flex-col gap-0.5">
        <Code path="instructions/autopay.rs" line={57}>autopay.rs: pull_installment</Code>
        <Code path="vault.rs" line={64}>vault.rs: mandate_available</Code>
      </span>
    ),
  },
  {
    today: "A debt collection agency chases debtors",
    now: "No approval or no money in the wallet? After the due date and grace period anyone can trigger collection: the installment comes out of the collateral, with nobody's permission.",
    code: <Code path="instructions/repay.rs" line={96}>repay.rs: collect_overdue</Code>,
  },
  {
    today: "A bank runs a standing savings order",
    now: "Standing contribution: once per period anyone (the bot) can move the agreed amount from a member's wallet into their savings, within the approved limit.",
    code: <Code path="instructions/autopay.rs" line={142}>autopay.rs: pull_contribution</Code>,
  },
  {
    today: "A credit bureau says whether someone repays their debts",
    now: "Every borrower's history lives in loan accounts on the chain, across the whole network of funds. A guarantor sees it before guaranteeing. It is information, not a rule: the program does not use it.",
    code: (
      <Code path="src/lib/history.ts" line={33} web>
        history.ts: creditHistory
      </Code>
    ),
  },
  {
    today: "Savings are returned when the board decides (usually when you leave the job)",
    now: "You withdraw your free savings yourself, whenever you want. The fund is always solvent.",
    code: <Code path="instructions/member.rs" line={127}>member.rs: withdraw</Code>,
  },
  {
    today: "The general meeting or the board can change the rules",
    now: "The rules are written when the fund is created. There is no instruction that changes them and no admin key.",
    code: <Code path="instructions/create_kasa.rs" line={40}>create_kasa.rs</Code>,
  },
];

const SIMPLE: { today: string; here: string }[] = [
  { today: "A treasurer holds the fund's money (sometimes in their own private account)", here: "The money sits in a program account. Nobody can take it for themselves." },
  { today: "A board or a bank decides who gets a loan", here: "Nobody decides. The loan pays out when your savings and others' guarantees cover the full amount." },
  { today: "The employer deducts installments from wages, a bank runs the direct debit", here: "On the due date the installment leaves the borrower's wallet by itself – exactly as much as is due." },
  { today: "Debt collectors chase those who don't pay", here: "An unpaid installment is covered from locked savings. Nobody has to be chased." },
  { today: "A bank runs a standing savings order", here: "The standing contribution moves from your wallet into the fund every period, by itself." },
  { today: "A credit bureau says whether someone repays their debts", here: "Everyone's repayment history is public. Before you guarantee, you see it in the app." },
  { today: "Getting your savings back waits on the board's approval", here: "You take out your free money whenever you want, without asking anyone." },
];

export function HowItWorks() {
  return (
    <div className="space-y-5 max-w-4xl">
      <Card>
        <h2 className="font-bold text-slate-900 text-lg mb-3">How it works – in 5 sentences</h2>
        <ol className="space-y-2.5 text-sm text-slate-800 leading-relaxed list-decimal list-inside marker:font-bold marker:text-emerald-600">
          <li>A group of people saves money in a shared fund. It sits in a program account, not with a treasurer or a bank.</li>
          <li>
            Anyone can borrow several times what they have saved – interest-free and without anyone's approval. The condition: their
            savings and other members' guarantees must cover the whole loan.
          </li>
          <li>Installments and contributions can pay themselves: on the due date the program takes exactly what is due from the wallet.</li>
          <li>
            Whoever misses an installment loses their locked savings; if that's not enough, the people who guaranteed for them lose theirs.
            The fund never loses, and everyone else's money is safe.
          </li>
          <li>Nobody can change the rules: not the founder, not the members, and not us – the authors.</li>
        </ol>
      </Card>

      <Card>
        <h2 className="kicker font-semibold text-[11px] mb-3">Exactly where the middleman disappears</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="font-medium pb-2 pr-3 w-1/2">Today</th>
                <th className="font-medium pb-2">In Kitty</th>
              </tr>
            </thead>
            <tbody>
              {SIMPLE.map((r) => (
                <tr key={r.today} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-3 text-slate-600">{r.today}</td>
                  <td className="py-2 text-slate-900 font-medium">{r.here}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-900 text-sm mb-2">Why the fund never loses</h2>
          <ul className="text-xs text-emerald-900 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>A loan pays out only when locked savings cover it in full.</li>
            <li>Every repaid installment unlocks the same amount – guarantors first.</li>
            <li>An unpaid installment is taken from locked savings: the borrower's first, then the guarantors'.</li>
            <li>That's why all the members' free money is always in the fund – anyone can take theirs out at any moment.</li>
            <li>Only those who chose to guarantee take a risk – and at most as much as they guaranteed.</li>
          </ul>
        </Card>
        <Card>
          <h2 className="font-bold text-slate-900 text-sm mb-2">What if someone disappears?</h2>
          <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside leading-relaxed">
            <li>
              <strong>The borrower stops paying:</strong> the installments still come back to the fund – from their locked savings, then from
              the guarantees.
            </li>
            <li>
              <strong>A guarantor disappears:</strong> they don't need to do anything. Their money unlocks by itself once the loan is repaid.
            </li>
            <li>
              <strong>The bot stops working:</strong> nothing breaks. It has no special permissions – the same buttons are in the app
              for everyone.
            </li>
            <li>
              <strong>The founder, we or this website disappear:</strong> the money and the rules are on Solana. The fund keeps working.
            </li>
          </ul>
        </Card>
      </div>

      <Card>
        <h2 className="font-bold text-slate-900 text-sm mb-2">Why not a regular app with a database?</h2>
        <p className="text-xs text-slate-700 leading-relaxed">
          Because then whoever runs the database becomes the middleman: they can change someone's balance, block a withdrawal or “borrow”
          from the fund for themselves – exactly how money used to vanish from workplace savings and loan funds. Here the money sits in a
          program account, the rules are public code nobody can get around, and everyone sees every operation in the fund's history.
        </p>
      </Card>

      <details className="group bg-panel/80 border border-slate-200 rounded-2xl shadow-sm">
        <summary className="cursor-pointer px-4 py-3 font-bold text-slate-900 text-sm">
          For the jury and developers: where it is in the code, who can do what, and what you still have to trust us on
        </summary>
        <div className="px-4 pb-4 space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="font-medium pb-2 pr-3">Today</th>
                  <th className="font-medium pb-2 pr-3">Program rule</th>
                  <th className="font-medium pb-2">Code</th>
                </tr>
              </thead>
              <tbody>
                {ROLES.map((r) => (
                  <tr key={r.today} className="border-t border-slate-100 align-top">
                    <td className="py-2 pr-3 text-slate-600">{r.today}</td>
                    <td className="py-2 pr-3 text-slate-900">{r.now}</td>
                    <td className="py-2">{r.code}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="font-bold text-slate-900 text-sm mb-1">Who can do what</h3>
            <table className="w-full text-xs">
              <tbody className="[&_td]:py-1.5 [&_tr]:border-t [&_tr]:border-slate-100">
                <tr><td className="text-slate-600 pr-3">Create a fund and set its rules</td><td className="text-slate-900">Anyone, once. After that the founder is an ordinary member.</td></tr>
                <tr><td className="text-slate-600 pr-3">Join, deposit, withdraw free savings</td><td className="text-slate-900">Every member, for themselves</td></tr>
                <tr><td className="text-slate-600 pr-3">Request a loan / guarantee one</td><td className="text-slate-900">Members, within the fund's limits (not for themselves)</td></tr>
                <tr><td className="text-slate-600 pr-3">Pay out a loan / cancel it</td><td className="text-slate-900">Only the borrower</td></tr>
                <tr><td className="text-slate-600 pr-3">Turn automatic payments on or off</td><td className="text-slate-900">Only the wallet owner (standard SPL approve / revoke)</td></tr>
                <tr><td className="text-slate-600 pr-3">Collect an installment or contribution automatically</td><td className="text-slate-900">Anyone (e.g. the bot): only the amount due, only from that person's wallet, within their approved limit</td></tr>
                <tr><td className="text-slate-600 pr-3">Repay, cover an overdue installment from savings</td><td className="text-slate-900">Anyone (overdue: after the grace period)</td></tr>
                <tr><td className="text-slate-600 pr-3">Change the rules, freeze or move someone else's funds</td><td className="text-slate-900 font-semibold">No instruction allows it, not even for us</td></tr>
              </tbody>
            </table>
          </div>

          <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2">
            To be fair: on devnet the program code can still be updated by the authors' key (upgrade authority). We keep it for the
            hackathon so we can fix bugs. Before any real money, it will go to a multisig of member representatives or be
            removed forever.
          </p>
          <p className="text-[11px] text-slate-600 leading-relaxed">
            A bank direct debit needs a bank that both sides trust. Here the SPL Token program enforces the approved limit, our program
            enforces the amount and due date, and the bot that sends the transaction can only do what anyone is allowed to do anyway.
          </p>
          <p className="text-[11px] text-slate-500">
            Program: <AddressLink address={PROGRAM_ID} /> ·{" "}
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
              source code
            </a>
          </p>
        </div>
      </details>
    </div>
  );
}
