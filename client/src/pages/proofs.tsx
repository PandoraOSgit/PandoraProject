import { useQuery } from "@tanstack/react-query";
import { ZkProofCard } from "@/components/zk-proof-card";
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
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { Shield, ShieldCheck, Clock, Search, Filter, Lock, Wallet } from "lucide-react";
import type { ZkProof, Agent } from "@shared/schema";
import { useWallet } from "@/contexts/wallet-context";

function ProofCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-16 w-full rounded-md" />
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-5 w-16" />
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function ProofsPage() {
  const { publicKey, connect } = useWallet();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: proofs, isLoading } = useQuery<ZkProof[]>({
    queryKey: ["/api/zk-proofs", { owner: publicKey }],
    queryFn: async () => {
      if (!publicKey) return [];
      const response = await fetch(`/api/zk-proofs?owner=${publicKey}`);
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

  const proofTypes = Array.from(new Set(proofs?.map((p) => p.proofType) || []));

  const filteredProofs = proofs?.filter((proof) => {
    const matchesSearch =
      proof.proofData.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proof.proofType.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "verified" && proof.verified) ||
      (statusFilter === "pending" && !proof.verified);
    const matchesType = typeFilter === "all" || proof.proofType === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  const verifiedCount = proofs?.filter((p) => p.verified).length || 0;
  const pendingCount = proofs?.filter((p) => !p.verified).length || 0;
  const proofsWithTime = proofs?.filter((p) => p.verificationTime) || [];
  const avgVerificationTime = proofsWithTime.length > 0
    ? proofsWithTime.reduce((sum, p) => sum + (p.verificationTime || 0), 0) / proofsWithTime.length
    : 0;

  if (!publicKey) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-proofs-title">
            ZK Proofs
          </h1>
          <p className="text-muted-foreground">
            Privacy-preserving zero-knowledge proof verification
          </p>
        </div>
        <Card className="backdrop-blur-xl border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="h-16 w-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Wallet className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Connect Wallet to View</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Connect your wallet to view your ZK proofs
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
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-proofs-title">
          ZK Proofs
        </h1>
        <p className="text-muted-foreground">
          Privacy-preserving zero-knowledge proof verification
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Proofs</span>
            <Shield className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{proofs?.length || 0}</div>
            <p className="text-xs text-muted-foreground">generated proofs</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Verified</span>
            <ShieldCheck className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">{verifiedCount}</div>
            <p className="text-xs text-muted-foreground">
              {proofs?.length ? ((verifiedCount / proofs.length) * 100).toFixed(0) : 0}% verified
            </p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Pending</span>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">{pendingCount}</div>
            <p className="text-xs text-muted-foreground">awaiting verification</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Avg Time</span>
            <Lock className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgVerificationTime.toFixed(0)}ms</div>
            <p className="text-xs text-muted-foreground">verification time</p>
          </CardContent>
        </Card>
      </div>

      <Card className="backdrop-blur-xl border-border/50 p-4">
        <div className="flex items-center gap-4 p-4 rounded-md bg-primary/5 border border-primary/20">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-medium text-foreground">ZK Privacy Engine</p>
            <p className="text-sm text-muted-foreground">
              All agent operations are verified using zero-knowledge proofs. Sensitive data like balances,
              strategies, and AI decisions are never exposed - only succinct cryptographic proofs are shared.
            </p>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-2xl font-bold text-primary">100%</span>
            <span className="text-xs text-muted-foreground">Privacy</span>
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search proofs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-proofs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="verified">Verified</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[160px]" data-testid="select-type-filter">
              <SelectValue placeholder="Proof Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {proofTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <ProofCardSkeleton key={i} />
          ))}
        </div>
      ) : !filteredProofs || filteredProofs.length === 0 ? (
        <Card className="backdrop-blur-xl border-border/50">
          <EmptyState
            icon={<Shield className="h-8 w-8" />}
            title={searchQuery || statusFilter !== "all" || typeFilter !== "all" ? "No matching proofs" : "No proofs yet"}
            description={
              searchQuery || statusFilter !== "all" || typeFilter !== "all"
                ? "Try adjusting your filters to find proofs"
                : "ZK proofs will appear here when agents start executing privacy-preserving operations"
            }
            testId="empty-proofs"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProofs.map((proof) => (
            <ZkProofCard
              key={proof.id}
              proof={proof}
              agentName={agentMap.get(proof.agentId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
