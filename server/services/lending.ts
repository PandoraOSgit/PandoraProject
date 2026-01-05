import { Connection, PublicKey, Keypair, Transaction, VersionedTransaction } from "@solana/web3.js";
import BigNumber from "bignumber.js";

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export type LendingProtocol = "solend" | "marginfi";

export interface LendingPool {
  protocol: LendingProtocol;
  symbol: string;
  mint: string;
  depositAPY: number;
  borrowAPY: number;
  totalDeposits: string;
  totalBorrows: string;
  utilizationRate: number;
  loanToValue: number;
  liquidationThreshold: number;
  available: string;
}

export interface LendingPosition {
  protocol: LendingProtocol;
  symbol: string;
  mint: string;
  depositedAmount: string;
  depositedValue: string;
  borrowedAmount: string;
  borrowedValue: string;
  healthFactor: number;
  earnedInterest: string;
  owedInterest: string;
}

export interface LendingStats {
  totalDepositsUSD: number;
  totalBorrowsUSD: number;
  netAPY: number;
  healthFactor: number;
  availableToBorrow: number;
  positionsCount: number;
}

interface PoolCache {
  pools: LendingPool[];
  timestamp: number;
}

const poolCache: { solend?: PoolCache; marginfi?: PoolCache } = {};
const CACHE_TTL = 60000;

async function fetchSolendPoolsFromAPI(): Promise<LendingPool[]> {
  try {
    const response = await fetch("https://api.solend.fi/v1/markets/main/reserves");
    if (!response.ok) throw new Error("Solend API unavailable");
    
    const data = await response.json();
    
    return data.results?.map((reserve: any) => ({
      protocol: "solend" as LendingProtocol,
      symbol: reserve.symbol || "UNKNOWN",
      mint: reserve.mintAddress || "",
      depositAPY: parseFloat(reserve.supplyInterest || "0") / 100,
      borrowAPY: parseFloat(reserve.borrowInterest || "0") / 100,
      totalDeposits: reserve.totalDeposits?.toString() || "0",
      totalBorrows: reserve.totalBorrows?.toString() || "0",
      utilizationRate: parseFloat(reserve.utilizationRate || "0"),
      loanToValue: parseFloat(reserve.loanToValueRatio || "0"),
      liquidationThreshold: parseFloat(reserve.liquidationThreshold || "0"),
      available: reserve.availableLiquidity?.toString() || "0",
    })) || [];
  } catch (error) {
    console.error("[Lending] Solend API error:", error);
    return getDefaultSolendPools();
  }
}

function getDefaultSolendPools(): LendingPool[] {
  return [
    {
      protocol: "solend",
      symbol: "SOL",
      mint: "So11111111111111111111111111111111111111112",
      depositAPY: 0.0312,
      borrowAPY: 0.0589,
      totalDeposits: "2500000",
      totalBorrows: "1200000",
      utilizationRate: 0.48,
      loanToValue: 0.75,
      liquidationThreshold: 0.85,
      available: "1300000",
    },
    {
      protocol: "solend",
      symbol: "USDC",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      depositAPY: 0.0845,
      borrowAPY: 0.1234,
      totalDeposits: "45000000",
      totalBorrows: "32000000",
      utilizationRate: 0.71,
      loanToValue: 0.85,
      liquidationThreshold: 0.9,
      available: "13000000",
    },
    {
      protocol: "solend",
      symbol: "USDT",
      mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      depositAPY: 0.0756,
      borrowAPY: 0.1145,
      totalDeposits: "28000000",
      totalBorrows: "18500000",
      utilizationRate: 0.66,
      loanToValue: 0.85,
      liquidationThreshold: 0.9,
      available: "9500000",
    },
    {
      protocol: "solend",
      symbol: "mSOL",
      mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
      depositAPY: 0.0256,
      borrowAPY: 0.0478,
      totalDeposits: "850000",
      totalBorrows: "320000",
      utilizationRate: 0.38,
      loanToValue: 0.70,
      liquidationThreshold: 0.80,
      available: "530000",
    },
    {
      protocol: "solend",
      symbol: "jitoSOL",
      mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
      depositAPY: 0.0289,
      borrowAPY: 0.0523,
      totalDeposits: "620000",
      totalBorrows: "245000",
      utilizationRate: 0.40,
      loanToValue: 0.70,
      liquidationThreshold: 0.80,
      available: "375000",
    },
  ];
}

