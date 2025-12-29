import type { Agent, AgentDecision, InsertAgentDecision, AIProvider } from "@shared/schema";
import { storage } from "../storage";
import { getSolPrice, getNetworkStats } from "./solana";
import { getAICompletion, getProviderDisplayName } from "./multi-ai-provider";

export interface AnalysisContext {
  currentPrice?: number;
  marketCondition?: string;
  portfolioValue?: number;
  riskLevel?: string;
  recentTransactions?: number;
}

export interface AgentAnalysisResult {
  action: "buy" | "sell" | "stake" | "unstake" | "lend" | "borrow" | "hold" | "rebalance";
  confidence: number;
  reasoning: string;
  amount?: number;
  targetAsset?: string;
  priority: "low" | "medium" | "high" | "urgent";
  riskAssessment: string;
}

export async function analyzeAgentDecision(
  agent: Agent,
  context: AnalysisContext
): Promise<AgentAnalysisResult> {
  const systemPrompt = `You are an autonomous AI agent operating on Solana blockchain. Your role is to make optimal financial decisions based on the agent's configuration and current market context.

Agent Configuration:
- Name: ${agent.name}
- Type: ${agent.type}
- Goal: ${agent.goal}
- Strategy: ${agent.strategy || "No specific strategy defined"}
- Risk Parameters: ${JSON.stringify(agent.parameters || {})}

You must respond with a JSON object containing:
- action: One of "buy", "sell", "stake", "unstake", "lend", "borrow", "hold", "rebalance"
- confidence: A number between 0 and 1 indicating decision confidence
- reasoning: A brief explanation of your decision
- amount: Optional suggested amount in SOL or percentage
- targetAsset: Optional target asset symbol
- priority: One of "low", "medium", "high", "urgent"
- riskAssessment: Brief risk analysis of this action

Be conservative and prioritize capital preservation. Never recommend actions with confidence below 0.6 for execution.`;

  const userPrompt = `Current Market Context:
- Current SOL Price: $${context.currentPrice || 150}
- Market Condition: ${context.marketCondition || "neutral"}
- Portfolio Value: $${context.portfolioValue || 10000}
- Risk Level: ${context.riskLevel || "medium"}
- Recent Transactions: ${context.recentTransactions || 0}

Analyze the situation and provide your recommended action as the autonomous agent "${agent.name}".`;

  try {
    const provider = (agent.aiProvider as AIProvider) || "openai";
    console.log(`[AIAgent] Using ${getProviderDisplayName(provider)} for analysis`);
    
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

    const result = JSON.parse(content) as AgentAnalysisResult;
    return result;
  } catch (error) {
    console.error("Error analyzing agent decision:", error);
    return {
      action: "hold",
      confidence: 0.5,
      reasoning: "Unable to analyze market conditions. Defaulting to hold position.",
      priority: "low",
      riskAssessment: "Error in analysis - maintaining current position for safety.",
    };
  }
}

export async function executeAgentAnalysis(agentId: number): Promise<AgentDecision | null> {
  const agent = await storage.getAgent(agentId);
  if (!agent) {
    return null;
  }

  if (agent.status !== "running") {
    return null;
  }

  let currentPrice = 150;
  let networkTps = 2500;
  let marketCondition = "neutral";

  try {
    currentPrice = await getSolPrice();
    const networkStats = await getNetworkStats();
    networkTps = networkStats.tps;
    
    if (networkTps > 3000 && currentPrice > 120) {
      marketCondition = "bullish";
    } else if (networkTps < 1500 || currentPrice < 100) {
      marketCondition = "bearish";
    } else {
      marketCondition = "neutral";
    }
  } catch (error) {
    console.error("Error fetching Solana data for agent analysis:", error);
  }

  const context: AnalysisContext = {
    currentPrice,
    marketCondition,
    portfolioValue: agent.totalVolume,
    riskLevel: "medium",
    recentTransactions: agent.totalTransactions,
  };

  const analysis = await analyzeAgentDecision(agent, context);

  const decision: InsertAgentDecision = {
    agentId: agent.id,
    decision: analysis.action,
    confidence: analysis.confidence,
    reasoning: `${analysis.reasoning} | Market: ${marketCondition}, Price: $${currentPrice.toFixed(2)}, TPS: ${networkTps}`,
  };

  const savedDecision = await storage.createAgentDecision(decision);

  await storage.updateAgent(agentId, {
    lastActiveAt: new Date(),
  });

  return savedDecision;
}

export async function generateAgentRecommendation(agent: Agent): Promise<string> {
  const systemPrompt = `You are an AI financial advisor for autonomous blockchain agents. Provide a brief strategic recommendation for the agent based on its current state.`;

  const userPrompt = `Agent "${agent.name}" (${agent.type}):
- Goal: ${agent.goal}
- Current P/L: $${agent.profitLoss.toLocaleString()}
- Success Rate: ${(agent.successRate * 100).toFixed(1)}%
- Total Volume: $${agent.totalVolume.toLocaleString()}
- Transactions: ${agent.totalTransactions}

Provide a brief (2-3 sentences) strategic recommendation.`;

  try {
    const provider = (agent.aiProvider as AIProvider) || "openai";
    
    const content = await getAICompletion({
      provider,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: false,
      maxTokens: 256,
    });

    return content || "Continue monitoring market conditions.";
  } catch (error) {
    console.error("Error generating recommendation:", error);
    return "Monitor market conditions and maintain current positions.";
  }
}
