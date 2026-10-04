# Video script (≤ 3:00)

**Opening:** the animated trailer in [`packages/video`](../packages/video) (`npm run render`, 40 s, sound effects only) can replace the three slides at 0:00–0:40. Keep the voice-over for those 40 seconds or let the trailer run on its own; the screen recording starts at 0:40 as below.

Record with QuickTime (File → New Screen Recording) at 1080p, browser zoom 110%, Phantom on devnet ("Testnet mode"). Upload as **unlisted** on YouTube and put the link in SUBMISSION.md. Keep the voice-over calm; the screen does the work.

**Before recording** (see `docs/DEMO_RUNBOOK.md`): three Phantom accounts named Anna, Bartek, Celina, each with test złoty from "Dobierz testowe zł". Check that the bot (`automat` on Railway) is running. About 1 minute before the climax shot, run `npx tsx scripts/demo-seed.ts --revoke` in `packages/web` and open the printed kasa link: installment 1 will be pulled by the bot about a minute later, installment 2 collected from collateral about 75 s after that. Explorer tab open.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Slide 1 | "People go to a bank for four things beyond transfers: to keep savings, to borrow, to have installments paid on time, and to prove they repay. A group of colleagues can do all four without a bank, a board or a treasurer." |
| 0:15–0:30 | Slide 2 | "In Polish workplaces colleagues run a *kasa zapomogowo-pożyczkowa*: save every month, borrow at zero percent. It runs on trust in a treasurer, a board and payroll deductions, and that trust fails: one treasurer lost 61,000 złoty of colleagues' savings on a crypto exchange." |
| 0:30–0:40 | Slide 3 | "Kasa bez zarządu turns each of those roles, and each of those bank services, into a rule in a Solana program." |
| 0:40–1:00 | App, Anna: **Załóż kasę** → sign; **Wpłać** 1000; **Włącz stałą składkę** 100 | "Anna creates a kasa; the founder gets no rights. Her savings go into the program's vault. One permission in her wallet, which she can switch off any time, turns on a standing order: 100 złoty from her wallet into her savings every period." |
| 1:00–1:25 | Bartek: join, deposit 500, **Poproś o pożyczkę** 1000 zł / 4 raty; Anna and Celina see his history line, **Poręczam** | "Bartek asks for a thousand. His five hundred get blocked until he repays. Before vouching, Anna and Celina see his record across every kasa, read from the chain, instead of a credit bureau. They block part of their savings for him; now the whole loan is covered." |
| 1:25–1:40 | Bartek: **Wypłać pożyczkę na mój portfel** with "Spłacaj raty automatycznie" ticked | "He pays it out himself, and in the same transaction gives the kasa a direct-debit mandate. No board, no bank." |
| 1:40–2:10 | Prepared kasa: installment 1 "termin minął – pobieram z portfela" → "spłacona", "Spłacone automatycznie: 250 zł"; "Historia kasy" row "Rata pobrana automatycznie z portfela · automat" → Explorer: signer = bot, transfer authority = Bartek's member PDA | "Installment one falls due. Nobody clicks anything. A bot with no rights sends the transaction, and the program takes exactly what is due from Bartek's wallet. He signs nothing; the guarantors get their collateral back. This is the moment the payroll deduction and the bank are no longer needed." |
| 2:10–2:35 | Same kasa: Bartek switched automatic repayment off; installment 2 "pokryta z oszczędności" | "Then Bartek switches it off and stops paying. The fund never depended on it: after a short grace period the bot covers the installment from his blocked savings, then from the guarantors. Nobody's consent needed." |
| 2:35–2:50 | "Historia kasy" with "✓ zgadza się z historią"; home page "Wszystkie kasy razem" | "Every złoty in and out, with the balance after each step, straight from the chain: nobody can edit it. Every loan is fully covered, so free savings are always there. And it scales: every kasa on one program, no server keeping the books." |
| 2:50–3:00 | Slide 10 | "No admin key, no instruction that lets us touch anyone's savings. Next: a złoty stablecoin and guarantees across kasas. Kasa bez zarządu." |

Tip: if a transaction is slow on camera, cut the wait in editing; don't fake anything. Every step above is a real devnet transaction.