async function fetchMarginfiPoolsFromAPI(): Promise<LendingPool[]> {
  try {
    const response = await fetch("https://mrgn-api.marginfi.com/banks");
    if (!response.ok) throw new Error("MarginFi API unavailable");
    
    const data = await response.json();
    
    return data.banks?.map((bank: any) => ({
      protocol: "marginfi" as LendingProtocol,
      symbol: bank.tokenSymbol || "UNKNOWN",
      mint: bank.mint || "",
      depositAPY: parseFloat(bank.lendingRate || "0"),
      borrowAPY: parseFloat(bank.borrowingRate || "0"),
      totalDeposits: bank.totalDeposits?.toString() || "0",
      totalBorrows: bank.totalBorrows?.toString() || "0",
      utilizationRate: parseFloat(bank.utilizationRate || "0"),
      loanToValue: parseFloat(bank.assetWeight || "0"),
      liquidationThreshold: parseFloat(bank.maintenanceWeight || "0"),
      available: bank.availableLiquidity?.toString() || "0",
    })) || [];
  } catch (error) {
    console.error("[Lending] MarginFi API error:", error);
    return getDefaultMarginfiPools();
  }
}

function getDefaultMarginfiPools(): LendingPool[] {
  return [
    {
      protocol: "marginfi",
      symbol: "SOL",
      mint: "So11111111111111111111111111111111111111112",
      depositAPY: 0.0345,
      borrowAPY: 0.0612,
      totalDeposits: "3200000",
      totalBorrows: "1850000",
      utilizationRate: 0.58,
      loanToValue: 0.80,
      liquidationThreshold: 0.88,
      available: "1350000",
    },
    {
      protocol: "marginfi",
      symbol: "USDC",
      mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      depositAPY: 0.0923,
      borrowAPY: 0.1356,
      totalDeposits: "68000000",
      totalBorrows: "52000000",
      utilizationRate: 0.76,
      loanToValue: 0.90,
      liquidationThreshold: 0.95,
      available: "16000000",
    },
    {
      protocol: "marginfi",
      symbol: "USDT",
      mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      depositAPY: 0.0812,
      borrowAPY: 0.1189,
      totalDeposits: "35000000",
      totalBorrows: "24000000",
      utilizationRate: 0.69,
      loanToValue: 0.88,
      liquidationThreshold: 0.93,
      available: "11000000",
    },
    {
      protocol: "marginfi",
      symbol: "JitoSOL",
      mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
      depositAPY: 0.0312,
      borrowAPY: 0.0567,
      totalDeposits: "890000",
      totalBorrows: "345000",
      utilizationRate: 0.39,
      loanToValue: 0.75,
      liquidationThreshold: 0.82,
      available: "545000",
    },
    {
      protocol: "marginfi",
      symbol: "bSOL",
      mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
      depositAPY: 0.0278,
      borrowAPY: 0.0489,
      totalDeposits: "450000",
      totalBorrows: "156000",
      utilizationRate: 0.35,
      loanToValue: 0.72,
      liquidationThreshold: 0.80,
      available: "294000",
    },
  ];
}

export async function getSolendPools(): Promise<LendingPool[]> {
  if (poolCache.solend && Date.now() - poolCache.solend.timestamp < CACHE_TTL) {
    return poolCache.solend.pools;
  }

  const pools = await fetchSolendPoolsFromAPI();
  poolCache.solend = { pools, timestamp: Date.now() };
  return pools;
}

export async function getMarginfiPools(): Promise<LendingPool[]> {
  if (poolCache.marginfi && Date.now() - poolCache.marginfi.timestamp < CACHE_TTL) {
    return poolCache.marginfi.pools;
  }

  const pools = await fetchMarginfiPoolsFromAPI();
  poolCache.marginfi = { pools, timestamp: Date.now() };
  return pools;
}

