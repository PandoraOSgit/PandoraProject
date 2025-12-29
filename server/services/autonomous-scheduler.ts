import { storage } from "../storage";
import { analyzeAgentDecision, type AnalysisContext } from "./ai-agent";
import { getSolPrice, getNetworkStats } from "./solana";
import { getAgentKeypair } from "./wallet-encryption";
import { Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import type { Agent, InsertTransaction, InsertZkProof } from "@shared/schema";
import { analyzeMemeCoins, executeMemeTradeForAgent } from "./meme-coin-agent";

const ANALYSIS_INTERVAL_MS = 60000;
const MIN_CONFIDENCE_THRESHOLD = 0.7;
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

let isRunning = false;
let intervalId: NodeJS.Timeout | null = null;
let cycleInProgress = false;

interface ExecutionResult {
  success: boolean;
  signature?: string;
  error?: string;
  decision?: string;
  confidence?: number;
}

async function getMarketContext(): Promise<{ price: number; tps: number; condition: string }> {
  let price = 150;
  let tps = 2500;
  let condition = "neutral";

  try {
    price = await getSolPrice();
    const networkStats = await getNetworkStats();
    tps = networkStats.tps;

    if (tps > 3000 && price > 120) {
      condition = "bullish";
    } else if (tps < 1500 || price < 100) {
      condition = "bearish";
    }
  } catch (error) {
    console.error("[Scheduler] Error fetching market data:", error);
  }

  return { price, tps, condition };
}

async function checkAndResetDailySpending(agent: Agent): Promise<number> {
  const now = new Date();
  const lastReset = agent.lastSpendingReset ? new Date(agent.lastSpendingReset) : null;
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (!lastReset || lastReset < dayStart) {
    await storage.updateAgent(agent.id, { dailySpent: 0, lastSpendingReset: now });
    return 0;
  }

  return agent.dailySpent;
}

async function executeAgentTrade(agent: Agent, decision: string, confidence: number): Promise<ExecutionResult> {
  if (!agent.encryptedPrivateKey || !agent.walletAddress) {
    return { success: false, error: "Agent has no wallet configured" };
  }

  const dailySpent = await checkAndResetDailySpending(agent);
  const remainingLimit = agent.spendingLimit - dailySpent;

  if (remainingLimit <= 0) {
    return { success: false, error: "Daily spending limit reached" };
  }

  const connection = new Connection(RPC_URL, "confirmed");
  let keypair;

  try {
    keypair = getAgentKeypair(agent.encryptedPrivateKey);
  } catch (err) {
    return { success: false, error: "Failed to decrypt agent wallet" };
  }

  const balance = await connection.getBalance(keypair.publicKey);
  const balanceSOL = balance / LAMPORTS_PER_SOL;

  if (balanceSOL < 0.001) {
    return { success: false, error: "Insufficient agent wallet balance" };
  }

  const tradeAmount = Math.min(0.001, remainingLimit, balanceSOL - 0.0001);

  if (tradeAmount <= 0) {
    return { success: false, error: "Trade amount too small" };
  }

  const destinationAddress = agent.ownerWallet;
  if (!destinationAddress) {
    return { success: false, error: "No owner wallet to send profits to" };
  }

  try {
    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(destinationAddress),
        lamports: Math.floor(tradeAmount * LAMPORTS_PER_SOL),
      })
    );

    const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);

    const newBalance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;
    await storage.updateAgent(agent.id, {
      walletBalance: newBalance,
      dailySpent: dailySpent + tradeAmount,
      lastActiveAt: new Date(),
      totalTransactions: agent.totalTransactions + 1,
      totalVolume: agent.totalVolume + tradeAmount,
    });

    const txRecord: InsertTransaction = {
      type: "autonomous_trade",
      status: "confirmed",
      amount: tradeAmount,
      signature,
      description: `Autonomous ${decision} - From: ${agent.walletAddress} To: ${destinationAddress} - Confidence: ${(confidence * 100).toFixed(0)}%`,
      agentId: agent.id,
    };
    await storage.createTransaction(txRecord);

    const zkProof: InsertZkProof = {
      proofType: "decision",
      publicInputs: [decision, String(confidence), String(agent.id)],
      proofData: `auto_${Date.now()}_${signature.slice(0, 16)}`,
      agentId: agent.id,
      verified: true,
    };
    await storage.createZkProof(zkProof);

    console.log(`[Scheduler] Agent ${agent.name} executed ${decision}: ${signature}`);

    return { success: true, signature, decision, confidence };
  } catch (error) {
    console.error(`[Scheduler] Trade execution failed for agent ${agent.name}:`, error);
    return { success: false, error: String(error) };
  }
}

