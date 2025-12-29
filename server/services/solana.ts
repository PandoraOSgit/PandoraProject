import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  ParsedTransactionWithMeta,
} from "@solana/web3.js";
import type { InsertTransaction } from "@shared/schema";
import { storage } from "../storage";

const MAINNET_RPC = process.env.SOLANA_RPC_URL || clusterApiUrl("mainnet-beta");
const connection = new Connection(MAINNET_RPC, "confirmed");

export interface WalletBalance {
  address: string;
  sol: number;
  usd: number;
}

export interface TransactionInfo {
  signature: string;
  blockTime: number | null;
  slot: number;
  fee: number;
  status: "confirmed" | "failed";
  type: string;
}

export async function getBalance(walletAddress: string): Promise<WalletBalance | null> {
  try {
    const pubkey = new PublicKey(walletAddress);
    const balance = await connection.getBalance(pubkey);
    const solBalance = balance / LAMPORTS_PER_SOL;
    
    const solPrice = await getSolPrice();
    
    return {
      address: walletAddress,
      sol: solBalance,
      usd: solBalance * solPrice,
    };
  } catch (error) {
    console.error("Error fetching balance:", error);
    return null;
  }
}

export async function getSolPrice(): Promise<number> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await response.json();
    return data.solana?.usd || 150;
  } catch (error) {
    console.error("Error fetching SOL price:", error);
    return 150;
  }
}

export async function getRecentTransactions(
  walletAddress: string,
  limit: number = 10
): Promise<TransactionInfo[]> {
  try {
    const pubkey = new PublicKey(walletAddress);
    const signatures = await connection.getSignaturesForAddress(pubkey, { limit });
    
    const transactions: TransactionInfo[] = signatures.map((sig) => ({
      signature: sig.signature,
      blockTime: sig.blockTime ?? null,
      slot: sig.slot,
      fee: 0,
      status: sig.err ? "failed" : "confirmed",
      type: "transfer",
    }));
    
    return transactions;
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
}

export async function getTransactionDetails(
  signature: string
): Promise<ParsedTransactionWithMeta | null> {
  try {
    const tx = await connection.getParsedTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
    return tx;
  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return null;
  }
}

export async function validateAddress(address: string): Promise<boolean> {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

export async function monitorWalletTransactions(
  agentId: number,
  walletAddress: string
): Promise<void> {
  try {
    const pubkey = new PublicKey(walletAddress);
    
    const subscriptionId = connection.onAccountChange(
      pubkey,
      async (accountInfo, context) => {
        const transaction: InsertTransaction = {
          agentId,
          signature: `monitor_${Date.now()}`,
          type: "transfer",
          status: "confirmed",
          amount: accountInfo.lamports / LAMPORTS_PER_SOL,
          description: "Wallet balance change detected",
          blockNumber: context.slot,
          fee: 0,
        };
        
        await storage.createTransaction(transaction);
      },
      "confirmed"
    );
    
    console.log(`Started monitoring wallet ${walletAddress} with subscription ${subscriptionId}`);
  } catch (error) {
    console.error("Error setting up wallet monitoring:", error);
  }
}

export async function getSlotInfo(): Promise<{
  slot: number;
  blockHeight: number;
  epoch: number;
}> {
  try {
    const slot = await connection.getSlot();
    const blockHeight = await connection.getBlockHeight();
    const epochInfo = await connection.getEpochInfo();
    
    return {
      slot,
      blockHeight,
      epoch: epochInfo.epoch,
    };
  } catch (error) {
    console.error("Error fetching slot info:", error);
    return {
      slot: 0,
      blockHeight: 0,
      epoch: 0,
    };
  }
}

export async function getNetworkStats(): Promise<{
  tps: number;
  avgBlockTime: number;
  version: string;
}> {
  try {
    const samples = await connection.getRecentPerformanceSamples(1);
    const version = await connection.getVersion();
    
    const tps = samples[0]?.numTransactions
      ? samples[0].numTransactions / samples[0].samplePeriodSecs
      : 0;
    
    return {
      tps: Math.round(tps),
      avgBlockTime: samples[0]?.samplePeriodSecs || 0.4,
      version: version["solana-core"] || "unknown",
    };
  } catch (error) {
    console.error("Error fetching network stats:", error);
    return {
      tps: 4000,
      avgBlockTime: 0.4,
      version: "unknown",
    };
  }
}

export { connection, MAINNET_RPC };
