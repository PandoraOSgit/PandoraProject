import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useState } from "react";
import { BarChart3, TrendingUp, Activity, Shield, Wallet } from "lucide-react";
import type { Agent, Transaction, ZkProof } from "@shared/schema";
import { useWallet } from "@/contexts/wallet-context";

const CHART_COLORS = [
  "hsl(255, 75%, 65%)",
  "hsl(248, 65%, 58%)",
  "hsl(200, 70%, 48%)",
  "hsl(280, 70%, 60%)",
  "hsl(340, 65%, 55%)",
];

function ChartSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <CardHeader>
        <Skeleton className="h-5 w-32" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const { publicKey, connect } = useWallet();
  const [timeRange, setTimeRange] = useState("7d");

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/agents?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const { data: transactions, isLoading: transactionsLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/transactions?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const { data: proofs, isLoading: proofsLoading } = useQuery<ZkProof[]>({
    queryKey: ["/api/zk-proofs", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/zk-proofs?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const isLoading = agentsLoading || transactionsLoading || proofsLoading;

  const agentTypeData = agents?.reduce((acc, agent) => {
    const existing = acc.find((item) => item.name === agent.type);
    if (existing) {
      existing.value += 1;
    } else {
      acc.push({ name: agent.type, value: 1 });
    }
    return acc;
  }, [] as { name: string; value: number }[]) || [];

  const transactionTypeData = transactions?.reduce((acc, tx) => {
    const existing = acc.find((item) => item.name === tx.type);
    if (existing) {
      existing.count += 1;
    } else {
      acc.push({ name: tx.type, count: 1 });
    }
    return acc;
  }, [] as { name: string; count: number }[]) || [];

  const performanceData = agents?.map((agent) => ({
    name: agent.name.slice(0, 10),
    successRate: Math.round(agent.successRate * 100),
    volume: agent.totalVolume,
    pnl: agent.profitLoss,
  })) || [];

  const mockTimeSeriesData = [
    { date: "Mon", volume: 12500, transactions: 45, proofs: 12 },
    { date: "Tue", volume: 18200, transactions: 62, proofs: 18 },
    { date: "Wed", volume: 15800, transactions: 53, proofs: 15 },
    { date: "Thu", volume: 22100, transactions: 71, proofs: 22 },
    { date: "Fri", volume: 19500, transactions: 58, proofs: 19 },
    { date: "Sat", volume: 16300, transactions: 48, proofs: 14 },
    { date: "Sun", volume: 20800, transactions: 65, proofs: 21 },
  ];

  const totalVolume = agents?.reduce((sum, a) => sum + a.totalVolume, 0) || 0;
  const totalPnL = agents?.reduce((sum, a) => sum + a.profitLoss, 0) || 0;
  const avgSuccessRate = agents?.length
    ? agents.reduce((sum, a) => sum + a.successRate, 0) / agents.length
    : 0;

  if (!publicKey) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-analytics-title">
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Performance metrics and insights across all agents
          </p>
        </div>
        <Card className="backdrop-blur-xl border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Connect Wallet to View</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to view your analytics data
            </p>
            <Button onClick={connect} data-testid="button-connect-wallet">
              <Wallet className="h-4 w-4 mr-2" />
              Connect Wallet
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-analytics-title">
            Analytics
          </h1>
          <p className="text-muted-foreground">
            Performance metrics and insights across all agents
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[140px]" data-testid="select-time-range">
            <SelectValue placeholder="Time range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Volume</span>
            <TrendingUp className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total P/L</span>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? "text-green-500" : "text-red-500"}`}>
              {totalPnL >= 0 ? "+" : ""}${totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Avg Success Rate</span>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(avgSuccessRate * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">ZK Verified</span>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {proofs?.filter((p) => p.verified).length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {isLoading ? (
          <>
            <ChartSkeleton />
            <ChartSkeleton />
          </>
        ) : (
          <>
            <Card className="backdrop-blur-xl border-border/50">
              <CardHeader>
                <CardTitle>Volume Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={mockTimeSeriesData}>
                    <defs>
                      <linearGradient id="volumeGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(255, 75%, 65%)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(255, 75%, 65%)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="volume"
                      stroke="hsl(255, 75%, 65%)"
                      fill="url(#volumeGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl border-border/50">
              <CardHeader>
                <CardTitle>Transactions by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={transactionTypeData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="hsl(255, 75%, 65%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl border-border/50">
              <CardHeader>
                <CardTitle>Agent Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={performanceData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                    <YAxis stroke="hsl(var(--muted-foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke="hsl(255, 75%, 65%)"
                      strokeWidth={2}
                      dot={{ fill: "hsl(255, 75%, 65%)" }}
                      name="Success Rate %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-xl border-border/50">
              <CardHeader>
                <CardTitle>Agent Distribution</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={agentTypeData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {agentTypeData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
