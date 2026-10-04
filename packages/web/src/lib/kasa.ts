// Pure helpers shared by the UI, the faucet route and scripts/e2e-devnet.ts.
// Everything that *decides* where money goes lives on-chain; this file only mirrors
// the program's arithmetic for display (limits, schedules, previews, countdowns).
import type { Address } from "@solana/kit";
import { KASA_PROGRAM_ADDRESS, LoanStatus, type Kasa, type Loan, type Member } from "../generated";

export const PROGRAM_ID = KASA_PROGRAM_ADDRESS;
export const CLUSTER = "devnet";
export const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";
/** Test złoty (tPLN), 2 decimals = grosze. Any SPL mint works; this one has a public faucet. */
export const MINT = (process.env.NEXT_PUBLIC_MINT ?? "3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG") as Address;
export const DECIMALS = 2;
export const REPO_URL = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/jxroo/kasa-bez-zarzadu";
export const DEFAULT_ADDRESS = "11111111111111111111111111111111" as Address;
/** The public bot (scripts/crank.ts): it only pays fees, the UI just labels its transactions. */
export const BOT_ADDRESS = process.env.NEXT_PUBLIC_BOT_ADDRESS ?? "AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz";
export const LAMPORTS_PER_SOL = 1_000_000_000n;
const BPS = 10_000n;

export function explorerTx(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=${CLUSTER}`;
}

export function explorerAddress(address: string) {
  return `https://explorer.solana.com/address/${address}?cluster=${CLUSTER}`;
}

