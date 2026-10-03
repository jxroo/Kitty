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
  getCreateAssociatedTokenIdempotentInstruction,
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
  getRepayInstruction,
  getRequestLoanInstruction,
  getWithdrawGuaranteeInstruction,
  getWithdrawInstruction,
  KASA_PROGRAM_ADDRESS,
  type Kasa,
  type Loan,
} from "../generated";

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

export async function disburseIxs(borrower: TransactionSigner, loan: Address, loanData: Loan, kasaData: Kasa) {
  const to = await ataOf(borrower.address, kasaData.mint);
  return [
    getCreateAssociatedTokenIdempotentInstruction({ payer: borrower, ata: to, owner: borrower.address, mint: kasaData.mint }),
    getDisburseInstruction({ borrower, kasa: loanData.kasa, loan, mint: kasaData.mint, vault: kasaData.vault, to }),
  ];
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
