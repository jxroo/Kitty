// The "automat": a bot that replaces the payroll deduction and the bank's standing order.
//   CRANK_KEYPAIR=~/crank.json npx tsx scripts/crank.ts          (or CRANK_SECRET_KEY='[1,2,…]')
//   … scripts/crank.ts --once                                     (one pass, then exit)
// It holds no rights in the program: it only pays transaction fees. Every few seconds it
// reads the chain and submits what the rules already allow anyone to submit:
//   1. pull_installment   – an installment is due and the borrower gave a mandate,
//   2. collect_overdue    – an installment is past due + grace (taken from collateral),
//   3. pull_contribution  – a member's standing contribution is due and they gave a mandate.
// If it stops, nothing breaks: anyone can press the same buttons in the app.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { createClient, createKeyPairSignerFromBytes, type Instruction } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer } from "@solana/kit-plugin-signer";
import { LoanStatus } from "../src/generated";
import { fetchChainState, fetchWalletToken } from "../src/lib/chain";
import { ataOf, collectOverdueIx, memberPda, pullContributionIx, pullInstallmentIx } from "../src/lib/instructions";
import { describeError, explorerTx, formatZl, mandateAvailable, overdueNow, owedNow, RPC_URL } from "../src/lib/kasa";
import { sendWithFallback } from "../src/lib/send";

const INTERVAL_MS = Number(process.env.CRANK_INTERVAL_MS ?? 4_000);
const once = process.argv.includes("--once");

function secretKey(): Uint8Array {
  const inline = process.env.CRANK_SECRET_KEY;
  const path = (process.env.CRANK_KEYPAIR ?? "~/crank-keypair.json").replace(/^~/, homedir());
  return Uint8Array.from(JSON.parse(inline ?? readFileSync(path, "utf8")) as number[]);
}

const log = (line: string) => console.log(`${new Date().toISOString().slice(11, 19)} ${line}`);

async function main() {
  const bot = await createKeyPairSignerFromBytes(secretKey());
  const client = createClient().use(signer(bot)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig: { version: 0 } }));
  const rpc = client.rpc;
  log(`automat ${bot.address} · RPC ${RPC_URL.replace(/api-key=[^&]+/, "api-key=***")}`);

  async function submit(label: string, ix: Instruction) {
    try {
      const signature = await sendWithFallback(rpc, () => client.sendTransaction([ix]));
      log(`✓ ${label} ${explorerTx(signature)}`);
    } catch (err) {
      // Usually the cluster clock is a second behind ours, or someone else got there first.
      log(`· ${label}: ${describeError(err)}`);
    }
  }

  async function pass() {
    const [state, now] = await Promise.all([
      fetchChainState(rpc),
      rpc
        .getSlot({ commitment: "confirmed" })
        .send()
        .then((slot) => rpc.getBlockTime(slot).send())
        .then(Number),
    ]);
    const kasas = new Map(state.kasas.map((k) => [k.address, k.data]));
    const names = new Map(state.members.map((m) => [`${m.data.kasa}:${m.data.wallet}`, m.data.displayName]));

    for (const { address, data: loan } of state.loans) {
      const kasa = kasas.get(loan.kasa);
      if (!kasa || loan.status !== LoanStatus.Active) continue;
      const who = names.get(`${loan.kasa}:${loan.borrower}`) ?? loan.borrower.slice(0, 4);
      const owed = owedNow(loan, kasa, now);
      if (owed > 0n) {
        const token = await fetchWalletToken(rpc, await ataOf(loan.borrower, kasa.mint));
        const available = mandateAvailable(token, await memberPda(loan.kasa, loan.borrower));
        if (available > 0n) {
          const amount = owed < available ? owed : available;
          await submit(`rata ${formatZl(amount)} z portfela: ${who} (polecenie zapłaty)`, await pullInstallmentIx(address, loan, kasa));
          continue; // re-read the loan next pass before touching collateral
        }
      }
      const overdue = overdueNow(loan, kasa, now);
      if (overdue > 0n) {
        await submit(`zaległe ${formatZl(overdue)} z zabezpieczeń: ${who}`, await collectOverdueIx(address, loan));
      }
    }

    for (const { data: member } of state.members) {
      const kasa = kasas.get(member.kasa);
      if (!kasa || member.contribution === 0n || Number(member.nextContributionAt) > now) continue;
      const token = await fetchWalletToken(rpc, await ataOf(member.wallet, kasa.mint));
      if (mandateAvailable(token, await memberPda(member.kasa, member.wallet)) < member.contribution) continue;
      await submit(
        `składka ${formatZl(member.contribution)}: ${member.displayName} (stałe zlecenie)`,
        await pullContributionIx(member.kasa, kasa, member.wallet)
      );
    }
  }

  for (;;) {
    try {
      await pass();
    } catch (err) {
      log(`! odczyt łańcucha: ${describeError(err)}`);
    }
    if (once) return;
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
