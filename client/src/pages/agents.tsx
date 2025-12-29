import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AgentCard } from "@/components/agent-card";
import { CreateAgentDialog } from "@/components/create-agent-dialog";
import { ExecuteTransactionDialog } from "@/components/execute-transaction-dialog";
import { AgentWalletDialog } from "@/components/agent-wallet-dialog";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/wallet-context";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Bot, Plus, Search, Filter, Wallet } from "lucide-react";
import type { Agent } from "@shared/schema";

function AgentCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
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
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-md" />
        <div className="flex justify-between">
          <Skeleton className="h-8 w-20" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8" />
            <Skeleton className="h-8 w-8" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export default function AgentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [executeDialogOpen, setExecuteDialogOpen] = useState(false);
  const [walletDialogOpen, setWalletDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();
  const { connected, publicKey, connect } = useWallet();

  const { data: agents, isLoading } = useQuery<Agent[]>({
    queryKey: ["/api/agents", publicKey],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/agents?owner=${publicKey}`);
      if (!response.ok) throw new Error("Failed to fetch agents");
      return response.json();
    },
    enabled: !!publicKey,
  });

  const createMutation = useMutation({
    mutationFn: async (data: Partial<Agent>) => {
      return apiRequest("POST", "/api/agents", { ...data, ownerWallet: publicKey });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", publicKey] });
      setDialogOpen(false);
      toast({
        title: "Agent created",
        description: "Your new agent has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const newStatus = agent.status === "running" ? "paused" : "running";
      return apiRequest("PATCH", `/api/agents/${agent.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", publicKey] });
      toast({
        title: "Agent updated",
        description: "Agent status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update agent status.",
        variant: "destructive",
      });
    },
  });

  const analyzeMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const response = await apiRequest("POST", `/api/agents/${agent.id}/analyze`);
      return response.json() as Promise<{ decision: string; confidence: number }>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", publicKey] });
      toast({
        title: "Analysis Complete",
        description: `Decision: ${data.decision} (${(data.confidence * 100).toFixed(0)}% confidence)`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to analyze agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleExecute = (agent: Agent) => {
    setSelectedAgent(agent);
    setExecuteDialogOpen(true);
  };

  const handleAnalyze = (agent: Agent) => {
    analyzeMutation.mutate(agent);
  };

  const handleWallet = (agent: Agent) => {
    setSelectedAgent(agent);
    setWalletDialogOpen(true);
  };

  const memeTradeMutation = useMutation({
    mutationFn: async (agent: Agent) => {
      const response = await apiRequest("POST", `/api/agents/${agent.id}/execute-meme-trade`, { ownerWallet: publicKey });
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", publicKey] });
      if (data.executed) {
        toast({
          title: "Meme Trade Executed",
          description: `${data.decision?.action?.toUpperCase()} ${data.decision?.tokenSymbol} at ${(data.decision?.confidence * 100).toFixed(0)}% confidence`,
        });
      } else {
        toast({
          title: "Trade Analysis Complete",
          description: data.decision?.reasoning || "AI decided not to trade at this time",
        });
      }
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to execute meme trade. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleMemeTrade = (agent: Agent) => {
    memeTradeMutation.mutate(agent);
  };

  const filteredAgents = agents?.filter((agent) => {
    const matchesSearch =
      agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      agent.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || agent.type === typeFilter;
    const matchesStatus = statusFilter === "all" || agent.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  if (!connected) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground" data-testid="text-agents-title">
              Agents
            </h1>
            <p className="text-muted-foreground">
              Manage your AI-powered autonomous agents
            </p>
          </div>
        </div>
        <Card className="backdrop-blur-xl border-border/50">
          <EmptyState
            icon={<Wallet className="h-8 w-8" />}
            title="Connect Your Wallet"
            description="Connect your Phantom wallet to view and manage your agents. Each wallet has its own private set of agents."
            actionLabel="Connect Wallet"
            onAction={connect}
            testId="empty-wallet-connect"
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-agents-title">
            Agents
          </h1>
          <p className="text-muted-foreground">
            Manage your AI-powered autonomous agents
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-create-agent">
          <Plus className="h-4 w-4 mr-2" />
          Create Agent
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-agents"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-type-filter">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="trading">Trading</SelectItem>
              <SelectItem value="staking">Staking</SelectItem>
              <SelectItem value="lending">Lending</SelectItem>
              <SelectItem value="hedging">Hedging</SelectItem>
              <SelectItem value="custom">Custom</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="idle">Idle</SelectItem>
              <SelectItem value="running">Running</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="error">Error</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <AgentCardSkeleton key={i} />
          ))}
        </div>
      ) : !filteredAgents || filteredAgents.length === 0 ? (
        <Card className="backdrop-blur-xl border-border/50">
          <EmptyState
            icon={<Bot className="h-8 w-8" />}
            title={searchQuery || typeFilter !== "all" || statusFilter !== "all" ? "No matching agents" : "No agents yet"}
            description={
              searchQuery || typeFilter !== "all" || statusFilter !== "all"
                ? "Try adjusting your filters to find agents"
                : "Create your first AI-powered autonomous agent to start executing operations on Solana"
            }
            actionLabel={!searchQuery && typeFilter === "all" && statusFilter === "all" ? "Create Agent" : undefined}
            onAction={() => setDialogOpen(true)}
            testId="empty-agents"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredAgents.map((agent) => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onToggle={(a) => toggleMutation.mutate(a)}
              onExecute={handleExecute}
              onAnalyze={handleAnalyze}
              onWallet={handleWallet}
              onMemeTrade={handleMemeTrade}
            />
          ))}
        </div>
      )}

      <CreateAgentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={async (data) => {
          await createMutation.mutateAsync(data);
        }}
        isLoading={createMutation.isPending}
      />

      <ExecuteTransactionDialog
        open={executeDialogOpen}
        onOpenChange={setExecuteDialogOpen}
        agent={selectedAgent}
      />

      <AgentWalletDialog
        open={walletDialogOpen}
        onOpenChange={setWalletDialogOpen}
        agent={selectedAgent}
      />
    </div>
  );
}
