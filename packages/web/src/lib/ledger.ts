// A kasa's history, read from the chain: every instruction of the program emits an
// `Activity` event into the transaction logs, so the transactions that touch the kasa
// account are the full, public record of what happened to its money. No database.
import {
  getBase64Encoder,
  type Address,
  type Rpc,
  type Signature,
  type SolanaRpcApi,
} from "@solana/kit";
import { ACTIVITY_EVENT_DISCRIMINATOR, ActivityKind, getActivityEventDecoder, type ActivityEvent } from "../generated";

export type KasaEvent = Omit<ActivityEvent, "kasa"> & {
  signature: string;
  slot: bigint;
  /** Position of the event among the transaction's events. */
  index: number;
  blockTime: number | null;
  /** Who sent (and paid for) the transaction: a member, the bot, anyone. */
  sender: string;
};

/** in: money entered the vault; out: it left; internal: collateral changed hands inside the vault; info: no money moved. */
export type Flow = "in" | "out" | "internal" | "info";

export type LedgerRow = KasaEvent & {
  flow: Flow;
  /** Change of the vault's balance. */
  delta: bigint;
  /** Vault balance after this event, counted from the kasa's creation. */
  balance: bigint;
};

const PREFIX = "Program data: ";

/** The program's events in the order they were logged; other log lines are ignored. */
export function parseActivityLogs(logs: readonly string[]): ActivityEvent[] {
  const decoder = getActivityEventDecoder();
  const base64 = getBase64Encoder();
  const events: ActivityEvent[] = [];
  for (const line of logs) {
    if (!line.startsWith(PREFIX)) continue;
    let bytes: Uint8Array;
    try {
      bytes = new Uint8Array(base64.encode(line.slice(PREFIX.length)));
    } catch {
      continue;
    }
    if (!ACTIVITY_EVENT_DISCRIMINATOR.every((b, i) => bytes[i] === b)) continue;
    try {
      events.push(decoder.decode(bytes));
    } catch {
      // Same discriminator but another layout: not ours to read.
    }
  }
  return events;
}

/** How an event changes the vault's token balance. Mirrors the program's transfers. */
export function vaultFlow(kind: ActivityKind, amount: bigint): { flow: Flow; delta: bigint } {
  switch (kind) {
    case ActivityKind.Deposited:
    case ActivityKind.ContributionPulled:
    case ActivityKind.Repaid:
    case ActivityKind.InstallmentPulled:
      return { flow: "in", delta: amount };
    case ActivityKind.Withdrew:
    case ActivityKind.Disbursed:
      return { flow: "out", delta: -amount };
    case ActivityKind.OverdueCollected:
      return { flow: "internal", delta: 0n };
    default:
      return { flow: "info", delta: 0n };
  }
}

/** Oldest first, with the vault balance after every event (the vault starts at 0 when the kasa is created). */
export function buildLedger(events: KasaEvent[]): LedgerRow[] {
  const sorted = [...events].sort((a, b) => (a.slot === b.slot ? a.index - b.index : a.slot < b.slot ? -1 : 1));
  let balance = 0n;
  return sorted.map((e) => {
    const { flow, delta } = vaultFlow(e.kind, e.amount);
    balance += delta;
    return { ...e, flow, delta, balance };
  });
}

/** Most recent transactions read per kasa. A kasa with more has its oldest ones cut off (the UI says so). */
export const HISTORY_LIMIT = 300;

// Transactions never change once confirmed, so each is fetched once per page load.
const cache = new Map<string, KasaEvent[]>();

/** Every Activity event of this kasa, from the transactions that reference its account. */
export async function fetchKasaEvents(
  rpc: Rpc<SolanaRpcApi>,
  kasa: Address
): Promise<{ events: KasaEvent[]; complete: boolean }> {
  const signatures = await rpc.getSignaturesForAddress(kasa, { limit: HISTORY_LIMIT, commitment: "confirmed" }).send();
  const ok = signatures.filter((s) => s.err === null);
  const missing = ok.filter((s) => !cache.has(s.signature));
  for (let i = 0; i < missing.length; i += 4) {
    await Promise.all(
      missing.slice(i, i + 4).map(async ({ signature, slot, blockTime }) => {
        const tx = await rpc
          .getTransaction(signature as Signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "json" })
          .send();
        if (!tx) return; // not yet visible to this RPC node; picked up on the next refresh
        const sender = String(tx.transaction.message.accountKeys[0]);
        const events = parseActivityLogs(tx.meta?.logMessages ?? [])
          .filter((e) => e.kasa === kasa)
          .map(({ kasa: _kasa, ...e }, index) => ({
            ...e,
            signature,
            slot: BigInt(slot),
            index,
            blockTime: blockTime === null ? null : Number(blockTime),
            sender,
          }));
        cache.set(signature, events);
      })
    );
  }
  const events = ok.flatMap((s) => cache.get(s.signature) ?? []);
  return { events, complete: signatures.length < HISTORY_LIMIT };
}
