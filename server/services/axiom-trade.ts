import WebSocket from "ws";

const AXIOM_API_BASE = "https://axiom.trade/api";
const AXIOM_PULSE_API = "https://api5.axiom.trade";
const AXIOM_WS_URL = "wss://ws.axiom.trade";

export interface AxiomToken {
  mint: string;
  name: string;
  symbol: string;
  liquiditySol: number;
  liquidityUsd: number;
  volume24h: number;
  priceUsd: number;
  priceChange24h: number;
  holders: number;
  marketCap: number;
  createdAt: string;
}

export interface TrendingToken extends AxiomToken {
  rank: number;
  score: number;
}

export interface NewTokenLaunch {
  mint: string;
  name: string;
  symbol: string;
  liquiditySol: number;
  deployer: string;
  timestamp: number;
}

let authToken: string | null = process.env.AXIOM_ACCESS_TOKEN || null;
let refreshToken: string | null = process.env.AXIOM_REFRESH_TOKEN || null;
let wsConnection: WebSocket | null = null;
let tokenLaunchCallbacks: ((token: NewTokenLaunch) => void)[] = [];

if (authToken && refreshToken) {
  console.log("[Axiom] Credentials loaded from environment variables");
}

export function setAxiomCredentials(auth: string, refresh: string): void {
  authToken = auth;
  refreshToken = refresh;
  console.log("[Axiom] Credentials set");
}

