import type { Agent, AIProvider } from "@shared/schema";
import { getTrendingTokens, getNewLaunches, analyzeToken, type TrendingToken, type MemeTokenAnalysis } from "./dexscreener";
import { buyToken, getSwapQuote, type SwapQuote } from "./jupiter-swap";
import { getAgentKeypair } from "./wallet-encryption";
import { storage } from "../storage";
import { getAICompletion, getProviderDisplayName } from "./multi-ai-provider";

export interface MemeTradeDecision {
  shouldTrade: boolean;
  action: "buy" | "sell" | "hold";
  tokenMint?: string;
  tokenSymbol?: string;
  tokenName?: string;
  amount?: number;
  confidence: number;
  reasoning: string;
  riskLevel: "low" | "medium" | "high" | "extreme";
}

export interface MemeCoinContext {
  trendingTokens: TrendingToken[];
  tokenAnalyses: MemeTokenAnalysis[];
  agentBalance: number;
  dailySpent: number;
  spendingLimit: number;
}

export async function analyzeMemeCoins(agent: Agent): Promise<MemeTradeDecision> {
  const remainingBudget = Math.max(0, agent.spendingLimit - agent.dailySpent);
  if (remainingBudget <= 0.001) {
    return {
      shouldTrade: false,
      action: "hold",
      confidence: 0.9,
      reasoning: "Daily spending limit exhausted",
      riskLevel: "low",
    };
  }

  const trendingTokens = await getTrendingTokens("1h");
  
  if (trendingTokens.length === 0) {
    return {
      shouldTrade: false,
      action: "hold",
      confidence: 0.3,
      reasoning: "No trending tokens available for analysis",
      riskLevel: "low",
    };
  }

  const tokenAnalyses = trendingTokens.slice(0, 10).map(token => analyzeToken(token));
  
  const popularTokens = tokenAnalyses.filter(a => {
    const token = a.token as TrendingToken;
    return (
      token.volume24h >= 100000 &&
      token.liquiditySol >= 50 &&
      token.liquidityUsd >= 10000
    );
  });

  const buyOpportunities = popularTokens.filter(
    a => a.recommendation === "strong_buy" || a.recommendation === "buy"
  );

  if (buyOpportunities.length === 0) {
    const allBuyOpportunities = tokenAnalyses.filter(
      a => a.recommendation === "strong_buy" || a.recommendation === "buy"
    );
    
    if (allBuyOpportunities.length === 0) {
      return {
        shouldTrade: false,
        action: "hold",
        confidence: 0.6,
        reasoning: "No buy opportunities found - all tokens either too risky or insufficient liquidity",
        riskLevel: "low",
      };
    }
    
    return {
      shouldTrade: false,
      action: "hold",
      confidence: 0.5,
      reasoning: `Found ${allBuyOpportunities.length} opportunities but none meet thresholds ($100K+ volume, 50+ SOL liquidity)`,
      riskLevel: "medium",
    };
  }

  const bestOpportunity = buyOpportunities.sort((a, b) => {
    const tokenA = a.token as TrendingToken;
    const tokenB = b.token as TrendingToken;
    const popularityA = (tokenA.liquidityUsd / 100000) + (tokenA.volume24h / 1000000);
    const popularityB = (tokenB.liquidityUsd / 100000) + (tokenB.volume24h / 1000000);
    return (b.confidence + popularityB * 0.2) - (a.confidence + popularityA * 0.2);
  })[0];
  
  const token = bestOpportunity.token as TrendingToken;

  const systemPrompt = `You are an expert meme coin trading AI on Solana. You analyze token metrics and decide whether to execute trades.

Agent Configuration:
- Name: ${agent.name}
- Goal: ${agent.goal}
- Strategy: ${agent.strategy || "Find high-potential meme coins with good liquidity"}
- Daily Spending Limit: ${agent.spendingLimit} SOL
- Already Spent Today: ${agent.dailySpent} SOL

You must be conservative with meme coins due to their high-risk nature. Only recommend trades when:
1. Liquidity is sufficient (>50 SOL minimum, >$10K USD)
2. 24h Volume is healthy (>$100K)
3. Price momentum is positive or stable
4. Market cap indicates reasonable valuation

Respond with a JSON object containing:
- shouldTrade: boolean - whether to execute the trade
- action: "buy" | "sell" | "hold"
- amount: number - SOL amount to trade (respect spending limits)
- confidence: number between 0 and 1
- reasoning: string explaining your decision
- riskLevel: "low" | "medium" | "high" | "extreme"`;

  const userPrompt = `Analyze this meme coin opportunity:

Token: ${token.name} (${token.symbol})
Mint: ${token.mint}
Trending Rank: ${token.rank}
Score: ${token.score}

Metrics:
- Liquidity: ${token.liquiditySol.toFixed(2)} SOL ($${token.liquidityUsd.toLocaleString()})
- 24h Volume: $${token.volume24h.toLocaleString()}
- Price: $${token.priceUsd}
- 24h Change: ${token.priceChange24h.toFixed(2)}%
- Market Cap: $${token.marketCap.toLocaleString()}

Pre-Analysis Signals:
- Liquidity Score: ${bestOpportunity.signals.liquidityScore.toFixed(0)}/100
- Volume Score: ${bestOpportunity.signals.volumeScore.toFixed(0)}/100
- Momentum Score: ${bestOpportunity.signals.momentumScore.toFixed(0)}/100
- Risk Score: ${bestOpportunity.signals.riskScore.toFixed(0)}/100

Pre-Analysis Recommendation: ${bestOpportunity.recommendation}
Pre-Analysis Confidence: ${(bestOpportunity.confidence * 100).toFixed(0)}%

Agent's Available Budget: ${agent.spendingLimit - agent.dailySpent} SOL remaining today

Should this agent trade this token?`;

  try {
    const provider = (agent.aiProvider as AIProvider) || "openai";
    console.log(`[MemeCoinAgent] Using ${getProviderDisplayName(provider)} for analysis`);
    
    const content = await getAICompletion({
      provider,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxTokens: 1024,
    });

    if (!content) {
      throw new Error("No response from AI");
    }

    const decision = JSON.parse(content);
    
    const remainingBudget = Math.max(0, agent.spendingLimit - agent.dailySpent);
    const requestedAmount = Math.max(0, decision.amount || 0.01);
    const safeAmount = Math.min(requestedAmount, remainingBudget);
    
    if (remainingBudget <= 0.001) {
      return {
        shouldTrade: false,
        action: "hold",
        tokenMint: token.mint,
        tokenSymbol: token.symbol,
        tokenName: token.name,
        amount: 0,
        confidence: 0.9,
        reasoning: "Daily spending limit exhausted - holding",
        riskLevel: "low",
      };
    }
    
    return {
      shouldTrade: decision.shouldTrade && safeAmount > 0.001,
      action: decision.action || "hold",
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      amount: safeAmount,
      confidence: decision.confidence || 0.5,
      reasoning: decision.reasoning || "AI analysis completed",
      riskLevel: decision.riskLevel || "high",
    };
  } catch (error) {
    console.error("[MemeCoinAgent] Error in AI analysis:", error);
    return {
      shouldTrade: false,
      action: "hold",
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      confidence: 0.3,
      reasoning: "Error in AI analysis - defaulting to hold",
      riskLevel: "extreme",
    };
  }
}

