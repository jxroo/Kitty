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
        <strong>Jak {name} spłaca pożyczki</strong> (we wszystkich kasach, dane publiczne – zamiast BIK):{" "}
        {loans === 0 ? (
          "jeszcze żadnej pożyczki."
        ) : (
          <>
            spłacone w terminie: {h.repaidClean}
            {h.repaidWithCollection > 0 && (
              <span className="text-rose-700">
                , z niezapłaconymi ratami: {h.repaidWithCollection}
                {h.guarantorsLost > 0n && ` (poręczający stracili ${formatZl(h.guarantorsLost)})`}
              </span>
            )}
            {h.active > 0 && `, w trakcie spłaty: ${h.active}`}.
          </>
        )}
        {h.guarantees > 0 && ` Poręczenia za innych: ${h.guarantees}.`}
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
      <h2 className="font-bold text-slate-900 text-xs uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Network className="w-4 h-4 text-emerald-600" aria-hidden /> Wszystkie kasy razem
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Kasy" value={s.kasas} hint={`${s.people} ${plural(s.people, "osoba", "osoby", "osób")}`} />
        <Stat label="Odłożone" value={formatZl(s.savings)} hint="na kontach programu" tone="emerald" />
        <Stat label="Pożyczone teraz" value={formatZl(s.lent)} hint={`${s.activeLoans} w spłacie, ${s.settledLoans} spłaconych`} />
        <Stat
          label="Raty zapłacone same"
          value={formatZl(s.autopaid)}
          hint={`${s.standingOrders} ${plural(s.standingOrders, "stała składka", "stałe składki", "stałych składek")} · ${formatZl(s.collectedFromCollateral)} pokryte z oszczędności`}
        />
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Liczone na bieżąco z danych na Solanie – nie ma żadnego serwera ani księgowego, który by je prowadził. Odsetki i prowizje:
        0 zł.
      </p>
    </Card>
  );
}
