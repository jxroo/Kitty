use anchor_lang::prelude::*;

#[error_code]
pub enum KasaError {
    #[msg("Name must be 1-40 bytes")]
    InvalidName,
    #[msg("Display name must be 1-24 bytes")]
    InvalidDisplayName,
    #[msg("Loan multiple must be between 1x and 5x savings")]
    InvalidMultiplier,
    #[msg("Number of installments is out of range")]
    InvalidInstallments,
    #[msg("Installment period must be between 30 s and 90 days")]
    InvalidPeriod,
    #[msg("Grace period is too long")]
    InvalidGrace,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Not enough free (unlocked) savings")]
    InsufficientFreeSavings,
    #[msg("Loan exceeds the multiple of your savings allowed by this kasa")]
    LoanLimitExceeded,
    #[msg("You already have an open loan in this kasa")]
    OpenLoanExists,
    #[msg("Loan is not waiting for guarantors")]
    LoanNotPending,
    #[msg("Loan is not active")]
    LoanNotActive,
    #[msg("Only the borrower can do this")]
    NotBorrower,
    #[msg("A borrower cannot guarantee their own loan")]
    CannotGuaranteeOwnLoan,
    #[msg("This loan already has the maximum number of guarantors")]
    TooManyGuarantors,
    #[msg("Pledge exceeds the part of the loan that is still uncovered")]
    OverCollateralized,
    #[msg("Signer is not a guarantor of this loan")]
    NotAGuarantor,
    #[msg("Loan is not fully covered by locked savings yet")]
    CollateralIncomplete,
    #[msg("Repayment exceeds what is still owed")]
    RepayExceedsOutstanding,
    #[msg("No installment is overdue yet")]
    NothingOverdue,
    #[msg("Guarantor accounts do not match the loan")]
    GuarantorAccountMismatch,
    #[msg("Account belongs to a different kasa")]
    WrongKasa,
    #[msg("Arithmetic overflow")]
    MathOverflow,
}
