use anchor_lang::prelude::*;

use crate::{constants::*, error::KasaError, math};

/// One savings and loan fund. Its rules are fixed at creation: there is no
/// instruction that edits them and the founder keeps no special rights.
#[account]
#[derive(InitSpace)]
pub struct Kasa {
    pub founder: Pubkey,
    pub kasa_id: u64,
    pub mint: Pubkey,
    /// Token account owned by this PDA. Members' money lives here, not with a treasurer.
    pub vault: Pubkey,
    /// Max loan = savings * multiplier / 10_000.
    pub loan_multiplier_bps: u16,
    pub max_installments: u8,
    pub period_secs: u32,
    pub grace_secs: u32,
    /// Sum of all members' savings.
    pub total_savings: u64,
    /// Sum of what disbursed loans still owe. Always `vault balance == total_savings - total_outstanding`.
    pub total_outstanding: u64,
    pub member_count: u32,
    pub loan_count: u32,
    pub created_at: i64,
    #[max_len(40)]
    pub name: String,
    pub bump: u8,
}

impl Kasa {
    pub fn max_loan(&self, savings: u64) -> Result<u64> {
        math::mul_bps(savings, self.loan_multiplier_bps as u64)
    }
}

/// A member's share of the fund. `locked` is the part pledged as collateral
/// (for their own loan or as a guarantor) and cannot be withdrawn.
#[account]
#[derive(InitSpace)]
pub struct Member {
    pub kasa: Pubkey,
    pub wallet: Pubkey,
    pub savings: u64,
    pub locked: u64,
    /// Loans requested so far; also the next loan's PDA index.
    pub loan_count: u32,
    pub open_loans: u8,
    pub total_deposited: u64,
    /// Savings taken to cover overdue installments (own loans or guaranteed ones).
    pub total_seized: u64,
    /// Standing order: amount pulled into savings once per kasa period (0 = none).
    pub contribution: u64,
    /// When the next standing-order contribution may be pulled.
    pub next_contribution_at: i64,
    pub joined_at: i64,
    #[max_len(24)]
    pub display_name: String,
    pub bump: u8,
}

impl Member {
    pub fn free(&self) -> u64 {
        self.savings.saturating_sub(self.locked)
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Default, PartialEq, Eq, InitSpace, Debug)]
pub struct Pledge {
    pub wallet: Pubkey,
    /// Guarantor savings still locked for this loan.
    pub amount: u64,
    /// Guarantor savings already used to cover overdue installments.
    pub seized: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LoanStatus {
    /// Requested; guarantors are pledging. Nothing has left the vault.
    Pending,
    /// Paid out; installments are due.
    Active,
    /// Fully paid back (by the borrower, or from collateral).
    Repaid,
    /// Withdrawn by the borrower before payout; all pledges unlocked.
    Cancelled,
}

/// A loan from the fund. It can only be paid out when locked savings
/// (borrower's own + guarantors') cover 100% of it, so the fund can never lose.
#[account]
#[derive(InitSpace)]
pub struct Loan {
    pub kasa: Pubkey,
    pub borrower: Pubkey,
    pub index: u32,
    pub amount: u64,
    pub installments: u8,
    pub status: LoanStatus,
    pub created_at: i64,
    pub disbursed_at: i64,
    pub closed_at: i64,
    /// Paid back by the borrower (or anyone on their behalf).
    pub repaid: u64,
    /// Taken from collateral because installments were overdue.
    pub seized: u64,
    /// Part of `repaid` pulled from the borrower's wallet under their direct-debit mandate.
    pub autopaid: u64,
    /// Borrower's own savings still locked for this loan.
    pub own_collateral: u64,
    pub own_seized: u64,
    pub guarantor_count: u8,
    pub guarantors: [Pledge; MAX_GUARANTORS],
    pub bump: u8,
}

impl Loan {
    pub fn outstanding(&self) -> u64 {
        self.amount.saturating_sub(self.repaid).saturating_sub(self.seized)
    }

    pub fn pledged(&self) -> u64 {
        self.guarantors.iter().map(|p| p.amount).sum()
    }

    pub fn collateral(&self) -> u64 {
        self.own_collateral + self.pledged()
    }

    /// What should be paid by `now` (installments past due + grace) minus what was paid or seized.
    pub fn overdue(&self, now: i64, period_secs: u32, grace_secs: u32) -> Result<u64> {
        let due = math::due_by(
            self.amount,
            self.installments,
            self.disbursed_at,
            period_secs,
            grace_secs,
            now,
        )?;
        Ok(due.saturating_sub(self.repaid + self.seized))
    }

    pub fn guarantor_index(&self, wallet: &Pubkey) -> Option<usize> {
        self.guarantors[..self.guarantor_count as usize]
            .iter()
            .position(|p| p.wallet == *wallet)
    }

    pub fn pledge_weights(&self) -> [u64; MAX_GUARANTORS] {
        let mut w = [0; MAX_GUARANTORS];
        for (i, p) in self.guarantors.iter().enumerate() {
            w[i] = p.amount;
        }
        w
    }

    pub fn require_status(&self, status: LoanStatus) -> Result<()> {
        match status {
            LoanStatus::Pending => require!(self.status == status, KasaError::LoanNotPending),
            _ => require!(self.status == status, KasaError::LoanNotActive),
        }
        Ok(())
    }
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ActivityKind {
    KasaCreated,
    Joined,
    Deposited,
    Withdrew,
    LoanRequested,
    Guaranteed,
    GuaranteeWithdrawn,
    LoanCancelled,
    Disbursed,
    Repaid,
    OverdueCollected,
    LoanClosed,
    InstallmentPulled,
    ContributionSet,
    ContributionPulled,
}

#[event]
pub struct Activity {
    pub kasa: Pubkey,
    pub wallet: Pubkey,
    /// `Pubkey::default()` when the action is not about a loan.
    pub loan: Pubkey,
    pub kind: ActivityKind,
    pub amount: u64,
}
