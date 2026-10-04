"use client";

import React from "react";
import { useKasa } from "./KasaProvider";
import { Card, TxLink } from "./ui";

export function ActivityFeed() {
  const { activity, busy } = useKasa();
  if (!busy && activity.length === 0) return null;
  return (
    <Card>
      <h3 className="kicker font-semibold text-[11px] mb-2">Twoje ostatnie operacje</h3>
      {busy && (
        <div className="text-xs text-slate-600 mb-2 animate-pulse" role="status">
          {busy}: czekam na podpis w portfelu i potwierdzenie sieci…
        </div>
      )}
      <ul className="space-y-1.5">
        {activity.map((a) => (
          <li key={a.id} className="text-xs flex flex-wrap items-center gap-2">
            <span className="text-slate-400 font-mono text-[10px]">{new Date(a.at).toLocaleTimeString("pl-PL")}</span>
            {a.signature ? (
              <>
                <span className="text-emerald-700">{a.label}</span>
                <TxLink signature={a.signature} />
              </>
            ) : (
              <span className="text-rose-600">
                {a.label}: {a.error}
              </span>
            )}
          </li>
        ))}
      </ul>
    </Card>
  );
}
