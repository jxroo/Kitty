"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Bot, ScrollText } from "lucide-react";
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
      return "Założenie kasy";
    case ActivityKind.Joined:
      return "Dołączenie do kasy";
    case ActivityKind.Deposited:
      return "Wpłata";
    case ActivityKind.Withdrew:
      return "Wypłata oszczędności";
    case ActivityKind.LoanRequested:
      return "Prośba o pożyczkę";
    case ActivityKind.Guaranteed:
      return "Poręczenie za pożyczkę";
    case ActivityKind.GuaranteeWithdrawn:
      return "Wycofanie poręczenia";
    case ActivityKind.LoanCancelled:
      return "Rezygnacja z pożyczki";
    case ActivityKind.Disbursed:
      return "Wypłata pożyczki";
    case ActivityKind.Repaid:
      return "Spłata raty";
    case ActivityKind.InstallmentPulled:
      return "Rata pobrana automatycznie z portfela";
    case ActivityKind.OverdueCollected:
      return "Niezapłacona rata pokryta z zablokowanych oszczędności";
    case ActivityKind.LoanClosed:
      return "Pożyczka spłacona w całości";
    case ActivityKind.ContributionSet:
      return row.amount > 0n ? "Włączenie stałej składki" : "Wyłączenie stałej składki";
    case ActivityKind.ContributionPulled:
      return "Składka pobrana automatycznie z portfela";
  }
}

type Filter = "money" | "in" | "all";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "money", label: "Ruchy pieniędzy" },
  { id: "in", label: "Tylko wpływy" },
  { id: "all", label: "Wszystko" },
];

function when(blockTime: number | null) {
  if (blockTime === null) return "–";
  const d = new Date(blockTime * 1000);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? d.toLocaleTimeString("pl-PL") : d.toLocaleString("pl-PL", { dateStyle: "short", timeStyle: "medium" });
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

  const who = (address: string) => names.get(address) ?? `spoza kasy (${shortAddress(address)})`;
  const sender = (address: string) =>
    address === BOT_ADDRESS ? (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Bot className="w-3.5 h-3.5" aria-hidden /> automat
      </span>
    ) : (
      who(address)
    );
  const last = rows && rows.length > 0 ? rows[rows.length - 1].balance : 0n;
  const matches = complete && vault !== null && last === vault;

  return (
    <section aria-label="Historia kasy">
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <h2 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
            <ScrollText className="w-4 h-4 text-emerald-600" aria-hidden /> Historia kasy
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Każdy grosz, który wszedł do kasy albo z niej wyszedł. Lista pochodzi prosto z łańcucha: nikt nie może jej poprawić ani
            niczego z niej usunąć.
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label="Filtr historii">
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
            Wpłynęło: <strong className="text-emerald-700">{formatZl(totals.inflow)}</strong>
          </span>
          <span>
            Wypłynęło: <strong className="text-rose-700">{formatZl(totals.outflow)}</strong>
          </span>
          <span>
            Jest w kasie: <strong>{vault === null ? "…" : formatZl(vault)}</strong>{" "}
            {matches ? (
              <span className="text-emerald-700">✓ zgadza się z historią</span>
            ) : complete ? (
              <span className="text-slate-500">(odświeżam…)</span>
            ) : null}
          </span>
        </div>
      )}

      {error && <p className="text-xs text-rose-600">Nie udało się wczytać historii: {error}</p>}
      {!rows && !error && <p className="text-xs text-slate-500">Czytam historię z łańcucha…</p>}
      {rows && shown.length === 0 && <p className="text-xs text-slate-500">Na razie nic tu nie ma.</p>}

      {shown.length > 0 && (
        <div className="overflow-x-auto -mx-1">
          <table className="w-full text-[11px] min-w-[560px]">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="font-medium pb-1.5 px-1">Kiedy</th>
                <th className="font-medium pb-1.5 px-1">Co się stało</th>
                <th className="font-medium pb-1.5 px-1">Kogo dotyczy</th>
                <th className="font-medium pb-1.5 px-1 text-right">Kwota</th>
                <th className="font-medium pb-1.5 px-1 text-right">W kasie potem</th>
                <th className="font-medium pb-1.5 px-1">Kto wysłał</th>
                <th className="font-medium pb-1.5 px-1">Dowód</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={`${r.signature}:${r.index}`} className="border-t border-slate-100 align-top">
                  <td className="py-1.5 px-1 text-slate-500 font-mono whitespace-nowrap">{when(r.blockTime)}</td>
                  <td className="py-1.5 px-1 text-slate-900">
                    {describe(r)}
                    {r.flow === "internal" && <div className="text-slate-500">pieniądze nie wychodzą z kasy</div>}
                  </td>
                  <td className="py-1.5 px-1 text-slate-700">{who(r.wallet)}</td>
                  <td
                    className={`py-1.5 px-1 text-right font-semibold whitespace-nowrap ${
                      r.flow === "in" ? "text-emerald-700" : r.flow === "out" ? "text-rose-700" : "text-slate-500"
                    }`}
                  >
                    {r.flow === "in" ? "+" : r.flow === "out" ? "−" : ""}
                    {r.amount > 0n ? formatZl(r.amount) : "–"}
                  </td>
                  <td className="py-1.5 px-1 text-right text-slate-900 whitespace-nowrap">{r.flow === "info" ? "" : formatZl(r.balance)}</td>
                  <td className="py-1.5 px-1 text-slate-700 whitespace-nowrap">{sender(r.sender)}</td>
                  <td className="py-1.5 px-1">
                    <TxLink signature={r.signature} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!complete && (
        <p className="text-[11px] text-slate-500 mt-2">
          Pokazuję ostatnie {HISTORY_LIMIT} transakcji; starsze są w eksploratorze przy koncie kasy.
        </p>
      )}
    </Card>
    </section>
  );
}
