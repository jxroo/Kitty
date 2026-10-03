//! The fund's rules, run against the compiled .so in LiteSVM with the real SPL Token program.
//! `anchor build` first (the test loads target/deploy/kasa.so).

use {
    anchor_lang::{
        prelude::{Clock, Pubkey},
        solana_program::{
            instruction::{AccountMeta, Instruction},
            system_program,
        },
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    kasa::{
        accounts, instruction,
        state::{Kasa, Loan, LoanStatus, Member},
        KASA_SEED, LOAN_SEED, MEMBER_SEED, VAULT_SEED,
    },
    litesvm::LiteSVM,
    litesvm_token::{
        get_spl_account, spl_token, CreateAssociatedTokenAccount, CreateMint, MintTo,
    },
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SOL: u64 = 1_000_000_000;
/// tPLN has 2 decimals: amounts are in grosze.
fn zl(x: u64) -> u64 {
    x * 100
}
const KASA_ID: u64 = 7;
const MULTIPLIER_BPS: u16 = 20_000; // loans up to 2x savings
const MAX_INSTALLMENTS: u8 = 12;
const PERIOD: u32 = 100;
const GRACE: u32 = 10;

struct Env {
    svm: LiteSVM,
    /// Pays fees and is the mint authority; never a member.
    relayer: Keypair,
    founder: Keypair,
    anna: Keypair,
    bartek: Keypair,
    celina: Keypair,
    stranger: Keypair,
    mint: Pubkey,
    kasa: Pubkey,
    vault: Pubkey,
}

fn setup() -> Env {
    let mut svm = LiteSVM::new();
    let bytes = include_bytes!(concat!(env!("CARGO_TARGET_TMPDIR"), "/../deploy/kasa.so"));
    svm.add_program(kasa::id(), bytes).unwrap();

    let [relayer, founder, anna, bartek, celina, stranger] = std::array::from_fn(|_| Keypair::new());
    for kp in [&relayer, &founder, &anna, &bartek, &celina, &stranger] {
        svm.airdrop(&kp.pubkey(), 10 * SOL).unwrap();
    }
    let mint = CreateMint::new(&mut svm, &relayer).decimals(2).send().unwrap();
    for kp in [&anna, &bartek, &celina, &stranger] {
        let ata = CreateAssociatedTokenAccount::new(&mut svm, &relayer, &mint)
            .owner(&kp.pubkey())
            .send()
            .unwrap();
        MintTo::new(&mut svm, &relayer, &mint, &ata, zl(5_000)).send().unwrap();
    }
    let kasa = Pubkey::find_program_address(
        &[KASA_SEED, founder.pubkey().as_ref(), &KASA_ID.to_le_bytes()],
        &kasa::id(),
    )
    .0;
    let vault = Pubkey::find_program_address(&[VAULT_SEED, kasa.as_ref()], &kasa::id()).0;
    let mut env = Env {
        svm,
        relayer,
        founder,
        anna,
        bartek,
        celina,
        stranger,
        mint,
        kasa,
        vault,
    };
    env.create_kasa().unwrap();
    env
}

fn ata(owner: &Pubkey, mint: &Pubkey) -> Pubkey {
    Pubkey::find_program_address(
        &[owner.as_ref(), spl_token::ID.as_ref(), mint.as_ref()],
        &Pubkey::from_str_const("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"),
    )
    .0
}

impl Env {
    fn send(&mut self, ix: Instruction, signers: &[&Keypair]) -> Result<(), String> {
        self.svm.expire_blockhash();
        let blockhash = self.svm.latest_blockhash();
        let msg = Message::new_with_blockhash(&[ix], Some(&self.relayer.pubkey()), &blockhash);
        let mut all: Vec<&Keypair> = vec![&self.relayer];
        all.extend_from_slice(signers);
        let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &all).unwrap();
        self.svm
            .send_transaction(tx)
            .map(|_| ())
            .map_err(|e| format!("{:?}\n{}", e.err, e.meta.logs.join("\n")))
    }

    fn ix(&self, data: impl InstructionData, accounts: impl ToAccountMetas) -> Instruction {
        Instruction::new_with_bytes(kasa::id(), &data.data(), accounts.to_account_metas(None))
    }

    fn read<T: AccountDeserialize>(&self, key: &Pubkey) -> T {
        let account = self.svm.get_account(key).unwrap();
        T::try_deserialize(&mut account.data.as_slice()).unwrap()
    }

    fn kasa_state(&self) -> Kasa {
        self.read(&self.kasa)
    }

    fn member_pda(&self, wallet: &Pubkey) -> Pubkey {
        Pubkey::find_program_address(&[MEMBER_SEED, self.kasa.as_ref(), wallet.as_ref()], &kasa::id()).0
    }

    fn member(&self, wallet: &Keypair) -> Member {
        self.read(&self.member_pda(&wallet.pubkey()))
    }

    fn loan_pda(&self, borrower: &Pubkey, index: u32) -> Pubkey {
        Pubkey::find_program_address(
            &[LOAN_SEED, self.kasa.as_ref(), borrower.as_ref(), &index.to_le_bytes()],
            &kasa::id(),
        )
        .0
    }

    fn loan(&self, key: &Pubkey) -> Loan {
        self.read(key)
    }

    fn tokens(&self, account: &Pubkey) -> u64 {
        get_spl_account::<spl_token::state::Account>(&self.svm, account).unwrap().amount
    }

    fn wallet_tokens(&self, owner: &Keypair) -> u64 {
        self.tokens(&ata(&owner.pubkey(), &self.mint))
    }

    fn warp(&mut self, secs: i64) {
        let mut clock: Clock = self.svm.get_sysvar();
        clock.unix_timestamp += secs;
        self.svm.set_sysvar(&clock);
    }

    /// vault balance == total savings - outstanding loans, and the totals match the members.
    fn assert_invariants(&self, members: &[&Keypair]) {
        let kasa = self.kasa_state();
        assert_eq!(
            self.tokens(&self.vault),
            kasa.total_savings - kasa.total_outstanding,
            "vault must hold every saving that is not lent out"
        );
        let mut savings = 0;
        let mut free = 0;
        for m in members {
            let state = self.member(m);
            assert!(state.locked <= state.savings, "locked can never exceed savings");
            savings += state.savings;
            free += state.free();
        }
        assert_eq!(savings, kasa.total_savings);
        assert!(self.tokens(&self.vault) >= free, "every free saving is withdrawable");
    }

    // ---- instructions ----

    fn create_kasa(&mut self) -> Result<(), String> {
        let ix = self.ix(
            instruction::CreateKasa {
                kasa_id: KASA_ID,
                name: "Kasa Działu IT".into(),
                loan_multiplier_bps: MULTIPLIER_BPS,
                max_installments: MAX_INSTALLMENTS,
                period_secs: PERIOD,
                grace_secs: GRACE,
            },
            accounts::CreateKasa {
                founder: self.founder.pubkey(),
                kasa: self.kasa,
                mint: self.mint,
                vault: self.vault,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            },
        );
        let founder = self.founder.insecure_clone();
        self.send(ix, &[&founder])
    }

    fn join(&mut self, who: &Keypair, name: &str) -> Result<(), String> {
        let ix = self.ix(
            instruction::Join { display_name: name.into() },
            accounts::Join {
                wallet: who.pubkey(),
                kasa: self.kasa,
                member: self.member_pda(&who.pubkey()),
                system_program: system_program::ID,
            },
        );
        self.send(ix, &[who])
    }

    fn deposit(&mut self, who: &Keypair, amount: u64) -> Result<(), String> {
        let ix = self.ix(
            instruction::Deposit { amount },
            accounts::Deposit {
                wallet: who.pubkey(),
                kasa: self.kasa,
                member: self.member_pda(&who.pubkey()),
                mint: self.mint,
                vault: self.vault,
                from: ata(&who.pubkey(), &self.mint),
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[who])
    }

    fn withdraw(&mut self, who: &Keypair, amount: u64) -> Result<(), String> {
        let ix = self.ix(
            instruction::Withdraw { amount },
            accounts::Withdraw {
                wallet: who.pubkey(),
                kasa: self.kasa,
                member: self.member_pda(&who.pubkey()),
                mint: self.mint,
                vault: self.vault,
                to: ata(&who.pubkey(), &self.mint),
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[who])
    }

    fn request_loan(&mut self, who: &Keypair, amount: u64, installments: u8) -> Result<Pubkey, String> {
        let index = self.member(who).loan_count;
        let loan = self.loan_pda(&who.pubkey(), index);
        let ix = self.ix(
            instruction::RequestLoan { amount, installments },
            accounts::RequestLoan {
                borrower: who.pubkey(),
                kasa: self.kasa,
                borrower_member: self.member_pda(&who.pubkey()),
                loan,
                system_program: system_program::ID,
            },
        );
        self.send(ix, &[who]).map(|_| loan)
    }

    fn guarantee(&mut self, who: &Keypair, loan: Pubkey, amount: u64) -> Result<(), String> {
        let ix = self.ix(
            instruction::Guarantee { amount },
            accounts::Guarantee {
                guarantor: who.pubkey(),
                kasa: self.kasa,
                loan,
                guarantor_member: self.member_pda(&who.pubkey()),
            },
        );
        self.send(ix, &[who])
    }

    fn withdraw_guarantee(&mut self, who: &Keypair, loan: Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::WithdrawGuarantee {},
            accounts::Guarantee {
                guarantor: who.pubkey(),
                kasa: self.kasa,
                loan,
                guarantor_member: self.member_pda(&who.pubkey()),
            },
        );
        self.send(ix, &[who])
    }

    /// The guarantor Member PDAs in the loan's slot order.
    fn guarantor_slots(&self, loan: &Pubkey) -> [Option<Pubkey>; 3] {
        let state = self.loan(loan);
        std::array::from_fn(|i| {
            (i < state.guarantor_count as usize).then(|| self.member_pda(&state.guarantors[i].wallet))
        })
    }

    fn cancel_loan(&mut self, who: &Keypair, loan: Pubkey) -> Result<(), String> {
        let [g0, g1, g2] = self.guarantor_slots(&loan);
        let ix = self.ix(
            instruction::CancelLoan {},
            accounts::CancelLoan {
                borrower: who.pubkey(),
                kasa: self.kasa,
                loan,
                borrower_member: self.member_pda(&who.pubkey()),
                guarantor0: g0,
                guarantor1: g1,
                guarantor2: g2,
            },
        );
        self.send(ix, &[who])
    }

    fn disburse(&mut self, who: &Keypair, loan: Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::Disburse {},
            accounts::Disburse {
                borrower: who.pubkey(),
                kasa: self.kasa,
                loan,
                mint: self.mint,
                vault: self.vault,
                to: ata(&who.pubkey(), &self.mint),
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[who])
    }

    fn repay(&mut self, payer: &Keypair, loan: Pubkey, amount: u64) -> Result<(), String> {
        let [g0, g1, g2] = self.guarantor_slots(&loan);
        let borrower = self.loan(&loan).borrower;
        let ix = self.ix(
            instruction::Repay { amount },
            accounts::Repay {
                payer: payer.pubkey(),
                kasa: self.kasa,
                loan,
                borrower_member: self.member_pda(&borrower),
                guarantor0: g0,
                guarantor1: g1,
                guarantor2: g2,
                mint: self.mint,
                vault: self.vault,
                from: ata(&payer.pubkey(), &self.mint),
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[payer])
    }

    /// Submitted with no signer but the relayer (fee payer): anyone can crank it.
    fn collect_overdue_with(&mut self, loan: Pubkey, slots: [Option<Pubkey>; 3]) -> Result<(), String> {
        let borrower = self.loan(&loan).borrower;
        let [g0, g1, g2] = slots;
        let ix = self.ix(
            instruction::CollectOverdue {},
            accounts::CollectOverdue {
                kasa: self.kasa,
                loan,
                borrower_member: self.member_pda(&borrower),
                guarantor0: g0,
                guarantor1: g1,
                guarantor2: g2,
            },
        );
        self.send(ix, &[])
    }

    fn collect_overdue(&mut self, loan: Pubkey) -> Result<(), String> {
        let slots = self.guarantor_slots(&loan);
        self.collect_overdue_with(loan, slots)
    }

    // ---- direct debit (SPL allowance to the member's PDA) ----

    /// SPL Token `Approve`: `owner` lets `delegate` move up to `amount` from their tPLN account.
    fn approve(&mut self, owner: &Keypair, delegate: Pubkey, amount: u64) -> Result<(), String> {
        let mut data = vec![4u8];
        data.extend_from_slice(&amount.to_le_bytes());
        let ix = Instruction {
            program_id: spl_token::ID,
            accounts: vec![
                AccountMeta::new(ata(&owner.pubkey(), &self.mint), false),
                AccountMeta::new_readonly(delegate, false),
                AccountMeta::new_readonly(owner.pubkey(), true),
            ],
            data,
        };
        self.send(ix, &[owner])
    }

    /// The mandate a member gives their own kasa: the delegate is their Member PDA.
    fn grant_mandate(&mut self, owner: &Keypair, amount: u64) -> Result<(), String> {
        let member = self.member_pda(&owner.pubkey());
        self.approve(owner, member, amount)
    }

    /// SPL Token `Revoke`: the owner cancels the mandate at any time.
    fn revoke(&mut self, owner: &Keypair) -> Result<(), String> {
        let ix = Instruction {
            program_id: spl_token::ID,
            accounts: vec![
                AccountMeta::new(ata(&owner.pubkey(), &self.mint), false),
                AccountMeta::new_readonly(owner.pubkey(), true),
            ],
            data: vec![5u8],
        };
        self.send(ix, &[owner])
    }

    /// SPL Token `Transfer` out of a wallet (the borrower spending their money elsewhere).
    fn spend(&mut self, owner: &Keypair, to: &Pubkey, amount: u64) -> Result<(), String> {
        let mut data = vec![3u8];
        data.extend_from_slice(&amount.to_le_bytes());
        let ix = Instruction {
            program_id: spl_token::ID,
            accounts: vec![
                AccountMeta::new(ata(&owner.pubkey(), &self.mint), false),
                AccountMeta::new(ata(to, &self.mint), false),
                AccountMeta::new_readonly(owner.pubkey(), true),
            ],
            data,
        };
        self.send(ix, &[owner])
    }

    fn delegated(&self, owner: &Keypair) -> u64 {
        get_spl_account::<spl_token::state::Account>(&self.svm, &ata(&owner.pubkey(), &self.mint))
            .unwrap()
            .delegated_amount
    }

    /// Submitted with no signer but the relayer: a bot (or anyone) pulls the installment.
    fn pull_installment_from(&mut self, loan: Pubkey, from: Pubkey) -> Result<(), String> {
        let [g0, g1, g2] = self.guarantor_slots(&loan);
        let borrower = self.loan(&loan).borrower;
        let ix = self.ix(
            instruction::PullInstallment {},
            accounts::PullInstallment {
                kasa: self.kasa,
                loan,
                borrower_member: self.member_pda(&borrower),
                guarantor0: g0,
                guarantor1: g1,
                guarantor2: g2,
                mint: self.mint,
                vault: self.vault,
                from,
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[])
    }

    fn pull_installment(&mut self, loan: Pubkey) -> Result<(), String> {
        let borrower = self.loan(&loan).borrower;
        self.pull_installment_from(loan, ata(&borrower, &self.mint))
    }

    fn set_contribution(&mut self, who: &Keypair, amount: u64) -> Result<(), String> {
        let ix = self.ix(
            instruction::SetContribution { amount },
            accounts::SetContribution {
                wallet: who.pubkey(),
                kasa: self.kasa,
                member: self.member_pda(&who.pubkey()),
            },
        );
        self.send(ix, &[who])
    }

    /// Submitted with no signer but the relayer.
    fn pull_contribution(&mut self, who: &Pubkey) -> Result<(), String> {
        let ix = self.ix(
            instruction::PullContribution {},
            accounts::PullContribution {
                kasa: self.kasa,
                member: self.member_pda(who),
                mint: self.mint,
                vault: self.vault,
                from: ata(who, &self.mint),
                token_program: spl_token::ID,
            },
        );
        self.send(ix, &[])
    }

    /// Anna 1000 zł, Bartek 500 zł, Celina 1000 zł; Bartek asks for 1000 zł in 4
    /// installments (own 500 locked), Anna pledges 300, Celina 200, paid out.
    fn standard_loan(&mut self) -> Pubkey {
        let (anna, bartek, celina) = (
            self.anna.insecure_clone(),
            self.bartek.insecure_clone(),
            self.celina.insecure_clone(),
        );
        self.join(&anna, "Anna").unwrap();
        self.join(&bartek, "Bartek").unwrap();
        self.join(&celina, "Celina").unwrap();
        self.deposit(&anna, zl(1_000)).unwrap();
        self.deposit(&bartek, zl(500)).unwrap();
        self.deposit(&celina, zl(1_000)).unwrap();
        let loan = self.request_loan(&bartek, zl(1_000), 4).unwrap();
        self.guarantee(&anna, loan, zl(300)).unwrap();
        self.guarantee(&celina, loan, zl(200)).unwrap();
        self.disburse(&bartek, loan).unwrap();
        loan
    }

    fn all(&self) -> [Keypair; 3] {
        [
            self.anna.insecure_clone(),
            self.bartek.insecure_clone(),
            self.celina.insecure_clone(),
        ]
    }
}

fn err_contains(result: Result<(), String>, needle: &str) {
    let err = result.expect_err(&format!("expected failure containing {needle}"));
    assert!(err.contains(needle), "expected `{needle}` in:\n{err}");
}

#[test]
fn rules_are_fixed_at_creation() {
    let env = setup();
    let kasa = env.kasa_state();
    assert_eq!(kasa.founder, env.founder.pubkey());
    assert_eq!(kasa.loan_multiplier_bps, MULTIPLIER_BPS);
    assert_eq!(kasa.period_secs, PERIOD);
    assert_eq!(kasa.vault, env.vault);
    assert_eq!(env.tokens(&env.vault), 0);
}

#[test]
fn invalid_rules_are_rejected() {
    let mut env = setup();
    let mut try_create = |id: u64, mult: u16, inst: u8, period: u32| {
        let kasa = Pubkey::find_program_address(
            &[KASA_SEED, env.founder.pubkey().as_ref(), &id.to_le_bytes()],
            &kasa::id(),
        )
        .0;
        let vault = Pubkey::find_program_address(&[VAULT_SEED, kasa.as_ref()], &kasa::id()).0;
        let ix = env.ix(
            instruction::CreateKasa {
                kasa_id: id,
                name: "x".into(),
                loan_multiplier_bps: mult,
                max_installments: inst,
                period_secs: period,
                grace_secs: 0,
            },
            accounts::CreateKasa {
                founder: env.founder.pubkey(),
                kasa,
                mint: env.mint,
                vault,
                token_program: spl_token::ID,
                system_program: system_program::ID,
            },
        );
        let founder = env.founder.insecure_clone();
        env.send(ix, &[&founder])
    };
    err_contains(try_create(100, 60_000, 4, 100), "InvalidMultiplier");
    err_contains(try_create(101, 20_000, 0, 100), "InvalidInstallments");
    err_contains(try_create(102, 20_000, 4, 5), "InvalidPeriod");
}

#[test]
fn loan_backed_by_guarantors_is_paid_out_and_repaid() {
    let mut env = setup();
    let [anna, bartek, celina] = env.all();
    env.join(&anna, "Anna").unwrap();
    env.join(&bartek, "Bartek").unwrap();
    env.join(&celina, "Celina").unwrap();
    env.deposit(&anna, zl(1_000)).unwrap();
    env.deposit(&bartek, zl(500)).unwrap();
    env.deposit(&celina, zl(1_000)).unwrap();
    env.assert_invariants(&[&anna, &bartek, &celina]);

    let loan = env.request_loan(&bartek, zl(1_000), 4).unwrap();
    assert_eq!(env.member(&bartek).locked, zl(500), "own free savings are locked first");
    err_contains(env.disburse(&bartek, loan), "CollateralIncomplete");

    env.guarantee(&anna, loan, zl(300)).unwrap();
    env.guarantee(&celina, loan, zl(200)).unwrap();
    assert_eq!(env.loan(&loan).collateral(), zl(1_000));

    let before = env.wallet_tokens(&bartek);
    env.disburse(&bartek, loan).unwrap();
    assert_eq!(env.wallet_tokens(&bartek), before + zl(1_000));
    assert_eq!(env.loan(&loan).status, LoanStatus::Active);
    assert_eq!(env.tokens(&env.vault), zl(1_500));
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // Every repayment frees collateral, guarantors first, pro rata.
    env.repay(&bartek, loan, zl(250)).unwrap();
    assert_eq!(env.member(&anna).locked, zl(150));
    assert_eq!(env.member(&celina).locked, zl(100));
    assert_eq!(env.member(&bartek).locked, zl(500));
    env.assert_invariants(&[&anna, &bartek, &celina]);

    env.repay(&bartek, loan, zl(750)).unwrap();
    let state = env.loan(&loan);
    assert_eq!(state.status, LoanStatus::Repaid);
    assert_eq!(state.seized, 0);
    for m in [&anna, &bartek, &celina] {
        assert_eq!(env.member(m).locked, 0);
    }
    assert_eq!(env.member(&bartek).open_loans, 0);
    assert_eq!(env.kasa_state().total_outstanding, 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // A new loan is possible once the old one is closed.
    env.request_loan(&bartek, zl(100), 1).unwrap();
}

#[test]
fn overdue_installments_come_from_collateral_without_anyone_signing() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();
    let bartek_cash = env.wallet_tokens(&bartek);

    // Before the first installment is due (+ grace) there is nothing to collect.
    err_contains(env.collect_overdue(loan), "NothingOverdue");
    env.warp(PERIOD as i64 + GRACE as i64 - 1);
    err_contains(env.collect_overdue(loan), "NothingOverdue");

    // Bartek pays nothing. Installment 1 is collected from his own locked savings.
    env.warp(1);
    env.collect_overdue(loan).unwrap();
    assert_eq!(env.member(&bartek).savings, zl(250));
    assert_eq!(env.member(&anna).savings, zl(1_000));
    err_contains(env.collect_overdue(loan), "NothingOverdue");
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // Two more installments: Bartek's last 250, then 250 from guarantors 3:2.
    env.warp(2 * PERIOD as i64);
    env.collect_overdue(loan).unwrap();
    assert_eq!(env.member(&bartek).savings, 0);
    assert_eq!(env.member(&anna).savings, zl(850));
    assert_eq!(env.member(&celina).savings, zl(900));
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // Last installment: guarantors' remaining pledges. Loan closes.
    env.warp(PERIOD as i64);
    env.collect_overdue(loan).unwrap();
    let state = env.loan(&loan);
    assert_eq!(state.status, LoanStatus::Repaid);
    assert_eq!(state.seized, zl(1_000));
    assert_eq!(state.own_seized, zl(500));
    assert_eq!(state.guarantors[0].seized, zl(300));
    assert_eq!(state.guarantors[1].seized, zl(200));
    assert_eq!(env.member(&anna).savings, zl(700));
    assert_eq!(env.member(&celina).savings, zl(800));
    assert_eq!(env.member(&anna).total_seized, zl(300));
    for m in [&anna, &bartek, &celina] {
        assert_eq!(env.member(m).locked, 0);
    }
    // Nobody signed anything: the borrower kept the cash, the fund lost nothing.
    assert_eq!(env.wallet_tokens(&bartek), bartek_cash);
    assert_eq!(env.kasa_state().total_outstanding, 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // Bank run: everyone takes out everything they have left, and it all works.
    env.withdraw(&anna, zl(700)).unwrap();
    env.withdraw(&celina, zl(800)).unwrap();
    assert_eq!(env.tokens(&env.vault), 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn partial_repayment_then_overdue_uses_borrowers_savings_first() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();

    env.repay(&bartek, loan, zl(250)).unwrap(); // installment 1 paid early
    env.warp(2 * PERIOD as i64 + GRACE as i64);
    env.collect_overdue(loan).unwrap(); // installment 2 missed
    let state = env.loan(&loan);
    assert_eq!(state.repaid, zl(250));
    assert_eq!(state.seized, zl(250));
    assert_eq!(state.own_seized, zl(250));
    assert_eq!(env.member(&anna).savings, zl(1_000), "guarantors untouched while borrower has savings");
    assert_eq!(state.collateral(), state.outstanding());
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn locked_savings_cannot_be_withdrawn_and_limits_hold() {
    let mut env = setup();
    let [anna, bartek, celina] = env.all();
    let stranger = env.stranger.insecure_clone();
    env.join(&anna, "Anna").unwrap();
    env.join(&bartek, "Bartek").unwrap();
    env.join(&celina, "Celina").unwrap();
    env.deposit(&anna, zl(1_000)).unwrap();
    env.deposit(&bartek, zl(500)).unwrap();
    env.deposit(&celina, zl(100)).unwrap();

    // Not a member: no Member account, so nothing to deposit into.
    assert!(env.deposit(&stranger, zl(10)).is_err());

    err_contains(env.request_loan(&bartek, zl(1_001), 4).map(|_| ()), "LoanLimitExceeded");
    err_contains(env.request_loan(&bartek, zl(1_000), 13).map(|_| ()), "InvalidInstallments");
    let loan = env.request_loan(&bartek, zl(1_000), 4).unwrap();
    err_contains(env.request_loan(&bartek, zl(10), 1).map(|_| ()), "OpenLoanExists");

    err_contains(env.withdraw(&bartek, zl(1)), "InsufficientFreeSavings");
    err_contains(env.guarantee(&bartek, loan, zl(100)), "CannotGuaranteeOwnLoan");
    err_contains(env.guarantee(&celina, loan, zl(101)), "InsufficientFreeSavings");
    err_contains(env.guarantee(&anna, loan, zl(501)), "OverCollateralized");
    err_contains(env.disburse(&anna, loan), "NotBorrower");

    env.guarantee(&anna, loan, zl(500)).unwrap();
    err_contains(env.withdraw(&anna, zl(501)), "InsufficientFreeSavings");
    env.withdraw(&anna, zl(500)).unwrap(); // the free half is still hers to take
    env.disburse(&bartek, loan).unwrap();

    err_contains(env.guarantee(&celina, loan, zl(10)), "LoanNotPending");
    err_contains(env.withdraw_guarantee(&anna, loan), "LoanNotPending");
    err_contains(env.cancel_loan(&bartek, loan), "LoanNotPending");
    err_contains(env.repay(&bartek, loan, zl(1_001)), "RepayExceedsOutstanding");
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn guarantor_accounts_cannot_be_skipped_or_swapped() {
    let mut env = setup();
    let loan = env.standard_loan();
    let celina_member = env.member_pda(&env.celina.pubkey());
    let anna_member = env.member_pda(&env.anna.pubkey());
    env.warp(10 * PERIOD as i64);
    err_contains(
        env.collect_overdue_with(loan, [Some(anna_member), None, None]),
        "GuarantorAccountMismatch",
    );
    err_contains(
        env.collect_overdue_with(loan, [Some(celina_member), Some(anna_member), None]),
        "GuarantorAccountMismatch",
    );
    env.collect_overdue(loan).unwrap();
}

#[test]
fn pending_loan_can_be_cancelled_and_pledges_withdrawn() {
    let mut env = setup();
    let [anna, bartek, celina] = env.all();
    env.join(&anna, "Anna").unwrap();
    env.join(&bartek, "Bartek").unwrap();
    env.join(&celina, "Celina").unwrap();
    env.deposit(&anna, zl(1_000)).unwrap();
    env.deposit(&bartek, zl(500)).unwrap();
    env.deposit(&celina, zl(1_000)).unwrap();

    let loan = env.request_loan(&bartek, zl(1_000), 4).unwrap();
    env.guarantee(&anna, loan, zl(300)).unwrap();
    env.guarantee(&celina, loan, zl(200)).unwrap();
    env.withdraw_guarantee(&anna, loan).unwrap();
    assert_eq!(env.member(&anna).locked, 0);
    let state = env.loan(&loan);
    assert_eq!(state.guarantor_count, 1);
    assert_eq!(state.guarantors[0].wallet, celina.pubkey());
    err_contains(env.withdraw_guarantee(&anna, loan), "NotAGuarantor");

    err_contains(env.cancel_loan(&anna, loan), "NotBorrower");
    env.cancel_loan(&bartek, loan).unwrap();
    assert_eq!(env.loan(&loan).status, LoanStatus::Cancelled);
    for m in [&anna, &bartek, &celina] {
        assert_eq!(env.member(m).locked, 0);
    }
    assert_eq!(env.member(&bartek).open_loans, 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn anyone_can_repay_on_behalf_of_the_borrower() {
    let mut env = setup();
    let loan = env.standard_loan();
    let stranger = env.stranger.insecure_clone();
    env.repay(&stranger, loan, zl(1_000)).unwrap();
    assert_eq!(env.loan(&loan).status, LoanStatus::Repaid);
    let [anna, bartek, celina] = env.all();
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

// ---- direct debit: the payroll deduction without an employer or a bank ----

#[test]
fn installment_is_pulled_from_the_wallet_by_mandate_without_the_borrower_signing() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();
    env.grant_mandate(&bartek, zl(1_000)).unwrap();
    let cash = env.wallet_tokens(&bartek);

    // Not due yet: the mandate cannot be used early.
    env.warp(PERIOD as i64 - 1);
    err_contains(env.pull_installment(loan), "InstallmentNotDue");

    // On the due date (no grace needed) anyone pulls installment 1 from Bartek's wallet.
    env.warp(1);
    env.pull_installment(loan).unwrap();
    assert_eq!(env.wallet_tokens(&bartek), cash - zl(250));
    assert_eq!(env.delegated(&bartek), zl(750));
    let state = env.loan(&loan);
    assert_eq!(state.repaid, zl(250));
    assert_eq!(state.autopaid, zl(250));
    assert_eq!(state.seized, 0);
    // Like any repayment it frees collateral, guarantors first, 3:2.
    assert_eq!(env.member(&anna).locked, zl(150));
    assert_eq!(env.member(&celina).locked, zl(100));
    assert_eq!(env.member(&bartek).locked, zl(500));
    env.assert_invariants(&[&anna, &bartek, &celina]);

    // Nothing more is due, and nothing is left for the debt collector.
    err_contains(env.pull_installment(loan), "InstallmentNotDue");
    env.warp(GRACE as i64);
    err_contains(env.collect_overdue(loan), "NothingOverdue");
}

#[test]
fn mandate_takes_only_what_is_due_even_with_a_large_allowance() {
    let mut env = setup();
    let loan = env.standard_loan();
    let bartek = env.bartek.insecure_clone();
    env.grant_mandate(&bartek, zl(5_000)).unwrap();
    env.warp(2 * PERIOD as i64);
    env.pull_installment(loan).unwrap();
    assert_eq!(env.loan(&loan).repaid, zl(500), "two installments, not the whole allowance");
    assert_eq!(env.delegated(&bartek), zl(4_500));
    err_contains(env.pull_installment(loan), "InstallmentNotDue");
}

#[test]
fn without_a_mandate_or_after_revoking_it_collateral_covers_the_installment() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();
    env.warp(PERIOD as i64);
    err_contains(env.pull_installment(loan), "NoMandate");

    env.grant_mandate(&bartek, zl(1_000)).unwrap();
    env.revoke(&bartek).unwrap();
    err_contains(env.pull_installment(loan), "NoMandate");

    // The fund never depended on the mandate: after grace the collateral pays.
    env.warp(GRACE as i64);
    env.collect_overdue(loan).unwrap();
    assert_eq!(env.member(&bartek).savings, zl(250));
    assert_eq!(env.loan(&loan).autopaid, 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn mandate_cannot_pull_from_someone_elses_account() {
    let mut env = setup();
    let loan = env.standard_loan();
    let celina = env.celina.insecure_clone();
    // Even if Celina's account names Bartek's Member PDA as delegate, the
    // program only ever pulls from the borrower's own account.
    let bartek_member = env.member_pda(&env.bartek.pubkey());
    env.approve(&celina, bartek_member, zl(1_000)).unwrap();
    env.warp(PERIOD as i64);
    let celina_ata = ata(&celina.pubkey(), &env.mint);
    err_contains(env.pull_installment_from(loan, celina_ata), "WrongPayerAccount");
}

#[test]
fn short_wallet_pays_what_it_has_and_collateral_covers_the_rest() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();
    let stranger = env.stranger.pubkey();
    env.grant_mandate(&bartek, zl(1_000)).unwrap();
    // Bartek spends almost everything; 100 zł is left in his wallet.
    let cash = env.wallet_tokens(&bartek);
    env.spend(&bartek, &stranger, cash - zl(100)).unwrap();

    env.warp(PERIOD as i64);
    env.pull_installment(loan).unwrap();
    assert_eq!(env.wallet_tokens(&bartek), 0);
    assert_eq!(env.loan(&loan).repaid, zl(100));
    err_contains(env.pull_installment(loan), "NoMandate");

    env.warp(GRACE as i64);
    env.collect_overdue(loan).unwrap();
    let state = env.loan(&loan);
    assert_eq!(state.seized, zl(150), "the rest of installment 1 comes from collateral");
    assert_eq!(state.own_seized, zl(150), "borrower's own savings first");
    assert_eq!(env.member(&anna).savings, zl(1_000));
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

#[test]
fn loan_repaid_entirely_by_mandate_then_everyone_withdraws_everything() {
    let mut env = setup();
    let loan = env.standard_loan();
    let [anna, bartek, celina] = env.all();
    env.grant_mandate(&bartek, zl(1_000)).unwrap();
    for _ in 0..4 {
        env.warp(PERIOD as i64);
        env.pull_installment(loan).unwrap();
        env.assert_invariants(&[&anna, &bartek, &celina]);
    }
    let state = env.loan(&loan);
    assert_eq!(state.status, LoanStatus::Repaid);
    assert_eq!(state.autopaid, zl(1_000));
    assert_eq!(state.seized, 0);
    assert_eq!(env.delegated(&bartek), 0);
    for m in [&anna, &bartek, &celina] {
        assert_eq!(env.member(m).locked, 0);
    }
    env.withdraw(&anna, zl(1_000)).unwrap();
    env.withdraw(&bartek, zl(500)).unwrap();
    env.withdraw(&celina, zl(1_000)).unwrap();
    assert_eq!(env.tokens(&env.vault), 0);
    env.assert_invariants(&[&anna, &bartek, &celina]);
}

// ---- standing order: monthly savings without a bank ----

#[test]
fn standing_contribution_is_pulled_once_per_period_by_anyone() {
    let mut env = setup();
    let [anna, _, _] = env.all();
    env.join(&anna, "Anna").unwrap();
    err_contains(env.pull_contribution(&anna.pubkey()), "ContributionNotSet");

    env.set_contribution(&anna, zl(100)).unwrap();
    assert_eq!(env.member(&anna).contribution, zl(100));
    err_contains(env.pull_contribution(&anna.pubkey()), "NoMandate");

    env.grant_mandate(&anna, zl(300)).unwrap();
    let cash = env.wallet_tokens(&anna);
    env.pull_contribution(&anna.pubkey()).unwrap();
    assert_eq!(env.member(&anna).savings, zl(100));
    assert_eq!(env.member(&anna).total_deposited, zl(100));
    assert_eq!(env.wallet_tokens(&anna), cash - zl(100));
    err_contains(env.pull_contribution(&anna.pubkey()), "ContributionNotDue");

    env.warp(PERIOD as i64);
    env.pull_contribution(&anna.pubkey()).unwrap();
    assert_eq!(env.member(&anna).savings, zl(200));

    // A long pause does not pile up: one contribution, not five.
    env.warp(5 * PERIOD as i64);
    env.pull_contribution(&anna.pubkey()).unwrap();
    assert_eq!(env.member(&anna).savings, zl(300));
    err_contains(env.pull_contribution(&anna.pubkey()), "ContributionNotDue");

    // The allowance (300 zł) is used up: the mandate is exhausted.
    env.warp(PERIOD as i64);
    err_contains(env.pull_contribution(&anna.pubkey()), "NoMandate");

    env.set_contribution(&anna, 0).unwrap();
    err_contains(env.pull_contribution(&anna.pubkey()), "ContributionNotSet");
    assert_eq!(env.kasa_state().total_savings, zl(300));
    env.assert_invariants(&[&anna]);
}

#[test]
fn only_the_member_can_set_their_contribution() {
    let mut env = setup();
    let [anna, _, _] = env.all();
    let stranger = env.stranger.insecure_clone();
    env.join(&anna, "Anna").unwrap();
    // The stranger signs, but Anna's Member PDA is not derived from the stranger's wallet.
    let ix = env.ix(
        instruction::SetContribution { amount: zl(100) },
        accounts::SetContribution {
            wallet: stranger.pubkey(),
            kasa: env.kasa,
            member: env.member_pda(&anna.pubkey()),
        },
    );
    assert!(env.send(ix, &[&stranger]).is_err());
    assert_eq!(env.member(&anna).contribution, 0);
}
