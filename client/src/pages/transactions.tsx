import { useQuery } from "@tanstack/react-query";
import { TransactionItem } from "@/components/transaction-item";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState } from "react";
import { Activity, Search, Filter, CheckCircle, Clock, XCircle, Wallet } from "lucide-react";
import type { Transaction, Agent } from "@shared/schema";
import { useWallet } from "@/contexts/wallet-context";
import { Button } from "@/components/ui/button";

function TransactionSkeleton() {
  return (
    <div className="flex items-center gap-4 p-4 border-b border-border/50">
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-3 w-40" />
      </div>
      <Skeleton className="h-5 w-20" />
      <Skeleton className="h-6 w-32" />
    </div>
  );
}

export default function TransactionsPage() {
  const { publicKey, connect } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/transactions?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/agents?owner=${publicKey}`);
      return response.json();
    },
    enabled: !!publicKey,
  });

  const agentMap = new Map(agents?.map((a) => [a.id, a.name]) || []);

  const filteredTransactions = transactions?.filter((tx) => {
    const matchesSearch =
      tx.signature.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || tx.type === typeFilter;
    const matchesStatus = statusFilter === "all" || tx.status === statusFilter;
    return matchesSearch && matchesType && matchesStatus;
  });

  const confirmedCount = transactions?.filter((tx) => tx.status === "confirmed").length || 0;
  const pendingCount = transactions?.filter((tx) => tx.status === "pending").length || 0;
  const failedCount = transactions?.filter((tx) => tx.status === "failed").length || 0;

  if (!publicKey) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-transactions-title">
            Transactions
          </h1>
          <p className="text-muted-foreground">
            Real-time monitoring of on-chain agent actions
          </p>
        </div>
        <Card className="backdrop-blur-xl border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Connect Wallet to View</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to view your transaction history
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
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-transactions-title">
          Transactions
        </h1>
        <p className="text-muted-foreground">
          Real-time monitoring of on-chain agent actions
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Confirmed</span>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{confirmedCount}</div>
            <p className="text-xs text-muted-foreground">transactions</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Pending</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">transactions</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Failed</span>
            <XCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{failedCount}</div>
            <p className="text-xs text-muted-foreground">transactions</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by signature, type, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-transactions"
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
              <SelectItem value="swap">Swap</SelectItem>
              <SelectItem value="transfer">Transfer</SelectItem>
              <SelectItem value="stake">Stake</SelectItem>
              <SelectItem value="unstake">Unstake</SelectItem>
              <SelectItem value="lend">Lend</SelectItem>
              <SelectItem value="borrow">Borrow</SelectItem>
              <SelectItem value="repay">Repay</SelectItem>
              <SelectItem value="withdraw">Withdraw</SelectItem>
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="confirmed">Confirmed</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="backdrop-blur-xl border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="divide-y divide-border/50">
              {[1, 2, 3, 4, 5].map((i) => (
                <TransactionSkeleton key={i} />
              ))}
            </div>
          ) : !filteredTransactions || filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title={searchQuery || typeFilter !== "all" || statusFilter !== "all" ? "No matching transactions" : "No transactions yet"}
              description={
                searchQuery || typeFilter !== "all" || statusFilter !== "all"
                  ? "Try adjusting your filters to find transactions"
                  : "Agent transactions will appear here once they start executing operations"
              }
              testId="empty-transactions"
            />
          ) : (
            <ScrollArea className="h-[600px]">
              <div className="divide-y divide-border/50">
                {filteredTransactions.map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    agentName={agentMap.get(tx.agentId)}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
