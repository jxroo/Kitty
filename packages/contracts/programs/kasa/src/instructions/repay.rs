use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    collateral::{check_guarantors, release_excess, seize, Guarantors},
    constants::*,
    error::KasaError,
    state::{Activity, ActivityKind, Kasa, Loan, LoanStatus, Member},
    vault::pay_in,
};

#[derive(Accounts)]
pub struct Repay<'info> {
    /// Usually the borrower, but anyone may pay a loan off on their behalf.
    pub payer: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub kasa: Box<Account<'info, Kasa>>,
    #[account(mut, has_one = kasa)]
    pub loan: Box<Account<'info, Loan>>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), loan.borrower.as_ref()],
        bump = borrower_member.bump
    )]
    pub borrower_member: Box<Account<'info, Member>>,
    #[account(mut)]
    pub guarantor0: Option<Account<'info, Member>>,
    #[account(mut)]
    pub guarantor1: Option<Account<'info, Member>>,
    #[account(mut)]
    pub guarantor2: Option<Account<'info, Member>>,
    pub mint: Box<Account<'info, Mint>>,
    #[account(mut)]
    pub vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, token::mint = mint, token::authority = payer, token::token_program = token_program)]
    pub from: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// Pays back any amount up to what is owed. Each repayment immediately frees
/// the same amount of collateral, guarantors first.
pub fn handle_repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
    ctx.accounts.loan.require_status(LoanStatus::Active)?;
    require!(amount > 0, KasaError::ZeroAmount);
    require!(
        amount <= ctx.accounts.loan.outstanding(),
        KasaError::RepayExceedsOutstanding
    );

    let a = &ctx.accounts;
    pay_in(&a.token_program, &a.from, &a.mint, &a.vault, &a.payer, amount)?;

    let a = &mut *ctx.accounts;
    a.kasa.total_outstanding = a.kasa.total_outstanding.checked_sub(amount).ok_or(KasaError::MathOverflow)?;
    a.loan.repaid += amount;

    let mut guarantors: Guarantors = [
        a.guarantor0.as_deref_mut(),
        a.guarantor1.as_deref_mut(),
        a.guarantor2.as_deref_mut(),
    ];
    check_guarantors(&a.loan, &guarantors)?;
    release_excess(&mut a.loan, &mut a.borrower_member, &mut guarantors)?;

    emit!(Activity {
        kasa: a.kasa.key(),
        wallet: a.payer.key(),
        loan: a.loan.key(),
        kind: ActivityKind::Repaid,
        amount,
    });
    close_if_settled(&mut a.loan, &mut a.borrower_member)
}

/// No signer is required: anyone (a member, a bot, a stranger) can submit it.
#[derive(Accounts)]
pub struct CollectOverdue<'info> {
    #[account(mut)]
    pub kasa: Account<'info, Kasa>,
    #[account(mut, has_one = kasa)]
    pub loan: Account<'info, Loan>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), loan.borrower.as_ref()],
        bump = borrower_member.bump
    )]
    pub borrower_member: Account<'info, Member>,
    #[account(mut)]
    pub guarantor0: Option<Account<'info, Member>>,
    #[account(mut)]
    pub guarantor1: Option<Account<'info, Member>>,
    #[account(mut)]
    pub guarantor2: Option<Account<'info, Member>>,
}

/// The rule that replaces the board and the payroll deduction: once an
/// installment is past due plus grace, the overdue amount is taken from the
/// collateral (borrower's savings first, then guarantors pro rata). The tokens
/// are already in the vault, so this is pure accounting and needs nobody's consent.
pub fn handle_collect_overdue(ctx: Context<CollectOverdue>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &mut *ctx.accounts;
    a.loan.require_status(LoanStatus::Active)?;
    let overdue = a.loan.overdue(now, a.kasa.period_secs, a.kasa.grace_secs)?;
    require!(overdue > 0, KasaError::NothingOverdue);

    let mut guarantors: Guarantors = [
        a.guarantor0.as_deref_mut(),
        a.guarantor1.as_deref_mut(),
        a.guarantor2.as_deref_mut(),
    ];
    check_guarantors(&a.loan, &guarantors)?;
    seize(&mut a.loan, &mut a.borrower_member, &mut guarantors, overdue)?;

    a.kasa.total_savings = a.kasa.total_savings.checked_sub(overdue).ok_or(KasaError::MathOverflow)?;
    a.kasa.total_outstanding = a.kasa.total_outstanding.checked_sub(overdue).ok_or(KasaError::MathOverflow)?;

    emit!(Activity {
        kasa: a.kasa.key(),
        wallet: a.loan.borrower,
        loan: a.loan.key(),
        kind: ActivityKind::OverdueCollected,
        amount: overdue,
    });
    close_if_settled(&mut a.loan, &mut a.borrower_member)
}

fn close_if_settled(loan: &mut Account<Loan>, borrower: &mut Member) -> Result<()> {
    if loan.outstanding() > 0 {
        return Ok(());
    }
    // Collateral always equals what is owed, so at zero nothing is left locked.
    require!(loan.collateral() == 0, KasaError::MathOverflow);
    loan.status = LoanStatus::Repaid;
    loan.closed_at = Clock::get()?.unix_timestamp;
    borrower.open_loans = 0;

    emit!(Activity {
        kasa: loan.kasa,
        wallet: loan.borrower,
        loan: loan.key(),
        kind: ActivityKind::LoanClosed,
        amount: loan.amount,
    });
    Ok(())
}
