# HackTribe submission draft: Finance Without Intermediaries (Superteam Poland)

> Draft for the HackTribe form. Fill in the fields marked **TODO** before submitting (deadline: 4 Oct 2026, 23:00).

## Project title

**Kasa bez zarządu: a savings and loan fund with no board and no treasurer**

## Team name

**TODO**

## Team members (1–6)

**TODO**: full names (and roles, optional)

## Links

| | |
|---|---|
| Code repository (public) | https://github.com/jxroo/kasa-bez-zarzadu |
| Live demo (Solana devnet) | https://web-production-ad49f.up.railway.app |
| Video (≤ 3 min) | **TODO**: YouTube/Drive link (script: `docs/VIDEO_SCRIPT.md`) |
| Pitch deck (PDF, 10 slides) | `docs/pitch.pdf` in the repo (also attached) |
| On-chain program | [`EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2`](https://explorer.solana.com/address/EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2?cluster=devnet) |
| Recorded devnet run with explorer links | https://github.com/jxroo/kasa-bez-zarzadu/blob/HEAD/docs/devnet-e2e.md |
| Screenshots | https://github.com/jxroo/kasa-bez-zarzadu/tree/HEAD/docs/screenshots |

## Short description (one paragraph)

Kasa bez zarządu is a *kasa zapomogowo-pożyczkowa* (a workplace or group savings and loan fund) where a Solana program replaces the board, the treasurer and the payroll deduction. Members' savings sit in a vault owned by the program, not in a treasurer's account. Anyone can borrow up to a multiple of their savings at 0%, with no approval: the loan pays out once locked savings, their own plus pledges from co-members who vouch for them, cover 100% of it. If an installment is late, anyone can trigger its collection from that collateral, with nobody's consent. Because every loan is fully covered, the vault always holds everyone's free savings and anyone can withdraw theirs at any moment. No instruction lets anyone, including the founder and the authors, change a kasa's rules or move someone else's money.

## Detailed description

### Who we build for

Small groups in Poland that already pool money: workplace KZPs (schools, public offices, factories), teams with a "kasa koleżeńska", friends and families lending to each other. In this version they use a Solana wallet on devnet, so the first users are deliberately crypto-aware. The interface is in Polish and hides the chain: amounts in złoty, plain buttons ("Wpłać", "Poręczam", "Egzekwuj zaległą ratę"), every program error explained in one sentence, explorer links one click away.

### The user flow (working end to end on devnet)

1. **Anna founds a kasa.** She picks the rules once: loans up to 2× savings, up to 6 installments, every 60 s in the demo (a month in the real preset), 15 s grace. She joins as an ordinary member; the founder gets no rights.
2. **Members join from an invite link and deposit test złoty.** Nobody approves members: a newcomer can only risk their own savings.
3. **Bartek asks for 1000 zł in 4 installments.** His 500 zł of free savings are locked as collateral. The program refuses to pay out yet: the loan is only half covered.
4. **Anna pledges 300 zł, Celina 200 zł.** Their savings lock. Collateral now equals the loan.
5. **Bartek pays the loan out to his wallet.** No board, no approval: the only condition is 100% collateral.
6. **Bartek repays installment 1**; the guarantors immediately get 250 zł unlocked, 3:2.
7. **Bartek stops paying.** When installment 2 is past due + grace, **Celina presses "Egzekwuj zaległą ratę"**. The program takes 250 zł from Bartek's locked savings. When his collateral runs out, the rest comes from the guarantors pro rata. Nobody had to sue, call or deduct anything: this is the moment the intermediary is no longer needed.
8. **Anyone withdraws their free savings at any time**, even during all of this. The vault card shows live that vault = savings − lent.

## Design rationale

### Which financial relationship we redesigned

**Mutual credit in a group**: saving together and lending to each other at 0% with co-members as guarantors, the model of the Polish *kasa zapomogowo-pożyczkowa* (regulated since 2021 by the Act of 11 August 2021, Dz.U. 2021 poz. 1666) and of every informal "group kasa".

### Who the intermediary was

- **The treasurer**, who holds the money and the books. When trust fails, members find out late: a PKZP treasurer from Jawor county embezzled 61,000 zł of colleagues' savings and lost it on a crypto exchange (Puls Legnicy, 2024); a PKZP cashier hid 261,510 zł with falsified cash reports for ten years (Court of Appeal in Katowice, II AKa 98/15). In informal groups the kasa is simply someone's private account.
- **The board**, which decides who gets a loan and when savings are returned.
- **The employer's payroll**, which deducts contributions and installments and is the only real enforcement against a defaulter.

### What changes once the intermediary is removed

| | Before | After |
|---|---|---|
| Custody | Treasurer's / KZP bank account | Token account owned by the program; only `withdraw` and `disburse` can move tokens out, along the rules |
| Loan approval | Board decision | None: 100% collateral from locked savings (own + guarantors) |
| Enforcement | Payroll deduction, board chasing debtors | `collect_overdue`: after due date + grace, anyone triggers collection from collateral |
| Getting your savings back | When the board agrees, usually when leaving | Any time for unlocked savings; the vault always holds them |
| Rule changes | General meeting / board | No instruction changes them; no admin key (caveat: program upgrade key, below) |
| Who can lose | Every member, if the treasurer or the books fail | Only a guarantor who chose to vouch, capped at the pledge, as a KZP *poręczyciel* today |

### Why it works without anyone enforcing it

Every condition the program needs is on-chain: deposits, balances, the installment schedule and the clock. Two invariants follow and are tested after every step: each loan is fully covered by locked savings, and **vault balance = Σ savings − Σ outstanding loans**. So the fund can never lose money and can always pay out free savings.

### Why not an arbiter or a marketplace

We started with escrow for second-hand trades and dropped it: for physical goods somebody must judge whether the parcel arrived, which means an arbiter (still an intermediary) or bonds that punish honest parties too. We picked a relationship where the program sees everything it enforces.

### Why blockchain and not a regular database?

In a database the intermediary is whoever runs it: they can edit a balance, hold back a withdrawal or quietly "borrow" from the pot, which is exactly how the cases above happened. Here the balance is a program-owned token account, the rules are code nobody can swap, every member sees every operation in real time, and collecting an overdue installment needs no trusted server because anyone can do it. Solana makes it practical for a monthly 100 zł contribution: sub-second confirmation, a fraction of a cent per transaction.

### What happens if someone disappears halfway

- **Borrower**: installments are collected from their locked savings, then guarantors'; the fund ends whole.
- **Guarantor**: nothing to do; the pledge unlocks as the loan is repaid.
- **Founder / authors / website**: nothing changes; no admin rights exist, the program and IDL are on-chain.

### Who has which permissions; can we change anything?

Everyone can create a kasa, join, deposit and withdraw their free savings; members borrow and guarantee within the kasa's limits; only the borrower can pay out or cancel their loan; anyone can repay or collect an overdue installment; **no instruction lets anyone change the rules or move another member's savings, including us**. Honest caveat: on devnet the program's upgrade authority is still our deploy key, so we could deploy different code; we keep it during the hackathon for bug fixes, and before real money it goes to a members' multisig or is removed with `--final` (verifiable on the explorer).

### Limitations we are aware of

The program is still upgradeable by our key (see above); test złoty come from a devnet faucet (the program accepts any SPL mint, production would use a stablecoin); users need a wallet; collection needs someone (or a bot) to send the transaction; contributions are voluntary rather than monthly-mandatory; savings earn no interest, as in a KZP; the Act on benefit-loan funds still expects a board, so a fully board-less KZP needs legal recognition; not audited, devnet only.

### If we had another week

Automatic installments and contributions through SPL token delegation (a standing order without a bank), grants (*zapomogi*) released by member vote, a PLN stablecoin with BLIK on-ramp and passkey wallets, a public collector bot with due-date reminders, verifiable build and audit.

## Technology

Solana devnet · Anchor 1.1.2 program with SPL Token CPIs · 12 Rust tests (LiteSVM with the real token program) · Codama-generated client · @solana/kit 8 with Wallet Standard (Phantom, Solflare, Backpack) · Next.js 16 · Playwright UI tests · Railway hosting. Built with an AI coding assistant (Claude Code); disclosed per HackYeah rules.
