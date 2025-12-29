import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  TrendingUp,
  TrendingDown,
  Rocket,
  Zap,
  CircleDot,
  RefreshCw,
  ExternalLink,
  Droplets,
  Users,
  Clock,
} from "lucide-react";

interface TrendingToken {
  rank: number;
  score: number;
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
  logoUrl?: string;
}

interface MemeTokenAnalysis {
  token: TrendingToken;
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

interface NewTokenLaunch {
  mint: string;
  name: string;
  symbol: string;
  liquiditySol: number;
  deployer: string;
  timestamp: number;
  logoUrl?: string;
}

interface TrendingResponse {
  tokens: TrendingToken[];
  analyses: MemeTokenAnalysis[];
  isLiveData: boolean;
}

interface LaunchesResponse {
  launches: NewTokenLaunch[];
  isLiveData: boolean;
}

interface OpportunitiesResponse {
  trending: TrendingToken[];
  analyses: MemeTokenAnalysis[];
  topPicks: MemeTokenAnalysis[];
  isLiveData: boolean;
}

interface DexScreenerStatus {
  connected: boolean;
  message: string;
}

function formatPrice(price: number): string {
  if (price >= 1) {
    return `$${price.toFixed(2)}`;
  } else if (price >= 0.0001) {
    return `$${price.toFixed(6)}`;
  } else {
    return `$${price.toExponential(2)}`;
  }
}

function formatLargeNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(2)}K`;
  return num.toFixed(2);
}

function getRecommendationBadge(recommendation: string) {
  switch (recommendation) {
    case "strong_buy":
      return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Strong Buy</Badge>;
    case "buy":
      return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Buy</Badge>;
    case "hold":
      return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Hold</Badge>;
    case "sell":
      return <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Sell</Badge>;
    case "avoid":
      return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Avoid</Badge>;
    default:
      return <Badge variant="secondary">{recommendation}</Badge>;
  }
}

function TokenCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

function LaunchCardSkeleton() {
  return (
    <div className="flex items-center gap-4 p-3">
      <Skeleton className="h-8 w-8 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-5 w-16" />
    </div>
  );
}

export default function MemeCoinsPage() {
  const { data: dexStatus, isLoading: statusLoading } = useQuery<DexScreenerStatus>({
    queryKey: ["/api/dexscreener/status"],
  });

  const { data: trending, isLoading: trendingLoading, refetch: refetchTrending } = useQuery<TrendingResponse>({
    queryKey: ["/api/meme/trending"],
  });

  const { data: launches, isLoading: launchesLoading, refetch: refetchLaunches } = useQuery<LaunchesResponse>({
    queryKey: ["/api/meme/new-launches"],
  });

  const { data: opportunities, isLoading: opportunitiesLoading, refetch: refetchOpportunities } = useQuery<OpportunitiesResponse>({
    queryKey: ["/api/meme/opportunities"],
  });

  const handleRefreshAll = () => {
    refetchTrending();
    refetchLaunches();
    refetchOpportunities();
  };

  const getAnalysisForToken = (mint: string): MemeTokenAnalysis | undefined => {
    return trending?.analyses.find((a) => a.token.mint === mint);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-meme-coins-title">
              Meme Coins
            </h1>
            <p className="text-muted-foreground">
              Discover trending tokens and new launches on Solana
            </p>
          </div>
          {statusLoading ? (
            <Skeleton className="h-6 w-32" />
          ) : (
            <Badge
              data-testid="badge-dexscreener-status"
              className={
                dexStatus?.connected
                  ? "bg-green-500/20 text-green-400 border-green-500/30"
                  : "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
              }
            >
              <CircleDot className="h-3 w-3 mr-1" />
              {dexStatus?.connected ? "Live Data" : "Connecting..."}
            </Badge>
          )}
        </div>
        <Button onClick={handleRefreshAll} variant="outline" data-testid="button-refresh-all">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Trending Tokens
            </h2>
            {trending && !trending.isLiveData && (
              <Badge variant="outline" className="text-xs">Demo Data</Badge>
            )}
          </div>

          {trendingLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <TokenCardSkeleton key={i} />
              ))}
            </div>
          ) : !trending?.tokens?.length ? (
            <Card className="backdrop-blur-xl border-border/50">
              <CardContent className="p-8 text-center">
                <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No trending tokens available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {trending.tokens.map((token) => {
                const analysis = getAnalysisForToken(token.mint);
                return (
                  <Card
                    key={token.mint}
                    className="backdrop-blur-xl border-border/50"
                    data-testid={`card-token-${token.symbol.toLowerCase()}`}
                  >
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-10 w-10">
                            {token.logoUrl ? (
                              <AvatarImage src={token.logoUrl} alt={token.symbol} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-blue-500 text-white font-bold text-sm">
                              {token.symbol.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-semibold text-foreground" data-testid={`text-token-symbol-${token.symbol.toLowerCase()}`}>
                              {token.symbol}
                            </p>
                            <p className="text-sm text-muted-foreground truncate max-w-[120px]">
                              {token.name}
                            </p>
                          </div>
                        </div>
                        {analysis && getRecommendationBadge(analysis.recommendation)}
                      </div>

                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-lg font-mono font-semibold text-foreground" data-testid={`text-token-price-${token.symbol.toLowerCase()}`}>
                            {formatPrice(token.priceUsd)}
                          </p>
                          <div className="flex items-center gap-1">
                            {token.priceChange24h >= 0 ? (
                              <TrendingUp className="h-3 w-3 text-green-400" />
                            ) : (
                              <TrendingDown className="h-3 w-3 text-red-400" />
                            )}
                            <span
                              className={`text-sm font-mono ${
                                token.priceChange24h >= 0 ? "text-green-400" : "text-red-400"
                              }`}
                              data-testid={`text-token-change-${token.symbol.toLowerCase()}`}
                            >
                              {token.priceChange24h >= 0 ? "+" : ""}
                              {token.priceChange24h.toFixed(2)}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">Market Cap</p>
                          <p className="font-mono text-foreground">${formatLargeNumber(token.marketCap)}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/50">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Droplets className="h-3 w-3" />
                          <span>{formatLargeNumber(token.liquiditySol)} SOL</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Zap className="h-3 w-3" />
                          <span>${formatLargeNumber(token.volume24h)}</span>
                        </div>
                      </div>

                      {analysis && (
                        <div className="pt-2 border-t border-border/50">
                          <p className="text-xs text-muted-foreground mb-2">
                            Confidence: {(analysis.confidence * 100).toFixed(0)}%
                          </p>
                          <div className="w-full bg-muted rounded-full h-1.5">
                            <div
                              className="bg-gradient-to-r from-purple-500 to-blue-500 h-1.5 rounded-full"
                              style={{ width: `${analysis.confidence * 100}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <Card className="backdrop-blur-xl border-border/50">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-400" />
                Top Opportunities
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opportunitiesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-8 w-8 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : !opportunities?.topPicks?.length ? (
                <p className="text-center text-muted-foreground py-4">
                  No buy opportunities found
                </p>
              ) : (
                opportunities.topPicks.map((pick, index) => (
                  <div
                    key={pick.token.mint}
                    className="flex items-start gap-3 p-3 rounded-md bg-muted/50 border border-border/50"
                    data-testid={`card-opportunity-${index}`}
                  >
                    <Avatar className="h-8 w-8">
                      {pick.token.logoUrl ? (
                        <AvatarImage src={pick.token.logoUrl} alt={pick.token.symbol} />
                      ) : null}
                      <AvatarFallback className="bg-gradient-to-br from-green-500 to-emerald-500 text-white text-xs">
                        {pick.token.symbol.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-foreground" data-testid={`text-opportunity-symbol-${index}`}>
                          {pick.token.symbol}
                        </p>
                        {getRecommendationBadge(pick.recommendation)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {pick.reasoning}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-muted-foreground">
                          Confidence:
                        </span>
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-gradient-to-r from-green-500 to-emerald-500 h-1.5 rounded-full"
                            style={{ width: `${pick.confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs font-mono text-foreground" data-testid={`text-opportunity-confidence-${index}`}>
                          {(pick.confidence * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="backdrop-blur-xl border-border/50">
            <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Rocket className="h-5 w-5 text-purple-400" />
                New Launches
              </CardTitle>
              {launches && !launches.isLiveData && (
                <Badge variant="outline" className="text-xs">Demo</Badge>
              )}
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {launchesLoading ? (
                  <div className="space-y-1 divide-y divide-border/50">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <LaunchCardSkeleton key={i} />
                    ))}
                  </div>
                ) : !launches?.launches?.length ? (
                  <p className="text-center text-muted-foreground py-8">
                    No new launches detected
                  </p>
                ) : (
                  <div className="space-y-1 divide-y divide-border/50">
                    {launches.launches.map((launch, index) => {
                      const timeAgo = Math.floor((Date.now() - launch.timestamp) / 60000);
                      return (
                        <div
                          key={launch.mint}
                          className="flex items-center gap-3 py-3"
                          data-testid={`row-launch-${index}`}
                        >
                          <Avatar className="h-8 w-8">
                            {launch.logoUrl ? (
                              <AvatarImage src={launch.logoUrl} alt={launch.symbol} />
                            ) : null}
                            <AvatarFallback className="bg-gradient-to-br from-purple-500 to-pink-500 text-white text-xs">
                              {launch.symbol.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate" data-testid={`text-launch-name-${index}`}>
                              {launch.name}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <span className="font-mono">{launch.symbol}</span>
                              <span>·</span>
                              <span>{launch.liquiditySol.toFixed(1)} SOL</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{timeAgo}m ago</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
