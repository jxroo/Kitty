//! Direct debit without a bank. A member gives their own Member PDA an SPL Token
//! allowance on their wallet (a standard `approve`, revocable at any time with
//! `revoke`). Within that allowance the program pulls exactly what the rules say
//! is due, and nothing else: installments of the member's own loan once their due
//! date arrives, and the standing contribution they chose, once per kasa period.
//! Anyone can submit the pull, so a bot replaces the payroll deduction and the bank.

use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    collateral::Guarantors,
    constants::*,
    error::KasaError,
    instructions::repay::{book_repayment, close_if_settled},
    state::{Activity, ActivityKind, Kasa, Loan, LoanStatus, Member},
    vault::{mandate_available, pay_in_by_mandate},
};

/// No signer is required: anyone (the borrower, a bot, a stranger) can submit it.
#[derive(Accounts)]
pub struct PullInstallment<'info> {
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
    /// The borrower's own wallet: the mandate never reaches anyone else's money.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = from.owner == loan.borrower @ KasaError::WrongPayerAccount
    )]
    pub from: Box<Account<'info, TokenAccount>>,
    pub token_program: Program<'info, Token>,
}

/// From an installment's due date (no grace), pulls what is due and unpaid from
/// the borrower's wallet, up to the mandate. If the wallet is short or the
/// mandate was revoked, nothing changes for the fund: after grace,
/// `collect_overdue` takes the rest from collateral as before.
pub fn handle_pull_installment(ctx: Context<PullInstallment>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    a.loan.require_status(LoanStatus::Active)?;
    let due = a.loan.overdue(now, a.kasa.period_secs, 0)?;
    require!(due > 0, KasaError::InstallmentNotDue);
    let amount = due.min(mandate_available(&a.from, &a.borrower_member.key()));
    require!(amount > 0, KasaError::NoMandate);
    pay_in_by_mandate(&a.token_program, &a.from, &a.mint, &a.vault, &a.borrower_member, amount)?;

    let a = &mut *ctx.accounts;
    a.loan.autopaid += amount;
    let mut guarantors: Guarantors = [
        a.guarantor0.as_deref_mut(),
        a.guarantor1.as_deref_mut(),
        a.guarantor2.as_deref_mut(),
    ];
    book_repayment(&mut a.kasa, &mut a.loan, &mut a.borrower_member, &mut guarantors, amount)?;

    emit!(Activity {
        kasa: a.kasa.key(),
        wallet: a.loan.borrower,
        loan: a.loan.key(),
        kind: ActivityKind::InstallmentPulled,
        amount,
    });
    close_if_settled(&mut a.loan, &mut a.borrower_member)
}

#[derive(Accounts)]
pub struct SetContribution<'info> {
    pub wallet: Signer<'info>,
    pub kasa: Account<'info, Kasa>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), wallet.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
}

/// A member sets (or with 0, cancels) their standing contribution. The first one
/// can be pulled right away, then once per kasa period.
pub fn handle_set_contribution(ctx: Context<SetContribution>, amount: u64) -> Result<()> {
    let member = &mut ctx.accounts.member;
    member.contribution = amount;
    member.next_contribution_at = if amount > 0 { Clock::get()?.unix_timestamp } else { 0 };

    emit!(Activity {
        kasa: ctx.accounts.kasa.key(),
        wallet: ctx.accounts.wallet.key(),
        loan: Pubkey::default(),
        kind: ActivityKind::ContributionSet,
        amount,
    });
    Ok(())
}

/// No signer is required: anyone can submit it once the contribution is due.
#[derive(Accounts)]
pub struct PullContribution<'info> {
    #[account(mut, has_one = mint, has_one = vault)]
    pub kasa: Account<'info, Kasa>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), member.wallet.as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    /// The member's own wallet.
    #[account(
        mut,
        token::mint = mint,
        token::token_program = token_program,
        constraint = from.owner == member.wallet @ KasaError::WrongPayerAccount
    )]
    pub from: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Moves the standing contribution from the member's wallet into their savings,
/// all or nothing. Missed periods are not piled up: one pull, then one period wait.
pub fn handle_pull_contribution(ctx: Context<PullContribution>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let a = &ctx.accounts;
    let amount = a.member.contribution;
    require!(amount > 0, KasaError::ContributionNotSet);
    require!(now >= a.member.next_contribution_at, KasaError::ContributionNotDue);
    require!(
        mandate_available(&a.from, &a.member.key()) >= amount,
        KasaError::NoMandate
    );
    pay_in_by_mandate(&a.token_program, &a.from, &a.mint, &a.vault, &a.member, amount)?;

    let period = a.kasa.period_secs as i64;
    let member = &mut ctx.accounts.member;
    member.savings = member.savings.checked_add(amount).ok_or(KasaError::MathOverflow)?;
    member.total_deposited = member.total_deposited.checked_add(amount).ok_or(KasaError::MathOverflow)?;
    member.next_contribution_at += period;
    if member.next_contribution_at <= now {
        member.next_contribution_at = now + period;
    }
    let wallet = member.wallet;
    let kasa = &mut ctx.accounts.kasa;
    kasa.total_savings = kasa.total_savings.checked_add(amount).ok_or(KasaError::MathOverflow)?;

    emit!(Activity {
        kasa: kasa.key(),
        wallet,
        loan: Pubkey::default(),
        kind: ActivityKind::ContributionPulled,
        amount,
    });
    Ok(())
}
