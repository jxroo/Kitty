pub mod collateral;
pub mod constants;
pub mod error;
pub mod instructions;
pub mod math;
pub mod state;
pub mod vault;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR");

/// Kitty: a workplace-style savings and loan fund (KZP) with no board
/// and no treasurer. Members' money sits in a vault owned by this program, loans
/// are paid out only when locked savings cover them in full, and overdue
/// installments are collected from that collateral by anyone. There is no admin
/// key and no instruction that lets the founder or the authors move funds.
#[program]
pub mod kasa {
    use super::*;

    pub fn create_kasa(
        ctx: Context<CreateKasa>,
        kasa_id: u64,
        name: String,
        loan_multiplier_bps: u16,
        max_installments: u8,
        period_secs: u32,
        grace_secs: u32,
    ) -> Result<()> {
        instructions::create_kasa::handle_create_kasa(
            ctx,
            kasa_id,
            name,
            loan_multiplier_bps,
            max_installments,
            period_secs,
            grace_secs,
        )
    }

    pub fn join(ctx: Context<Join>, display_name: String) -> Result<()> {
        instructions::member::handle_join(ctx, display_name)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::member::handle_deposit(ctx, amount)
    }

    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        instructions::member::handle_withdraw(ctx, amount)
    }

    pub fn request_loan(ctx: Context<RequestLoan>, amount: u64, installments: u8) -> Result<()> {
        instructions::loan::handle_request_loan(ctx, amount, installments)
    }

    pub fn guarantee(ctx: Context<Guarantee>, amount: u64) -> Result<()> {
        instructions::loan::handle_guarantee(ctx, amount)
    }

    pub fn withdraw_guarantee(ctx: Context<Guarantee>) -> Result<()> {
        instructions::loan::handle_withdraw_guarantee(ctx)
    }

    pub fn cancel_loan(ctx: Context<CancelLoan>) -> Result<()> {
        instructions::loan::handle_cancel_loan(ctx)
    }

    pub fn disburse(ctx: Context<Disburse>) -> Result<()> {
        instructions::loan::handle_disburse(ctx)
    }

    pub fn repay(ctx: Context<Repay>, amount: u64) -> Result<()> {
        instructions::repay::handle_repay(ctx, amount)
    }

    pub fn collect_overdue(ctx: Context<CollectOverdue>) -> Result<()> {
        instructions::repay::handle_collect_overdue(ctx)
    }

    pub fn pull_installment(ctx: Context<PullInstallment>) -> Result<()> {
        instructions::autopay::handle_pull_installment(ctx)
    }

    pub fn set_contribution(ctx: Context<SetContribution>, amount: u64) -> Result<()> {
        instructions::autopay::handle_set_contribution(ctx, amount)
    }

    pub fn pull_contribution(ctx: Context<PullContribution>) -> Result<()> {
        instructions::autopay::handle_pull_contribution(ctx)
    }
}