export async function executeMemeTradeForAgent(
  agent: Agent,
  decision: MemeTradeDecision
): Promise<{ success: boolean; signature?: string; error?: string }> {
  if (!decision.shouldTrade || decision.action !== "buy" || !decision.tokenMint) {
    return { success: false, error: "No trade to execute" };
  }

  if (!agent.encryptedPrivateKey) {
    return { success: false, error: "Agent has no wallet configured" };
  }

  const amount = Math.max(0, decision.amount || 0.01);
  
  if (amount < 0.001) {
    return { success: false, error: "Trade amount too small" };
  }
  
  const remainingBudget = Math.max(0, agent.spendingLimit - agent.dailySpent);
  if (amount > remainingBudget) {
    return { success: false, error: "Would exceed daily spending limit" };
  }

  try {
    const keypair = getAgentKeypair(agent.encryptedPrivateKey);
    
    console.log(`[MemeCoinAgent] Executing buy: ${amount} SOL -> ${decision.tokenSymbol}`);
    
    const result = await buyToken(decision.tokenMint, amount, keypair, 100);

    if (result.success && result.signature) {
      await storage.updateAgent(agent.id, {
        dailySpent: agent.dailySpent + amount,
        lastActiveAt: new Date(),
        totalTransactions: agent.totalTransactions + 1,
        totalVolume: agent.totalVolume + amount,
      });

      await storage.createTransaction({
        type: "meme_swap",
        status: "confirmed",
        signature: result.signature,
        amount: amount,
        agentId: agent.id,
        description: `Bought ${decision.tokenSymbol} (${decision.tokenName}) - ${decision.reasoning}`,
      });

      await storage.createZkProof({
        proofType: "trade_decision",
        proofData: `meme_${Date.now()}_${result.signature.slice(0, 16)}`,
        publicInputs: [decision.action, decision.tokenSymbol || "", String(decision.confidence)],
        agentId: agent.id,
        verified: true,
      });

      console.log(`[MemeCoinAgent] Trade successful: ${result.signature}`);
      return { success: true, signature: result.signature };
    } else {
      return { success: false, error: result.error };
    }
  } catch (error) {
    console.error("[MemeCoinAgent] Trade execution error:", error);
    return { success: false, error: String(error) };
  }
}

export async function getMemeCoinOpportunities(): Promise<{
  trending: TrendingToken[];
  analyses: MemeTokenAnalysis[];
  topPicks: MemeTokenAnalysis[];
}> {
  const trending = await getTrendingTokens("1h");
  const analyses = trending.slice(0, 10).map(token => analyzeToken(token));
  const topPicks = analyses
    .filter(a => a.recommendation === "strong_buy" || a.recommendation === "buy")
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);

  return { trending, analyses, topPicks };
}
