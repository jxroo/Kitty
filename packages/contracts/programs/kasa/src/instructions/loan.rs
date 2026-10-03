use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    collateral::{check_guarantors, Guarantors},
    constants::*,
    error::KasaError,
    state::{Activity, ActivityKind, Kasa, Loan, LoanStatus, Member, Pledge},
    vault::pay_out,
};

#[derive(Accounts)]
pub struct RequestLoan<'info> {
    #[account(mut)]
    pub borrower: Signer<'info>,
    #[account(mut)]
    pub kasa: Account<'info, Kasa>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), borrower.key().as_ref()],
        bump = borrower_member.bump
    )]
    pub borrower_member: Account<'info, Member>,
    #[account(
        init,
        payer = borrower,
        space = 8 + Loan::INIT_SPACE,
        seeds = [
            LOAN_SEED,
            kasa.key().as_ref(),
            borrower.key().as_ref(),
            &borrower_member.loan_count.to_le_bytes()
        ],
        bump
    )]
    pub loan: Account<'info, Loan>,
    pub system_program: Program<'info, System>,
}

/// Asks for a loan of up to `multiplier x savings`. The borrower's own free savings
/// are locked first; whatever they don't cover must be pledged by guarantors.
pub fn handle_request_loan(ctx: Context<RequestLoan>, amount: u64, installments: u8) -> Result<()> {
    let kasa = &ctx.accounts.kasa;
    let member = &ctx.accounts.borrower_member;
    require!(amount > 0, KasaError::ZeroAmount);
    require!(
        (1..=kasa.max_installments).contains(&installments),
        KasaError::InvalidInstallments
    );
    require!(member.open_loans == 0, KasaError::OpenLoanExists);
    require!(amount <= kasa.max_loan(member.savings)?, KasaError::LoanLimitExceeded);

    let own = member.free().min(amount);
    let index = member.loan_count;
    let kasa_key = kasa.key();
    let borrower = ctx.accounts.borrower.key();

    let member = &mut ctx.accounts.borrower_member;
    member.locked += own;
    member.open_loans = 1;
    member.loan_count = member.loan_count.checked_add(1).ok_or(KasaError::MathOverflow)?;
    let kasa = &mut ctx.accounts.kasa;
    kasa.loan_count = kasa.loan_count.checked_add(1).ok_or(KasaError::MathOverflow)?;

    let loan_key = ctx.accounts.loan.key();
    ctx.accounts.loan.set_inner(Loan {
        kasa: kasa_key,
        borrower,
        index,
        amount,
        installments,
        status: LoanStatus::Pending,
        created_at: Clock::get()?.unix_timestamp,
        disbursed_at: 0,
        closed_at: 0,
        repaid: 0,
        seized: 0,
        autopaid: 0,
        own_collateral: own,
        own_seized: 0,
        guarantor_count: 0,
        guarantors: [Pledge::default(); MAX_GUARANTORS],
        bump: ctx.bumps.loan,
    });

    emit!(Activity {
        kasa: kasa_key,
        wallet: borrower,
        loan: loan_key,
        kind: ActivityKind::LoanRequested,
        amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Guarantee<'info> {
    pub guarantor: Signer<'info>,
    pub kasa: Account<'info, Kasa>,
    #[account(mut, has_one = kasa)]
    pub loan: Account<'info, Loan>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), guarantor.key().as_ref()],
        bump = guarantor_member.bump
    )]
    pub guarantor_member: Account<'info, Member>,
}

/// A member vouches for a loan by locking part of their own savings. This
/// replaces the board's approval: a loan exists only if members back it.
pub fn handle_guarantee(ctx: Context<Guarantee>, amount: u64) -> Result<()> {
    let guarantor = ctx.accounts.guarantor.key();
    let loan = &mut ctx.accounts.loan;
    loan.require_status(LoanStatus::Pending)?;
    require_keys_neq!(guarantor, loan.borrower, KasaError::CannotGuaranteeOwnLoan);
    require!(amount > 0, KasaError::ZeroAmount);
    require!(
        amount <= loan.amount - loan.collateral(),
        KasaError::OverCollateralized
    );
    let member = &mut ctx.accounts.guarantor_member;
    require!(amount <= member.free(), KasaError::InsufficientFreeSavings);

    match loan.guarantor_index(&guarantor) {
        Some(i) => loan.guarantors[i].amount += amount,
        None => {
            let i = loan.guarantor_count as usize;
            require!(i < MAX_GUARANTORS, KasaError::TooManyGuarantors);
            loan.guarantors[i] = Pledge {
                wallet: guarantor,
                amount,
                seized: 0,
            };
            loan.guarantor_count += 1;
        }
    }
    member.locked += amount;

    emit!(Activity {
        kasa: loan.kasa,
        wallet: guarantor,
        loan: loan.key(),
        kind: ActivityKind::Guaranteed,
        amount,
    });
    Ok(())
}

