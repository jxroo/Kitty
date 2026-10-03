// Full kasa lifecycle on devnet against the deployed program, with throwaway wallets.
//   FUNDER_KEYPAIR=~/funded.json FAUCET_KEYPAIR=~/tpln-mint-authority.json npx tsx scripts/e2e-devnet.ts
// Anna founds a kasa, Bartek borrows with Anna and Celina as guarantors, pays one
// installment, then stops paying: the rest is collected from collateral by other
// people's transactions. Rule-breaking attempts are shown being rejected.
// Writes explorer links to ../../docs/devnet-e2e.md.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
  createClient,
  createKeyPairSignerFromBytes,
  generateKeyPairSigner,
  lamports,
  type Address,
  type Instruction,
  type KeyPairSigner,
} from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer, signerFromFile } from "@solana/kit-plugin-signer";
import { getTransferSolInstruction } from "@solana-program/system";
import { getCreateAssociatedTokenIdempotentInstruction, getMintToCheckedInstruction } from "@solana-program/token";
import { fetchKasa, fetchLoan, fetchMember, type Kasa } from "../src/generated";
import { fetchTokenBalance } from "../src/lib/chain";
import {
  ataOf,
  collectOverdueIx,
  createKasaIxs,
  depositIx,
  disburseIxs,
  guaranteeIx,
  joinIx,
  loanPda,
  memberPda,
  repayIx,
  requestLoanIx,
  withdrawIxs,
} from "../src/lib/instructions";
import { describeError, explorerAddress, explorerTx, formatZl, MINT, PROGRAM_ID, randomId, RPC_URL } from "../src/lib/kasa";
import { sendWithFallback } from "../src/lib/send";

const PERIOD = 30;
const GRACE = 5;
const transactionConfig = { version: 0 } as const;
const expand = (p: string) => p.replace(/^~/, homedir());
const funderPath = expand(process.env.FUNDER_KEYPAIR ?? "~/Downloads/projekt2-keypair.json");
const faucetPath = expand(process.env.FAUCET_KEYPAIR ?? "~/Downloads/kasa-faucet-keypair.json");
const zl = (x: number) => BigInt(Math.round(x * 100));

const log: string[] = [];
const report = (line: string) => {
  console.log(line);
  log.push(line);
};

async function clientFor(kp: KeyPairSigner) {
  return createClient().use(signer(kp)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig }));
}
type Client = Awaited<ReturnType<typeof clientFor>>;

async function step(client: Client, label: string, ixs: Instruction[]) {
  const signature = await sendWithFallback(client.rpc, () => client.sendTransaction(ixs));
  report(`| ${label} | [${signature.slice(0, 16)}…](${explorerTx(signature)}) |`);
  return signature;
}

/** A transaction the program must refuse. Preflight simulation fails, so nothing lands on-chain. */
async function rejected(client: Client, label: string, ixs: Instruction[]) {
  try {
    await client.sendTransaction(ixs);
  } catch (err) {
    report(`| ❌ ${label} | rejected: *${describeError(err)}* |`);
    return;
  }
  throw new Error(`Expected the program to reject: ${label}`);
}

// Burner keys are persisted (gitignored) so a crashed run never strands SOL.
const WALLETS_FILE = resolve(import.meta.dirname, "../.e2e-wallets.json");

