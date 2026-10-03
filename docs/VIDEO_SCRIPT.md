# Video script (≤ 3:00)

Record with QuickTime (File → New Screen Recording) at 1080p, browser zoom 110%, Phantom on devnet ("Testnet mode"). Upload as **unlisted** on YouTube and put the link in SUBMISSION.md. Keep the voice-over calm; the screen does the work.

**Before recording** (see `docs/DEMO_RUNBOOK.md`): three Phantom accounts named Anna, Bartek, Celina, each with test złoty from "Dobierz testowe zł". Prepare a kasa with the **Demo** schedule where Bartek's loan is already paid out and installment 1 repaid, about 1–2 minutes before installment 2 becomes collectible. Explorer tab open.

| Time | Screen | Voice-over |
|---|---|---|
| 0:00–0:15 | Slide 1 | "In many Polish workplaces colleagues run a savings and loan fund, a *kasa zapomogowo-pożyczkowa*. You save every month and borrow at zero percent. It only works if you trust the treasurer." |
| 0:15–0:35 | Slide 2 | "That trust fails: a treasurer in Jawor county lost 61,000 złoty of colleagues' savings on a crypto exchange; a cashier in another fund hid 261,000 złoty for ten years. And the board decides who gets a loan, the employer deducts installments." |
| 0:35–0:50 | Slide 3 | "Kasa bez zarządu removes all three. The money sits in an account owned by a Solana program. Built for small groups that already pool money." |
| 0:50–1:10 | App, Anna: **Załóż kasę** → sign; **Wpłać** 1000 | "Anna creates a kasa. Loans up to twice your savings, installments every minute for the demo. She joins as an ordinary member: the founder gets no rights. Her savings go into the program's vault." *(click "skarbiec w eksploratorze")* |
| 1:10–1:35 | Bartek: join, deposit 500, **Złóż wniosek** 1000 zł / 4 raty → collateral bar half full; Anna and Celina **Poręczam** | "Bartek asks for a thousand. His five hundred of savings lock as collateral. Nobody approves the loan; instead two colleagues vouch for him by locking part of their own savings. Now it's covered a hundred percent." |
| 1:35–1:50 | Bartek: **Wypłać pożyczkę na mój portfel**, wallet +1000 zł | "And he pays it out himself. No board." |
| 1:50–2:20 | Switch to the prepared kasa: installment 2 turns "zaległa", Celina presses **Egzekwuj zaległą ratę**; schedule shows "pobrana z zabezpieczeń" | "Here Bartek stopped paying. Once the installment is overdue, anyone can press this button. The program takes the installment from his locked savings, and when those run out, from the guarantors. No payroll, no debt collector, nobody's consent. This is the moment the intermediary disappears." |
| 2:20–2:35 | Vault card "1750 zł = oszczędności − pożyczone ✓"; Anna **Wypłać** free savings | "Every loan is fully covered, so the vault always holds everyone's free savings. Anna takes hers out right now, without asking anyone." |
| 2:35–2:50 | **Gdzie znika pośrednik?** tab, code links | "Every rule is in one small Anchor program on devnet: open source, no admin key, and we can't change it." |
| 2:50–3:00 | Slide 10 | "Next: automatic installments through token delegation, grants by member vote, a złoty stablecoin. Kasa bez zarządu." |

Tip: if a transaction is slow on camera, cut the wait in editing; don't fake anything. Every step above is a real devnet transaction.
