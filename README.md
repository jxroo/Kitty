<p align="center"><img src="packages/web/src/app/opengraph-image.png" alt="Kitty: a guilloche rosette, with the program address engraved around its rim"></p>

# Kitty

**Savings, 0% loans, direct debits and standing orders with no board, no treasurer and no bank.** Members of a group (a team at work, a school, friends, a family) save together and lend each other money at 0%, like a Polish *kasa zapomogowo-pożyczkowa* (KZP). The money sits in an account owned by a Solana program instead of a treasurer's bank account. Loans need no approval: they pay out once members' locked savings cover them 100%. **Installments leave the borrower's wallet by themselves on the due date** under a revocable SPL mandate, pulled by a bot that has no rights at all; if the wallet is empty or the mandate revoked, the installment is collected from collateral after grace. Nobody has to press anything, and nobody's consent is needed.

Built for the **Superteam Poland "Finance Without Intermediaries"** challenge at HackYeah 2026.

| | |
|---|---|
| Live app (Solana devnet, English UI) | https://web-production-ad49f.up.railway.app |
| Program (devnet) | [`2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR`](https://explorer.solana.com/address/2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR?cluster=devnet) (Anchor 1.1.2, IDL published on-chain) |
| The bot ("automat"): fee payer, no rights | [`AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz`](https://explorer.solana.com/address/AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz?cluster=devnet), runs [`scripts/crank.ts`](packages/web/scripts/crank.ts) on Railway |
| Test złoty (tPLN) mint | [`3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG`](https://explorer.solana.com/address/3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG?cluster=devnet) (SPL Token, 2 decimals = grosze) |
| Pitch deck (10 slides) | [pitch.pdf](pitch.pdf) |
| Submission text | [SUBMISSION.md](SUBMISSION.md) |

## Who it is for

**Small groups in Poland that already pool money**: workplace KZPs (common in schools, public offices and factories), teams with a "kasa koleżeńska", friends and families who lend to each other. In this version they use a Solana wallet on devnet, so the first users are deliberately crypto-aware. The interface is in Polish and written for people who don't work in finance or crypto: amounts in złoty, everyday words instead of "collateral", "grace period" or "enforcement", every program error explained in one sentence, technical details folded away, explorer links only for those who want proof.

## The bank services it replaces

A transfer without a bank is already solved: anyone can send an SPL token wallet to wallet. What still sends people to a bank (or to a payday lender) is everything around it. Each row below is a rule in the program or a read of its accounts, not a promise of a server.

| What people go to a bank for | Who intermediates today | What replaces it here | Where |
|---|---|---|---|
| A place to keep savings | bank, the KZP treasurer | a vault owned by the program; only the rules can move it | [`vault.rs:35`](packages/contracts/programs/kasa/src/vault.rs#L35) |
| Credit | bank (scoring, approval), the KZP board | 100% collateral from own savings + guarantors' pledges, 0% interest | [`loan.rs:248`](packages/contracts/programs/kasa/src/instructions/loan.rs#L248) |
| Direct debit / payroll deduction of installments | bank + employer | SPL allowance to the member's own PDA; anyone (a bot) pulls **only what is due** from the due date | [`autopay.rs:57`](packages/contracts/programs/kasa/src/instructions/autopay.rs#L57) |
| Debt collection | collection agency | after grace anyone collects from collateral, borrower first, then guarantors pro rata | [`repay.rs:96`](packages/contracts/programs/kasa/src/instructions/repay.rs#L96) |
| Standing order into savings | bank | standing contribution pulled once per period under the same mandate | [`autopay.rs:142`](packages/contracts/programs/kasa/src/instructions/autopay.rs#L142) |
| A bank statement | bank | "Historia kasy": every movement of the kasa's money, read from the transactions on the chain, with the vault balance after each one, who sent it (a member or the bot) and a link to the transaction; the running balance is checked against the vault | [`ledger.ts`](packages/web/src/lib/ledger.ts) |
| Credit bureau (BIK) | BIK | every loan account stays on-chain; the app shows a borrower's record across all kasas to a guarantor before they vouch (information, not a rule) | [`history.ts:33`](packages/web/src/lib/history.ts#L33) |
| Scale beyond one group | — | any number of kasas on one program; the home page sums the whole network from chain accounts | [`history.ts`](packages/web/src/lib/history.ts) |
| A transfer | bank, Elixir, BLIK | plain SPL transfer. Solana already does this; we did not reinvent it | — |

## The relationship we redesigned, and its intermediary

A KZP is mutual credit: members save every month and borrow from the common pot without interest; a borrower needs co-members to vouch for the loan (*poręczyciele*). It only works because of intermediaries:

- **the board (zarząd)** decides who gets a loan;
- **the treasurer** holds the money and the books;
- **the employer** deducts contributions and installments from salaries and chases defaulters (outside a workplace, the same job falls to a **bank**: a standing order, a direct debit).

Members have to trust them, and when that trust fails nobody can do anything about it: a PKZP treasurer from Jawor county embezzled 61,000 zł of colleagues' savings and lost it on a crypto exchange ([Puls Legnicy, 2024](https://pulslegnicy.pl/kryptowalutowa-afera-w-powiecie-jaworskim-skarbnik-ukradla-61-tys-zl-i-przegrala-je-na-gieldzie/41160/)); a PKZP cashier hid 261,510 zł of withdrawals with falsified cash reports for ten years ([Court of Appeal in Katowice, II AKa 98/15](https://www.saos.org.pl/judgments/175906)). Informal groups have it worse: "the kasa" is simply someone's private bank account. Since 2021 KZPs are regulated by the Act of 11 August 2021 on benefit-loan funds (Dz.U. 2021 poz. 1666), which still assumes a board, an audit committee and payroll deductions.

| | KZP / group kasa today | Kitty |
|---|---|---|
| Who holds the money | The treasurer (KZP bank account or a private one) | A token account owned by the program; only the rules can move it |
| Who approves loans | The board | Nobody. A loan pays out when locked savings (own + guarantors') cover 100% of it |
| Who collects installments | The employer's payroll, then the board | On the due date the program pulls the installment from the borrower's wallet under their mandate (anyone can submit it; our bot does). If that fails, after grace **anyone** can trigger collection from collateral |
| Monthly contributions | Payroll deduction | A standing contribution pulled once per period under the same mandate |
| Who knows if someone repays | Board members' memory; BIK for banks | The borrower's full record in loan accounts on-chain, across every kasa |
| Getting your savings back | Board decision, usually when leaving the job | Any time, for your unlocked savings, without asking |
| Changing the rules | General meeting or board | Impossible: no instruction edits a kasa's rules, no admin key |
| Interest and fees | 0% interest, admin effort | 0% interest, ~0.000005 SOL network fee |

## Why the fund can never lose

1. A loan can be paid out only when **locked savings cover 100% of it**: the borrower's own free savings first, then pledges from guarantors (up to 3).
2. Every repayment (by hand or pulled under the mandate) immediately **unlocks the same amount of collateral**, guarantors first (they are the last line of defence, so they leave first).
3. An overdue installment is **taken from the collateral**: the borrower's locked savings first, then guarantors pro rata. The tokens are already in the vault, so this is bookkeeping that needs no signature.
4. Therefore, always: **vault balance = Σ savings − Σ outstanding loans**, and every member's *free* savings are in the vault. Anyone can withdraw what is theirs at any moment; a run on the fund cannot fail. The LiteSVM tests assert this after every step, including a full bank run.

The only person who can lose money is a guarantor who chose to vouch for someone who then didn't pay. That is exactly the risk a *poręczyciel* takes in a KZP today, but now it is explicit, capped at the pledge, and visible to everyone.

```
request_loan ──► Pending ──(pledges reach 100%)──► disburse (+ SPL approve) ──► Active ──repay / pull_installment / collect_overdue──► Repaid
 (own savings       │  guarantee / withdraw_guarantee                                │
  locked)           └─ cancel_loan ──► Cancelled (all unlocked)                      └ installment k due at start + k·period:
                                                                                        from then on pulled from the wallet (mandate),
                                                                                        after + grace collectible from collateral
```

## Where exactly the intermediary disappears

All in `packages/contracts/programs/kasa/src/`:

| Rule that replaces the intermediary | Code |
|---|---|
| Money leaves the vault only through this function (callers: `withdraw`, `disburse`) | [`vault.rs:35`](packages/contracts/programs/kasa/src/vault.rs#L35) |
| No board: payout requires collateral = 100% of the loan, nothing else | [`instructions/loan.rs:248`](packages/contracts/programs/kasa/src/instructions/loan.rs#L248) |
| No payroll, no bank: from the due date anyone pulls what is due, capped by the mandate, only from the borrower's own account | [`instructions/autopay.rs:57`](packages/contracts/programs/kasa/src/instructions/autopay.rs#L57), [`autopay.rs:47`](packages/contracts/programs/kasa/src/instructions/autopay.rs#L47) |
| The mandate counts only if the wallet named this member's PDA as delegate; the program signs as that PDA | [`vault.rs:64`](packages/contracts/programs/kasa/src/vault.rs#L64), [`vault.rs:76`](packages/contracts/programs/kasa/src/vault.rs#L76) |
| Standing order: the contribution, once per period, all or nothing, no piling up of missed periods | [`instructions/autopay.rs:142`](packages/contracts/programs/kasa/src/instructions/autopay.rs#L142) |
| No debt collector: overdue amount computed from the schedule and the clock, collectable by anyone | [`instructions/repay.rs:96`](packages/contracts/programs/kasa/src/instructions/repay.rs#L96) |
| Seizure order: borrower's savings first, then guarantors pro rata | [`collateral.rs:32`](packages/contracts/programs/kasa/src/collateral.rs#L32) |
| Every guarantor account must be passed and match the loan, so nobody can be skipped | [`collateral.rs:18`](packages/contracts/programs/kasa/src/collateral.rs#L18) |
| Free savings withdrawable at any time, without asking | [`instructions/member.rs:127`](packages/contracts/programs/kasa/src/instructions/member.rs#L127) |
| Rules fixed at creation; the founder is not checked by any later instruction | [`instructions/create_kasa.rs:40`](packages/contracts/programs/kasa/src/instructions/create_kasa.rs#L40) |
| Loan limit = multiple of savings, own savings locked first | [`instructions/loan.rs:42`](packages/contracts/programs/kasa/src/instructions/loan.rs#L42) |

## What if someone disappears halfway?

| Who goes silent | Where the money is | What happens |
|---|---|---|
| The borrower stops paying (revokes the mandate or empties the wallet) | Disbursed tokens are with the borrower; the collateral is locked in the vault | The bot's `pull_installment` is refused (`NoMandate`) or takes what is left. After each due date + grace the bot (or anyone) calls `collect_overdue` and the installment is taken from the borrower's locked savings, then from guarantors. The fund ends whole. |
| The bot | n/a: it never holds funds | Nothing breaks. It has no rights, only pays fees; every button it "presses" is in the app for anyone, and its code is public. |
| A guarantor | Their pledge stays locked in the vault | Nothing to do: the pledge unlocks automatically as the loan is repaid. Their free savings remain withdrawable. |
| The founder | n/a | Nothing changes. The founder has no rights after creation. |
| We (the authors) and this website | In the program's vault | Nothing changes. The program and its IDL are on-chain; any client can build the transactions. |

## Who can do what

| Action | Who | Enforced by |
|---|---|---|
| Create a kasa and set its rules (1–5× loan multiple, up to 24 installments, period, grace) | Anyone, once per kasa | `create_kasa`; no instruction edits them later |
| Join, deposit, withdraw free savings | Any wallet, for itself | `join` (no approval), `deposit`, `withdraw` (≤ savings − locked) |
| Ask for a loan | A member without an open loan, up to multiple × savings | `request_loan` |
| Guarantee | Any other member, from their free savings, up to the uncovered part | `guarantee` (borrower can't guarantee own loan) |
| Pay out / cancel a pending loan | The borrower only | `has_one = borrower` |
| Repay | Anyone (also on someone's behalf) | `repay` |
| Give or revoke a direct-debit mandate | The wallet's owner only | standard SPL Token `approve` / `revoke`; no instruction of ours |
| Set or cancel a standing contribution | The member, for themselves | `set_contribution` (seeds include the signer) |
| Pull a due installment / contribution under a mandate | **Anyone** (in practice the bot): only what is due, only from that member's account, within the allowance | `pull_installment`, `pull_contribution` (no signer needed) |
| Collect an overdue installment | **Anyone**, after due date + grace | `collect_overdue` (no signer needed) |
| Change rules, freeze or move someone's savings | **Nobody, through any instruction (including us)** | No such instruction exists; see the upgrade-key caveat below |

**Can we, as authors, change anything after deployment?** Not through the program: it has no admin key and no instruction that touches funds or rules outside the logic above, so we cannot edit a kasa's rules or move anyone's savings. The bot is not an exception: it signs only as a fee payer, and a mandate can be used solely by the program, as the member's own PDA, for what is due. One trust point remains, and we state it plainly: on devnet the program's **upgrade authority is still our deploy key** (`DhFgUwnupHZphYhJ2qWmD7zfjNE2p8zyRDqFiXo2AxXw`), so we could deploy different code. We keep it during the hackathon to be able to fix bugs. Before real money it would go to a multisig of member representatives, or be removed for good with `solana program set-upgrade-authority --final`. Anyone can check the current state with `solana program show 2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR --url devnet`. (An earlier version without direct debit stays deployed at `EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2`.)

## Why blockchain and not a regular database?

In a database the intermediary is whoever runs it: they can change a balance, hold back a withdrawal or "borrow" from the pot, which is exactly what happens in the cases above. Here the balance is a token account owned by the program, the rules are public code that no instruction can bypass, every member sees every operation in real time, and collection of an overdue installment needs no trusted server because anyone can trigger it. A direct debit is the clearest case: at a bank it needs a bank both sides trust to honour the mandate and the amount. Here the SPL Token program enforces the allowance, our program enforces the amount and the date, and the bot that submits the transaction can do nothing more than anyone else can. Solana makes this cheap enough for a monthly 100 zł contribution: a transaction confirms in under a second for a fraction of a cent.

## Why there is no arbiter (and why we did not build a marketplace)

We started from escrow for second-hand trades between strangers. Any escrow for physical goods needs someone to say whether the parcel arrived and what was in it: an arbiter or an oracle. An arbiter is still an intermediary; bonds that burn both sides' deposits remove the arbiter but punish the honest party too. So we chose a relationship where **every condition is visible on-chain** (deposits, balances, the schedule, the clock), and the program can enforce it alone. Lending fits that pattern, and the KZP is a form of it that many Polish workplaces already use.

## Repository layout

```
packages/
├── contracts/                        Anchor 1.1.2 workspace
│   ├── programs/kasa/src/
│   │   ├── lib.rs                    instruction entrypoints
│   │   ├── state.rs                  Kasa, Member, Loan accounts
│   │   ├── math.rs                   installment schedule, pro-rata split (unit-tested)
│   │   ├── collateral.rs             lock / release / seize collateral
│   │   ├── vault.rs                  the only code that moves tokens in and out
│   │   └── instructions/             create_kasa, member (join/deposit/withdraw),
│   │                                 loan (request/guarantee/cancel/disburse), repay (repay/collect_overdue),
│   │                                 autopay (pull_installment, set_contribution, pull_contribution)
│   └── programs/kasa/tests/kasa.rs   17 LiteSVM tests with the real SPL Token program
└── web/                              Next.js 16 app (English UI)
    ├── idl/kasa.json                 IDL from the program build
    ├── src/generated/                typed Kit client generated by Codama
    ├── src/lib/                      schedule math mirrored from the program, instruction builders, chain reads,
    │                                 history.ts (credit history and network totals from program accounts),
    │                                 ledger.ts (the kasa's history from transaction logs, vault balance after each event),
    │                                 guilloche.ts (the rosette mark)
    ├── src/components/               kasa list + network, kasa view, loan card, standing order, explainer
    ├── src/app/api/faucet/route.ts   test-złoty faucet (devnet only, see limitations)
    ├── scripts/crank.ts              the bot: pulls due installments/contributions, collects overdue ones
    ├── scripts/                      devnet e2e, Playwright UI e2e, burner wallets, Codama codegen
    └── tests/                        unit tests: the UI's math matches the program's; history, ledger, rosette
pitch.pdf                             10-slide pitch deck
SUBMISSION.md                         submission text
```

There is **no database and no backend that decides anything**. The UI reads every kasa, member and loan with `getProgramAccounts` and sends transactions signed by the user's wallet. Server-side there are two things: the faucet for test złoty and the bot, which only submits transactions the program already allows anyone to submit.

## Run it

Requirements: Node ≥ 20.18; for the program also Rust 1.89, Solana CLI 3.1.x and Anchor 1.1.2.

```bash
# Web app against the deployed devnet program
cd packages/web
npm install
cp .env.example .env.local      # a dedicated devnet RPC is recommended; FAUCET_SECRET_KEY enables the faucet
npm run dev                      # http://localhost:3000
```

Use Phantom, Solflare or Backpack on **devnet**. "Get test PLN" gives a wallet 2000 test złoty (and a little SOL for fees if it has none).

```bash
# The bot (any devnet keypair with a little SOL; it needs no rights)
CRANK_KEYPAIR=~/crank-keypair.json npx tsx scripts/crank.ts
```

```bash
# Program: build + tests (LiteSVM loads target/deploy/kasa.so)
cd packages/contracts
anchor build
cargo test

# Web: unit tests, production build
cd packages/web
npm test
npm run build

# Devnet end-to-end with throwaway wallets and the bot key (prints an explorer link for every step)
FUNDER_KEYPAIR=~/funded.json FAUCET_KEYPAIR=~/tpln-mint-authority.json CRANK_KEYPAIR=~/crank-keypair.json npx tsx scripts/e2e-devnet.ts
# Real UI in headless Chromium with an injected Wallet Standard test wallet per member (the bot must be running)
npx tsx scripts/burners.ts fund && node scripts/ui-e2e.mjs https://web-production-ad49f.up.railway.app .e2e-wallets.json screenshots
```

## What was verified

- **20/20 Rust tests**: 3 unit tests (schedule, pro-rata split) and 17 LiteSVM tests with the real SPL Token program. The original nine: loan backed by guarantors paid out and repaid; overdue installments collected first from the borrower then guarantors by a transaction with no signer; partial repayment then default; withdrawing locked savings, exceeding the limit, guaranteeing your own loan, over-pledging, paying out an uncovered loan, collecting early, skipping or swapping guarantor accounts are all rejected; vault invariant after every step and a full bank run. Eight new ones for the direct debit: an installment pulled from the wallet with no borrower signature (guarantors unlocked first); nothing pulled before the due date; never more than is due even with a large allowance; refused without a mandate or after `revoke`, then collateral pays; refused from someone else's account even if it names the PDA as delegate; a short wallet pays what it has and collateral covers the rest; a loan repaid entirely by mandate followed by a bank run to 0; standing contributions once per period, not piled up, refused without a mandate.
- **18/18 web unit tests**: the UI's schedule, overdue, "due now" and mandate math return the same numbers as the program; credit history and network totals; the kasa history reads only the program's events from transaction logs and follows the vault balance (money in, money out, collections move nothing); the rosette mark is deterministic and drawn from closed curves.
- **Devnet**: [`scripts/e2e-devnet.ts`](packages/web/scripts/e2e-devnet.ts) runs the full story with throwaway wallets and prints an explorer link for every step: the bot key pulls Anna's contribution and Bartek's installment 1 with nobody signing, Bartek revokes, the bot is refused and then collects from collateral, rule-breaking attempts are rejected, everyone withdraws everything and the vault ends at 0.
- **UI**: Playwright drives three real browser sessions (Anna, Bartek, Celina) through create → join → deposit → standing contribution → request → guarantee → pay out with mandate → installment pulled by the bot → revoke → installment collected from collateral by the bot, with the bot running; then checks that the kasa history shows the bot's rows and a balance that matches the vault.

## Honest limitations

- **Test money.** On devnet there is no złoty, so a faucet mints test tPLN. It is the only server-side code and plays no role in the rules; the program accepts any SPL mint, so a real deployment would use a stablecoin (USDC/EURC, or a PLN stablecoin).
- **Wallet required.** Fine for crypto-aware groups, a barrier for a school KZP today (see roadmap).
- **Something has to send the transaction.** Solana programs do not run on a timer. Our bot sends `pull_installment`, `collect_overdue` and `pull_contribution` every few seconds; it has no rights and pays ~0.000005 SOL per transaction. If it stops, the same buttons are in the app for anyone, and anyone can run `scripts/crank.ts`.
- **A mandate is a convenience, not the guarantee.** The borrower can revoke it at any time (a standard SPL `revoke`); the fund is protected by collateral either way.
- **One delegate per token account.** SPL Token allows one delegate per account, so a mandate in a second kasa replaces the first (the app warns). A per-wallet mandate PDA shared by all kasas would remove this.
- **Contributions are opt-in.** A real KZP requires monthly contributions; here a member chooses a standing contribution, and the loan limit scales with what they saved.
- **Credit history is public.** That is what makes it verifiable without a bureau, but it also means anyone can see a wallet's loans. Display names are chosen per kasa; for real use it should be opt-in per kasa.
- **Savings earn nothing**, as in a KZP (0% loans). Idle funds could be put to work, but that would add a counterparty.
- **Legal wrapper.** The Act on benefit-loan funds expects a statute, a board and an audit committee. The program can be the "engine" of such a fund; a fully board-less KZP would need the law to recognise it.
- **Clock.** Deadlines use the cluster clock, which on devnet runs a few seconds behind wall time; the UI uses the chain's clock for countdowns.
- **Upgrade key.** The program is still upgradeable by our deploy key (see "Can we change anything"). That is the one place where users must trust us today.
- **Not audited. Devnet only.** The RPC key in the public bundle is a free devnet key.

## If we had another week

1. **A PLN stablecoin and a BLIK on-ramp, passkey wallets**, so a school KZP can use it without crypto knowledge.
2. **Guarantees across kasas**: vouch for a friend in another group from your own savings, with collateral moving between vaults atomically.
3. **Zapomogi** (grants) from a common fund, released by a member vote with a quorum fixed at creation.
4. Notifications before an installment is pulled, and a per-wallet mandate shared by all kasas.
5. Hand the upgrade authority to a members' multisig (or remove it), verifiable build and an audit; then mainnet.

## Stack

Anchor 1.1.2 · anchor-spl (SPL Token, delegate/allowance for the direct debit) · Solana CLI 3.1.10 · LiteSVM 0.10 · Codama · @solana/kit 8 + kit-plugin-wallet (Wallet Standard) · @solana-program/token · Next.js 16 · Tailwind · Playwright · deployed on Railway (web app + bot) with a Helius devnet RPC.

**AI disclosure.** The project was built with an AI coding assistant (Claude Code) for implementation, tests and documentation; the design decisions and their reasoning are described above, and every claim here is backed by the tests and the devnet run.
