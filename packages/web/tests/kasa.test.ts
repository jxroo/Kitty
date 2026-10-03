import { test } from "node:test";
import assert from "node:assert/strict";
import { LoanStatus, type Loan } from "../src/generated";
import { dueBy, formatZl, mandateAvailable, maxLoan, overdueNow, owedNow, parseZl, schedule, splitProRata } from "../src/lib/kasa";

// Same cases as math::tests in programs/kasa/src/math.rs: UI previews must match the program.
test("dueBy follows the schedule and grace like the program", () => {
  assert.equal(dueBy(1000n, 4, 0, 100, 10, 109), 0n);
  assert.equal(dueBy(1000n, 4, 0, 100, 10, 110), 250n);
  assert.equal(dueBy(1000n, 4, 0, 100, 10, 310), 750n);
  assert.equal(dueBy(1000n, 4, 0, 100, 10, 10_000), 1000n);
  assert.equal(dueBy(1000n, 3, 0, 100, 0, 100), 333n);
  assert.equal(dueBy(1000n, 3, 0, 100, 0, 300), 1000n);
});

test("splitProRata is exact and capped like the program", () => {
  assert.deepEqual(splitProRata(500n, [300n, 200n, 0n]), [300n, 200n, 0n]);
  assert.deepEqual(splitProRata(250n, [300n, 200n, 0n]), [150n, 100n, 0n]);
  const s = splitProRata(7n, [3n, 3n, 3n]);
  assert.equal(s.reduce((a, b) => a + b, 0n), 7n);
  assert.ok(s.every((x) => x <= 3n));
  assert.throws(() => splitProRata(10n, [1n, 1n, 1n]));
});

test("złoty amounts parse to grosze and format back", () => {
  assert.equal(parseZl("12"), 1200n);
  assert.equal(parseZl("1 234,5"), 123450n);
  assert.equal(parseZl("0.07"), 7n);
  assert.throws(() => parseZl("1,234"));
  assert.throws(() => parseZl("-5"));
  assert.equal(formatZl(123450n), "1 234,50 zł");
  assert.equal(formatZl(100000n, false), "1 000");
});

test("loan limit is a multiple of savings", () => {
  assert.equal(maxLoan({ loanMultiplierBps: 20_000 }, 50_000n), 100_000n);
});

const kasa = { periodSecs: 100, graceSecs: 10 };
function loan(over: Partial<Loan>): Loan {
  return {
    discriminator: new Uint8Array(8),
    kasa: "11111111111111111111111111111111" as Loan["kasa"],
    borrower: "11111111111111111111111111111111" as Loan["borrower"],
    index: 0,
    amount: 100_000n,
    installments: 4,
    status: LoanStatus.Active,
    createdAt: 0n,
    disbursedAt: 1_000n,
    closedAt: 0n,
    repaid: 0n,
    seized: 0n,
    autopaid: 0n,
    ownCollateral: 50_000n,
    ownSeized: 0n,
    guarantorCount: 0,
    guarantors: [],
    bump: 0,
    ...over,
  };
}

test("overdueNow is what collect_overdue would take", () => {
  assert.equal(overdueNow(loan({}), kasa, 1_109), 0n);
  assert.equal(overdueNow(loan({}), kasa, 1_110), 25_000n);
  assert.equal(overdueNow(loan({ repaid: 25_000n }), kasa, 1_210), 25_000n);
  assert.equal(overdueNow(loan({ status: LoanStatus.Pending }), kasa, 9_999), 0n);
});

test("schedule marks paid, seized and open installments", () => {
  const rows = schedule(loan({ repaid: 25_000n, seized: 25_000n }), kasa);
  assert.deepEqual(rows.map((r) => r.state), ["paid", "seized", "open", "open"]);
  assert.equal(rows[0].dueAt, 1_100);
  assert.equal(rows[0].collectibleAt, 1_110);
  assert.equal(rows.reduce((a, r) => a + r.amount, 0n), 100_000n);
});

// Mirrors pull_installment: due from the due date itself (no grace), minus what was paid or seized.
test("owedNow is what pull_installment may take from the wallet", () => {
  assert.equal(owedNow(loan({}), kasa, 1_099), 0n);
  assert.equal(owedNow(loan({}), kasa, 1_100), 25_000n);
  assert.equal(owedNow(loan({ repaid: 25_000n }), kasa, 1_150), 0n);
  assert.equal(owedNow(loan({ repaid: 10_000n }), kasa, 1_300), 65_000n);
  assert.equal(owedNow(loan({ status: LoanStatus.Repaid }), kasa, 9_999), 0n);
});

test("mandate counts only for the member's own PDA, capped by allowance and balance", () => {
  const pda = "Memb3r11111111111111111111111111111111111111";
  const other = "0ther111111111111111111111111111111111111111";
  assert.equal(mandateAvailable({ amount: 500n, delegate: pda, delegatedAmount: 300n }, pda), 300n);
  assert.equal(mandateAvailable({ amount: 100n, delegate: pda, delegatedAmount: 300n }, pda), 100n);
  assert.equal(mandateAvailable({ amount: 500n, delegate: other, delegatedAmount: 300n }, pda), 0n);
  assert.equal(mandateAvailable({ amount: 500n, delegate: null, delegatedAmount: 0n }, pda), 0n);
  assert.equal(mandateAvailable(null, pda), 0n);
});
