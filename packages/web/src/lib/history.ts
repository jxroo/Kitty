// Public credit history and network totals, computed only from program accounts.
// This replaces a credit bureau (BIK) as a source of information, not as a decision:
// the program does not use it; a guarantor reads it before choosing to vouch.
// Loan accounts are never closed, so every loan ever taken stays on the chain.
import type { Address } from "@solana/kit";
import { LoanStatus } from "../generated";
import type { ChainState } from "./chain";

export type CreditHistory = {
  /** Kasas this wallet is a member of. */
  kasas: number;
  savings: bigint;
  standingOrders: number;
  /** Loans fully paid back with no collateral used. */
  repaidClean: number;
  /** Loans settled with part of the money taken from collateral. */
  repaidWithCollection: number;
  active: number;
  /** Sum of loans that were paid out (cancelled requests excluded). */
  borrowed: bigint;
  /** Paid by direct debit from the wallet. */
  autopaid: bigint;
  /** The borrower's own savings used to cover their overdue installments. */
  ownSavingsSeized: bigint;
  /** What guarantors lost vouching for this borrower. */
  guarantorsLost: bigint;
  /** Loans this wallet currently or ever guaranteed (pledges withdrawn before payout are gone). */
  guarantees: number;
  /** What this wallet lost as a guarantor. */
  guaranteeLosses: bigint;
};

export function creditHistory(chain: ChainState, wallet: Address): CreditHistory {
  const memberships = chain.members.filter((m) => m.data.wallet === wallet);
  const h: CreditHistory = {
    kasas: memberships.length,
    savings: memberships.reduce((sum, m) => sum + m.data.savings, 0n),
    standingOrders: memberships.filter((m) => m.data.contribution > 0n).length,
    repaidClean: 0,
    repaidWithCollection: 0,
    active: 0,
    borrowed: 0n,
    autopaid: 0n,
    ownSavingsSeized: 0n,
    guarantorsLost: 0n,
    guarantees: 0,
    guaranteeLosses: 0n,
  };
  for (const { data: loan } of chain.loans) {
    const pledges = loan.guarantors.slice(0, loan.guarantorCount);
    if (loan.borrower === wallet) {
      if (loan.status === LoanStatus.Repaid) {
        if (loan.seized > 0n) h.repaidWithCollection += 1;
        else h.repaidClean += 1;
      }
      if (loan.status === LoanStatus.Active) h.active += 1;
      if (loan.status === LoanStatus.Active || loan.status === LoanStatus.Repaid) h.borrowed += loan.amount;
      h.autopaid += loan.autopaid;
      h.ownSavingsSeized += loan.ownSeized;
      h.guarantorsLost += pledges.reduce((sum, p) => sum + p.seized, 0n);
    }
    const mine = pledges.find((p) => p.wallet === wallet);
    if (mine && loan.status !== LoanStatus.Cancelled) {
      h.guarantees += 1;
      h.guaranteeLosses += mine.seized;
    }
  }
  return h;
}

export type NetworkStats = {
  kasas: number;
  /** Distinct wallets across all kasas. */
  people: number;
  savings: bigint;
  /** Outstanding on paid-out loans right now. */
  lent: bigint;
  activeLoans: number;
  settledLoans: number;
  collectedFromCollateral: bigint;
  autopaid: bigint;
  standingOrders: number;
};

export function networkStats(chain: ChainState): NetworkStats {
  const loans = chain.loans.map((l) => l.data);
  return {
    kasas: chain.kasas.length,
    people: new Set(chain.members.map((m) => m.data.wallet)).size,
    savings: chain.kasas.reduce((sum, k) => sum + k.data.totalSavings, 0n),
    lent: chain.kasas.reduce((sum, k) => sum + k.data.totalOutstanding, 0n),
    activeLoans: loans.filter((l) => l.status === LoanStatus.Active).length,
    settledLoans: loans.filter((l) => l.status === LoanStatus.Repaid).length,
    collectedFromCollateral: loans.reduce((sum, l) => sum + l.seized, 0n),
    autopaid: loans.reduce((sum, l) => sum + l.autopaid, 0n),
    standingOrders: chain.members.filter((m) => m.data.contribution > 0n).length,
  };
}
