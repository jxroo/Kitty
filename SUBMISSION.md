# HackTribe submission draft: Finance Without Intermediaries (Superteam Poland)

> Draft for the HackTribe form. Fill in the fields marked **TODO** before submitting (deadline: 4 Oct 2026, 23:00).

## Project title

**Kasa bez zarządu: savings, 0% loans and direct debits with no board, no treasurer and no bank**

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
| On-chain program | [`2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR`](https://explorer.solana.com/address/2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR?cluster=devnet) |
| The bot (fee payer, no rights) | [`AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz`](https://explorer.solana.com/address/AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz?cluster=devnet) |
| Recorded devnet run with explorer links | https://github.com/jxroo/kasa-bez-zarzadu/blob/HEAD/docs/devnet-e2e.md |
| Screenshots | https://github.com/jxroo/kasa-bez-zarzadu/tree/HEAD/docs/screenshots |

## Short description (one paragraph)

Kasa bez zarządu is a *kasa zapomogowo-pożyczkowa* (a workplace or group savings and loan fund) where a Solana program replaces the board, the treasurer, the payroll deduction and the bank services around them. Members' savings sit in a vault owned by the program, not in a treasurer's account. Anyone can borrow up to a multiple of their savings at 0%, with no approval: the loan pays out once locked savings, their own plus pledges from co-members who vouch for them, cover 100% of it. With one standard SPL allowance (revocable at any time) the borrower lets the program pull each installment from their wallet on its due date; a bot with no rights submits it, so nobody clicks anything. If the wallet is empty or the allowance revoked, after grace the installment is collected from collateral, again by anyone. The same mandate runs a standing contribution into savings every period, and every loan stays on-chain as a public credit record that guarantors read before vouching. Because every loan is fully covered, the vault always holds everyone's free savings and anyone can withdraw theirs at any moment. No instruction lets anyone, including the founder, the bot and the authors, change a kasa's rules or move someone else's money.

## Detailed description

### Who we build for

Small groups in Poland that already pool money: workplace KZPs (schools, public offices, factories), teams with a "kasa koleżeńska", friends and families lending to each other. In this version they use a Solana wallet on devnet, so the first users are deliberately crypto-aware. The interface is in Polish and hides the chain: amounts in złoty, plain buttons ("Wpłać", "Poręczam", "Egzekwuj zaległą ratę"), every program error explained in one sentence, explorer links one click away.

### The user flow (working end to end on devnet)

1. **Anna founds a kasa.** She picks the rules once: loans up to 2× savings, up to 6 installments, every 60 s in the demo (a month in the real preset), 15 s grace. She joins as an ordinary member; the founder gets no rights.
2. **Anna deposits 1000 zł and sets a standing contribution of 100 zł per period.** One click: `set_contribution` plus an SPL `approve` naming her own member account in this kasa as delegate. From then on the bot moves 100 zł from her wallet into her savings every period. That is a standing order without a bank.
3. **Bartek and Celina join from an invite link and deposit.** Nobody approves members: a newcomer can only risk their own savings.
4. **Bartek asks for 1000 zł in 4 installments.** His 500 zł of free savings are locked as collateral. The program refuses to pay out yet: the loan is only half covered. Before vouching, Anna and Celina see Bartek's credit record across every kasa, read from the chain.
5. **Anna pledges 300 zł, Celina 200 zł.** Their savings lock. Collateral now equals the loan.
6. **Bartek pays the loan out to his wallet with the direct-debit box ticked.** One transaction: the payout and an SPL allowance of 1000 zł for the installments. No board, no approval.
7. **Installment 1 falls due and nobody clicks anything.** The bot submits `pull_installment`; the program takes exactly 250 zł from Bartek's wallet, without his signature, and the guarantors get 250 zł unlocked, 3:2. This is the moment the employer's payroll and the bank's direct debit are no longer needed.
8. **Bartek stops paying: he revokes the allowance.** On installment 2 the bot's pull is refused (`NoMandate`). After grace the bot (or Celina, or anyone) collects 250 zł from Bartek's locked savings; when his collateral runs out, the rest comes from the guarantors pro rata. Nobody had to sue, call or deduct anything.
9. **Anyone withdraws their free savings at any time**, even during all of this. The vault card shows live that vault = savings − lent.

## Design rationale

### Which financial relationship we redesigned

**Mutual credit in a group**: saving together and lending to each other at 0% with co-members as guarantors, the model of the Polish *kasa zapomogowo-pożyczkowa* (regulated since 2021 by the Act of 11 August 2021, Dz.U. 2021 poz. 1666) and of every informal "group kasa". Around it we redesigned the bank services such a group otherwise depends on: the direct debit of installments, the standing order into savings and the credit record.

### Who the intermediary was

- **The treasurer**, who holds the money and the books. When trust fails, members find out late: a PKZP treasurer from Jawor county embezzled 61,000 zł of colleagues' savings and lost it on a crypto exchange (Puls Legnicy, 2024); a PKZP cashier hid 261,510 zł with falsified cash reports for ten years (Court of Appeal in Katowice, II AKa 98/15). In informal groups the kasa is simply someone's private account.
- **The board**, which decides who gets a loan and when savings are returned.
- **The employer's payroll**, which deducts contributions and installments and is the only real enforcement against a defaulter. Outside a workplace that role falls to a **bank**: a direct debit, a standing order, a credit bureau (BIK).

### What changes once the intermediary is removed

| | Before | After |
|---|---|---|
| Custody | Treasurer's / KZP bank account | Token account owned by the program; only `withdraw` and `disburse` can move tokens out, along the rules |
| Loan approval | Board decision | None: 100% collateral from locked savings (own + guarantors) |
| Installments | Payroll deduction or a bank direct debit | `pull_installment`: from the due date anyone (the bot) pulls what is due from the borrower's wallet, within the SPL allowance the borrower gave their own member PDA |
| Enforcement | Board chasing debtors, a collection agency | `collect_overdue`: after due date + grace, anyone triggers collection from collateral |
| Monthly contributions | Payroll deduction, a bank standing order | `pull_contribution`: once per period under the same mandate |
| Credit record | Board members' memory, BIK | Every loan account stays on-chain; the app shows a borrower's record across all kasas |
| Getting your savings back | When the board agrees, usually when leaving | Any time for unlocked savings; the vault always holds them |
| Rule changes | General meeting / board | No instruction changes them; no admin key (caveat: program upgrade key, below) |
| Who can lose | Every member, if the treasurer or the books fail | Only a guarantor who chose to vouch, capped at the pledge, as a KZP *poręczyciel* today |

### Why it works without anyone enforcing it

Every condition the program needs is on-chain: deposits, balances, the installment schedule, the clock and the token allowance. Two invariants follow and are tested after every step: each loan is fully covered by locked savings, and **vault balance = Σ savings − Σ outstanding loans**. So the fund can never lose money and can always pay out free savings. The direct debit adds convenience, not risk: it can only take what is due, only from the borrower's own account, only within the allowance, and the fund never depends on it.

### Why not an arbiter or a marketplace

We started with escrow for second-hand trades and dropped it: for physical goods somebody must judge whether the parcel arrived, which means an arbiter (still an intermediary) or bonds that punish honest parties too. We picked a relationship where the program sees everything it enforces.

### Why blockchain and not a regular database?

In a database the intermediary is whoever runs it: they can edit a balance, hold back a withdrawal or quietly "borrow" from the pot, which is exactly how the cases above happened. Here the balance is a program-owned token account, the rules are public code that no instruction can bypass, every member sees every operation in real time, and collecting an overdue installment needs no trusted server because anyone can do it. A direct debit shows the difference best: at a bank it needs a bank both sides trust to honour the mandate; here the SPL Token program enforces the allowance, our program enforces the amount and the date, and the bot that sends the transaction can do nothing anyone else couldn't. And why not just send USDC? Transfers without a bank already exist; credit, direct debits, standing orders and credit records are what still need one, and those are what this replaces. Solana makes it practical for a monthly 100 zł contribution: sub-second confirmation, a fraction of a cent per transaction.

### What happens if someone disappears halfway

- **Borrower** (revokes the mandate or empties the wallet): installments are collected from their locked savings after grace, then guarantors'; the fund ends whole.
- **The bot**: nothing breaks. It has no rights and only pays fees; the same buttons are in the app for anyone, and its code is public.
- **Guarantor**: nothing to do; the pledge unlocks as the loan is repaid.
- **Founder / authors / website**: nothing changes; no admin rights exist, the program and IDL are on-chain.

### Who has which permissions; can we change anything?

Everyone can create a kasa, join, deposit and withdraw their free savings; members borrow and guarantee within the kasa's limits; only the borrower can pay out or cancel their loan; only a wallet's owner can give or revoke a mandate (standard SPL approve/revoke) and set their contribution; anyone can repay, pull what is due under a mandate, or collect an overdue installment; **no instruction lets anyone change the rules or move another member's savings, including us**. Honest caveat: on devnet the program's upgrade authority is still our deploy key, so we could deploy different code; we keep it during the hackathon for bug fixes, and before real money it goes to a members' multisig or is removed with `--final` (verifiable on the explorer).

### Limitations we are aware of

The program is still upgradeable by our key (see above); test złoty come from a devnet faucet (the program accepts any SPL mint, production would use a stablecoin); users need a wallet; Solana programs don't run on a timer, so a bot with no rights sends the pulls and collections (anyone can replace it); one SPL delegate per token account means a mandate in a second kasa replaces the first; the credit record is public by design and should be opt-in for real groups; contributions are opt-in rather than mandatory; savings earn no interest, as in a KZP; the Act on benefit-loan funds still expects a board, so a fully board-less KZP needs legal recognition; not audited, devnet only.

### If we had another week

A PLN stablecoin with a BLIK on-ramp and passkey wallets; guarantees across kasas (vouch from your savings in another group); grants (*zapomogi*) released by member vote; reminders before a pull and one mandate shared by all kasas; upgrade key to a members' multisig, verifiable build and audit.

## Technology

Solana devnet · Anchor 1.1.2 program with SPL Token CPIs (transfers signed by the member's PDA as delegate) · 20 Rust tests (LiteSVM with the real token program) · 11 web unit tests · Codama-generated client · @solana/kit 8 with Wallet Standard (Phantom, Solflare, Backpack) · Next.js 16 · Playwright UI tests · Railway hosting (web app + bot). Built with an AI coding assistant (Claude Code); disclosed per HackYeah rules.
