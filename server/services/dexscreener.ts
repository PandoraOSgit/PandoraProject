const DEXSCREENER_API_BASE = "https://api.dexscreener.com";

export interface DexScreenerToken {
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
  dexId?: string;
  pairAddress?: string;
  logoUrl?: string;
}

export interface TrendingToken extends DexScreenerToken {
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
  pairAddress?: string;
  logoUrl?: string;
}

export interface MemeTokenAnalysis {
  token: DexScreenerToken | TrendingToken;
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

async function fetchDexScreener(endpoint: string): Promise<any> {
  const response = await fetch(`${DEXSCREENER_API_BASE}${endpoint}`, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "PandoraOS/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`DexScreener API error: ${response.status}`);
  }

  return response.json();
}

export async function getTrendingTokens(timeframe: "1h" | "6h" | "24h" = "1h"): Promise<TrendingToken[]> {
  try {
    const [boostsData, searchData] = await Promise.all([
      fetchDexScreener("/token-boosts/top/v1").catch(() => []),
      fetchDexScreener("/latest/dex/search?q=SOL").catch(() => ({ pairs: [] })),
    ]);

    const solPairs = (searchData.pairs || [])
      .filter((pair: any) => pair.chainId === "solana")
      .slice(0, 20);

    const tokens: TrendingToken[] = [];
    const seenMints = new Set<string>();

    for (const boost of (boostsData || []).slice(0, 10)) {
      if (boost.chainId !== "solana") continue;
      const mint = boost.tokenAddress;
      if (seenMints.has(mint)) continue;
      seenMints.add(mint);

      try {
        const tokenData = await getTokenInfo(mint);
        if (tokenData) {
          tokens.push({
            ...tokenData,
            rank: tokens.length + 1,
            score: Math.min(100, 80 + (boost.amount || 0) / 100),
          });
        }
      } catch (e) {
        console.warn("[DexScreener] Failed to get boost token info:", mint);
      }
    }

    for (const pair of solPairs) {
      const mint = pair.baseToken?.address;
      if (!mint || seenMints.has(mint)) continue;
      if (pair.quoteToken?.symbol !== "SOL" && pair.quoteToken?.symbol !== "WSOL") continue;
      seenMints.add(mint);

      const liquidityUsd = pair.liquidity?.usd || 0;
      const volume24h = pair.volume?.h24 || 0;
      const priceChange24h = pair.priceChange?.h24 || 0;

      const score = calculateTrendingScore(liquidityUsd, volume24h, priceChange24h);

      tokens.push({
        rank: tokens.length + 1,
        score,
        mint,
        name: pair.baseToken?.name || "Unknown",
        symbol: pair.baseToken?.symbol || "???",
        liquiditySol: liquidityUsd / 150,
        liquidityUsd,
        volume24h,
        priceUsd: parseFloat(pair.priceUsd || "0"),
        priceChange24h,
        holders: 0,
        marketCap: pair.fdv || 0,
        createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString(),
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        logoUrl: pair.info?.imageUrl || undefined,
      });
    }

    tokens.sort((a, b) => b.score - a.score);
    tokens.forEach((t, i) => t.rank = i + 1);

    console.log(`[DexScreener] Fetched ${tokens.length} trending tokens (live data)`);
    return tokens.slice(0, 20);
  } catch (error) {
    console.error("[DexScreener] Error fetching trending tokens:", error);
    return [];
  }
}

export async function getTokenInfo(mint: string): Promise<DexScreenerToken | null> {
  try {
    const data = await fetchDexScreener(`/tokens/v1/solana/${mint}`);
    
    if (!data || !Array.isArray(data) || data.length === 0) {
      return null;
    }

    const pairs = data;
    const bestPair = pairs.reduce((best: any, pair: any) => {
      const liquidity = pair.liquidity?.usd || 0;
      const bestLiquidity = best?.liquidity?.usd || 0;
      return liquidity > bestLiquidity ? pair : best;
    }, pairs[0]);

    if (!bestPair) return null;

    return {
      mint,
      name: bestPair.baseToken?.name || "Unknown",
      symbol: bestPair.baseToken?.symbol || "???",
      liquiditySol: (bestPair.liquidity?.usd || 0) / 150,
      liquidityUsd: bestPair.liquidity?.usd || 0,
      volume24h: bestPair.volume?.h24 || 0,
      priceUsd: parseFloat(bestPair.priceUsd || "0"),
      priceChange24h: bestPair.priceChange?.h24 || 0,
      holders: 0,
      marketCap: bestPair.fdv || 0,
      createdAt: bestPair.pairCreatedAt ? new Date(bestPair.pairCreatedAt).toISOString() : new Date().toISOString(),
      dexId: bestPair.dexId,
      logoUrl: bestPair.info?.imageUrl || undefined,
      pairAddress: bestPair.pairAddress,
    };
  } catch (error) {
    console.error("[DexScreener] Error fetching token info:", error);
    return null;
  }
}

export async function getNewLaunches(limit: number = 20): Promise<NewTokenLaunch[]> {
  try {
    const data = await fetchDexScreener("/token-profiles/latest/v1");
    
    const solanaPairs = (data || [])
      .filter((profile: any) => profile.chainId === "solana")
      .slice(0, limit);

    const tokenInfoPromises = solanaPairs.map(async (profile: any) => {
      const tokenInfo = await getTokenInfo(profile.tokenAddress).catch(() => null);
      return {
        mint: profile.tokenAddress,
        name: tokenInfo?.name || profile.description?.split(" ")[0] || "New Token",
        symbol: tokenInfo?.symbol || "???",
        liquiditySol: tokenInfo?.liquiditySol || 0,
        deployer: "",
        timestamp: tokenInfo?.createdAt ? new Date(tokenInfo.createdAt).getTime() : Date.now(),
        pairAddress: tokenInfo?.pairAddress,
        logoUrl: tokenInfo?.logoUrl || profile.icon || undefined,
      };
    });

    const launches = await Promise.all(tokenInfoPromises);

    console.log(`[DexScreener] Fetched ${launches.length} new launches (live data)`);
    return launches;
  } catch (error) {
    console.error("[DexScreener] Error fetching new launches:", error);
    return [];
  }
}

export async function searchTokens(query: string): Promise<DexScreenerToken[]> {
  try {
    const data = await fetchDexScreener(`/latest/dex/search?q=${encodeURIComponent(query)}`);
    
    const solanaPairs = (data.pairs || [])
      .filter((pair: any) => pair.chainId === "solana")
      .slice(0, 20);

    const tokens: DexScreenerToken[] = [];
    const seenMints = new Set<string>();

    for (const pair of solanaPairs) {
      const mint = pair.baseToken?.address;
      if (!mint || seenMints.has(mint)) continue;
      seenMints.add(mint);

      tokens.push({
        mint,
        name: pair.baseToken?.name || "Unknown",
        symbol: pair.baseToken?.symbol || "???",
        liquiditySol: (pair.liquidity?.usd || 0) / 150,
        liquidityUsd: pair.liquidity?.usd || 0,
        volume24h: pair.volume?.h24 || 0,
        priceUsd: parseFloat(pair.priceUsd || "0"),
        priceChange24h: pair.priceChange?.h24 || 0,
        holders: 0,
        marketCap: pair.fdv || 0,
        createdAt: pair.pairCreatedAt ? new Date(pair.pairCreatedAt).toISOString() : new Date().toISOString(),
        dexId: pair.dexId,
        logoUrl: pair.info?.imageUrl || undefined,
        pairAddress: pair.pairAddress,
      });
    }

    return tokens;
  } catch (error) {
    console.error("[DexScreener] Error searching tokens:", error);
    return [];
  }
}

function calculateTrendingScore(liquidityUsd: number, volume24h: number, priceChange24h: number): number {
  const liquidityScore = Math.min(liquidityUsd / 100000, 30);
  const volumeScore = Math.min(volume24h / 500000, 40);
  const momentumScore = priceChange24h > 0 
    ? Math.min(priceChange24h / 5, 30) 
    : Math.max(priceChange24h / 10, -10);

  return Math.max(0, Math.min(100, liquidityScore + volumeScore + momentumScore));
}

export function analyzeToken(token: DexScreenerToken | TrendingToken): MemeTokenAnalysis {
  const liquidityScore = Math.min(token.liquiditySol / 1000, 100);
  const volumeScore = Math.min(token.volume24h / 1000000, 100);
  const momentumScore = token.priceChange24h > 0 
    ? Math.min(token.priceChange24h * 2, 100) 
    : Math.max(token.priceChange24h * 2, -100);
  const riskScore = token.liquiditySol < 50 ? 80 : token.liquiditySol < 200 ? 50 : 20;

  const overallScore = (liquidityScore * 0.3) + (volumeScore * 0.3) + (momentumScore * 0.25) + ((100 - riskScore) * 0.15);

  let recommendation: MemeTokenAnalysis["recommendation"];
  let reasoning: string;

  if (overallScore >= 80 && token.liquiditySol > 500 && momentumScore > 10) {
    recommendation = "strong_buy";
    reasoning = `High liquidity (${token.liquiditySol.toFixed(0)} SOL), strong volume, positive momentum`;
  } else if (overallScore >= 60 && token.liquiditySol > 100) {
    recommendation = "buy";
    reasoning = `Good fundamentals with ${token.liquiditySol.toFixed(0)} SOL liquidity`;
  } else if (overallScore >= 40) {
    recommendation = "hold";
    reasoning = `Mixed signals - monitor closely`;
  } else if (token.liquiditySol < 10 || riskScore > 80) {
    recommendation = "avoid";
    reasoning = `High risk: Low liquidity (${token.liquiditySol.toFixed(0)} SOL)`;
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

export function isDexScreenerAvailable(): boolean {
  return true;
}
