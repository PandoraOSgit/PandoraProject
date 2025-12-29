import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  TransactionInstruction,
} from "@solana/web3.js";
import { connection } from "./solana";

export interface TransactionRequest {
  type: "transfer" | "stake" | "unstake" | "swap";
  fromPubkey: string;
  toPubkey?: string;
  amount?: number;
  memo?: string;
}

export interface PreparedTransaction {
  serializedTransaction: string;
  recentBlockhash: string;
  lastValidBlockHeight: number;
  estimatedFee: number;
  type: string;
  description: string;
}

export async function prepareTransferTransaction(
  fromPubkey: string,
  toPubkey: string,
  amountSol: number,
  memo?: string
): Promise<PreparedTransaction> {
  const from = new PublicKey(fromPubkey);
  const to = new PublicKey(toPubkey);
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");

  const transaction = new Transaction({
    recentBlockhash: blockhash,
    feePayer: from,
  });

  transaction.add(
    SystemProgram.transfer({
      fromPubkey: from,
      toPubkey: to,
      lamports,
    })
  );

  if (memo) {
    const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
    transaction.add(
      new TransactionInstruction({
        keys: [{ pubkey: from, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(memo, "utf-8"),
      })
    );
  }

  const serialized = transaction.serialize({
    requireAllSignatures: false,
    verifySignatures: false,
  });

  const estimatedFee = await connection.getFeeForMessage(transaction.compileMessage(), "confirmed");

  return {
    serializedTransaction: serialized.toString("base64"),
    recentBlockhash: blockhash,
    lastValidBlockHeight,
    estimatedFee: (estimatedFee.value || 5000) / LAMPORTS_PER_SOL,
    type: "transfer",
    description: `Transfer ${amountSol} SOL to ${toPubkey.slice(0, 8)}...`,
  };
}

export async function confirmTransaction(
  signature: string,
  blockhash: string,
  lastValidBlockHeight: number
): Promise<{ confirmed: boolean; slot?: number; error?: string }> {
  try {
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      "confirmed"
    );

    if (confirmation.value.err) {
      return { confirmed: false, error: JSON.stringify(confirmation.value.err) };
    }

    const tx = await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });

    return { confirmed: true, slot: tx?.slot };
  } catch (error) {
    console.error("Error confirming transaction:", error);
    return { confirmed: false, error: String(error) };
  }
}

export async function broadcastSignedTransaction(
  signedTransactionBase64: string
): Promise<{ signature: string; error?: string }> {
  try {
    const buffer = Buffer.from(signedTransactionBase64, "base64");
    const signature = await connection.sendRawTransaction(buffer, {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    return { signature };
  } catch (error) {
    console.error("Error broadcasting transaction:", error);
    return { signature: "", error: String(error) };
  }
}