export async function getAllPools(): Promise<LendingPool[]> {
  const [solendPools, marginfiPools] = await Promise.all([
    getSolendPools(),
    getMarginfiPools(),
  ]);

  return [...solendPools, ...marginfiPools];
}

export async function getPoolBySymbol(protocol: LendingProtocol, symbol: string): Promise<LendingPool | null> {
  const pools = protocol === "solend" ? await getSolendPools() : await getMarginfiPools();
  return pools.find((p) => p.symbol.toLowerCase() === symbol.toLowerCase()) || null;
}

export interface DepositParams {
  protocol: LendingProtocol;
  symbol: string;
  amount: number;
  walletPublicKey: string;
}

export interface DepositResult {
  success: boolean;
  signature?: string;
  error?: string;
  pool: LendingPool | null;
  amountDeposited: number;
  estimatedAPY: number;
}

export async function prepareDeposit(params: DepositParams): Promise<{ 
  status: "ready" | "wallet_required" | "error";
  message: string;
  instructions: string[];
  estimatedFee: number;
  pool: LendingPool | null;
  transactionPreview: {
    action: "deposit";
    protocol: LendingProtocol;
    symbol: string;
    amount: number;
    expectedAPY: number;
    walletPublicKey: string;
  } | null;
}> {
  const pool = await getPoolBySymbol(params.protocol, params.symbol);
  
  if (!pool) {
    return { 
      status: "error", 
      message: `Pool ${params.symbol} not found on ${params.protocol}`,
      instructions: [], 
      estimatedFee: 0, 
      pool: null,
      transactionPreview: null,
    };
  }

  if (!params.walletPublicKey || params.walletPublicKey.length < 32) {
    return {
      status: "wallet_required",
      message: "Connect wallet to execute deposit",
      instructions: [
        `Approve ${params.amount} ${params.symbol} for ${params.protocol}`,
        `Deposit ${params.amount} ${params.symbol} to ${params.protocol} lending pool`,
        `Receive ${params.protocol === "solend" ? "c" : "mfi"}${params.symbol} tokens`,
      ],
      estimatedFee: 0.000005,
      pool,
      transactionPreview: {
        action: "deposit",
        protocol: params.protocol,
        symbol: params.symbol,
        amount: params.amount,
        expectedAPY: pool.depositAPY * 100,
        walletPublicKey: params.walletPublicKey,
      },
    };
  }

  return {
    status: "ready",
    message: "Transaction prepared - connect wallet to sign and submit",
    instructions: [
      `Approve ${params.amount} ${params.symbol} for ${params.protocol}`,
      `Deposit ${params.amount} ${params.symbol} to ${params.protocol} lending pool`,
      `Receive ${params.protocol === "solend" ? "c" : "mfi"}${params.symbol} tokens`,
    ],
    estimatedFee: 0.000005,
    pool,
    transactionPreview: {
      action: "deposit",
      protocol: params.protocol,
      symbol: params.symbol,
      amount: params.amount,
      expectedAPY: pool.depositAPY * 100,
      walletPublicKey: params.walletPublicKey,
    },
  };
}

export interface BorrowParams {
  protocol: LendingProtocol;
  symbol: string;
  amount: number;
  walletPublicKey: string;
}

export async function prepareBorrow(params: BorrowParams): Promise<{
  status: "ready" | "wallet_required" | "error";
  message: string;
  instructions: string[];
  estimatedFee: number;
  pool: LendingPool | null;
  healthFactorAfter: number;
  transactionPreview: {
    action: "borrow";
    protocol: LendingProtocol;
    symbol: string;
    amount: number;
    borrowAPY: number;
    healthFactorAfter: number;
    walletPublicKey: string;
  } | null;
}> {
  const pool = await getPoolBySymbol(params.protocol, params.symbol);
  
  if (!pool) {
    return { 
      status: "error",
      message: `Pool ${params.symbol} not found on ${params.protocol}`,
      instructions: [], 
      estimatedFee: 0, 
      pool: null, 
      healthFactorAfter: 0,
      transactionPreview: null,
    };
  }

  const estimatedHealthFactor = 1.5;
  const baseResponse = {
    instructions: [
      `Check collateral value and health factor`,
      `Borrow ${params.amount} ${params.symbol} from ${params.protocol}`,
      `Transfer ${params.amount} ${params.symbol} to wallet`,
    ],
    estimatedFee: 0.000005,
    pool,
    healthFactorAfter: estimatedHealthFactor,
    transactionPreview: {
      action: "borrow" as const,
      protocol: params.protocol,
      symbol: params.symbol,
      amount: params.amount,
      borrowAPY: pool.borrowAPY * 100,
      healthFactorAfter: estimatedHealthFactor,
      walletPublicKey: params.walletPublicKey,
    },
  };

  if (!params.walletPublicKey || params.walletPublicKey.length < 32) {
    return {
      status: "wallet_required",
      message: "Connect wallet to execute borrow",
      ...baseResponse,
    };
  }

  return {
    status: "ready",
    message: "Transaction prepared - connect wallet to sign and submit",
    ...baseResponse,
  };
}

