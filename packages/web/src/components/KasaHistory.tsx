"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Bot, Check, Info, ScrollText } from "lucide-react";
import { ActivityKind, type Kasa } from "@/generated";
import { fetchTokenBalance, type WithAddress } from "@/lib/chain";
import { BOT_ADDRESS, describeError, formatZl, shortAddress } from "@/lib/kasa";
import { buildLedger, fetchKasaEvents, HISTORY_LIMIT, type LedgerRow } from "@/lib/ledger";
import { useKasa } from "./KasaProvider";
import { Card, TxLink } from "./ui";

/** What happened, in words anyone understands. */
function describe(row: LedgerRow): string {
  switch (row.kind) {
    case ActivityKind.KasaCreated:
      return "Fund created";
    case ActivityKind.Joined:
      return "Joined the fund";
    case ActivityKind.Deposited:
      return "Deposit";
    case ActivityKind.Withdrew:
      return "Savings withdrawn";
    case ActivityKind.LoanRequested:
      return "Loan requested";
    case ActivityKind.Guaranteed:
      return "Loan guaranteed";
    case ActivityKind.GuaranteeWithdrawn:
      return "Guarantee withdrawn";
    case ActivityKind.LoanCancelled:
      return "Loan cancelled";
    case ActivityKind.Disbursed:
      return "Loan paid out";
    case ActivityKind.Repaid:
      return "Installment repaid";
    case ActivityKind.InstallmentPulled:
      return "Installment collected automatically from the wallet";
    case ActivityKind.OverdueCollected:
      return "Unpaid installment covered from locked savings";
    case ActivityKind.LoanClosed:
      return "Loan fully repaid";
    case ActivityKind.ContributionSet:
      return row.amount > 0n ? "Standing contribution turned on" : "Standing contribution turned off";
    case ActivityKind.ContributionPulled:
      return "Contribution collected automatically from the wallet";
  }
}

type Filter = "money" | "in" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "money", label: "Money movements" },
  { id: "in", label: "Inflows only" },
  { id: "all", label: "Everything" },
];

const FLOW_STYLE: Record<LedgerRow["flow"], { Icon: typeof ArrowDownLeft; ring: string }> = {
  in: { Icon: ArrowDownLeft, ring: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  out: { Icon: ArrowUpRight, ring: "bg-rose-50 text-rose-700 border-rose-200" },
  internal: { Icon: ArrowLeftRight, ring: "bg-amber-50 text-amber-800 border-amber-200" },
  info: { Icon: Info, ring: "bg-slate-50 text-slate-500 border-slate-200" },
};

function when(blockTime: number | null) {
  if (blockTime === null) return "–";
  const d = new Date(blockTime * 1000);
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === new Date().toDateString()) return `today, ${time}`;
  return `${d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}, ${time}`;
}

/**
 * Every movement of the kasa's money, read from the transactions on the chain,
 * with the vault balance after each one. Anyone can check it against the vault.
 */
