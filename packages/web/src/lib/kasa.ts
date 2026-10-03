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

/** "1234,5" / "1 234.50" / "12" -> grosze. Throws on anything that is not a non-negative amount. */
export function parseZl(text: string): bigint {
  const clean = text.replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) throw new Error("Niepoprawna kwota.");
  const [whole, frac = ""] = clean.split(".");
  return BigInt(whole) * 100n + BigInt((frac + "00").slice(0, 2));
}

export function formatZl(grosze: bigint | number, withUnit = true): string {
  const value = BigInt(grosze);
  const sign = value < 0n ? "-" : "";
  const abs = value < 0n ? -value : value;
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const frac = (abs % 100n).toString().padStart(2, "0");
  return `${sign}${whole}${frac === "00" ? "" : "," + frac}${withUnit ? " zł" : ""}`;
}

export function formatSol(lamports: bigint | number, maxDecimals = 3): string {
  const value = BigInt(lamports);
  const whole = value / LAMPORTS_PER_SOL;
  const frac = (value % LAMPORTS_PER_SOL).toString().padStart(9, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return `${whole}${frac ? "," + frac : ""}`;
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
  [LoanStatus.Pending]: "Czeka na poręczenia",
  [LoanStatus.Active]: "Spłacana",
  [LoanStatus.Repaid]: "Spłacona",
  [LoanStatus.Cancelled]: "Bez wypłaty",
};

/** "1 rata", "2–4 raty", "5 rat" (and 12–14 rat), as Polish counts them. */
export function plural(n: number, one: string, few: string, many: string) {
  if (n === 1) return one;
  const tens = n % 100;
  return n % 10 >= 2 && n % 10 <= 4 && (tens < 12 || tens > 14) ? few : many;
}

export function randomId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new DataView(bytes.buffer).getBigUint64(0, true);
}

export function utf8Length(text: string) {
  return new TextEncoder().encode(text).length;
}

/** Polish messages for the program's custom errors (codes 6000+). */
const PROGRAM_ERRORS_PL: Record<number, string> = {
  6000: "Nazwa kasy musi mieć od 1 do 40 bajtów.",
  6001: "Imię lub pseudonim musi mieć od 1 do 24 bajtów.",
  6002: "Limit pożyczki musi wynosić od 1× do 5× oszczędności.",
  6003: "Niedozwolona liczba rat w tej kasie.",
  6004: "Okres raty musi wynosić od 30 sekund do 90 dni.",
  6005: "Karencja jest za długa.",
  6006: "Kwota musi być większa od zera.",
  6007: "Program odrzucił: za mało wolnych (niezablokowanych) oszczędności.",
  6008: "Program odrzucił: pożyczka przekracza limit tej kasy (wielokrotność Twoich oszczędności).",
  6009: "Masz już otwartą pożyczkę w tej kasie.",
  6010: "Ta pożyczka nie czeka już na poręczenia.",
  6011: "Ta pożyczka nie jest aktywna.",
  6012: "Program odrzucił: tylko pożyczkobiorca może to zrobić.",
  6013: "Program odrzucił: nie można poręczyć własnej pożyczki.",
  6014: "Pożyczka ma już maksymalnie 3 poręczycieli.",
  6015: "Poręczenie jest większe niż brakująca kwota.",
  6016: "Nie jesteś poręczycielem tej pożyczki.",
  6017: "Program odrzucił: pożyczka nie jest jeszcze w całości pokryta oszczędnościami i poręczeniami.",
  6018: "Kwota przekracza to, co zostało do spłaty.",
  6019: "Program odrzucił: żadna rata nie jest jeszcze zaległa (trwa czas na spóźnienie).",
  6020: "Konta poręczycieli nie zgadzają się z pożyczką.",
  6021: "Konto należy do innej kasy.",
  6022: "Błąd arytmetyczny.",
  6023: "Program odrzucił: termin żadnej raty jeszcze nie minął.",
  6024: "Automatyczna spłata jest wyłączona albo w portfelu brakuje pieniędzy.",
  6025: "Program odrzucił: to konto nie należy do osoby, która płaci.",
  6026: "Nie ustawiono składki stałej.",
  6027: "Kolejna składka nie jest jeszcze wymagalna.",
};

/** Turns wallet/RPC/program errors into one readable Polish sentence. */
export function describeError(err: unknown): string {
  const text = collectErrorText(err);
  const custom = text.match(/custom program error: 0x([0-9a-f]+)/i) ?? text.match(/"Custom":\s*(\d+)/);
  if (custom) {
    const code = custom[0].includes("0x") ? parseInt(custom[1], 16) : Number(custom[1]);
    if (PROGRAM_ERRORS_PL[code]) return PROGRAM_ERRORS_PL[code];
  }
  const anchorCode = text.match(/Error Number: (\d+)/);
  if (anchorCode && PROGRAM_ERRORS_PL[Number(anchorCode[1])]) return PROGRAM_ERRORS_PL[Number(anchorCode[1])];
  if (/ConstraintHasOne|ConstraintSeeds|2001|2006/.test(text)) return "Program odrzucił: konto nie zgadza się z zapisanym w kasie.";
  if (/reject|denied|cancel/i.test(text)) return "Transakcja odrzucona w portfelu.";
  if (/insufficient funds|0x1\b/i.test(text)) return "Za mało tPLN na koncie. Dobierz testowe złotówki przyciskiem u góry.";
  if (/insufficient|lamports/i.test(text)) return "Za mało SOL na opłaty (devnet).";
  if (/blockhash/i.test(text)) return "Transakcja wygasła – spróbuj ponownie.";
  return text.split("\n")[0].slice(0, 240) || "Nieznany błąd.";
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
