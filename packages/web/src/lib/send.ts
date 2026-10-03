// Public devnet RPC websockets drop now and then. Kit confirms transactions over a
// websocket subscription, so a dropped socket can surface as an error even though the
// transaction landed. This falls back to polling the signature status before giving up.
import type { Rpc, Signature, SolanaRpcApi } from "@solana/kit";

type Sent = { context: { signature: string } };

const SIGNATURE_IN_MESSAGE = /\(([1-9A-HJ-NP-Za-km-z]{80,90})\)/;
const TRANSIENT = /WebSocket|socket|timed out|timeout|block height exceeded|fetch failed/i;

export async function sendWithFallback(
  rpc: Rpc<SolanaRpcApi>,
  run: () => Promise<Sent>,
  attempt = 0
): Promise<string> {
  try {
    return (await run()).context.signature;
  } catch (err) {
    const text = errorText(err);
    const signature = text.match(SIGNATURE_IN_MESSAGE)?.[1];
    // Rate-limited before anything was signed and sent: safe to try again.
    if (!signature && /\b429\b|Too Many Requests/.test(text) && attempt < 4) {
      await new Promise((r) => setTimeout(r, 3_000 * (attempt + 1)));
      return sendWithFallback(rpc, run, attempt + 1);
    }
    if (!signature || !TRANSIENT.test(text)) throw err;
    for (let i = 0; i < 30; i++) {
      const { value } = await rpc.getSignatureStatuses([signature as Signature]).send();
      const status = value[0];
      if (status && (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized")) {
        if (status.err) throw err;
        return signature;
      }
      await new Promise((r) => setTimeout(r, 1_000));
    }
    throw err;
  }
}

function errorText(err: unknown, depth = 0): string {
  if (!err || depth > 4) return "";
  const e = err as { message?: string; cause?: unknown; context?: { causeMessage?: string } };
  return [e.message, e.context?.causeMessage, errorText(e.cause, depth + 1)].filter(Boolean).join("\n");
}
