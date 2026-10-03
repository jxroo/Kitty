# HackTribe form: ready-to-paste answers

## Problem

Workplace savings and loan funds (*kasy zapomogowo-pożyczkowe*, KZP) let colleagues save every month and borrow at 0%, with co-workers vouching for each loan. According to GUS data, nearly 1,000 such funds were operating in Poland when the 2021 Act on benefit-loan funds came into force, and countless informal "group kasas" exist in teams, schools and families. All of them depend on intermediaries: a treasurer who holds the money, a board that decides who gets a loan, and the employer's payroll that deducts installments. People without such a group go to a bank for the same things: credit with interest, a direct debit, a standing order, a credit score. When that trust fails, members find out too late: a PKZP treasurer in Jawor county embezzled 61,000 zł of colleagues' savings and lost it on a crypto exchange (2024); a PKZP cashier hid 261,510 zł of withdrawals with falsified cash reports for ten years (Court of Appeal in Katowice, II AKa 98/15). In informal groups the "kasa" is simply someone's private bank account.

## Solution

Kasa bez zarządu replaces the board, the treasurer, the payroll deduction and the bank services around them with a Solana program. Savings sit in a vault owned by the program, not in anyone's account. A member can borrow up to a multiple of their savings at 0%, with no approval: the loan pays out once locked savings (their own plus pledges from co-members who vouch for them) cover 100% of it. With one standard SPL allowance, revocable at any time, the borrower lets the program pull each installment from their wallet on its due date: a bot with no rights sends the transaction, nobody clicks anything. If the wallet is empty or the allowance revoked, after grace the installment is collected from collateral (the borrower's savings first, then guarantors pro rata), with nobody's consent. The same mandate runs a standing contribution into savings, and every loan stays on-chain as a public credit record that guarantors read before vouching. Because every loan is fully covered, the vault always holds everyone's free savings, so anyone can withdraw theirs at any moment and the fund can never lose money. Benefits: no treasurer, board or bank to trust, no paperwork, zero interest and near-zero fees, and every member sees every operation in real time.

## Challenges

Finance Without Intermediaries (Superteam Poland)

## Cover image

`docs/cover.png`

## Idea stage

New idea, built entirely during HackYeah 2026.

## What's done so far and goal of your project

Nothing existed before the event. During HackYeah we built and deployed: an Anchor program on Solana devnet (savings vault, loans backed by own savings and guarantor pledges, direct debit of installments and standing contributions under a revocable SPL mandate, permissionless collection of overdue installments), a bot with no rights that sends the pulls and collections, 20 Rust tests with LiteSVM and the real SPL Token program (including invariant checks and a full "bank run"), a Polish web app (Next.js, wallet connection, public credit history, network totals, test-złoty faucet), a recorded end-to-end devnet run with explorer links, and automated UI tests driving three wallets through the deployed app. Goal: show live that a group fund can work with no treasurer, no board and no bank, where the program enforces every rule. Next: a złoty stablecoin with BLIK and passkey wallets, guarantees across kasas, grants by member vote.

## Team status

**TODO**: e.g. "Team is complete."

## Current team size

**TODO**

## Needed skills / Skills comment

**TODO** (leave empty if the team is complete).

## Your video presentation

**TODO**: YouTube link (Listed). Script: `docs/VIDEO_SCRIPT.md`.

## Website

https://web-production-ad49f.up.railway.app

## Code Repository

https://github.com/jxroo/kasa-bez-zarzadu

## Instructions on how to open project

Live (no setup): open https://web-production-ad49f.up.railway.app with Phantom, Solflare or Backpack switched to Solana devnet. Click "Połącz portfel", then "Dobierz testowe zł" to receive 2000 test złoty and some SOL for fees. Create a kasa (choose "Demo (60 s)"), deposit, set a standing contribution, and invite others with "Zaproś: skopiuj link". With a second wallet: join, deposit, request a loan; guarantee it from the first wallet; pay it out with "polecenie zapłaty" ticked. When installment 1 falls due (60 s), the bot pulls it from the wallet by itself. Press "Cofnij polecenie zapłaty" and the next installment is collected from collateral after grace, also by the bot (or press "Egzekwuj zaległą ratę" yourself).

Locally: `cd packages/web && npm install && cp .env.example .env.local && npm run dev`, then open http://localhost:3000 (the program is already deployed on devnet).

Program tests: `cd packages/contracts && anchor build && cargo test` (Rust 1.89, Solana CLI 3.1, Anchor 1.1.2). The bot: `cd packages/web && CRANK_KEYPAIR=<any devnet keypair> npx tsx scripts/crank.ts`. Full details in README.md.

## Presentation

`docs/pitch.pdf` (10 slides, 1.1 MB)