async function processRunningAgent(agent: Agent): Promise<void> {
  console.log(`[Scheduler] Processing agent: ${agent.name} (ID: ${agent.id}, Type: ${agent.type})`);

  try {
    if (agent.type === "trading") {
      console.log(`[Scheduler] Using meme coin analysis for trading agent: ${agent.name}`);
      
      const decision = await analyzeMemeCoins(agent);
      
      await storage.createAgentDecision({
        agentId: agent.id,
        decision: decision.action,
        confidence: decision.confidence,
        reasoning: decision.reasoning,
      });

      console.log(`[Scheduler] Agent ${agent.name} meme analysis: ${decision.action} on ${decision.tokenSymbol || "N/A"} (${(decision.confidence * 100).toFixed(0)}% confidence)`);

      if (decision.shouldTrade && decision.confidence >= MIN_CONFIDENCE_THRESHOLD) {
        const result = await executeMemeTradeForAgent(agent, decision);

        if (result.success) {
          console.log(`[Scheduler] Agent ${agent.name} meme trade executed: ${result.signature}`);
        } else {
          console.log(`[Scheduler] Agent ${agent.name} meme trade skipped: ${result.error}`);
        }
      } else {
        console.log(`[Scheduler] Agent ${agent.name} holding (${decision.reasoning})`);
      }
    } else {
      const market = await getMarketContext();

      const context: AnalysisContext = {
        currentPrice: market.price,
        marketCondition: market.condition,
        portfolioValue: agent.totalVolume,
        riskLevel: "medium",
        recentTransactions: agent.totalTransactions,
      };

      const analysis = await analyzeAgentDecision(agent, context);

      await storage.createAgentDecision({
        agentId: agent.id,
        decision: analysis.action,
        confidence: analysis.confidence,
        reasoning: `${analysis.reasoning} | Market: ${market.condition}, Price: $${market.price.toFixed(2)}, TPS: ${market.tps}`,
      });

      console.log(`[Scheduler] Agent ${agent.name} analysis: ${analysis.action} (${(analysis.confidence * 100).toFixed(0)}% confidence)`);

      if (analysis.confidence >= MIN_CONFIDENCE_THRESHOLD && analysis.action !== "hold") {
        const result = await executeAgentTrade(agent, analysis.action, analysis.confidence);

        if (result.success) {
          console.log(`[Scheduler] Agent ${agent.name} trade executed: ${result.signature}`);
        } else {
          console.log(`[Scheduler] Agent ${agent.name} trade skipped: ${result.error}`);
        }
      } else {
        console.log(`[Scheduler] Agent ${agent.name} holding (confidence too low or hold decision)`);
      }
    }

    await storage.updateAgent(agent.id, { lastActiveAt: new Date() });
  } catch (error) {
    console.error(`[Scheduler] Error processing agent ${agent.name}:`, error);
  }
}

async function runSchedulerCycle(): Promise<void> {
  if (!isRunning) return;
  
  if (cycleInProgress) {
    console.log("[Scheduler] Previous cycle still in progress, skipping...");
    return;
  }

  cycleInProgress = true;
  console.log("[Scheduler] Running autonomous agent cycle...");

  try {
    const allAgents = await storage.getAllAgents();
    const runningAgents = allAgents.filter(
      (agent) => agent.status === "running" && agent.encryptedPrivateKey
    );

    console.log(`[Scheduler] Found ${runningAgents.length} running agents with wallets`);

    for (const agent of runningAgents) {
      await processRunningAgent(agent);
    }
  } catch (error) {
    console.error("[Scheduler] Error in scheduler cycle:", error);
  } finally {
    cycleInProgress = false;
  }
}

export function startAutonomousScheduler(): void {
  if (isRunning) {
    console.log("[Scheduler] Already running");
    return;
  }

  isRunning = true;
  console.log(`[Scheduler] Starting autonomous agent scheduler (interval: ${ANALYSIS_INTERVAL_MS / 1000}s)`);

  runSchedulerCycle();

  intervalId = setInterval(runSchedulerCycle, ANALYSIS_INTERVAL_MS);
}

export function stopAutonomousScheduler(): void {
  if (!isRunning) {
    console.log("[Scheduler] Not running");
    return;
  }

  isRunning = false;
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  console.log("[Scheduler] Stopped autonomous agent scheduler");
}

export function isSchedulerRunning(): boolean {
  return isRunning;
}
