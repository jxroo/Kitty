//! Pure arithmetic shared by the instructions (and mirrored in packages/web/src/lib/kasa.ts).

use anchor_lang::prelude::*;

use crate::{constants::BPS_DENOMINATOR, error::KasaError};

pub fn mul_bps(amount: u64, bps: u64) -> Result<u64> {
    let value = (amount as u128)
        .checked_mul(bps as u128)
        .ok_or(KasaError::MathOverflow)?
        / BPS_DENOMINATOR as u128;
    u64::try_from(value).map_err(|_| KasaError::MathOverflow.into())
}

/// Amount that must have been paid by `now`: installment k (1..=n) falls due at
/// `start + k * period` and becomes collectible `grace` seconds later.
/// Equal installments; the last one carries the rounding remainder.
pub fn due_by(
    amount: u64,
    installments: u8,
    start: i64,
    period_secs: u32,
    grace_secs: u32,
    now: i64,
) -> Result<u64> {
    let n = installments as i64;
    let elapsed = now - start - grace_secs as i64;
    if elapsed < 0 || n == 0 {
        return Ok(0);
    }
    let count = (elapsed / period_secs as i64).min(n);
    let due = (amount as u128)
        .checked_mul(count as u128)
        .ok_or(KasaError::MathOverflow)?
        / n as u128;
    u64::try_from(due).map_err(|_| KasaError::MathOverflow.into())
}

/// Splits `total` across `weights` in proportion, never giving anyone more than
/// their weight and always summing to exactly `total` (requires `total <= sum(weights)`).
pub fn split_pro_rata<const N: usize>(total: u64, weights: &[u64; N]) -> Result<[u64; N]> {
    let sum: u128 = weights.iter().map(|&w| w as u128).sum();
    require!(total as u128 <= sum, KasaError::MathOverflow);
    let mut shares = [0u64; N];
    if total == 0 {
        return Ok(shares);
    }
    let mut assigned = 0u64;
    for (i, &w) in weights.iter().enumerate() {
        shares[i] = ((total as u128 * w as u128) / sum) as u64;
        assigned += shares[i];
    }
    let mut leftover = total - assigned;
    for (i, &w) in weights.iter().enumerate() {
        if leftover == 0 {
            break;
        }
        let add = leftover.min(w - shares[i]);
        shares[i] += add;
        leftover -= add;
    }
    Ok(shares)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn due_by_follows_schedule_and_grace() {
        // 1000 in 4 installments, every 100 s, 10 s grace, start at t=0.
        assert_eq!(due_by(1000, 4, 0, 100, 10, 109).unwrap(), 0);
        assert_eq!(due_by(1000, 4, 0, 100, 10, 110).unwrap(), 250);
        assert_eq!(due_by(1000, 4, 0, 100, 10, 310).unwrap(), 750);
        assert_eq!(due_by(1000, 4, 0, 100, 10, 10_000).unwrap(), 1000);
        // Remainder lands on the last installment.
        assert_eq!(due_by(1000, 3, 0, 100, 0, 100).unwrap(), 333);
        assert_eq!(due_by(1000, 3, 0, 100, 0, 300).unwrap(), 1000);
    }

    #[test]
    fn split_is_exact_and_capped() {
        assert_eq!(split_pro_rata(500, &[300, 200, 0]).unwrap(), [300, 200, 0]);
        assert_eq!(split_pro_rata(250, &[300, 200, 0]).unwrap(), [150, 100, 0]);
        let s = split_pro_rata(10, &[1, 1, 1]).unwrap_err();
        let _ = s;
        let s = split_pro_rata(2, &[1, 1, 1]).unwrap();
        assert_eq!(s.iter().sum::<u64>(), 2);
        assert!(s.iter().zip([1, 1, 1]).all(|(a, w)| *a <= w));
        let s = split_pro_rata(7, &[3, 3, 3]).unwrap();
        assert_eq!(s.iter().sum::<u64>(), 7);
        assert!(s.iter().all(|a| *a <= 3));
    }
}