export function KasaHistory({ kasa, names }: { kasa: WithAddress<Kasa>; names: Map<string, string> }) {
  const { client, chain } = useKasa();
  const [rows, setRows] = useState<LedgerRow[] | null>(null);
  const [complete, setComplete] = useState(true);
  const [vault, setVault] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("money");

  useEffect(() => {
    let live = true;
    Promise.all([fetchKasaEvents(client.rpc, kasa.address), fetchTokenBalance(client.rpc, kasa.data.vault)])
      .then(([{ events, complete }, balance]) => {
        if (!live) return;
        setRows(buildLedger(events));
        setComplete(complete);
        setVault(balance);
        setError(null);
      })
      .catch((err) => live && setError(describeError(err)));
    return () => {
      live = false;
    };
  }, [client, chain, kasa.address, kasa.data.vault]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const kept = rows.filter((r) => (filter === "all" ? true : filter === "in" ? r.flow === "in" : r.flow !== "info"));
    return kept.reverse();
  }, [rows, filter]);

  const totals = useMemo(() => {
    let inflow = 0n;
    let outflow = 0n;
    for (const r of rows ?? []) {
      if (r.delta > 0n) inflow += r.delta;
      if (r.delta < 0n) outflow -= r.delta;
    }
    return { inflow, outflow };
  }, [rows]);

  const who = (address: string) => names.get(address) ?? `outside the fund (${shortAddress(address)})`;
  const sender = (address: string) =>
    address === BOT_ADDRESS ? (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Bot className="w-3.5 h-3.5" aria-hidden /> bot
      </span>
    ) : (
      who(address)
    );
  const last = rows && rows.length > 0 ? rows[rows.length - 1].balance : 0n;
  const matches = complete && vault !== null && last === vault;

  return (
    <section aria-label="Fund history">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <ScrollText className="w-4 h-4 text-emerald-600" aria-hidden /> Fund history
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Every grosz that came into the fund or left it. The list comes straight from the chain: nobody can edit it or
            remove anything from it.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="History filter">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              aria-pressed={filter === f.id}
              className={`text-[11px] px-2 py-1 rounded-md border ${
                filter === f.id ? "bg-emerald-50 text-emerald-700 border-emerald-300 shadow-glow" : "bg-transparent text-slate-600 border-slate-200 hover:border-slate-400"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {rows && (
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-700 mb-3">
          <span>
            Money in: <strong className="text-emerald-700">{formatZl(totals.inflow)}</strong>
          </span>
          <span>
            Money out: <strong className="text-rose-700">{formatZl(totals.outflow)}</strong>
          </span>
          <span>
            In the fund: <strong>{vault === null ? "…" : formatZl(vault)}</strong>{" "}
            {matches ? (
              <span className="inline-flex items-center gap-0.5 text-emerald-700">
                <Check className="w-3.5 h-3.5" aria-hidden /> matches the history
              </span>
            ) : complete ? (
              <span className="text-slate-500">(refreshing…)</span>
            ) : null}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">Couldn't load the history: {error}</p>}
      {!rows && !error && <p className="text-xs text-slate-500">Reading the history from the chain…</p>}
      {rows && shown.length === 0 && <p className="text-xs text-slate-500">Nothing here yet.</p>}

      {shown.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {shown.map((r) => {
            const { Icon, ring } = FLOW_STYLE[r.flow];
            return (
              <li key={`${r.signature}:${r.index}`} className="flex items-start gap-3 py-2.5">
                <span className={`mt-0.5 shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${ring}`}>
                  <Icon className="w-3.5 h-3.5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-slate-900">{describe(r)}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                    <span>{who(r.wallet)}</span>
                    <span aria-hidden>·</span>
                    <span>{when(r.blockTime)}</span>
                    {r.sender === BOT_ADDRESS && (
                      <>
                        <span aria-hidden>·</span>
                        {sender(r.sender)}
                      </>
                    )}
                    <span aria-hidden>·</span>
                    <TxLink signature={r.signature} />
                  </div>
                  {r.flow === "internal" && <div className="text-[11px] text-slate-500 mt-0.5">The money doesn't leave the fund.</div>}
                </div>
                <div className="text-right shrink-0">
                  {r.amount > 0n && (
                    <div
                      className={`text-sm font-bold tabular-nums whitespace-nowrap ${
                        r.flow === "in" ? "text-emerald-700" : r.flow === "out" ? "text-rose-700" : "text-slate-600"
                      }`}
                    >
                      {r.flow === "in" ? "+" : r.flow === "out" ? "−" : ""}
                      {formatZl(r.amount)}
                    </div>
                  )}
                  {r.flow !== "info" && (
                    <div className="text-[11px] text-slate-500 tabular-nums whitespace-nowrap">in the fund {formatZl(r.balance)}</div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {!complete && (
        <p className="text-[11px] text-slate-500 mt-2">
          Showing the last {HISTORY_LIMIT} transactions; older ones are in the explorer under the fund's account.
        </p>
      )}
    </Card>
    </section>
  );
}
