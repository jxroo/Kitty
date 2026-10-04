"use client";

import React from "react";
import type { Address } from "@solana/kit";
import { History as HistoryIcon, Network } from "lucide-react";
import { creditHistory, networkStats } from "@/lib/history";
import { formatZl, plural } from "@/lib/kasa";
import { useKasa } from "./KasaProvider";
import { Card, Stat } from "./ui";

/**
 * A borrower's record across every kasa, read from loan accounts on the chain:
 * what a guarantor would otherwise ask a credit bureau (BIK) for.
 */
export function CreditHistoryLine({ wallet, name }: { wallet: Address; name: string }) {
  const { chain } = useKasa();
  const h = creditHistory(chain, wallet);
  const loans = h.repaidClean + h.repaidWithCollection + h.active;
  return (
    <div className="text-[11px] text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 flex items-start gap-1.5">
      <HistoryIcon className="w-3.5 h-3.5 shrink-0 mt-px text-slate-500" aria-hidden />
      <span>
        <strong>How {name} repays loans</strong> (across all funds, public data – instead of a credit bureau):{" "}
        {loans === 0 ? (
          "no loans yet."
        ) : (
          <>
            repaid on time: {h.repaidClean}
            {h.repaidWithCollection > 0 && (
              <span className="text-rose-700">
                , with missed installments: {h.repaidWithCollection}
                {h.guarantorsLost > 0n && ` (guarantors lost ${formatZl(h.guarantorsLost)})`}
              </span>
            )}
            {h.active > 0 && `, being repaid: ${h.active}`}.
          </>
        )}
        {h.guarantees > 0 && ` Guarantees for others: ${h.guarantees}.`}
      </span>
    </div>
  );
}

/** Totals across every kasa of the program: the scale is a network, not one group. */
export function NetworkCard() {
  const { chain, loading } = useKasa();
  if (loading) return null;
  const s = networkStats(chain);
  return (
    <Card>
      <h2 className="kicker font-semibold text-[11px] mb-3 flex items-center gap-1.5">
        <Network className="w-4 h-4 text-emerald-600" aria-hidden /> All funds combined
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Funds" value={s.kasas} hint={`${s.people} ${plural(s.people, "person", "people")}`} />
        <Stat label="Saved" value={formatZl(s.savings)} hint="in program accounts" tone="emerald" />
        <Stat label="Lent right now" value={formatZl(s.lent)} hint={`${s.activeLoans} being repaid, ${s.settledLoans} repaid`} />
        <Stat
          label="Paid automatically"
          value={formatZl(s.autopaid)}
          hint={`${s.standingOrders} ${plural(s.standingOrders, "standing contribution", "standing contributions")} · ${formatZl(s.collectedFromCollateral)} covered from savings`}
        />
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Computed live from data on Solana – there is no server or accountant keeping these books. Interest and fees:
        0 PLN.
      </p>
    </Card>
  );
}