/** "1234.5" / "1,234.50" / "12,5" -> grosze. Throws on anything that is not a non-negative amount. */
export function parseZl(text: string): bigint {
  let clean = text.replace(/\s/g, "");
  // A comma is a decimal separator only in "12,5" / "12,50"; otherwise it groups thousands.
  clean = clean.includes(".") || !/^\d+,\d{1,2}$/.test(clean) ? clean.replace(/,/g, "") : clean.replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) throw new Error("Invalid amount.");
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export function formatZl(grosze: bigint | number, withUnit = true): string {
  const value = BigInt(grosze);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${whole}${frac === "00" ? "" : "." + frac}${withUnit ? " PLN" : ""}`;
}

export function formatSol(lamports: bigint | number, maxDecimals = 3): string {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const frac = (value % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return `${whole}${frac ? "." + frac : ""}`;
}

export function shortAddress(address: string, chars = 4) {
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

export function mulBps(amount: bigint, bps: number): bigint {
  return (amount * BigInt(bps)) / BPS;
}

export function memberFree(member: Pick<Member, "savings" | "locked">): bigint {
  return member.savings > member.locked ? member.savings - member.locked : 0n;
}

export function maxLoan(kasa: Pick<Kasa, "loanMultiplierBps">, savings: bigint): bigint {
  return mulBps(savings, kasa.loanMultiplierBps);
}

/** Mirrors `math::due_by` in programs/kasa/src/math.rs. */
export function dueBy(
  amount: bigint,
  installments: number,
  start: number,
  periodSecs: number,
  graceSecs: number,
  now: number
): bigint {
  const elapsed = now - start - graceSecs;
  if (elapsed < 0 || installments === 0) return 0n;
  const count = Math.min(Math.floor(elapsed / periodSecs), installments);
  return (amount * BigInt(count)) / BigInt(installments);
}

export function outstanding(loan: Pick<Loan, "amount" | "repaid" | "seized">): bigint {
  const rest = loan.amount - loan.repaid - loan.seized;
  return rest > 0n ? rest : 0n;
}

export function pledged(loan: Pick<Loan, "guarantors">): bigint {
  return loan.guarantors.reduce((sum, p) => sum + p.amount, 0n);
}

export function collateral(loan: Pick<Loan, "ownCollateral" | "guarantors">): bigint {
  return loan.ownCollateral + pledged(loan);
}

/** Mirrors `Loan::overdue`: what `collect_overdue` would take right now. */
export function overdueNow(loan: Loan, kasa: Pick<Kasa, "periodSecs" | "graceSecs">, now: number): bigint {
  if (loan.status !== LoanStatus.Active) return 0n;
  const due = dueBy(loan.amount, loan.installments, Number(loan.disbursedAt), kasa.periodSecs, kasa.graceSecs, now);
  const paid = loan.repaid + loan.seized;
  return due > paid ? due - paid : 0n;
}

/** Mirrors `pull_installment`: due from the due date itself (no grace), minus what was paid or seized. */
export function owedNow(loan: Loan, kasa: Pick<Kasa, "periodSecs">, now: number): bigint {
  return overdueNow(loan, { periodSecs: kasa.periodSecs, graceSecs: 0 }, now);
}

/** A wallet's token account as far as a direct-debit mandate is concerned. */
export type WalletToken = { amount: bigint; delegate: string | null; delegatedAmount: bigint };

/** Mirrors `vault::mandate_available`: the allowance given to this member's PDA, capped by the balance. */
export function mandateAvailable(token: WalletToken | null, memberPda: string): bigint {
  if (!token || token.delegate !== memberPda) return 0n;
  return token.delegatedAmount < token.amount ? token.delegatedAmount : token.amount;
}

export type Installment = {
  k: number;
  /** Cumulative amount that must be paid by this installment. */
  cumulative: bigint;
  amount: bigint;
  dueAt: number;
  /** After this moment anyone can collect it from collateral. */
  collectibleAt: number;
  state: "paid" | "seized" | "partly" | "open";
};

export function schedule(loan: Loan, kasa: Pick<Kasa, "periodSecs" | "graceSecs">): Installment[] {
  const start = Number(loan.disbursedAt);
  const n = loan.installments;
  const out: Installment[] = [];
  let previous = 0n;
  for (let k = 1; k <= n; k++) {
    const cumulative = (loan.amount * BigInt(k)) / BigInt(n);
    const dueAt = start + k * kasa.periodSecs;
    // Repayments cover installments in order, then seizures cover the rest.
    let state: Installment["state"] = "open";
    if (loan.repaid >= cumulative) state = "paid";
    else if (loan.repaid + loan.seized >= cumulative) state = "seized";
    else if (loan.repaid + loan.seized > previous) state = "partly";
    out.push({ k, cumulative, amount: cumulative - previous, dueAt, collectibleAt: dueAt + kasa.graceSecs, state });
    previous = cumulative;
  }
  return out;
}

/** Mirrors `math::split_pro_rata`: proportional, capped by each weight, exact total. */
export function splitProRata(total: bigint, weights: bigint[]): bigint[] {
  const sum = weights.reduce((a, b) => a + b, 0n);
  if (total > sum) throw new Error("total exceeds weights");
  if (total === 0n) return weights.map(() => 0n);
  const shares = weights.map((w) => (total * w) / sum);
  let leftover = total - shares.reduce((a, b) => a + b, 0n);
  for (let i = 0; i < weights.length && leftover > 0n; i++) {
    const room = weights[i] - shares[i];
    const add = leftover < room ? leftover : room;
    shares[i] += add;
    leftover -= add;
  }
  return shares;
}

export const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  [LoanStatus.Pending]: "Awaiting guarantees",
  [LoanStatus.Active]: "Being repaid",
  [LoanStatus.Repaid]: "Repaid",
  [LoanStatus.Cancelled]: "Cancelled",
};

/** "1 installment", "2 installments". */
export function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export function randomId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new DataView(bytes.buffer).getBigUint64(0, true);
}

export function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

/** Messages for the program's custom errors (codes 6000+). */
const PROGRAM_ERRORS: Record<number, string> = {
  6000: "The fund name must be 1 to 40 bytes long.",
  6001: "The name or nickname must be 1 to 24 bytes long.",
  6002: "The loan limit must be between 1× and 5× savings.",
  6003: "This number of installments is not allowed in this fund.",
  6004: "The installment period must be between 30 seconds and 90 days.",
  6005: "The grace period is too long.",
  6006: "The amount must be greater than zero.",
  6007: "Rejected by the program: not enough free (unlocked) savings.",
  6008: "Rejected by the program: the loan exceeds this fund's limit (a multiple of your savings).",
  6009: "You already have an open loan in this fund.",
  6010: "This loan is no longer waiting for guarantees.",
  6011: "This loan is not active.",
  6012: "Rejected by the program: only the borrower can do this.",
  6013: "Rejected by the program: you cannot guarantee your own loan.",
  6014: "This loan already has the maximum of 3 guarantors.",
  6015: "The guarantee is larger than the amount still missing.",
  6016: "You are not a guarantor of this loan.",
  6017: "Rejected by the program: the loan is not yet fully covered by savings and guarantees.",
  6018: "The amount exceeds what is left to repay.",
  6019: "Rejected by the program: no installment is overdue yet (the grace period is still running).",
  6020: "The guarantor accounts do not match the loan.",
  6021: "The account belongs to a different fund.",
  6022: "Arithmetic error.",
  6023: "Rejected by the program: no installment is due yet.",
  6024: "Automatic repayment is turned off or the wallet does not have enough money.",
  6025: "Rejected by the program: this account does not belong to the person paying.",
  6026: "No standing contribution is set.",
  6027: "The next contribution is not due yet.",
};

/** Turns wallet/RPC/program errors into one readable sentence. */
export function describeError(err: unknown): string {
  const text = collectErrorText(err);
  const custom = text.match(/custom program error: 0x([0-9a-f]+)/i) ?? text.match(/"Custom":\s*(\d+)/);
  if (custom) {
    const code = custom[0].includes("0x") ? parseInt(custom[1], 16) : Number(custom[1]);
    if (PROGRAM_ERRORS[code]) return PROGRAM_ERRORS[code];
  }
  const anchorCode = text.match(/Error Number: (\d+)/);
  if (anchorCode && PROGRAM_ERRORS[Number(anchorCode[1])]) return PROGRAM_ERRORS[Number(anchorCode[1])];
  if (/ConstraintHasOne|ConstraintSeeds|2001|2006/.test(text)) return "Rejected by the program: the account does not match the one stored in the fund.";
  if (/reject|denied|cancel/i.test(text)) return "Transaction rejected in the wallet.";
  if (/insufficient funds|0x1\b/i.test(text)) return "Not enough tPLN in your account. Get test PLN with the button at the top.";
  if (/insufficient|lamports/i.test(text)) return "Not enough SOL for fees (devnet).";
  if (/blockhash/i.test(text)) return "The transaction expired – please try again.";
  return text.split("\n")[0].slice(0, 240) || "Unknown error.";
}

function collectErrorText(err: unknown, depth = 0): string {
  if (!err || depth > 5) return "";
  if (typeof err === "string") return err;
  const e = err as { message?: string; context?: unknown; cause?: unknown; logs?: unknown };
  const parts = [e.message ?? ""];
  try {
    if (e.context) parts.push(JSON.stringify(e.context, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
  } catch {
    /* ignore */
  }
  if (Array.isArray(e.logs)) parts.push(e.logs.join("\n"));
  parts.push(collectErrorText(e.cause, depth + 1));
  return parts.filter(Boolean).join("\n");
}
