# Devnet end-to-end run (2026-10-03T16:04:48.730Z)

Program: [`EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2`](https://explorer.solana.com/address/EEUFKgMU7hWUbAiGYTZEHvrXEzfnoE4qKkyS7sa4vEp2?cluster=devnet) · test złoty mint: [`3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG`](https://explorer.solana.com/address/3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG?cluster=devnet)  
Anna `EATJ3za7wDtanD7z3rc5h1RtiLMcEyoPjpSsVaqGU1Ab` · Bartek `Hqc4ScWRLP1vsEPu2DtYUMvC5poY3hep3U88trENrqpq` · Celina `CpFsv4bgbEJN9wD4BtriCuEnaFg4e97ppaVRxwY9khhS`  
Installments every 30 s with 5 s grace, so the whole default path fits in a few minutes.

| Step | Transaction |
|---|---|
| Anna creates the kasa (loans up to 2× savings) and joins as an ordinary member | [eic4v33tH4XbY8dP…](https://explorer.solana.com/tx/eic4v33tH4XbY8dP8thm2t6dwGRx4Fs2WWXTH6XL7fqX5dskygb4KMLofoNH7HX52SKFRLhnME3e6mu1Z8SkYgr?cluster=devnet) |
| Bartek joins (nobody approves members) | [5CRmdYXpvLK95Vm7…](https://explorer.solana.com/tx/5CRmdYXpvLK95Vm7vUafi6LVdvFGaF6xoPHoUaDCwocWzTWuQbNaHe3YQ85hGr5cyJhPjR1PwcGGpTT5ByWGN1y2?cluster=devnet) |
| Celina joins | [5fVQT9rEWnETnui6…](https://explorer.solana.com/tx/5fVQT9rEWnETnui6rem5hSpNdKVzGeaJzBhB34cNNtEC2uW8FMS1x8RY1u9Afbs7iX3eLzAAtyQY8WCg2XHCSwbW?cluster=devnet) |
| Anna deposits 1000 zł into the program-owned vault | [447mjiJW7URJt1hz…](https://explorer.solana.com/tx/447mjiJW7URJt1hzHy9viMkyyS6mbKW8koKct82VeGy86W7n179aGb7YZVpMX5kZAqdKLiXhw5rCjuoRnTcJmj6g?cluster=devnet) |
| Bartek deposits 500 zł | [4aApbpRCBkAHJjD9…](https://explorer.solana.com/tx/4aApbpRCBkAHJjD9k4ENpXNbkneLWFzXAyCbEocEPSKgnQnppQTnpwPLtNqrDj1ZM6s5qADfC7cQD8W4NLgukoXr?cluster=devnet) |
| Celina deposits 1000 zł | [5hLmtk8v1eyS4Xkj…](https://explorer.solana.com/tx/5hLmtk8v1eyS4XkjruY7DjM4MjxTsypnYLWngtQL7eABvb78voWKArfdViN4zBd1XfR4QpvbUx2Dmsc6HZfuLjrL?cluster=devnet) |
| ❌ Bartek asks for 1001 zł (limit is 2 × 500 zł) | rejected: *Program odrzucił: pożyczka przekracza limit tej kasy (wielokrotność Twoich oszczędności).* |
| Bartek asks for 1000 zł in 4 installments: his 500 zł of savings get locked as collateral | [5qfm16sJRafiSka7…](https://explorer.solana.com/tx/5qfm16sJRafiSka7tZg9i9UMDbEkcxKkkh4gNpPKiypTLcLdSMrN7uGf3xnLqTB8Twye3NiRUbKKWSz8zmBVvEid?cluster=devnet) |
| ❌ Bartek tries to take the money out before it is fully covered | rejected: *Program odrzucił: pożyczka nie jest jeszcze w 100% zabezpieczona.* |
| ❌ Bartek tries to withdraw his locked savings | rejected: *Program odrzucił: za mało wolnych (niezablokowanych) oszczędności.* |
| ❌ Bartek tries to guarantee his own loan | rejected: *Program odrzucił: nie można poręczyć własnej pożyczki.* |
| Anna guarantees 300 zł (locks 300 zł of her savings) | [psYArqcKhVpB96df…](https://explorer.solana.com/tx/psYArqcKhVpB96df5GwBwonDN4FGU5qgv3zRr5yyfxbmX6kaFNcEdJ7D9QCwQx38oB4z8KwgS6b1qy8kwA6zsrA?cluster=devnet) |
| Celina guarantees 200 zł: the loan is now 100% covered | [U5LcrcaYcq1VZER7…](https://explorer.solana.com/tx/U5LcrcaYcq1VZER7iagxoGETR9bQpZUf5p2dwVs3i6eZNAbaB661UT2Wxth3C5GR58TU28Fg8wJgecU6X84ShT9?cluster=devnet) |
| Bartek pays the loan out to his own wallet. No board, no approval. | [2FidRdRqG1ZUzuzo…](https://explorer.solana.com/tx/2FidRdRqG1ZUzuzohbQFcaMAXm5RQg85seXXHo67uzdHFRkmVRhNYLL3JTv7wKEMM8HdoofahabDt4fexfyBbLia?cluster=devnet) |
| ↳ Bartek's wallet: 1 500 zł → 2 500 zł | |
| Bartek repays installment 1 (250 zł): guarantors get 250 zł unlocked, 3:2 | [3SnLqRVsVAA2UL7f…](https://explorer.solana.com/tx/3SnLqRVsVAA2UL7fZtoL7gq4qs5DyPzo6zsUNsVcCB5jopMJj9RLSA6hotgwQ9bxF6rdD8G1YThrt8Eo21ET87fz?cluster=devnet) |
| ❌ Celina tries to collect before anything is overdue | rejected: *Program odrzucił: żadna rata nie jest jeszcze zaległa.* |
| Bartek misses installment 2: Celina (anyone) collects it from Bartek's locked savings | [5wUh9rU9bdNAmL7b…](https://explorer.solana.com/tx/5wUh9rU9bdNAmL7bmGGyqoYoTozVof4j8YKrNMteu3Rcyssh3D6aMzw4i2CaQsdz3RsxmxmUL2g7PL23uR9eHnXQ?cluster=devnet) |
| Installments 3–4 overdue: Bartek's last 250 zł, then 250 zł from guarantors pro rata | [4nbuiTYxehPQ3C3F…](https://explorer.solana.com/tx/4nbuiTYxehPQ3C3F3sqNoSyicca8GLwQHzvMHq6jbVU7MoiEbAGfgetNuLs116S5mSwL4WsC1ARB24mn2Y6m3MWs?cluster=devnet) |

Loan status: **Repaid** · repaid by Bartek 250 zł · taken from collateral 750 zł (Bartek 500 zł, guarantors Anna 150 zł, Celina 100 zł)
- Anna: savings 850 zł, locked 0 zł, used to cover defaults 150 zł
- Bartek: savings 0 zł, locked 0 zł, used to cover defaults 500 zł
- Celina: savings 900 zł, locked 0 zł, used to cover defaults 100 zł
- Vault 1 750 zł = savings 1 750 zł − lent 0 zł ✓

| Step | Transaction |
|---|---|
| Anna withdraws all 850 zł of her savings, without asking anyone | [4Yan5kkoAHNYSN4T…](https://explorer.solana.com/tx/4Yan5kkoAHNYSN4TbJD4RGHjWgNPNxqi1ssM3UG63VLLeaijctN2inHTfGbQnUKz91Zg4Dp9pbwcxP1wofNBkiUk?cluster=devnet) |
| Celina withdraws all 900 zł of her savings, without asking anyone | [5VTqN9eH24Pec3s2…](https://explorer.solana.com/tx/5VTqN9eH24Pec3s25cG3ciNd5AaStJ7AzxAtuMiSfJQKgaTHDXDXdpfZU33AL9d8zYvbspkQQ4mPh4XeCrHRR5Lr?cluster=devnet) |
| ↳ Vault after everyone withdrew: 0 zł | |

Kasa account: [`kzypwGzUrab5e7PUXXczi2ceqn7NnPe55s1CJJUk4fQ`](https://explorer.solana.com/address/kzypwGzUrab5e7PUXXczi2ceqn7NnPe55s1CJJUk4fQ?cluster=devnet) · loan account: [`B2Ts62ozqFTaraxb7kKXRnnNhgWrhxDsXc5bLWTQXAfw`](https://explorer.solana.com/address/B2Ts62ozqFTaraxb7kKXRnnNhgWrhxDsXc5bLWTQXAfw?cluster=devnet)