/// A guarantor may change their mind until the loan is paid out.
pub fn handle_withdraw_guarantee(ctx: Context<Guarantee>) -> Result<()> {
    let guarantor = ctx.accounts.guarantor.key();
    let loan = &mut ctx.accounts.loan;
    loan.require_status(LoanStatus::Pending)?;
    let i = loan.guarantor_index(&guarantor).ok_or(KasaError::NotAGuarantor)?;
    let amount = loan.guarantors[i].amount;

    let count = loan.guarantor_count as usize;
    loan.guarantors.copy_within(i + 1..count, i);
    loan.guarantors[count - 1] = Pledge::default();
    loan.guarantor_count -= 1;
    ctx.accounts.guarantor_member.locked -= amount;

    emit!(Activity {
        kasa: loan.kasa,
        wallet: guarantor,
        loan: loan.key(),
        kind: ActivityKind::GuaranteeWithdrawn,
        amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct CancelLoan<'info> {
    pub borrower: Signer<'info>,
    pub kasa: Account<'info, Kasa>,
    #[account(mut, has_one = kasa, has_one = borrower @ KasaError::NotBorrower)]
    pub loan: Account<'info, Loan>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), borrower.key().as_ref()],
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

/// The borrower withdraws the request before payout; every pledge is unlocked.
pub fn handle_cancel_loan(ctx: Context<CancelLoan>) -> Result<()> {
    let a = &mut *ctx.accounts;
    a.loan.require_status(LoanStatus::Pending)?;
    let mut guarantors: Guarantors = [
        a.guarantor0.as_deref_mut(),
        a.guarantor1.as_deref_mut(),
        a.guarantor2.as_deref_mut(),
    ];
    check_guarantors(&a.loan, &guarantors)?;

    let loan = &mut a.loan;
    for i in 0..loan.guarantor_count as usize {
        if let Some(member) = guarantors[i].as_deref_mut() {
            member.locked -= loan.guarantors[i].amount;
        }
        loan.guarantors[i].amount = 0;
    }
    a.borrower_member.locked -= loan.own_collateral;
    a.borrower_member.open_loans = 0;
    loan.own_collateral = 0;
    loan.status = LoanStatus::Cancelled;
    loan.closed_at = Clock::get()?.unix_timestamp;

    emit!(Activity {
        kasa: loan.kasa,
        wallet: loan.borrower,
        loan: loan.key(),
        kind: ActivityKind::LoanCancelled,
        amount: loan.amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Disburse<'info> {
    pub borrower: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub kasa: Account<'info, Kasa>,
    #[account(mut, has_one = kasa, has_one = borrower @ KasaError::NotBorrower)]
    pub loan: Account<'info, Loan>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// Pays the loan out. Nobody approves it: the only condition is that locked
/// savings cover 100% of the amount, so the fund cannot lose this money.
pub fn handle_disburse(ctx: Context<Disburse>) -> Result<()> {
    let loan = &ctx.accounts.loan;
    loan.require_status(LoanStatus::Pending)?;
    require!(loan.collateral() == loan.amount, KasaError::CollateralIncomplete);
    let amount = loan.amount;

    let a = &ctx.accounts;
    pay_out(&a.kasa, &a.token_program, &a.vault, &a.mint, &a.to, amount)?;

    let kasa = &mut ctx.accounts.kasa;
    kasa.total_outstanding = kasa.total_outstanding.checked_add(amount).ok_or(KasaError::MathOverflow)?;
    let loan = &mut ctx.accounts.loan;
    loan.status = LoanStatus::Active;
    loan.disbursed_at = Clock::get()?.unix_timestamp;

    emit!(Activity {
        kasa: loan.kasa,
        wallet: loan.borrower,
        loan: loan.key(),
        kind: ActivityKind::Disbursed,
        amount,
    });
    Ok(())
}
