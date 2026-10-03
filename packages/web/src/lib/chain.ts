// Reads every account of the program in one call. The chain is the only database:
// there is no backend that stores kasas, members or loans.
import { getBase64Encoder, type Address, type Rpc, type SolanaRpcApi } from "@solana/kit";
import {
  getKasaDecoder,
  getLoanDecoder,
  getMemberDecoder,
  KASA_DISCRIMINATOR,
  KASA_PROGRAM_ADDRESS,
  LOAN_DISCRIMINATOR,
  MEMBER_DISCRIMINATOR,
  type Kasa,
  type Loan,
  type Member,
} from "../generated";

export type WithAddress<T> = { address: Address; data: T };

export type ChainState = {
  kasas: WithAddress<Kasa>[];
  members: WithAddress<Member>[];
  loans: WithAddress<Loan>[];
};

function startsWith(bytes: Uint8Array, prefix: ArrayLike<number>) {
  if (bytes.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) if (bytes[i] !== prefix[i]) return false;
  return true;
}

export async function fetchChainState(rpc: Rpc<SolanaRpcApi>): Promise<ChainState> {
  const accounts = await rpc
    .getProgramAccounts(KASA_PROGRAM_ADDRESS, { encoding: "base64", commitment: "confirmed" })
    .send();
  const base64 = getBase64Encoder();
  const state: ChainState = { kasas: [], members: [], loans: [] };
  const kasaDecoder = getKasaDecoder();
  const memberDecoder = getMemberDecoder();
  const loanDecoder = getLoanDecoder();
  for (const { pubkey, account } of accounts) {
    const bytes = new Uint8Array(base64.encode(account.data[0]));
    try {
      if (startsWith(bytes, KASA_DISCRIMINATOR)) state.kasas.push({ address: pubkey, data: kasaDecoder.decode(bytes) });
      else if (startsWith(bytes, MEMBER_DISCRIMINATOR))
        state.members.push({ address: pubkey, data: memberDecoder.decode(bytes) });
      else if (startsWith(bytes, LOAN_DISCRIMINATOR)) state.loans.push({ address: pubkey, data: loanDecoder.decode(bytes) });
    } catch {
      // Not decodable with this IDL (e.g. an account from an older layout): skip it.
    }
  }
  state.kasas.sort((a, b) => Number(b.data.createdAt - a.data.createdAt));
  state.members.sort((a, b) => Number(a.data.joinedAt - b.data.joinedAt));
  state.loans.sort((a, b) => Number(b.data.createdAt - a.data.createdAt));
  return state;
}

export async function fetchTokenBalance(rpc: Rpc<SolanaRpcApi>, tokenAccount: Address): Promise<bigint> {
  try {
    const { value } = await rpc.getTokenAccountBalance(tokenAccount, { commitment: "confirmed" }).send();
    return BigInt(value.amount);
  } catch {
    return 0n; // account does not exist yet
  }
}