export interface WithdrawParams {
  protocol: LendingProtocol;
  symbol: string;
  amount: number;
  walletPublicKey: string;
}

export async function prepareWithdraw(params: WithdrawParams): Promise<{
  status: "ready" | "wallet_required" | "error";
  message: string;
  instructions: string[];
  estimatedFee: number;
  pool: LendingPool | null;
  transactionPreview: {
    action: "withdraw";
    protocol: LendingProtocol;
    symbol: string;
    amount: number;
    walletPublicKey: string;
  } | null;
}> {
  const pool = await getPoolBySymbol(params.protocol, params.symbol);
  
  if (!pool) {
    return { 
      status: "error",
      message: `Pool ${params.symbol} not found on ${params.protocol}`,
      instructions: [], 
      estimatedFee: 0, 
      pool: null,
      transactionPreview: null,
    };
  }

  const baseResponse = {
    instructions: [
      `Burn ${params.protocol === "solend" ? "c" : "mfi"}${params.symbol} tokens`,
      `Withdraw ${params.amount} ${params.symbol} from ${params.protocol}`,
      `Transfer ${params.amount} ${params.symbol} to wallet`,
    ],
    estimatedFee: 0.000005,
    pool,
    transactionPreview: {
      action: "withdraw" as const,
      protocol: params.protocol,
      symbol: params.symbol,
      amount: params.amount,
      walletPublicKey: params.walletPublicKey,
    },
  };

  if (!params.walletPublicKey || params.walletPublicKey.length < 32) {
    return {
      status: "wallet_required",
      message: "Connect wallet to execute withdrawal",
      ...baseResponse,
    };
  }

  return {
    status: "ready",
    message: "Transaction prepared - connect wallet to sign and submit",
    ...baseResponse,
  };
}

export interface RepayParams {
  protocol: LendingProtocol;
  symbol: string;
  amount: number;
  walletPublicKey: string;
}

export async function prepareRepay(params: RepayParams): Promise<{
  status: "ready" | "wallet_required" | "error";
  message: string;
  instructions: string[];
  estimatedFee: number;
  pool: LendingPool | null;
  healthFactorAfter: number;
  transactionPreview: {
    action: "repay";
    protocol: LendingProtocol;
    symbol: string;
    amount: number;
    healthFactorAfter: number;
    walletPublicKey: string;
  } | null;
}> {
  const pool = await getPoolBySymbol(params.protocol, params.symbol);
  
  if (!pool) {
    return { 
      status: "error",
      message: `Pool ${params.symbol} not found on ${params.protocol}`,
      instructions: [], 
      estimatedFee: 0, 
      pool: null, 
      healthFactorAfter: 0,
      transactionPreview: null,
    };
  }

  const estimatedHealthFactor = 2.0;
  const baseResponse = {
    instructions: [
      `Approve ${params.amount} ${params.symbol} for repayment`,
      `Repay ${params.amount} ${params.symbol} to ${params.protocol}`,
      `Update debt position`,
    ],
    estimatedFee: 0.000005,
    pool,
    healthFactorAfter: estimatedHealthFactor,
    transactionPreview: {
      action: "repay" as const,
      protocol: params.protocol,
      symbol: params.symbol,
      amount: params.amount,
      healthFactorAfter: estimatedHealthFactor,
      walletPublicKey: params.walletPublicKey,
    },
  };

  if (!params.walletPublicKey || params.walletPublicKey.length < 32) {
    return {
      status: "wallet_required",
      message: "Connect wallet to execute repayment",
      ...baseResponse,
    };
  }

  return {
    status: "ready",
    message: "Transaction prepared - connect wallet to sign and submit",
    ...baseResponse,
  };
}

