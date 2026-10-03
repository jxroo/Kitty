import { test } from "node:test";
import assert from "node:assert/strict";
import { getBase64Decoder, type Address } from "@solana/kit";
import { ActivityKind, getActivityEventEncoder } from "../src/generated";
import { buildLedger, parseActivityLogs, type KasaEvent } from "../src/lib/ledger";

const A = (s: string) => s.padEnd(44, "1") as Address;
// Real 32-byte addresses: the encoder checks them.
const KASA = "2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR" as Address;
const ANNA = "AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz" as Address;
const NONE = "11111111111111111111111111111111" as Address;

function programData(kind: ActivityKind, amount: bigint, kasa = KASA) {
  const bytes = getActivityEventEncoder().encode({ kasa, wallet: ANNA, loan: NONE, kind, amount });
  return `Program data: ${getBase64Decoder().decode(bytes)}`;
}

test("events are read from the program's log lines and nothing else", () => {
  const logs = [
    "Program 2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR invoke [1]",
    "Program log: Instruction: Deposit",
    programData(ActivityKind.Deposited, 100_000n),
    "Program data: bm90IGFuIGV2ZW50",
    programData(ActivityKind.LoanClosed, 5n),
    "Program 2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR success",
  ];
  const events = parseActivityLogs(logs);
  assert.equal(events.length, 2);
  assert.equal(events[0].kind, ActivityKind.Deposited);
  assert.equal(events[0].amount, 100_000n);
  assert.equal(events[0].kasa, KASA);
  assert.equal(events[1].kind, ActivityKind.LoanClosed);
});

let n = 0;
function ev(kind: ActivityKind, amount: bigint, slot: number, index = 0): KasaEvent {
  n += 1;
  return { signature: `sig${n}`, slot: BigInt(slot), index, blockTime: 1_000 + slot, sender: A("Anna"), wallet: A("Anna"), loan: NONE, kind, amount };
}

test("the ledger follows the vault: money in, money out, collections move nothing", () => {
  const rows = buildLedger([
    // given newest first, as the RPC returns them
    ev(ActivityKind.Withdrew, 50_000n, 9),
    ev(ActivityKind.OverdueCollected, 25_000n, 8),
    ev(ActivityKind.InstallmentPulled, 25_000n, 7),
    ev(ActivityKind.Disbursed, 100_000n, 6),
    ev(ActivityKind.Guaranteed, 30_000n, 5),
    ev(ActivityKind.ContributionPulled, 10_000n, 4),
    ev(ActivityKind.Deposited, 50_000n, 3),
    ev(ActivityKind.Joined, 0n, 2, 1),
    ev(ActivityKind.Deposited, 100_000n, 2, 2),
    ev(ActivityKind.KasaCreated, 0n, 2, 0),
  ]);
  assert.deepEqual(
    rows.map((r) => [r.kind, r.flow, r.delta, r.balance]),
    [
      [ActivityKind.KasaCreated, "info", 0n, 0n],
      [ActivityKind.Joined, "info", 0n, 0n],
      [ActivityKind.Deposited, "in", 100_000n, 100_000n],
      [ActivityKind.Deposited, "in", 50_000n, 150_000n],
      [ActivityKind.ContributionPulled, "in", 10_000n, 160_000n],
      [ActivityKind.Guaranteed, "info", 0n, 160_000n],
      [ActivityKind.Disbursed, "out", -100_000n, 60_000n],
      [ActivityKind.InstallmentPulled, "in", 25_000n, 85_000n],
      [ActivityKind.OverdueCollected, "internal", 0n, 85_000n],
      [ActivityKind.Withdrew, "out", -50_000n, 35_000n],
    ]
  );
});

test("a repayment by hand counts as money in", () => {
  const [row] = buildLedger([ev(ActivityKind.Repaid, 25_000n, 1)]);
  assert.equal(row.flow, "in");
  assert.equal(row.delta, 25_000n);
});
