use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    constants::*,
    error::KasaError,
    state::{Activity, ActivityKind, Kasa},
};

#[derive(Accounts)]
#[instruction(kasa_id: u64)]
pub struct CreateKasa<'info> {
    #[account(mut)]
    pub founder: Signer<'info>,
    #[account(
        init,
        payer = founder,
        space = 8 + Kasa::INIT_SPACE,
        seeds = [KASA_SEED, founder.key().as_ref(), &kasa_id.to_le_bytes()],
        bump
    )]
    pub kasa: Account<'info, Kasa>,
    pub mint: Account<'info, Mint>,
    #[account(
        init,
        payer = founder,
        seeds = [VAULT_SEED, kasa.key().as_ref()],
        bump,
        token::mint = mint,
        token::authority = kasa,
        token::token_program = token_program
    )]
    pub vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Publishes the fund's rules. Nothing can edit them later, and the founder is
/// recorded only for the PDA address: no instruction checks `founder` again.
pub fn handle_create_kasa(
    ctx: Context<CreateKasa>,
    kasa_id: u64,
    name: String,
    loan_multiplier_bps: u16,
    max_installments: u8,
    period_secs: u32,
    grace_secs: u32,
) -> Result<()> {
    require!(!name.is_empty() && name.len() <= MAX_NAME_LEN, KasaError::InvalidName);
    require!(
        (MIN_LOAN_MULTIPLIER_BPS..=MAX_LOAN_MULTIPLIER_BPS).contains(&loan_multiplier_bps),
        KasaError::InvalidMultiplier
    );
    require!(
        (1..=MAX_INSTALLMENTS).contains(&max_installments),
        KasaError::InvalidInstallments
    );
    require!(
        (MIN_PERIOD_SECS..=MAX_PERIOD_SECS).contains(&period_secs),
        KasaError::InvalidPeriod
    );
    require!(grace_secs <= MAX_GRACE_SECS, KasaError::InvalidGrace);

    let kasa_key = ctx.accounts.kasa.key();
    ctx.accounts.kasa.set_inner(Kasa {
        founder: ctx.accounts.founder.key(),
        kasa_id,
        mint: ctx.accounts.mint.key(),
        vault: ctx.accounts.vault.key(),
        loan_multiplier_bps,
        max_installments,
        period_secs,
        grace_secs,
        total_savings: 0,
        total_outstanding: 0,
        member_count: 0,
        loan_count: 0,
        created_at: Clock::get()?.unix_timestamp,
        name,
        bump: ctx.bumps.kasa,
    });

    emit!(Activity {
        kasa: kasa_key,
        wallet: ctx.accounts.founder.key(),
        loan: Pubkey::default(),
        kind: ActivityKind::KasaCreated,
        amount: 0,
    });
    Ok(())
}
