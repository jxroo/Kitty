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
        <strong>{name}: historia w całej sieci kas</strong> (publiczna, z łańcucha, zamiast BIK):{" "}
        {loans === 0 ? (
          "jeszcze żadnej pożyczki."
        ) : (
          <>
            {h.repaidClean} {plural(h.repaidClean, "pożyczka spłacona", "pożyczki spłacone", "pożyczek spłaconych")} bez egzekucji
            {h.repaidWithCollection > 0 && (
              <span className="text-rose-700">
                , {h.repaidWithCollection} z egzekucją z zabezpieczeń
                {h.guarantorsLost > 0n && ` (poręczyciele stracili ${formatZl(h.guarantorsLost)})`}
              </span>
            )}
            {h.active > 0 && `, ${h.active} w spłacie`}
            {h.autopaid > 0n && `; ${formatZl(h.autopaid)} spłacone poleceniem zapłaty`}.
          </>
        )}
        {h.guarantees > 0 && ` Poręczenia dla innych: ${h.guarantees}${h.guaranteeLosses > 0n ? `, pobrano z nich ${formatZl(h.guaranteeLosses)}` : ""}.`}
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
        <Network className="w-4 h-4 text-emerald-600" aria-hidden /> Sieć kas na łańcuchu
      </h2>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label="Kasy" value={s.kasas} hint={`${s.people} ${plural(s.people, "osoba", "osoby", "osób")}`} />
        <Stat label="Oszczędności" value={formatZl(s.savings)} hint="w skarbcach programu" tone="emerald" />
        <Stat label="Pożyczone teraz" value={formatZl(s.lent)} hint={`${s.activeLoans} w spłacie, ${s.settledLoans} rozliczonych`} />
        <Stat
          label="Spłacone poleceniem zapłaty"
          value={formatZl(s.autopaid)}
          hint={`${formatZl(s.collectedFromCollateral)} z zabezpieczeń · ${s.standingOrders} ${plural(s.standingOrders, "stałe zlecenie", "stałe zlecenia", "stałych zleceń")}`}
        />
      </div>
      <p className="text-[11px] text-slate-500 mt-3">
        Każda liczba to suma kont programu: nie ma bazy danych ani serwera, który by je prowadził. Odsetki i prowizje: 0 zł.
      </p>
    </Card>
  );
}
