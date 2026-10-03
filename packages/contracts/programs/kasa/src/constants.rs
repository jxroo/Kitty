use anchor_lang::prelude::*;

#[constant]
pub const KASA_SEED: &[u8] = b"kasa";
#[constant]
pub const VAULT_SEED: &[u8] = b"vault";
#[constant]
pub const MEMBER_SEED: &[u8] = b"member";
#[constant]
pub const LOAN_SEED: &[u8] = b"loan";

pub const BPS_DENOMINATOR: u64 = 10_000;

/// A loan can be 1x to 5x the borrower's savings; the founder picks the multiple once, forever.
#[constant]
pub const MIN_LOAN_MULTIPLIER_BPS: u16 = 10_000;
#[constant]
pub const MAX_LOAN_MULTIPLIER_BPS: u16 = 50_000;

#[constant]
pub const MAX_INSTALLMENTS: u8 = 24;

/// 30 s minimum keeps the overdue path demoable live; 90 days is a sane ceiling for one installment.
#[constant]
pub const MIN_PERIOD_SECS: u32 = 30;
#[constant]
pub const MAX_PERIOD_SECS: u32 = 90 * 24 * 60 * 60;
#[constant]
pub const MAX_GRACE_SECS: u32 = 30 * 24 * 60 * 60;

/// Like a KZP "żyrant": at most three members can vouch for one loan.
pub const MAX_GUARANTORS: usize = 3;

pub const MAX_NAME_LEN: usize = 40;
pub const MAX_DISPLAY_NAME_LEN: usize = 24;
