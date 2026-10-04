// Prepares a kasa for the live demo's climax with the test wallets (.e2e-wallets.json):
// Anna, Bartek and Celina save, Bartek borrows 1000 zł in 4 installments with Anna and
// Celina as guarantors and pays it out with a direct-debit mandate. Then nobody clicks:
// the bot (scripts/crank.ts, running on Railway) pulls installment 1 from his wallet.
//   npx tsx scripts/burners.ts fund && npx tsx scripts/demo-seed.ts [--revoke] [--base https://…]
// --revoke: once installment 1 has been pulled, Bartek revokes the mandate, so the bot
// collects installment 2 from his locked savings after grace. Prints the kasa link to open.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, createKeyPairSignerFromBytes, type Instruction, type KeyPairSigner } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { fetchKasa, fetchLoan } from "../src/generated";
import {
  createKasaIxs,
  depositIx,
  disburseIxs,
  guaranteeIx,
  joinIx,
  loanPda,
  requestLoanIx,
  revokeMandateIx,
} from "../src/lib/instructions";
import { formatZl, MINT, randomId, RPC_URL } from "../src/lib/kasa";
import { sendWithFallback } from "../src/lib/send";

const WALLETS_FILE = resolve(import.meta.dirname, "../.e2e-wallets.json");
const transactionConfig = { version: 0 } as const;
const zl = (x: number) => BigInt(Math.round(x * 100));
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const base = arg("--base") ?? "https://web-production-ad49f.up.railway.app";
const revoke = process.argv.includes("--revoke");
const log = (line: string) => console.log(`${new Date().toLocaleTimeString("en-GB")} ${line}`);

async function main() {
  if (!existsSync(WALLETS_FILE)) throw new Error("No .e2e-wallets.json: run scripts/e2e-devnet.ts once, then scripts/burners.ts fund.");
  const [anna, bartek, celina] = await Promise.all(
    (JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as number[][]).slice(0, 3).map((b) => createKeyPairSignerFromBytes(Uint8Array.from(b)))
  );
  const clientFor = (kp: KeyPairSigner) => createClient().use(signer(kp)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig }));
  const [annaC, bartekC, celinaC] = [clientFor(anna), clientFor(bartek), clientFor(celina)];
  const rpc = annaC.rpc;
  const send = async (c: ReturnType<typeof clientFor>, label: string, ixs: Instruction[]) => {
    await sendWithFallback(rpc, () => c.sendTransaction(ixs));
    log(`✓ ${label}`);
  };

  const built = await createKasaIxs(anna, MINT, {
    kasaId: randomId(),
    name: "Kasa Działu IT",
    loanMultiplierBps: 20_000,
    maxInstallments: 6,
    periodSecs: 60,
    graceSecs: 15,
    displayName: "Anna",
  });
  const kasa = built.kasa;
  await send(annaC, "Anna zakłada kasę (rata co 60 s, karencja 15 s)", built.instructions);
  await send(bartekC, "Bartek dołącza", [await joinIx(bartek, kasa, "Bartek")]);
  await send(celinaC, "Celina dołącza", [await joinIx(celina, kasa, "Celina")]);
  const k = (await fetchKasa(rpc, kasa)).data;
  await send(annaC, "Anna wpłaca 1000 zł", [await depositIx(anna, kasa, k, zl(1_000))]);
  await send(bartekC, "Bartek wpłaca 500 zł", [await depositIx(bartek, kasa, k, zl(500))]);
  await send(celinaC, "Celina wpłaca 1000 zł", [await depositIx(celina, kasa, k, zl(1_000))]);
  await send(bartekC, "Bartek prosi o 1000 zł na 4 raty", [await requestLoanIx(bartek, kasa, 0, zl(1_000), 4)]);
  const loan = await loanPda(kasa, bartek.address, 0);
  await send(annaC, "Anna poręcza 300 zł", [await guaranteeIx(anna, kasa, loan, zl(300))]);
  await send(celinaC, "Celina poręcza 200 zł", [await guaranteeIx(celina, kasa, loan, zl(200))]);
  let l = (await fetchLoan(rpc, loan)).data;
  await send(bartekC, "Bartek wypłaca pożyczkę i włącza polecenie zapłaty", await disburseIxs(bartek, loan, l, k, { mandate: true }));
  l = (await fetchLoan(rpc, loan)).data;

  const due1 = new Date((Number(l.disbursedAt) + 60) * 1000).toLocaleTimeString("en-GB");
  log("");
  log(`Kasa gotowa: ${base}/?kasa=${kasa}`);
  log(`Rata 1 (250 zł) jest wymagalna o ${due1} (czas klastra). Bot pobierze ją sam z portfela Bartka.`);
  if (!revoke) return;

  log("--revoke: czekam, aż bot pobierze ratę 1…");
  for (;;) {
    l = (await fetchLoan(rpc, loan)).data;
    if (l.autopaid > 0n) break;
    await new Promise((r) => setTimeout(r, 3_000));
  }
  log(`✓ Bot pobrał ${formatZl(l.autopaid)} z portfela Bartka (polecenie zapłaty).`);
  await send(bartekC, "Bartek cofa polecenie zapłaty: przestaje płacić", [await revokeMandateIx(bartek, MINT)]);
  const due2 = new Date((Number(l.disbursedAt) + 2 * 60 + 15) * 1000).toLocaleTimeString("en-GB");
  log(`Rata 2 zejdzie z zabezpieczeń Bartka po karencji, ok. ${due2}: zrobi to bot, nikt nie klika.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
