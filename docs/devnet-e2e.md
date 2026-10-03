# Devnet end-to-end run (2026-10-03T20:34:35.972Z)

Program: [`2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR`](https://explorer.solana.com/address/2GCG5LMn8WNcgaZ2aWHCzzDW6hjkTCtYVRzykwsj7pcR?cluster=devnet) · test złoty mint: [`3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG`](https://explorer.solana.com/address/3m9ZBm3NqJSRbMdCbnsB5fZWKxpk6tFWeU6PGhzcM8HG?cluster=devnet)  
Anna `EATJ3za7wDtanD7z3rc5h1RtiLMcEyoPjpSsVaqGU1Ab` · Bartek `Hqc4ScWRLP1vsEPu2DtYUMvC5poY3hep3U88trENrqpq` · Celina `CpFsv4bgbEJN9wD4BtriCuEnaFg4e97ppaVRxwY9khhS` · bot (fee payer, no rights) `AuEGLSxJpfFqesbtQPDaBvTNqdsRUkZqPx3xiFjFqGqz`  
Installments every 30 s with 5 s grace, so the whole default path fits in a few minutes.

| Step | Transaction |
|---|---|
| Anna creates the kasa (loans up to 2× savings) and joins as an ordinary member | [5GzqLHgzyNRDa1ND…](https://explorer.solana.com/tx/5GzqLHgzyNRDa1NDHtB4xoAJ2fmvsiuMSkWaEFtcKV6VFAAu9M1mwXRFuA3sz2wNCMJ9rgJybfoc5S7jYjjsNngq?cluster=devnet) |
| Bartek joins (nobody approves members) | [MDvJPMHMRrrK13p7…](https://explorer.solana.com/tx/MDvJPMHMRrrK13p7Qvut76YHtT7wiitua9J97FftWVjRZ4ucnLVLoUiSepyBN2j8upwgMMYEMfJ1m5oTSeGBdhA?cluster=devnet) |
| Celina joins | [5D5e4DztxijAvG26…](https://explorer.solana.com/tx/5D5e4DztxijAvG26Asf8aMcA9AnTo27GWG7FicvsTn1PrTYw4XBv8ot14mXUg69kfS7mGQbMXFuoGMzdDjH1WtSj?cluster=devnet) |
| Anna deposits 1000 zł into the program-owned vault | [2neLjRC8cB7MW4UK…](https://explorer.solana.com/tx/2neLjRC8cB7MW4UKbk7P4aG6wqWkBt5JMPDvzrVbwHDKpYc3hRDsNq8ARGTvWk15cfC5VxyquzKj49xuAwQabTtM?cluster=devnet) |
| Bartek deposits 500 zł | [3LGyWjrK8yrgi7qs…](https://explorer.solana.com/tx/3LGyWjrK8yrgi7qsLL5pZZm2UntLYFpia8HMHTfRdEp6JS9PB4B28on3KXhymx1JrZ1vR9suTK73S9x1CynnejXN?cluster=devnet) |
| Celina deposits 1000 zł | [7TKymU2H5RDj1Mqa…](https://explorer.solana.com/tx/7TKymU2H5RDj1MqacxyyRz1ZJKzxUeSkj2MKuHTCCrcyZUcDLqBFCjaXY5nffbV32ypM52LJzwL915tAEacMvbs?cluster=devnet) |
| Anna sets a standing contribution of 100 zł per period and gives her kasa a 300 zł mandate (SPL approve) | [DBRpS86GUgJXjAgm…](https://explorer.solana.com/tx/DBRpS86GUgJXjAgmRHpphTA5enRcbAkY6rGEFXnasRmUxA9CfngYExeA7iScRRFyfdCFBHvR5PZXNMTMykWEiss?cluster=devnet) |
| The bot (a key with no rights, it only pays fees) pulls Anna's contribution into her savings | [4SrFySa1fkshZ2kw…](https://explorer.solana.com/tx/4SrFySa1fkshZ2kwrTRHBAsFxVBVsp6Qz6MfSTRyJm3vK2wDyYCaE5MfZmDpjQPuBgB3TTuDXjG9RHSUVnNtMDp8?cluster=devnet) |
| ❌ The bot tries to pull the contribution again in the same period | rejected: *Kolejna składka nie jest jeszcze wymagalna.* |
| ❌ Bartek asks for 1001 zł (limit is 2 × 500 zł) | rejected: *Program odrzucił: pożyczka przekracza limit tej kasy (wielokrotność Twoich oszczędności).* |
| Bartek asks for 1000 zł in 4 installments: his 500 zł of savings get locked as collateral | [2ihWqBL6kjCwC3TZ…](https://explorer.solana.com/tx/2ihWqBL6kjCwC3TZ65wwNhFt6SAjNduXQ7Z2jiZ2Pwu9Zy5iNm8jigBg5JGV8aHeceMDbjyM7XNwhunK1fk8cnnz?cluster=devnet) |
| ❌ Bartek tries to take the money out before it is fully covered | rejected: *Program odrzucił: pożyczka nie jest jeszcze w 100% zabezpieczona.* |
| ❌ Bartek tries to withdraw his locked savings | rejected: *Program odrzucił: za mało wolnych (niezablokowanych) oszczędności.* |
| ❌ Bartek tries to guarantee his own loan | rejected: *Program odrzucił: nie można poręczyć własnej pożyczki.* |
| Anna guarantees 300 zł (locks 300 zł of her savings) | [544Sih2koLDUTheS…](https://explorer.solana.com/tx/544Sih2koLDUTheSVhtpDbPcx2SZvzSpsVJf5U1tPmm5rubWHHLwNYDgKSypL49wvsdM3xbqkr5E5dRbW8GA5dPe?cluster=devnet) |
| Celina guarantees 200 zł: the loan is now 100% covered | [5mHYqgvEdpSAFnZe…](https://explorer.solana.com/tx/5mHYqgvEdpSAFnZe8GBTXUjLxsKHHVg7XioTSUqt2pA1kBYjdDhb9Q8ETwE4rBNDbp5bR9EqXTXdRMJKAFGVyANb?cluster=devnet) |
| Bartek pays the loan out to his own wallet and, in the same transaction, gives a 1000 zł direct-debit mandate. No board, no approval. | [2yc7CyeeWm886SPY…](https://explorer.solana.com/tx/2yc7CyeeWm886SPYqBaqGBwmczZChWpzrwaxFFeGTpFrA2R3odCb7eGesoR3UxMzT7A6Ze8vCqpVjtKmTdVqJkHo?cluster=devnet) |
| ↳ Bartek's wallet: 3 750 zł → 4 750 zł | |
| ❌ The bot tries to pull installment 1 before its due date | rejected: *Program odrzucił: żadna rata nie jest jeszcze wymagalna.* |
| Installment 1 is due: the bot pulls 250 zł from Bartek's wallet (Bartek signs nothing); guarantors get 250 zł unlocked, 3:2 | [5Hnu6jS28B2rNAiS…](https://explorer.solana.com/tx/5Hnu6jS28B2rNAiS9zxXNFXcmm8L49W7q5PBth7devg6CdEtiPfgpSA4aB5Frak6ELnYVxP2caNVNWL74dx9Jb6V?cluster=devnet) |
| ↳ Bartek's wallet: 4 750 zł → 4 500 zł | |
| ❌ The bot tries to pull more than is due | rejected: *Program odrzucił: żadna rata nie jest jeszcze wymagalna.* |
| Bartek revokes the mandate (SPL revoke): he stops paying | [34uafZZWVk7aFXeQ…](https://explorer.solana.com/tx/34uafZZWVk7aFXeQRevbQ95vHhnvunC1u9Yq8UZ2S6rbp4J1pfvoYbhAe6CV7NNRW3EMmM55eAuKfgdGxZwLiFvo?cluster=devnet) |
| ❌ Installment 2 is due: the bot tries to pull it, but there is no mandate any more | rejected: *Brak zgody na pobieranie (polecenia zapłaty) albo środków w portfelu.* |
| Grace is over: the bot collects installment 2 from Bartek's locked savings | [oipcKws6G8Hc1meC…](https://explorer.solana.com/tx/oipcKws6G8Hc1meCnibZdmK6w1APmugpUcxYnsdGQabXx1z11Af35uqcdBnNXwRA1bzNN15PfwnphdS5ahvqYxa?cluster=devnet) |
| Installments 3–4 overdue: Celina (anyone) collects Bartek's last 250 zł, then 250 zł from guarantors pro rata | [2Mi4ZokDt6Ey8ZiZ…](https://explorer.solana.com/tx/2Mi4ZokDt6Ey8ZiZhG9HVoJgE1xA4182DcKC6ZA5dkNdHey1DSwVhVjc1sxQhq9sPFPrfbQiVNXeLoTePUVxJRnW?cluster=devnet) |

Loan status: **Repaid** · repaid 250 zł (of which pulled by mandate 250 zł) · taken from collateral 750 zł (Bartek 500 zł, guarantors Anna 150 zł, Celina 100 zł)
- Anna: savings 950 zł, locked 0 zł, used to cover defaults 150 zł
- Bartek: savings 0 zł, locked 0 zł, used to cover defaults 500 zł
- Celina: savings 900 zł, locked 0 zł, used to cover defaults 100 zł
- Vault 1 850 zł = savings 1 850 zł − lent 0 zł ✓

| Step | Transaction |
|---|---|
| Anna withdraws all 950 zł of her savings, without asking anyone | [2sn1aRoKJZRhZswD…](https://explorer.solana.com/tx/2sn1aRoKJZRhZswDzuz3s6w1QKmWvGFE9HZgpcYRbJPpaZZGcEhn3Uprkm8hkpqQnHTHULbjbqM7EyTk59nTd8ax?cluster=devnet) |
| Celina withdraws all 900 zł of her savings, without asking anyone | [4XkDqybCsp1wJsLV…](https://explorer.solana.com/tx/4XkDqybCsp1wJsLVugjLEotRdxyc4h9Ngeccf1mWDD9FH3UVzqpJTUBYvTtQmWp8pHq37748NrLGMiFgpw78X2cH?cluster=devnet) |
| ↳ Vault after everyone withdrew: 0 zł | |

Kasa account: [`9mG54LWc23opArFstCCj53GCPRtRswXXjctwhvzkSSQQ`](https://explorer.solana.com/address/9mG54LWc23opArFstCCj53GCPRtRswXXjctwhvzkSSQQ?cluster=devnet) · loan account: [`FdCk6F2tb7rHxMYmwfhSykx8DkkD52RCoZKjMXH7jMUh`](https://explorer.solana.com/address/FdCk6F2tb7rHxMYmwfhSykx8DkkD52RCoZKjMXH7jMUh?cluster=devnet)
