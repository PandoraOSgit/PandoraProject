import { useQuery } from "@tanstack/react-query";
import { StatsCard } from "@/components/stats-card";
import { AgentCard } from "@/components/agent-card";
import { TransactionItem } from "@/components/transaction-item";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Bot,
  Activity,
  TrendingUp,
  Shield,
  ArrowRight,
  Plus,
  Network,
  Wallet,
} from "lucide-react";
import { Link } from "wouter";
import type { Agent, Transaction, Fleet, ZkProof } from "@shared/schema";
import { useWallet } from "@/contexts/wallet-context";

interface DashboardStats {
  totalAgents: number;
  activeAgents: number;
  totalTransactions: number;
  totalVolume: number;
  totalProofs: number;
  verifiedProofs: number;
  profitLoss: number;
}

function StatsCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-8 rounded-full" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-8 w-20 mb-2" />
        <Skeleton className="h-3 w-16" />
      </CardContent>
    </Card>
  );
}

function AgentCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-5 w-16" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const { connected, publicKey, connect } = useWallet();

  const { data: agents, isLoading: agentsLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents", publicKey],
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

  const { data: fleets } = useQuery<Fleet[]>({
    queryKey: ["/api/fleets", publicKey],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/fleets?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const { data: proofs } = useQuery<ZkProof[]>({
    queryKey: ["/api/zk-proofs", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/zk-proofs?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const stats: DashboardStats = {
    totalAgents: agents?.length || 0,
    activeAgents: agents?.filter((a) => a.status === "running").length || 0,
    totalTransactions: transactions?.length || 0,
    totalVolume: agents?.reduce((sum, a) => sum + a.totalVolume, 0) || 0,
    totalProofs: proofs?.length || 0,
    verifiedProofs: proofs?.filter((p) => p.verified).length || 0,
    profitLoss: agents?.reduce((sum, a) => sum + a.profitLoss, 0) || 0,
  };

  const recentAgents = agents?.slice(0, 3) || [];
  const recentTransactions = transactions?.slice(0, 5) || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-dashboard-title">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Monitor your autonomous agents and operations
          </p>
        </div>
        <Link href="/agents">
          <Button data-testid="button-create-agent-cta">
            <Plus className="h-4 w-4 mr-2" />
            Create Agent
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {agentsLoading ? (
          <>
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
            <StatsCardSkeleton />
          </>
        ) : (
          <>
            <StatsCard
              title="Active Agents"
              value={`${stats.activeAgents} / ${stats.totalAgents}`}
              icon={<Bot className="h-4 w-4" />}
              trend={stats.activeAgents > 0 ? "up" : "neutral"}
              changeLabel="agents running"
              testId="stats-active-agents"
            />
            <StatsCard
              title="Total Transactions"
              value={stats.totalTransactions.toLocaleString()}
              icon={<Activity className="h-4 w-4" />}
              trend="up"
              change={12.5}
              changeLabel="vs last week"
              testId="stats-transactions"
            />
            <StatsCard
              title="Total Volume"
              value={`$${stats.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              icon={<TrendingUp className="h-4 w-4" />}
              trend={stats.profitLoss >= 0 ? "up" : "down"}
              change={stats.profitLoss}
              changeLabel="P/L"
              testId="stats-volume"
            />
            <StatsCard
              title="ZK Proofs"
              value={`${stats.verifiedProofs} / ${stats.totalProofs}`}
              icon={<Shield className="h-4 w-4" />}
              trend="up"
              changeLabel="verified"
              testId="stats-proofs"
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Agents</h2>
            <Link href="/agents">
              <Button variant="ghost" size="sm" data-testid="link-view-all-agents">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          {agentsLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-4">
              <AgentCardSkeleton />
              <AgentCardSkeleton />
            </div>
          ) : recentAgents.length === 0 ? (
            <Card className="backdrop-blur-xl border-border/50">
              <EmptyState
                icon={<Bot className="h-8 w-8" />}
                title="No agents yet"
                description="Create your first AI-powered autonomous agent to get started"
                testId="empty-agents"
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {recentAgents.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <Link href="/transactions">
              <Button variant="ghost" size="sm" data-testid="link-view-all-txns">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </div>

          <Card className="backdrop-blur-xl border-border/50">
            {transactionsLoading ? (
              <CardContent className="p-4 space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </CardContent>
            ) : recentTransactions.length === 0 ? (
              <EmptyState
                icon={<Activity className="h-8 w-8" />}
                title="No transactions"
                description="Agent transactions will appear here"
                testId="empty-transactions"
              />
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="divide-y divide-border/50">
                  {recentTransactions.map((tx) => (
                    <TransactionItem key={tx.id} transaction={tx} />
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-lg">Fleet Overview</CardTitle>
            <Link href="/fleet">
              <Button variant="ghost" size="sm" data-testid="link-view-fleet">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {!fleets || fleets.length === 0 ? (
              <EmptyState
                icon={<Network className="h-8 w-8" />}
                title="No fleets"
                description="Create agent fleets for coordinated operations"
                testId="empty-fleets"
              />
            ) : (
              <div className="space-y-3">
                {fleets.slice(0, 3).map((fleet) => (
                  <div
                    key={fleet.id}
                    className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                        <Network className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{fleet.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {fleet.agentCount} agents
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-mono text-muted-foreground">
                      ${fleet.totalVolume.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle className="text-lg">Privacy Status</CardTitle>
            <Link href="/proofs">
              <Button variant="ghost" size="sm" data-testid="link-view-proofs">
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-md bg-primary/5 border border-primary/20">
                <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">ZK Privacy Engine Active</p>
                  <p className="text-sm text-muted-foreground">
                    All sensitive data protected with zero-knowledge proofs
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-md bg-muted/50 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-foreground">{stats.verifiedProofs}</p>
                  <p className="text-xs text-muted-foreground">Verified Proofs</p>
                </div>
                <div className="p-3 rounded-md bg-muted/50 border border-border/50 text-center">
                  <p className="text-2xl font-bold text-foreground">100%</p>
                  <p className="text-xs text-muted-foreground">Data Privacy</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
