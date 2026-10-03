use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::KasaError,
    state::{Activity, ActivityKind, Kasa, Member},
    vault::{pay_in, pay_out},
};

#[derive(Accounts)]
pub struct Join<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(mut)]
    pub kasa: Account<'info, Kasa>,
    #[account(
        init,
        payer = wallet,
        space = 8 + Member::INIT_SPACE,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), wallet.key().as_ref()],
        bump
    )]
    pub member: Account<'info, Member>,
    pub system_program: Program<'info, System>,
}

/// Anyone may join: nobody has to approve members, because a newcomer can only
/// ever risk their own savings or savings that others chose to pledge for them.
pub fn handle_join(ctx: Context<Join>, display_name: String) -> Result<()> {
    require!(
        !display_name.is_empty() && display_name.len() <= MAX_DISPLAY_NAME_LEN,
        KasaError::InvalidDisplayName
    );
    let kasa_key = ctx.accounts.kasa.key();
    let wallet = ctx.accounts.wallet.key();
    ctx.accounts.member.set_inner(Member {
        kasa: kasa_key,
        wallet,
        savings: 0,
        locked: 0,
        loan_count: 0,
        open_loans: 0,
        total_deposited: 0,
        total_seized: 0,
        joined_at: Clock::get()?.unix_timestamp,
        display_name,
        bump: ctx.bumps.member,
    });
    let kasa = &mut ctx.accounts.kasa;
    kasa.member_count = kasa.member_count.checked_add(1).ok_or(KasaError::MathOverflow)?;

    emit!(Activity {
        kasa: kasa_key,
        wallet,
        loan: Pubkey::default(),
        kind: ActivityKind::Joined,
        amount: 0,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    pub wallet: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub kasa: Account<'info, Kasa>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), wallet.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::authority = wallet, token::token_program = token_program)]
    pub from: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn handle_deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, KasaError::ZeroAmount);
    let a = &ctx.accounts;
    pay_in(&a.token_program, &a.from, &a.mint, &a.vault, &a.wallet, amount)?;

    let member = &mut ctx.accounts.member;
    member.savings = member.savings.checked_add(amount).ok_or(KasaError::MathOverflow)?;
    member.total_deposited = member.total_deposited.checked_add(amount).ok_or(KasaError::MathOverflow)?;
    let kasa = &mut ctx.accounts.kasa;
    kasa.total_savings = kasa.total_savings.checked_add(amount).ok_or(KasaError::MathOverflow)?;

    emit!(Activity {
        kasa: kasa.key(),
        wallet: ctx.accounts.wallet.key(),
        loan: Pubkey::default(),
        kind: ActivityKind::Deposited,
        amount,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    pub wallet: Signer<'info>,
    #[account(mut, has_one = mint, has_one = vault)]
    pub kasa: Account<'info, Kasa>,
    #[account(
        mut,
        seeds = [MEMBER_SEED, kasa.key().as_ref(), wallet.key().as_ref()],
        bump = member.bump
    )]
    pub member: Account<'info, Member>,
    pub mint: Account<'info, Mint>,
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    #[account(mut, token::mint = mint, token::token_program = token_program)]
    pub to: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

/// A member takes back unlocked savings at any time, without asking anyone.
/// Loans are always fully backed by *locked* savings, so the vault holds at
/// least every member's free savings: this can never fail for lack of money.
pub fn handle_withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    require!(amount > 0, KasaError::ZeroAmount);
    require!(amount <= ctx.accounts.member.free(), KasaError::InsufficientFreeSavings);

    let a = &ctx.accounts;
    pay_out(&a.kasa, &a.token_program, &a.vault, &a.mint, &a.to, amount)?;

    let member = &mut ctx.accounts.member;
    member.savings -= amount;
    let kasa = &mut ctx.accounts.kasa;
    kasa.total_savings = kasa.total_savings.checked_sub(amount).ok_or(KasaError::MathOverflow)?;

    emit!(Activity {
        kasa: kasa.key(),
        wallet: ctx.accounts.wallet.key(),
        loan: Pubkey::default(),
        kind: ActivityKind::Withdrew,
        amount,
    });
    Ok(())
}
