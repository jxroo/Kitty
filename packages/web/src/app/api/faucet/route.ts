// Test-money faucet: mints devnet tPLN (and a little SOL for fees) to a wallet.
// It exists only because devnet has no real złoty. It plays no role in the kasa's
// rules: the program accepts any SPL mint, and in production members bring a stablecoin.
import { NextResponse } from "next/server";
import {
  appendTransactionMessageInstructions,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  createTransactionMessage,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  isAddress,
  pipe,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Address,
  type Instruction,
} from "@solana/kit";
import {
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getMintToCheckedInstruction,
  TOKEN_PROGRAM_ADDRESS,
} from "@solana-program/token";
import { getTransferSolInstruction } from "@solana-program/system";
import { DECIMALS, MINT, RPC_URL } from "@/lib/kasa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GRANT = 2_000_00n; // 2000 zł in grosze
const SOL_MIN = 20_000_000n; // top up wallets below 0.02 SOL…
const SOL_TOPUP = 30_000_000n; // …with 0.03 SOL for fees and account rent
const COOLDOWN_MS = 30_000;
const lastGrant = new Map<string, number>();

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { address?: string };
  const owner = body.address;
  if (!owner || !isAddress(owner)) return NextResponse.json({ error: "Niepoprawny adres portfela." }, { status: 400 });
  const secret = process.env.FAUCET_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Faucet nie jest skonfigurowany na tym serwerze." }, { status: 503 });

  const now = Date.now();
  const last = lastGrant.get(owner) ?? 0;
  if (now - last < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);
    return NextResponse.json({ error: `Spróbuj ponownie za ${wait} s.` }, { status: 429 });
  }
  lastGrant.set(owner, now);

  try {
    const faucet = await createKeyPairSignerFromBytes(Uint8Array.from(JSON.parse(secret) as number[]));
    const rpc = createSolanaRpc(RPC_URL);
    const [ata] = await findAssociatedTokenPda({ owner: owner as Address, mint: MINT, tokenProgram: TOKEN_PROGRAM_ADDRESS });
    const instructions: Instruction[] = [
      getCreateAssociatedTokenIdempotentInstruction({ payer: faucet, ata, owner: owner as Address, mint: MINT }),
      getMintToCheckedInstruction({ mint: MINT, token: ata, mintAuthority: faucet, amount: GRANT, decimals: DECIMALS }),
    ];
    const { value: sol } = await rpc.getBalance(owner as Address, { commitment: "confirmed" }).send();
    if (BigInt(sol) < SOL_MIN) {
      instructions.push(getTransferSolInstruction({ source: faucet, destination: owner as Address, amount: SOL_TOPUP }));
    }

    const { value: blockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
    const message = pipe(
      createTransactionMessage({ version: 0 }),
      (m) => setTransactionMessageFeePayerSigner(faucet, m),
      (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
      (m) => appendTransactionMessageInstructions(instructions, m)
    );
    const tx = await signTransactionMessageWithSigners(message);
    const signature = getSignatureFromTransaction(tx);
    await rpc.sendTransaction(getBase64EncodedWireTransaction(tx), { encoding: "base64" }).send();

    for (let i = 0; i < 40; i++) {
      const { value } = await rpc.getSignatureStatuses([signature]).send();
      const status = value[0];
      if (status?.err) throw new Error(`Transakcja faucetu nie powiodła się: ${JSON.stringify(status.err)}`);
      if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
        return NextResponse.json({ signature, minted: GRANT.toString(), sol: BigInt(sol) < SOL_MIN });
      }
      await new Promise((r) => setTimeout(r, 750));
    }
    return NextResponse.json({ error: "Faucet nie doczekał się potwierdzenia, odśwież za chwilę.", signature }, { status: 504 });
  } catch (err) {
    lastGrant.delete(owner);
    console.error("faucet", err);
    return NextResponse.json({ error: err instanceof Error ? err.message.slice(0, 200) : "Błąd faucetu." }, { status: 500 });
  }
}
