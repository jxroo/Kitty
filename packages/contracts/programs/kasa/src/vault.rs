use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{
    constants::{KASA_SEED, MEMBER_SEED},
    state::{Kasa, Member},
};

/// Member's tokens into the vault, signed by the member.
pub fn pay_in<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    vault: &Account<'info, TokenAccount>,
    authority: &Signer<'info>,
    amount: u64,
) -> Result<()> {
    transfer_checked(
        CpiContext::new(
            token_program.key(),
            TransferChecked {
                from: from.to_account_info(),
                mint: mint.to_account_info(),
                to: vault.to_account_info(),
                authority: authority.to_account_info(),
            },
        ),
        amount,
        mint.decimals,
    )
}

/// Tokens out of the vault. Only this program can sign for the Kasa PDA, so the
/// callers of this function (withdraw, disburse) are the only ways money leaves.
pub fn pay_out<'info>(
    kasa: &Account<'info, Kasa>,
    token_program: &Program<'info, Token>,
    vault: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    to: &Account<'info, TokenAccount>,
    amount: u64,
) -> Result<()> {
    let kasa_id = kasa.kasa_id.to_le_bytes();
    let seeds: &[&[u8]] = &[KASA_SEED, kasa.founder.as_ref(), &kasa_id, &[kasa.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: vault.to_account_info(),
                mint: mint.to_account_info(),
                to: to.to_account_info(),
                authority: kasa.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}

/// How much the program may pull from `from` under the member's direct-debit
/// mandate: the SPL allowance granted to their Member PDA, capped by the balance.
/// Zero when the account names no delegate or a different one (revoked mandate).
pub fn mandate_available(from: &TokenAccount, member: &Pubkey) -> u64 {
    if from.delegate.contains(member) {
        from.delegated_amount.min(from.amount)
    } else {
        0
    }
}

/// Member's tokens into the vault under their mandate. The program signs as the
/// member's PDA, the delegate the member chose; the SPL Token program caps it at
/// the allowance, and the callers (pull_installment, pull_contribution) take only
/// what the rules say is due.
pub fn pay_in_by_mandate<'info>(
    token_program: &Program<'info, Token>,
    from: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    vault: &Account<'info, TokenAccount>,
    member: &Account<'info, Member>,
    amount: u64,
) -> Result<()> {
    let seeds: &[&[u8]] = &[MEMBER_SEED, member.kasa.as_ref(), member.wallet.as_ref(), &[member.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            token_program.key(),
            TransferChecked {
                from: from.to_account_info(),
                mint: mint.to_account_info(),
                to: vault.to_account_info(),
                authority: member.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        mint.decimals,
    )
}