export function hasAxiomCredentials(): boolean {
  return !!authToken && !!refreshToken;
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}): Promise<Response> {
  if (!authToken || !refreshToken) {
    throw new Error("Axiom auth tokens not set");
  }

  const headers = {
    "Content-Type": "application/json",
    "Cookie": `auth-access-token=${authToken}; auth-refresh-token=${refreshToken}`,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

export async function getTrendingTokens(timeframe: "1h" | "6h" | "24h" = "1h"): Promise<TrendingToken[]> {
  try {
    if (!authToken) {
      console.log("[Axiom] No auth token, returning mock trending data");
      return getMockTrendingTokens();
    }

    const timePeriodMap: Record<string, string> = { "1h": "1h", "6h": "6h", "24h": "24h" };
    const timePeriod = timePeriodMap[timeframe] || "1h";
    
    const response = await makeAuthenticatedRequest(`${AXIOM_API_BASE}/axiom-trending?timePeriod=${timePeriod}`);
    
    if (!response.ok) {
      console.warn("[Axiom] Failed to fetch trending tokens:", response.status);
      return getMockTrendingTokens();
    }

    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.map((token: any, index: number) => ({
        rank: index + 1,
        score: token.score || 0,
        mint: token.tokenMint || token.mint || "",
        name: token.name || token.tokenName || "Unknown",
        symbol: token.symbol || token.tokenTicker || "???",
        liquiditySol: token.liquiditySol || 0,
        liquidityUsd: token.liquidityUsd || 0,
        volume24h: token.volume24h || token.volumeSol || 0,
        priceUsd: token.priceUsd || 0,
        priceChange24h: token.priceChange24h || 0,
        holders: token.holders || 0,
        marketCap: token.marketCap || token.marketCapSol || 0,
        createdAt: token.createdAt || new Date().toISOString(),
      }));
    }
    
    return data.tokens || [];
  } catch (error) {
    console.error("[Axiom] Error fetching trending tokens:", error);
    return getMockTrendingTokens();
  }
}

export async function getTokenInfo(mint: string): Promise<AxiomToken | null> {
  try {
    if (!authToken) {
      return null;
    }

    const response = await makeAuthenticatedRequest(`${AXIOM_API_BASE}/pair-info?pairAddress=${mint}`);
    
    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return {
      mint: data.tokenMint || mint,
      name: data.name || data.tokenName || "Unknown",
      symbol: data.symbol || data.tokenTicker || "???",
      liquiditySol: data.liquiditySol || 0,
      liquidityUsd: data.liquidityUsd || 0,
      volume24h: data.volume24h || 0,
      priceUsd: data.priceUsd || 0,
      priceChange24h: data.priceChange24h || 0,
      holders: data.holders || 0,
      marketCap: data.marketCap || 0,
      createdAt: data.createdAt || new Date().toISOString(),
    };
  } catch (error) {
    console.error("[Axiom] Error fetching token info:", error);
    return null;
  }
}

export async function getNewLaunches(limit: number = 20): Promise<NewTokenLaunch[]> {
  try {
    if (!authToken) {
      console.log("[Axiom] No auth token, returning mock launches");
      return getMockNewLaunches();
    }

    const response = await makeAuthenticatedRequest(`${AXIOM_PULSE_API}/pulse`);
    
    if (!response.ok) {
      console.warn("[Axiom] Failed to fetch new launches:", response.status);
      return getMockNewLaunches();
    }

    const data = await response.json();
    
    if (Array.isArray(data)) {
      return data.slice(0, limit).map((token: any) => ({
        mint: token.tokenMint || token.mint || "",
        name: token.name || token.tokenName || "New Token",
        symbol: token.symbol || token.tokenTicker || "???",
        liquiditySol: token.liquiditySol || 0,
        deployer: token.deployer || token.creator || "",
        timestamp: token.createdAt ? new Date(token.createdAt).getTime() : Date.now(),
      }));
    }
    
    return data.tokens || getMockNewLaunches();
  } catch (error) {
    console.error("[Axiom] Error fetching new launches:", error);
    return getMockNewLaunches();
  }
}

export function subscribeToNewTokens(callback: (token: NewTokenLaunch) => void): void {
  tokenLaunchCallbacks.push(callback);
  
  if (!wsConnection && authToken) {
    connectWebSocket();
  }
}

export function unsubscribeFromNewTokens(callback: (token: NewTokenLaunch) => void): void {
  tokenLaunchCallbacks = tokenLaunchCallbacks.filter(cb => cb !== callback);
  
  if (tokenLaunchCallbacks.length === 0 && wsConnection) {
    wsConnection.close();
    wsConnection = null;
  }
}

function connectWebSocket(): void {
  if (!authToken) {
    console.log("[Axiom] Cannot connect WebSocket without auth token");
    return;
  }

  try {
    wsConnection = new WebSocket(AXIOM_WS_URL, {
      headers: {
        "Authorization": `Bearer ${authToken}`,
      },
    });

    wsConnection.on("open", () => {
      console.log("[Axiom] WebSocket connected");
      
      wsConnection?.send(JSON.stringify({
        type: "subscribe",
        channel: "new_tokens",
      }));
    });

    wsConnection.on("message", (data) => {
      try {
        const message = JSON.parse(data.toString());
        
        if (message.type === "new_token") {
          const token: NewTokenLaunch = {
            mint: message.data.mint,
            name: message.data.name,
            symbol: message.data.symbol,
            liquiditySol: message.data.liquiditySol,
            deployer: message.data.deployer,
            timestamp: message.data.timestamp,
          };
          
          tokenLaunchCallbacks.forEach(cb => cb(token));
        }
      } catch (error) {
        console.error("[Axiom] Error parsing WebSocket message:", error);
      }
    });

    wsConnection.on("close", () => {
      console.log("[Axiom] WebSocket disconnected");
      wsConnection = null;
      
      if (tokenLaunchCallbacks.length > 0) {
        setTimeout(connectWebSocket, 5000);
      }
    });

    wsConnection.on("error", (error) => {
      console.error("[Axiom] WebSocket error:", error);
    });
  } catch (error) {
    console.error("[Axiom] Failed to connect WebSocket:", error);
  }
}

function getMockTrendingTokens(): TrendingToken[] {
  return [
    {
      rank: 1,
      score: 95,
      mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
      name: "Bonk",
      symbol: "BONK",
      liquiditySol: 50000,
      liquidityUsd: 7500000,
      volume24h: 25000000,
      priceUsd: 0.00003,
      priceChange24h: 15.5,
      holders: 500000,
      marketCap: 2000000000,
      createdAt: "2022-12-25",
    },
    {
      rank: 2,
      score: 88,
      mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr",
      name: "Popcat",
      symbol: "POPCAT",
      liquiditySol: 30000,
      liquidityUsd: 4500000,
      volume24h: 15000000,
      priceUsd: 1.25,
      priceChange24h: 8.2,
      holders: 150000,
      marketCap: 1200000000,
      createdAt: "2024-01-15",
    },
    {
      rank: 3,
      score: 82,
      mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5",
      name: "Cat in a Dogs World",
      symbol: "MEW",
      liquiditySol: 25000,
      liquidityUsd: 3750000,
      volume24h: 10000000,
      priceUsd: 0.008,
      priceChange24h: -3.5,
      holders: 200000,
      marketCap: 800000000,
      createdAt: "2024-03-01",
    },
  ];
}

function getMockNewLaunches(): NewTokenLaunch[] {
  const now = Date.now();
  return [
    {
      mint: "NEW1" + Math.random().toString(36).substring(7),
      name: "New Meme Token",
      symbol: "NEWMEME",
      liquiditySol: 50,
      deployer: "DeP1oy3r" + Math.random().toString(36).substring(7),
      timestamp: now - 60000,
    },
    {
      mint: "NEW2" + Math.random().toString(36).substring(7),
      name: "Fresh Launch",
      symbol: "FRESH",
      liquiditySol: 100,
      deployer: "DeP1oy3r" + Math.random().toString(36).substring(7),
      timestamp: now - 120000,
    },
  ];
}

export interface MemeTokenAnalysis {
  token: AxiomToken | TrendingToken;
  signals: {
    liquidityScore: number;
    volumeScore: number;
    momentumScore: number;
    riskScore: number;
  };
  recommendation: "strong_buy" | "buy" | "hold" | "sell" | "avoid";
  confidence: number;
  reasoning: string;
}

export function analyzeToken(token: AxiomToken | TrendingToken): MemeTokenAnalysis {
  const liquidityScore = Math.min(token.liquiditySol / 1000, 100);
  const volumeScore = Math.min(token.volume24h / 1000000, 100);
  const momentumScore = token.priceChange24h > 0 
    ? Math.min(token.priceChange24h * 2, 100) 
    : Math.max(token.priceChange24h * 2, -100);
  const riskScore = 100 - Math.min(token.holders / 1000, 100);

  const overallScore = (liquidityScore * 0.3) + (volumeScore * 0.3) + (momentumScore * 0.25) + ((100 - riskScore) * 0.15);

  let recommendation: MemeTokenAnalysis["recommendation"];
  let reasoning: string;

  if (overallScore >= 80 && token.liquiditySol > 500 && momentumScore > 10) {
    recommendation = "strong_buy";
    reasoning = `High liquidity (${token.liquiditySol.toFixed(0)} SOL), strong volume, positive momentum`;
  } else if (overallScore >= 60 && token.liquiditySol > 100) {
    recommendation = "buy";
    reasoning = `Good fundamentals with ${token.liquiditySol.toFixed(0)} SOL liquidity and ${token.holders} holders`;
  } else if (overallScore >= 40) {
    recommendation = "hold";
    reasoning = `Mixed signals - monitor closely`;
  } else if (token.liquiditySol < 10 || riskScore > 80) {
    recommendation = "avoid";
    reasoning = `High risk: Low liquidity (${token.liquiditySol.toFixed(0)} SOL) or few holders`;
  } else {
    recommendation = "sell";
    reasoning = `Negative momentum and weak fundamentals`;
  }

  return {
    token,
    signals: {
      liquidityScore,
      volumeScore,
      momentumScore,
      riskScore,
    },
    recommendation,
    confidence: Math.min(overallScore / 100, 1),
    reasoning,
  };
}
