// Builds the program's instructions from chain state. Pure transaction assembly:
// every rule (limits, collateral, deadlines) is checked again by the program.
import {
  getAddressEncoder,
  getProgramDerivedAddress,
  getU32Encoder,
  getUtf8Encoder,
  type Address,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getApproveCheckedInstruction,
  getCreateAssociatedTokenIdempotentInstruction,
  getRevokeInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import {
  findKasaPda,
  findMemberPda,
  findVaultPda,
  getCancelLoanInstruction,
  getCollectOverdueInstruction,
  getCreateKasaInstruction,
  getDepositInstruction,
  getDisburseInstruction,
  getGuaranteeInstruction,
  getJoinInstruction,
  getPullContributionInstruction,
  getPullInstallmentInstruction,
  getRepayInstruction,
  getRequestLoanInstruction,
  getSetContributionInstruction,
  getWithdrawGuaranteeInstruction,
  getWithdrawInstruction,
  KASA_PROGRAM_ADDRESS,
  type Kasa,
  type Loan,
} from "../generated";
import { DECIMALS } from "./kasa";

export async function memberPda(kasa: Address, wallet: Address) {
  return (await findMemberPda({ kasa, wallet }))[0];
}

export async function loanPda(kasa: Address, borrower: Address, index: number) {
  const enc = getAddressEncoder();
  return (
    await getProgramDerivedAddress({
      programAddress: KASA_PROGRAM_ADDRESS,
      seeds: [getUtf8Encoder().encode("loan"), enc.encode(kasa), enc.encode(borrower), getU32Encoder().encode(index)],
    })
  )[0];
}

export async function ataOf(owner: Address, mint: Address) {
  return (await findAssociatedTokenPda({ owner, mint, tokenProgram: TOKEN_PROGRAM_ADDRESS }))[0];
}

/** Guarantor Member PDAs in the loan's slot order; the program checks every one. */
async function guarantorSlots(loan: Loan) {
  const slots: (Address | undefined)[] = [undefined, undefined, undefined];
  for (let i = 0; i < loan.guarantorCount; i++) slots[i] = await memberPda(loan.kasa, loan.guarantors[i].wallet);
  return { guarantor0: slots[0], guarantor1: slots[1], guarantor2: slots[2] };
}

export async function createKasaIxs(
  founder: TransactionSigner,
  mint: Address,
  args: {
    kasaId: bigint;
    name: string;
    loanMultiplierBps: number;
    maxInstallments: number;
    periodSecs: number;
    graceSecs: number;
    displayName: string;
  }
): Promise<{ kasa: Address; instructions: Instruction[] }> {
  const [kasa] = await findKasaPda({ founder: founder.address, kasaId: args.kasaId });
  const [vault] = await findVaultPda({ kasa });
  const create = getCreateKasaInstruction({
    founder,
    kasa,
    mint,
    vault,
    kasaId: args.kasaId,
    name: args.name,
    loanMultiplierBps: args.loanMultiplierBps,
    maxInstallments: args.maxInstallments,
    periodSecs: args.periodSecs,
    graceSecs: args.graceSecs,
  });
  // The founder joins in the same transaction, as an ordinary member with no extra rights.
  const join = getJoinInstruction({
    wallet: founder,
    kasa,
    member: await memberPda(kasa, founder.address),
    displayName: args.displayName,
  });
  return { kasa, instructions: [create, join] };
}

export async function joinIx(wallet: TransactionSigner, kasa: Address, displayName: string) {
  return getJoinInstruction({ wallet, kasa, member: await memberPda(kasa, wallet.address), displayName });
}

export async function depositIx(wallet: TransactionSigner, kasa: Address, kasaData: Kasa, amount: bigint) {
  return getDepositInstruction({
    wallet,
    kasa,
    member: await memberPda(kasa, wallet.address),
    mint: kasaData.mint,
    vault: kasaData.vault,
    from: await ataOf(wallet.address, kasaData.mint),
    amount,
  });
}

export async function withdrawIxs(wallet: TransactionSigner, kasa: Address, kasaData: Kasa, amount: bigint) {
  const to = await ataOf(wallet.address, kasaData.mint);
  return [
    getCreateAssociatedTokenIdempotentInstruction({ payer: wallet, ata: to, owner: wallet.address, mint: kasaData.mint }),
    getWithdrawInstruction({
      wallet,
      kasa,
      member: await memberPda(kasa, wallet.address),
      mint: kasaData.mint,
      vault: kasaData.vault,
      to,
      amount,
    }),
  ];
}

export async function requestLoanIx(
  borrower: TransactionSigner,
  kasa: Address,
  loanIndex: number,
  amount: bigint,
  installments: number
) {
  return getRequestLoanInstruction({
    borrower,
    kasa,
    borrowerMember: await memberPda(kasa, borrower.address),
    loan: await loanPda(kasa, borrower.address, loanIndex),
    amount,
    installments,
  });
}

export async function guaranteeIx(guarantor: TransactionSigner, kasa: Address, loan: Address, amount: bigint) {
  return getGuaranteeInstruction({
    guarantor,
    kasa,
    loan,
    guarantorMember: await memberPda(kasa, guarantor.address),
    amount,
  });
}

export async function withdrawGuaranteeIx(guarantor: TransactionSigner, kasa: Address, loan: Address) {
  return getWithdrawGuaranteeInstruction({
    guarantor,
    kasa,
    loan,
    guarantorMember: await memberPda(kasa, guarantor.address),
  });
}

export async function cancelLoanIx(borrower: TransactionSigner, loan: Address, loanData: Loan) {
  return getCancelLoanInstruction({
    borrower,
    kasa: loanData.kasa,
    loan,
    borrowerMember: await memberPda(loanData.kasa, borrower.address),
    ...(await guarantorSlots(loanData)),
  });
}

/** Pays the loan out; with `mandate`, in the same transaction the borrower lets the kasa pull the installments. */
export async function disburseIxs(
  borrower: TransactionSigner,
  loan: Address,
  loanData: Loan,
  kasaData: Kasa,
  { mandate = false } = {}
) {
  const to = await ataOf(borrower.address, kasaData.mint);
  const ixs: Instruction[] = [
    getCreateAssociatedTokenIdempotentInstruction({ payer: borrower, ata: to, owner: borrower.address, mint: kasaData.mint }),
    getDisburseInstruction({ borrower, kasa: loanData.kasa, loan, mint: kasaData.mint, vault: kasaData.vault, to }),
  ];
  if (mandate) ixs.push(await approveMandateIx(borrower, loanData.kasa, kasaData.mint, loanData.amount));
  return ixs;
}

export async function repayIx(payer: TransactionSigner, loan: Address, loanData: Loan, kasaData: Kasa, amount: bigint) {
  return getRepayInstruction({
    payer,
    kasa: loanData.kasa,
    loan,
    borrowerMember: await memberPda(loanData.kasa, loanData.borrower),
    ...(await guarantorSlots(loanData)),
    mint: kasaData.mint,
    vault: kasaData.vault,
    from: await ataOf(payer.address, kasaData.mint),
    amount,
  });
}

/** Needs no signature beyond the fee payer: anyone may submit it once an installment is overdue. */
export async function collectOverdueIx(loan: Address, loanData: Loan) {
  return getCollectOverdueInstruction({
    kasa: loanData.kasa,
    loan,
    borrowerMember: await memberPda(loanData.kasa, loanData.borrower),
    ...(await guarantorSlots(loanData)),
  });
}

/**
 * Direct-debit mandate: a standard SPL `approve` naming the member's own PDA in this kasa
 * as delegate, up to `amount`. The program uses it only in pull_installment and
 * pull_contribution, for what is due. Replaces any earlier delegate on this token account.
 */
export async function approveMandateIx(owner: TransactionSigner, kasa: Address, mint: Address, amount: bigint) {
  return getApproveCheckedInstruction({
    source: await ataOf(owner.address, mint),
    mint,
    delegate: await memberPda(kasa, owner.address),
    owner,
    amount,
    decimals: DECIMALS,
  });
}

/** Cancels the mandate at any time (SPL `revoke`). */
export async function revokeMandateIx(owner: TransactionSigner, mint: Address) {
  return getRevokeInstruction({ source: await ataOf(owner.address, mint), owner });
}

/** Needs no signature beyond the fee payer: anyone (a bot) may submit it once an installment is due. */
export async function pullInstallmentIx(loan: Address, loanData: Loan, kasaData: Kasa) {
  return getPullInstallmentInstruction({
    kasa: loanData.kasa,
    loan,
    borrowerMember: await memberPda(loanData.kasa, loanData.borrower),
    ...(await guarantorSlots(loanData)),
    mint: kasaData.mint,
    vault: kasaData.vault,
    from: await ataOf(loanData.borrower, kasaData.mint),
  });
}

export async function setContributionIx(wallet: TransactionSigner, kasa: Address, amount: bigint) {
  return getSetContributionInstruction({ wallet, kasa, member: await memberPda(kasa, wallet.address), amount });
}

/** Needs no signature beyond the fee payer: anyone may submit it once the contribution is due. */
export async function pullContributionIx(kasa: Address, kasaData: Kasa, wallet: Address) {
  return getPullContributionInstruction({
    kasa,
    member: await memberPda(kasa, wallet),
    mint: kasaData.mint,
    vault: kasaData.vault,
    from: await ataOf(wallet, kasaData.mint),
  });
}