async function loadBurners(n: number): Promise<KeyPairSigner[]> {
  const saved: number[][] = existsSync(WALLETS_FILE) ? JSON.parse(readFileSync(WALLETS_FILE, "utf8")) : [];
  while (saved.length < n) {
    const kp = await generateKeyPairSigner(true);
    const pkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.keyPair.privateKey));
    const pub = new Uint8Array(await crypto.subtle.exportKey("raw", kp.keyPair.publicKey));
    saved.push([...pkcs8.slice(-32), ...pub]);
  }
  writeFileSync(WALLETS_FILE, JSON.stringify(saved), { mode: 0o600 });
  return Promise.all(saved.slice(0, n).map((b) => createKeyPairSignerFromBytes(Uint8Array.from(b))));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const funderClient = await createClient().use(signerFromFile(funderPath)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig }));
  const funder = funderClient.payer as KeyPairSigner;
  const faucet = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(faucetPath, "utf8"))));
  const rpc = funderClient.rpc;

  const [anna, bartek, celina] = await loadBurners(3);
  const names = new Map<string, string>([
    [anna.address, "Anna"],
    [bartek.address, "Bartek"],
    [celina.address, "Celina"],
  ]);

  // Fund: SOL for fees/rent from the funder, test złoty from the tPLN mint authority.
  const topUps: Instruction[] = [];
  for (const kp of [anna, bartek, celina]) {
    const bal = (await rpc.getBalance(kp.address).send()).value;
    if (bal < 30_000_000n) topUps.push(getTransferSolInstruction({ source: funder, destination: kp.address, amount: lamports(30_000_000n - bal) }));
    const ata = await ataOf(kp.address, MINT);
    topUps.push(getCreateAssociatedTokenIdempotentInstruction({ payer: funder, ata, owner: kp.address, mint: MINT }));
    if ((await fetchTokenBalance(rpc, ata)) < zl(2_000)) {
      topUps.push(getMintToCheckedInstruction({ mint: MINT, token: ata, mintAuthority: faucet, amount: zl(2_000), decimals: 2 }));
    }
  }
  await sendWithFallback(rpc, () => funderClient.sendTransaction(topUps));
  const [annaC, bartekC, celinaC] = await Promise.all([clientFor(anna), clientFor(bartek), clientFor(celina)]);

  report(`# Devnet end-to-end run (${new Date().toISOString()})`);
  report("");
  report(`Program: [\`${PROGRAM_ID}\`](${explorerAddress(PROGRAM_ID)}) · test złoty mint: [\`${MINT}\`](${explorerAddress(MINT)})  `);
  report(`Anna \`${anna.address}\` · Bartek \`${bartek.address}\` · Celina \`${celina.address}\`  `);
  report(`Installments every ${PERIOD} s with ${GRACE} s grace, so the whole default path fits in a few minutes.`);
  report("");
  report("| Step | Transaction |");
  report("|---|---|");

  const built = await createKasaIxs(anna, MINT, {
    kasaId: randomId(),
    name: "Kasa E2E",
    loanMultiplierBps: 20_000,
    maxInstallments: 6,
    periodSecs: PERIOD,
    graceSecs: GRACE,
    displayName: "Anna",
  });
  const kasa = built.kasa;
  await step(annaC, "Anna creates the kasa (loans up to 2× savings) and joins as an ordinary member", built.instructions);
  await step(bartekC, "Bartek joins (nobody approves members)", [await joinIx(bartek, kasa, "Bartek")]);
  await step(celinaC, "Celina joins", [await joinIx(celina, kasa, "Celina")]);

  let k: Kasa = (await fetchKasa(rpc, kasa)).data;
  await step(annaC, "Anna deposits 1000 zł into the program-owned vault", [await depositIx(anna, kasa, k, zl(1_000))]);
  await step(bartekC, "Bartek deposits 500 zł", [await depositIx(bartek, kasa, k, zl(500))]);
  await step(celinaC, "Celina deposits 1000 zł", [await depositIx(celina, kasa, k, zl(1_000))]);

  await rejected(bartekC, "Bartek asks for 1001 zł (limit is 2 × 500 zł)", [await requestLoanIx(bartek, kasa, 0, zl(1_001), 4)]);
  await step(bartekC, "Bartek asks for 1000 zł in 4 installments: his 500 zł of savings get locked as collateral", [
    await requestLoanIx(bartek, kasa, 0, zl(1_000), 4),
  ]);
  const loanAddr = await loanPda(kasa, bartek.address, 0);
  let l = (await fetchLoan(rpc, loanAddr)).data;
  await rejected(bartekC, "Bartek tries to take the money out before it is fully covered", await disburseIxs(bartek, loanAddr, l, k));
  await rejected(bartekC, "Bartek tries to withdraw his locked savings", await withdrawIxs(bartek, kasa, k, zl(1)));
  await rejected(bartekC, "Bartek tries to guarantee his own loan", [await guaranteeIx(bartek, kasa, loanAddr, zl(100))]);
  await step(annaC, "Anna guarantees 300 zł (locks 300 zł of her savings)", [await guaranteeIx(anna, kasa, loanAddr, zl(300))]);
  await step(celinaC, "Celina guarantees 200 zł: the loan is now 100% covered", [await guaranteeIx(celina, kasa, loanAddr, zl(200))]);

  l = (await fetchLoan(rpc, loanAddr)).data;
  const before = await fetchTokenBalance(rpc, await ataOf(bartek.address, MINT));
  await step(bartekC, "Bartek pays the loan out to his own wallet. No board, no approval.", await disburseIxs(bartek, loanAddr, l, k));
  const after = await fetchTokenBalance(rpc, await ataOf(bartek.address, MINT));
  report(`| ↳ Bartek's wallet: ${formatZl(before)} → ${formatZl(after)} | |`);

  l = (await fetchLoan(rpc, loanAddr)).data;
  await step(bartekC, "Bartek repays installment 1 (250 zł): guarantors get 250 zł unlocked, 3:2", [await repayIx(bartek, loanAddr, l, k, zl(250))]);
  l = (await fetchLoan(rpc, loanAddr)).data;
  await rejected(celinaC, "Celina tries to collect before anything is overdue", [await collectOverdueIx(loanAddr, l)]);

  // Bartek goes silent. Wait for installment 2 (+ grace) and let Celina collect it.
  const due2 = Number(l.disbursedAt) + 2 * PERIOD + GRACE + 2;
  await waitUntil(rpc, due2);
  l = (await fetchLoan(rpc, loanAddr)).data;
  await step(celinaC, "Bartek misses installment 2: Celina (anyone) collects it from Bartek's locked savings", [
    await collectOverdueIx(loanAddr, l),
  ]);

  const due4 = Number(l.disbursedAt) + 4 * PERIOD + GRACE + 2;
  await waitUntil(rpc, due4);
  l = (await fetchLoan(rpc, loanAddr)).data;
  await step(annaC, "Installments 3–4 overdue: Bartek's last 250 zł, then 250 zł from guarantors pro rata", [
    await collectOverdueIx(loanAddr, l),
  ]);

  l = (await fetchLoan(rpc, loanAddr)).data;
  k = (await fetchKasa(rpc, kasa)).data;
  report("");
  report(`Loan status: **${["Pending", "Active", "Repaid", "Cancelled"][l.status]}** · repaid by Bartek ${formatZl(l.repaid)} · taken from collateral ${formatZl(l.seized)} (Bartek ${formatZl(l.ownSeized)}, guarantors ${l.guarantors
    .slice(0, l.guarantorCount)
    .map((g) => `${names.get(g.wallet)} ${formatZl(g.seized)}`)
    .join(", ")})`);
  for (const kp of [anna, bartek, celina]) {
    const m = (await fetchMember(rpc, await memberPda(kasa, kp.address))).data;
    report(`- ${names.get(kp.address)}: savings ${formatZl(m.savings)}, locked ${formatZl(m.locked)}, used to cover defaults ${formatZl(m.totalSeized)}`);
  }
  const vault = await fetchTokenBalance(rpc, k.vault);
  report(`- Vault ${formatZl(vault)} = savings ${formatZl(k.totalSavings)} − lent ${formatZl(k.totalOutstanding)} ${vault === k.totalSavings - k.totalOutstanding ? "✓" : "✗"}`);
  if (vault !== k.totalSavings - k.totalOutstanding) throw new Error("vault invariant broken");
  report("");
  report("| Step | Transaction |");
  report("|---|---|");

  // Run on the bank: everyone takes everything that is theirs, at once.
  for (const [kp, c] of [
    [anna, annaC],
    [celina, celinaC],
  ] as const) {
    const m = (await fetchMember(rpc, await memberPda(kasa, kp.address))).data;
    await step(c, `${names.get(kp.address)} withdraws all ${formatZl(m.savings)} of her savings, without asking anyone`, await withdrawIxs(kp, kasa, k, m.savings));
  }
  report(`| ↳ Vault after everyone withdrew: ${formatZl(await fetchTokenBalance(rpc, k.vault))} | |`);

  report("");
  report(`Kasa account: [\`${kasa}\`](${explorerAddress(kasa)}) · loan account: [\`${loanAddr}\`](${explorerAddress(loanAddr as Address)})`);
  writeFileSync(resolve(import.meta.dirname, "../../../docs/devnet-e2e.md"), log.join("\n") + "\n");
  console.log("\nWrote docs/devnet-e2e.md");
}

async function waitUntil(rpc: Client["rpc"], unix: number) {
  for (;;) {
    const slot = await rpc.getSlot().send();
    const time = await rpc.getBlockTime(slot).send().catch(() => null);
    const now = time ? Number(time) : Math.floor(Date.now() / 1000);
    if (now >= unix) return;
    const wait = Math.min(unix - now, 15);
    console.log(`  …waiting ${wait} s for the deadline (chain time ${now}, target ${unix})`);
    await sleep(wait * 1000);
  }
}

main().catch((err) => {
  console.error(describeError(err));
  console.error(err);
  process.exit(1);
});