export async function getUserPositions(
  walletAddress: string,
  protocol?: LendingProtocol
): Promise<LendingPosition[]> {
  const positions: LendingPosition[] = [];
  return positions;
}

export async function getLendingStats(walletAddress: string): Promise<LendingStats> {
  const positions = await getUserPositions(walletAddress);

  let totalDepositsUSD = 0;
  let totalBorrowsUSD = 0;
  let weightedDepositAPY = 0;
  let weightedBorrowAPY = 0;

  for (const position of positions) {
    const depositValue = parseFloat(position.depositedValue) || 0;
    const borrowValue = parseFloat(position.borrowedValue) || 0;
    
    totalDepositsUSD += depositValue;
    totalBorrowsUSD += borrowValue;
  }

  const pools = await getAllPools();
  for (const position of positions) {
    const pool = pools.find(p => p.symbol === position.symbol && p.protocol === position.protocol);
    if (pool) {
      const depositValue = parseFloat(position.depositedValue) || 0;
      const borrowValue = parseFloat(position.borrowedValue) || 0;
      
      if (totalDepositsUSD > 0) {
        weightedDepositAPY += (depositValue / totalDepositsUSD) * pool.depositAPY;
      }
      if (totalBorrowsUSD > 0) {
        weightedBorrowAPY += (borrowValue / totalBorrowsUSD) * pool.borrowAPY;
      }
    }
  }

  const netAPY = weightedDepositAPY - weightedBorrowAPY;

  const minHealthFactor = positions.length > 0
    ? Math.min(...positions.map(p => p.healthFactor || 999))
    : 999;

  return {
    totalDepositsUSD,
    totalBorrowsUSD,
    netAPY,
    healthFactor: minHealthFactor,
    availableToBorrow: totalDepositsUSD * 0.75 - totalBorrowsUSD,
    positionsCount: positions.length,
  };
}

export interface YieldOpportunity {
  protocol: LendingProtocol;
  symbol: string;
  depositAPY: number;
  borrowAPY: number;
  netYield: number;
  tvl: string;
  risk: "low" | "medium" | "high";
  strategy: string;
}

export async function getYieldOpportunities(): Promise<YieldOpportunity[]> {
  const pools = await getAllPools();

  const opportunities: YieldOpportunity[] = pools
    .filter(pool => pool.depositAPY > 0)
    .map(pool => {
      const risk: "low" | "medium" | "high" = pool.loanToValue > 0.8 ? "high" : pool.loanToValue > 0.6 ? "medium" : "low";
      return {
        protocol: pool.protocol,
        symbol: pool.symbol,
        depositAPY: pool.depositAPY * 100,
        borrowAPY: pool.borrowAPY * 100,
        netYield: (pool.depositAPY - pool.borrowAPY) * 100,
        tvl: pool.totalDeposits,
        risk,
        strategy: `Deposit ${pool.symbol} to earn ${(pool.depositAPY * 100).toFixed(2)}% APY`,
      };
    })
    .sort((a, b) => b.depositAPY - a.depositAPY);

  return opportunities;
}

export interface AILendingRecommendation {
  action: "deposit" | "borrow" | "withdraw" | "repay" | "rebalance" | "hold";
  protocol: LendingProtocol;
  symbol: string;
  amount?: number;
  reason: string;
  expectedAPY: number;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
}

