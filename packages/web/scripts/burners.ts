// Funds the persisted test wallets (.e2e-wallets.json) for UI/devnet runs, or sweeps their SOL back.
//   npx tsx scripts/burners.ts fund|sweep
// FUNDER_KEYPAIR pays SOL; FAUCET_KEYPAIR is the tPLN mint authority.
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { createClient, createKeyPairSignerFromBytes, lamports, type Instruction, type KeyPairSigner } from "@solana/kit";
import { solanaRpc } from "@solana/kit-plugin-rpc";
import { signer, signerFromFile } from "@solana/kit-plugin-signer";
import { getTransferSolInstruction } from "@solana-program/system";
import { getCreateAssociatedTokenIdempotentInstruction, getMintToCheckedInstruction } from "@solana-program/token";
import { fetchTokenBalance } from "../src/lib/chain";
import { ataOf } from "../src/lib/instructions";
import { formatSol, formatZl, MINT, RPC_URL } from "../src/lib/kasa";
import { sendWithFallback } from "../src/lib/send";

const expand = (p: string) => p.replace(/^~/, homedir());
const funderPath = expand(process.env.FUNDER_KEYPAIR ?? "~/Downloads/projekt2-keypair.json");
const faucetPath = expand(process.env.FAUCET_KEYPAIR ?? "~/Downloads/kasa-faucet-keypair.json");
const WALLETS_FILE = resolve(import.meta.dirname, "../.e2e-wallets.json");
const SOL_TARGET = 40_000_000n;
const TPLN_TARGET = 3_000_00n;
const transactionConfig = { version: 0 } as const;

async function main() {
  const mode = process.argv[2];
  if (!existsSync(WALLETS_FILE)) throw new Error("No .e2e-wallets.json yet: run scripts/e2e-devnet.ts once.");
  const burners: KeyPairSigner[] = await Promise.all(
    (JSON.parse(readFileSync(WALLETS_FILE, "utf8")) as number[][]).map((b) => createKeyPairSignerFromBytes(Uint8Array.from(b)))
  );
  const funderClient = await createClient().use(signerFromFile(funderPath)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig }));
  const funder = funderClient.payer as KeyPairSigner;
  const rpc = funderClient.rpc;

  if (mode === "fund") {
    const faucet = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(readFileSync(faucetPath, "utf8"))));
    const ixs: Instruction[] = [];
    for (const kp of burners) {
      const bal = (await rpc.getBalance(kp.address).send()).value;
      if (bal < SOL_TARGET) ixs.push(getTransferSolInstruction({ source: funder, destination: kp.address, amount: lamports(SOL_TARGET - bal) }));
      const ata = await ataOf(kp.address, MINT);
      ixs.push(getCreateAssociatedTokenIdempotentInstruction({ payer: funder, ata, owner: kp.address, mint: MINT }));
      const tokens = await fetchTokenBalance(rpc, ata);
      if (tokens < TPLN_TARGET) ixs.push(getMintToCheckedInstruction({ mint: MINT, token: ata, mintAuthority: faucet, amount: TPLN_TARGET - tokens, decimals: 2 }));
    }
    if (ixs.length) await sendWithFallback(rpc, () => funderClient.sendTransaction(ixs));
  } else if (mode === "sweep") {
    for (const kp of burners) {
      const bal = (await rpc.getBalance(kp.address).send()).value;
      const keep = 5_000n;
      if (bal <= keep) continue;
      const c = await createClient().use(signer(kp)).use(solanaRpc({ rpcUrl: RPC_URL, transactionConfig }));
      await sendWithFallback(rpc, () =>
        c.sendTransaction([getTransferSolInstruction({ source: kp, destination: funder.address, amount: lamports(bal - keep) })])
      );
    }
  } else {
    throw new Error("usage: burners.ts fund|sweep");
  }
  for (const kp of burners) {
    const bal = (await rpc.getBalance(kp.address).send()).value;
    console.log(`${kp.address}: ${formatSol(bal)} SOL, ${formatZl(await fetchTokenBalance(rpc, await ataOf(kp.address, MINT)))}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
