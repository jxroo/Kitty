import { test } from "node:test";
import assert from "node:assert/strict";
import type { Address } from "@solana/kit";
import { LoanStatus, type Kasa, type Loan, type Member } from "../src/generated";
import type { ChainState } from "../src/lib/chain";
import { creditHistory, networkStats } from "../src/lib/history";

const A = (s: string) => s.padEnd(44, "1") as Address;
const [K1, K2, BARTEK, ANNA, CELINA] = [A("K1"), A("K2"), A("Bartek"), A("Anna"), A("Celina")];

function kasa(address: Address, over: Partial<Kasa> = {}) {
  return { address, data: { totalSavings: 0n, totalOutstanding: 0n, memberCount: 0, ...over } as Kasa };
}
function member(kasaAddr: Address, wallet: Address, over: Partial<Member> = {}) {
  return {
    address: A(`m${kasaAddr}${wallet}`.slice(0, 20)),
    data: { kasa: kasaAddr, wallet, savings: 0n, locked: 0n, totalDeposited: 0n, totalSeized: 0n, contribution: 0n, ...over } as Member,
  };
}
let n = 0;
function loan(kasaAddr: Address, borrower: Address, over: Partial<Loan> = {}) {
  n += 1;
  return {
    address: A(`loan${n}`),
    data: {
      kasa: kasaAddr,
      borrower,
      amount: 100_000n,
      status: LoanStatus.Repaid,
      repaid: 100_000n,
      seized: 0n,
      autopaid: 0n,
      ownSeized: 0n,
      guarantorCount: 0,
      guarantors: [],
      ...over,
    } as unknown as Loan,
  };
}
const pledge = (wallet: Address, amount: bigint, seized: bigint) => ({ wallet, amount, seized });

const chain: ChainState = {
  kasas: [kasa(K1, { totalSavings: 300_000n, totalOutstanding: 100_000n, memberCount: 3 }), kasa(K2, { totalSavings: 50_000n, memberCount: 1 })],
  members: [
    member(K1, BARTEK, { savings: 20_000n, totalSeized: 30_000n }),
    member(K1, ANNA, { savings: 200_000n, totalSeized: 15_000n, contribution: 10_000n }),
    member(K1, CELINA, { savings: 80_000n }),
    member(K2, BARTEK, { savings: 50_000n }),
  ],
  loans: [
    // Bartek: one clean loan paid by direct debit, one where collateral was used (guarantors lost 20 000).
    loan(K2, BARTEK, { autopaid: 100_000n }),
    loan(K1, BARTEK, {
      repaid: 50_000n,
      seized: 50_000n,
      ownSeized: 30_000n,
      guarantorCount: 2,
      guarantors: [pledge(ANNA, 0n, 15_000n), pledge(CELINA, 0n, 5_000n)],
    }),
    // Bartek: one running, one cancelled.
    loan(K1, BARTEK, { status: LoanStatus.Active, repaid: 0n, guarantorCount: 1, guarantors: [pledge(ANNA, 40_000n, 0n)] }),
    loan(K1, BARTEK, { status: LoanStatus.Cancelled, repaid: 0n }),
  ],
};

test("credit history of a borrower is computed from on-chain loans in every kasa", () => {
  const h = creditHistory(chain, BARTEK);
  assert.equal(h.kasas, 2);
  assert.equal(h.savings, 70_000n);
  assert.equal(h.repaidClean, 1);
  assert.equal(h.repaidWithCollection, 1);
  assert.equal(h.active, 1);
  assert.equal(h.borrowed, 300_000n, "cancelled requests are not borrowing");
  assert.equal(h.autopaid, 100_000n);
  assert.equal(h.ownSavingsSeized, 30_000n);
  assert.equal(h.guarantorsLost, 20_000n, "what others lost vouching for this borrower");
});

test("credit history of a guarantor counts pledges and what they lost", () => {
  const h = creditHistory(chain, ANNA);
  assert.equal(h.guarantees, 2);
  assert.equal(h.guaranteeLosses, 15_000n);
  assert.equal(h.repaidClean + h.repaidWithCollection + h.active, 0);
  assert.equal(h.standingOrders, 1);
});

test("network stats add up every kasa on the chain", () => {
  const s = networkStats(chain);
  assert.equal(s.kasas, 2);
  assert.equal(s.people, 3, "Bartek is in two kasas but is one person");
  assert.equal(s.savings, 350_000n);
  assert.equal(s.lent, 100_000n);
  assert.equal(s.activeLoans, 1);
  assert.equal(s.settledLoans, 2);
  assert.equal(s.collectedFromCollateral, 50_000n);
  assert.equal(s.autopaid, 100_000n);
  assert.equal(s.standingOrders, 1);
});