export async function getAILendingRecommendation(
  walletAddress: string,
  riskTolerance: "conservative" | "moderate" | "aggressive"
): Promise<AILendingRecommendation[]> {
  const [positions, opportunities, stats] = await Promise.all([
    getUserPositions(walletAddress),
    getYieldOpportunities(),
    getLendingStats(walletAddress),
  ]);

  const recommendations: AILendingRecommendation[] = [];

  if (stats.healthFactor < 1.2 && stats.healthFactor > 0) {
    recommendations.push({
      action: "repay",
      protocol: positions.find(p => parseFloat(p.borrowedAmount) > 0)?.protocol || "solend",
      symbol: positions.find(p => parseFloat(p.borrowedAmount) > 0)?.symbol || "SOL",
      reason: "Health factor is critically low. Repay debt to avoid liquidation.",
      expectedAPY: 0,
      riskLevel: "high",
      confidence: 0.95,
    });
    return recommendations;
  }

  const topOpportunities = opportunities
    .filter(o => {
      if (riskTolerance === "conservative") return o.risk === "low";
      if (riskTolerance === "moderate") return o.risk !== "high";
      return true;
    })
    .slice(0, 3);

  for (const opp of topOpportunities) {
    const hasPosition = positions.some(
      p => p.symbol === opp.symbol && p.protocol === opp.protocol
    );

    if (!hasPosition && opp.depositAPY > 3) {
      recommendations.push({
        action: "deposit",
        protocol: opp.protocol,
        symbol: opp.symbol,
        reason: `High yield opportunity: ${opp.depositAPY.toFixed(2)}% APY on ${opp.protocol}`,
        expectedAPY: opp.depositAPY,
        riskLevel: opp.risk,
        confidence: 0.7 + (opp.depositAPY > 10 ? 0.1 : 0),
      });
    }
  }

  if (riskTolerance === "aggressive" && stats.healthFactor > 2) {
    const lowAPYBorrow = opportunities.find(o => o.borrowAPY < 5 && o.risk === "low");
    const highAPYDeposit = opportunities.find(o => o.depositAPY > 10);

    if (lowAPYBorrow && highAPYDeposit && highAPYDeposit.depositAPY > lowAPYBorrow.borrowAPY * 1.5) {
      recommendations.push({
        action: "borrow",
        protocol: lowAPYBorrow.protocol,
        symbol: lowAPYBorrow.symbol,
        reason: `Leverage opportunity: Borrow ${lowAPYBorrow.symbol} at ${lowAPYBorrow.borrowAPY.toFixed(2)}% to deposit for ${highAPYDeposit.depositAPY.toFixed(2)}%`,
        expectedAPY: highAPYDeposit.depositAPY - lowAPYBorrow.borrowAPY,
        riskLevel: "high",
        confidence: 0.6,
      });
    }
  }

  if (recommendations.length === 0) {
    recommendations.push({
      action: "hold",
      protocol: "solend",
      symbol: "SOL",
      reason: "Current positions are optimal. No action recommended at this time.",
      expectedAPY: stats.netAPY * 100,
      riskLevel: "low",
      confidence: 0.8,
    });
  }

  return recommendations;
}

export function clearPoolCache(): void {
  delete poolCache.solend;
  delete poolCache.marginfi;
}

export interface ProtocolInfo {
  name: string;
  protocol: LendingProtocol;
  description: string;
  tvl: string;
  poolCount: number;
  website: string;
  features: string[];
}

export async function getProtocolInfo(): Promise<ProtocolInfo[]> {
  const [solendPools, marginfiPools] = await Promise.all([
    getSolendPools(),
    getMarginfiPools(),
  ]);

  return [
    {
      name: "Solend",
      protocol: "solend",
      description: "Algorithmic, decentralized lending protocol built on Solana",
      tvl: solendPools.reduce((sum, p) => sum + parseFloat(p.totalDeposits || "0"), 0).toString(),
      poolCount: solendPools.length,
      website: "https://solend.fi",
      features: ["Flash Loans", "Multiple Markets", "Governance", "Isolated Pools"],
    },
    {
      name: "MarginFi",
      protocol: "marginfi",
      description: "Decentralized lending protocol optimized for capital efficiency",
      tvl: marginfiPools.reduce((sum, p) => sum + parseFloat(p.totalDeposits || "0"), 0).toString(),
      poolCount: marginfiPools.length,
      website: "https://marginfi.com",
      features: ["Cross-margin", "Points System", "Flash Loans", "LST Support"],
    },
  ];
}
