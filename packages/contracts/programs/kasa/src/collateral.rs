//! Locking, releasing and seizing collateral. Collateral is never moved out of
//! the vault: it is accounting on `Member.savings` / `Member.locked`, which is why
//! seizing it needs no signature from anyone.

use anchor_lang::prelude::*;

use crate::{
    constants::MAX_GUARANTORS,
    error::KasaError,
    math::split_pro_rata,
    state::{Loan, Member},
};

pub type Guarantors<'a> = [Option<&'a mut Member>; MAX_GUARANTORS];

/// Every recorded guarantor must be passed in its slot, as the Member account of
/// that wallet in this kasa. Without this a caller could skip someone's pledge.
pub fn check_guarantors(loan: &Loan, guarantors: &Guarantors) -> Result<()> {
    for (i, slot) in guarantors.iter().enumerate() {
        if i < loan.guarantor_count as usize {
            let member = slot.as_ref().ok_or(KasaError::GuarantorAccountMismatch)?;
            require_keys_eq!(member.wallet, loan.guarantors[i].wallet, KasaError::GuarantorAccountMismatch);
            require_keys_eq!(member.kasa, loan.kasa, KasaError::GuarantorAccountMismatch);
        }
    }
    Ok(())
}

/// Covers `amount` of overdue debt from locked savings: the borrower's own first,
/// then the guarantors in proportion to what each still has pledged.
/// Returns (taken from borrower, taken from guarantors).
pub fn seize(
    loan: &mut Loan,
    borrower: &mut Member,
    guarantors: &mut Guarantors,
    amount: u64,
) -> Result<(u64, u64)> {
    require!(amount <= loan.collateral(), KasaError::MathOverflow);
    let from_borrower = amount.min(loan.own_collateral);
    take(borrower, from_borrower)?;
    loan.own_collateral -= from_borrower;
    loan.own_seized += from_borrower;

    let from_guarantors = amount - from_borrower;
    let shares = split_pro_rata(from_guarantors, &loan.pledge_weights())?;
    for (i, share) in shares.into_iter().enumerate() {
        if share == 0 {
            continue;
        }
        let member = guarantors[i].as_deref_mut().ok_or(KasaError::GuarantorAccountMismatch)?;
        take(member, share)?;
        loan.guarantors[i].amount -= share;
        loan.guarantors[i].seized += share;
    }
    loan.seized += amount;
    Ok((from_borrower, from_guarantors))
}

/// After a repayment the loan is over-collateralized; give the excess back,
/// guarantors first (they are the last line of defence, so they leave first).
pub fn release_excess(loan: &mut Loan, borrower: &mut Member, guarantors: &mut Guarantors) -> Result<()> {
    let excess = loan.collateral().saturating_sub(loan.outstanding());
    if excess == 0 {
        return Ok(());
    }
    let from_guarantors = excess.min(loan.pledged());
    let shares = split_pro_rata(from_guarantors, &loan.pledge_weights())?;
    for (i, share) in shares.into_iter().enumerate() {
        if share == 0 {
            continue;
        }
        let member = guarantors[i].as_deref_mut().ok_or(KasaError::GuarantorAccountMismatch)?;
        member.locked -= share;
        loan.guarantors[i].amount -= share;
    }
    let from_borrower = excess - from_guarantors;
    borrower.locked -= from_borrower;
    loan.own_collateral -= from_borrower;
    Ok(())
}

fn take(member: &mut Member, amount: u64) -> Result<()> {
    member.savings = member.savings.checked_sub(amount).ok_or(KasaError::MathOverflow)?;
    member.locked = member.locked.checked_sub(amount).ok_or(KasaError::MathOverflow)?;
    member.total_seized += amount;
    Ok(())
}
