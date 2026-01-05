import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Landmark, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  Percent,
  AlertTriangle,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Info,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface LendingPool {
  protocol: "solend" | "marginfi";
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

interface YieldOpportunity {
  protocol: "solend" | "marginfi";
  symbol: string;
  depositAPY: number;
  borrowAPY: number;
  netYield: number;
  tvl: string;
  risk: "low" | "medium" | "high";
  strategy: string;
}

interface ProtocolInfo {
  name: string;
  protocol: "solend" | "marginfi";
  description: string;
  tvl: string;
  poolCount: number;
  website: string;
  features: string[];
}

interface AIRecommendation {
  action: string;
  protocol: "solend" | "marginfi";
  symbol: string;
  reason: string;
  expectedAPY: number;
  riskLevel: "low" | "medium" | "high";
  confidence: number;
}

function formatNumber(value: string | number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  
  if (num >= 1000000) {
    return `$${(num / 1000000).toFixed(2)}M`;
  } else if (num >= 1000) {
    return `$${(num / 1000).toFixed(2)}K`;
  }
  return `$${num.toFixed(2)}`;
}

function getRiskColor(risk: "low" | "medium" | "high"): string {
  switch (risk) {
    case "low":
      return "bg-green-500/10 text-green-500 border-green-500/20";
    case "medium":
      return "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
    case "high":
      return "bg-red-500/10 text-red-500 border-red-500/20";
  }
}

export default function LendingPage() {
  const { data: pools = [], isLoading: poolsLoading, refetch: refetchPools } = useQuery<LendingPool[]>({
    queryKey: ["/api/lending/pools"],
  });

  const { data: protocols = [], isLoading: protocolsLoading } = useQuery<ProtocolInfo[]>({
    queryKey: ["/api/lending/protocols"],
  });

  const { data: opportunities = [], isLoading: opportunitiesLoading } = useQuery<YieldOpportunity[]>({
    queryKey: ["/api/lending/opportunities"],
  });

  const { data: recommendationsData, isLoading: recommendationsLoading } = useQuery<{
    recommendations: AIRecommendation[];
    riskTolerance: string;
  }>({
    queryKey: ["/api/lending/recommendations", { owner: "demo", riskTolerance: "moderate" }],
  });

  const recommendations = recommendationsData?.recommendations || [];

  const solendPools = pools.filter(p => p.protocol === "solend");
  const marginfiPools = pools.filter(p => p.protocol === "marginfi");

  const totalTVL = pools.reduce((sum, p) => sum + parseFloat(p.totalDeposits || "0"), 0);
  const avgDepositAPY = pools.length > 0 
    ? pools.reduce((sum, p) => sum + p.depositAPY, 0) / pools.length * 100
    : 0;

  return (
    <div className="flex flex-col gap-6 p-6" data-testid="lending-page">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2" data-testid="text-page-title">
            <Landmark className="h-6 w-6 text-primary" />
            DeFi Lending
          </h1>
          <p className="text-muted-foreground">
            Earn yield by depositing assets or borrow against your collateral
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetchPools()}
          data-testid="button-refresh-pools"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-total-tvl">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total TVL</CardTitle>
            <Landmark className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {poolsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{formatNumber(totalTVL)}</p>
            )}
            <p className="text-xs text-muted-foreground">Across all pools</p>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-apy">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Deposit APY</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {poolsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold text-green-500">{avgDepositAPY.toFixed(2)}%</p>
            )}
            <p className="text-xs text-muted-foreground">Average across pools</p>
          </CardContent>
        </Card>

        <Card data-testid="card-protocols">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Protocols</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {protocolsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{protocols.length}</p>
            )}
            <p className="text-xs text-muted-foreground">Solend + MarginFi</p>
          </CardContent>
        </Card>

        <Card data-testid="card-pools-count">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Pools</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {poolsLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <p className="text-2xl font-bold">{pools.length}</p>
            )}
            <p className="text-xs text-muted-foreground">Available to deposit</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="pools" className="w-full">
        <TabsList data-testid="tabs-lending">
          <TabsTrigger value="pools" data-testid="tab-pools">Lending Pools</TabsTrigger>
          <TabsTrigger value="opportunities" data-testid="tab-opportunities">Yield Opportunities</TabsTrigger>
          <TabsTrigger value="ai" data-testid="tab-ai">AI Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="pools" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card data-testid="card-solend-pools">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-pink-500" />
                  Solend
                </CardTitle>
                <CardDescription>
                  Algorithmic lending protocol on Solana
                </CardDescription>
              </CardHeader>
              <CardContent>
                {poolsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {solendPools.map((pool, idx) => (
                      <div
                        key={`${pool.protocol}-${pool.symbol}`}
                        className="flex items-center justify-between p-3 rounded-md border bg-card"
                        data-testid={`pool-solend-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold">{pool.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{pool.symbol}</p>
                            <p className="text-xs text-muted-foreground">
                              TVL: {formatNumber(pool.totalDeposits)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-500 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {(pool.depositAPY * 100).toFixed(2)}% APY
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Borrow: {(pool.borrowAPY * 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card data-testid="card-marginfi-pools">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500" />
                  MarginFi
                </CardTitle>
                <CardDescription>
                  Capital-efficient lending protocol
                </CardDescription>
              </CardHeader>
              <CardContent>
                {poolsLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-16 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {marginfiPools.map((pool, idx) => (
                      <div
                        key={`${pool.protocol}-${pool.symbol}`}
                        className="flex items-center justify-between p-3 rounded-md border bg-card"
                        data-testid={`pool-marginfi-${idx}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold">{pool.symbol.slice(0, 2)}</span>
                          </div>
                          <div>
                            <p className="font-medium">{pool.symbol}</p>
                            <p className="text-xs text-muted-foreground">
                              TVL: {formatNumber(pool.totalDeposits)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-medium text-green-500 flex items-center gap-1">
                            <ArrowUpRight className="h-3 w-3" />
                            {(pool.depositAPY * 100).toFixed(2)}% APY
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Borrow: {(pool.borrowAPY * 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="opportunities" className="space-y-4 mt-4">
          <Card data-testid="card-yield-opportunities">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-green-500" />
                Top Yield Opportunities
              </CardTitle>
              <CardDescription>
                Sorted by deposit APY - connect wallet to interact
              </CardDescription>
            </CardHeader>
            <CardContent>
              {opportunitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {opportunities.slice(0, 10).map((opp, idx) => (
                    <div
                      key={`${opp.protocol}-${opp.symbol}`}
                      className="flex items-center justify-between p-4 rounded-md border bg-card"
                      data-testid={`opportunity-${idx}`}
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center">
                          <span className="text-2xl font-bold text-green-500">
                            {opp.depositAPY.toFixed(2)}%
                          </span>
                          <span className="text-xs text-muted-foreground">APY</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{opp.symbol}</p>
                            <Badge variant="outline" className="text-xs">
                              {opp.protocol}
                            </Badge>
                            <Badge className={getRiskColor(opp.risk)}>
                              {opp.risk}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {opp.strategy}
                          </p>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`button-deposit-${idx}`}>
                        Deposit
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="space-y-4 mt-4">
          <Card data-testid="card-ai-recommendations">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-primary" />
                AI Lending Recommendations
              </CardTitle>
              <CardDescription>
                AI-powered analysis for optimal yield strategies
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recommendationsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : recommendations.length === 0 ? (
                <div className="text-center py-8">
                  <Info className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    Connect your wallet to get personalized recommendations
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recommendations.map((rec, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-md border bg-card"
                      data-testid={`recommendation-${idx}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={rec.action === "deposit" ? "bg-green-500/10 text-green-500" : rec.action === "repay" ? "bg-red-500/10 text-red-500" : "bg-blue-500/10 text-blue-500"}>
                              {rec.action.toUpperCase()}
                            </Badge>
                            <span className="font-medium">{rec.symbol}</span>
                            <Badge variant="outline">{rec.protocol}</Badge>
                            <Badge className={getRiskColor(rec.riskLevel)}>
                              {rec.riskLevel} risk
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{rec.reason}</p>
                          <div className="flex items-center gap-4 mt-2 text-sm">
                            <span className="text-green-500">
                              Expected: {rec.expectedAPY.toFixed(2)}% APY
                            </span>
                            <span className="text-muted-foreground">
                              Confidence: {(rec.confidence * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                        <Button size="sm" data-testid={`button-execute-${idx}`}>
                          Execute
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
                Risk Warning
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                DeFi lending involves risks including smart contract vulnerabilities, 
                liquidation risk, and market volatility. Always do your own research 
                and never invest more than you can afford to lose. Positions can be 
                liquidated if your health factor falls below 1.0.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
