import OpenAI from "openai";
import { GoogleGenAI } from "@google/genai";
import type { AIProvider } from "@shared/schema";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

const gemini = new GoogleGenAI({
  apiKey: process.env.AI_INTEGRATIONS_GEMINI_API_KEY,
  httpOptions: {
    apiVersion: "",
    baseUrl: process.env.AI_INTEGRATIONS_GEMINI_BASE_URL,
  },
});

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AICompletionOptions {
  provider: AIProvider;
  messages: ChatMessage[];
  jsonMode?: boolean;
  maxTokens?: number;
}

export async function getAICompletion(options: AICompletionOptions): Promise<string> {
  const { provider, messages, jsonMode = false, maxTokens = 2048 } = options;

  switch (provider) {
    case "openai":
      return getOpenAICompletion(messages, jsonMode, maxTokens);
    case "gemini":
      return getGeminiCompletion(messages, jsonMode, maxTokens);
    case "anthropic":
      return getAnthropicCompletion(messages, jsonMode, maxTokens);
    default:
      return getOpenAICompletion(messages, jsonMode, maxTokens);
  }
}

async function getOpenAICompletion(
  messages: ChatMessage[],
  jsonMode: boolean,
  maxTokens: number
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
    response_format: jsonMode ? { type: "json_object" } : undefined,
    max_completion_tokens: maxTokens,
  });

  return response.choices[0]?.message?.content || "";
}

async function getGeminiCompletion(
  messages: ChatMessage[],
  jsonMode: boolean,
  maxTokens: number
): Promise<string> {
  const systemMessage = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  const contents = otherMessages.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));

  let systemInstruction = systemMessage?.content || "";
  if (jsonMode) {
    systemInstruction += "\n\nIMPORTANT: You must respond with valid JSON only. No other text.";
  }

  const response = await gemini.models.generateContent({
    model: "gemini-2.5-flash",
    contents,
    config: {
      systemInstruction,
      maxOutputTokens: maxTokens,
    },
  });

  return response.text || "";
}

async function getAnthropicCompletion(
  messages: ChatMessage[],
  jsonMode: boolean,
  maxTokens: number
): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  
  const anthropicClient = new Anthropic({
    apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  });

  const systemMessage = messages.find((m) => m.role === "system");
  const otherMessages = messages.filter((m) => m.role !== "system");

  let systemContent = systemMessage?.content || "";
  if (jsonMode) {
    systemContent += "\n\nIMPORTANT: You must respond with valid JSON only. No markdown, no code blocks, just raw JSON.";
  }

  const response = await anthropicClient.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: maxTokens,
    system: systemContent || undefined,
    messages: otherMessages.map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  });

  const content = response.content[0];
  return content.type === "text" ? content.text : "";
}

export interface AgentGenerationResult {
  name: string;
  description: string;
  goal: string;
  strategy: string;
  type: "trading" | "staking" | "lending" | "hedging" | "custom";
}

export async function generateAgentConfig(
  prompt: string,
  provider: AIProvider = "openai"
): Promise<AgentGenerationResult> {
  const systemPrompt = `You are an AI agent configuration generator for a Solana blockchain trading platform called Pandora OS.

Based on the user's prompt, generate a complete agent configuration with:
- name: A creative, catchy name for the agent (max 30 chars)
- description: A brief description of what the agent does (max 200 chars)
- goal: The agent's primary objective (max 300 chars)
- strategy: The trading/operating strategy the agent will use (max 500 chars)
- type: One of "trading", "staking", "lending", "hedging", or "custom"

The agent will operate autonomously on Solana mainnet, analyzing market conditions and executing trades.

Respond with a JSON object containing these fields.`;

  const userPrompt = `Create an AI agent based on this description: "${prompt}"`;

  try {
    let response = await getAICompletion({
      provider,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      jsonMode: true,
      maxTokens: 1024,
    });

    // Strip markdown code blocks if present
    response = response.trim();
    if (response.startsWith("```json")) {
      response = response.slice(7);
    } else if (response.startsWith("```")) {
      response = response.slice(3);
    }
    if (response.endsWith("```")) {
      response = response.slice(0, -3);
    }
    response = response.trim();

    const parsed = JSON.parse(response);
    
    return {
      name: (parsed.name || "Unnamed Agent").slice(0, 30),
      description: (parsed.description || "AI-powered autonomous agent").slice(0, 200),
      goal: (parsed.goal || "Maximize returns while managing risk").slice(0, 300),
      strategy: (parsed.strategy || "Analyze market conditions and execute optimal trades").slice(0, 500),
      type: ["trading", "staking", "lending", "hedging", "custom"].includes(parsed.type)
        ? parsed.type
        : "trading",
    };
  } catch (error) {
    console.error("[MultiAI] Error generating agent config:", error);
    return {
      name: "AI Agent",
      description: "AI-powered autonomous trading agent",
      goal: prompt.slice(0, 300) || "Maximize returns on Solana",
      strategy: "Analyze market conditions and execute trades based on AI analysis",
      type: "trading",
    };
  }
}

export function getProviderDisplayName(provider: AIProvider): string {
  switch (provider) {
    case "openai":
      return "GPT-4o";
    case "gemini":
      return "Gemini 2.5";
    case "anthropic":
      return "Claude Sonnet";
    default:
      return "AI";
  }
}
