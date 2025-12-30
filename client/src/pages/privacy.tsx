import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Shield, 
  Lock, 
  Layers, 
  Code, 
  Brain,
  Eye,
  EyeOff,
  Plus,
  CheckCircle,
  AlertCircle,
  Loader2,
  Copy,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface PrivacyStats {
  shieldedAddresses: number;
  payments: {
    totalPayments: number;
    pendingPayments: number;
    confirmedPayments: number;
    spentPayments: number;
    totalNullifiers: number;
  };
  bundling: {
    totalBundles: number;
    totalTransactions: number;
    averageCompressionRatio: number;
    totalGasSaved: number;
  };
  zkml: {
    totalModels: number;
    totalProofs: number;
    averageVerificationTime: number;
  };
}

interface ShieldedAddress {
  publicAddress: string;
  viewingKey: string;
  spendingKeyHash: string;
  createdAt: number;
}

interface ZkMLTemplate {
  name: string;
  description: string;
  modelType: string;
}

interface SDKInfo {
  version: string;
  features: string[];
  networks: string[];
  aiProviders: string[];
}

export default function Privacy() {
  const { toast } = useToast();

  const { data: stats, isLoading: statsLoading } = useQuery<PrivacyStats>({
    queryKey: ["/api/privacy/stats"],
  });

  const { data: shieldedAddresses = [] } = useQuery<ShieldedAddress[]>({
    queryKey: ["/api/privacy/shielded-addresses"],
  });

  const { data: zkmlTemplates = [] } = useQuery<ZkMLTemplate[]>({
    queryKey: ["/api/zkml/templates"],
  });

  const { data: sdkInfo } = useQuery<SDKInfo>({
    queryKey: ["/api/sdk/info"],
  });

  const generateKeysMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/privacy/generate-keys");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/shielded-addresses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/privacy/stats"] });
      toast({
        title: "Shielded Address Generated",
        description: "New stealth keys and shielded address created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate shielded address.",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard.",
    });
  };

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">ZK Privacy Layer</h1>
          <p className="text-muted-foreground">
            Privacy-first infrastructure for secure on-chain automation
          </p>
        </div>
        <Badge variant="outline" className="gap-1">
          <Shield className="h-3 w-3" />
          SDK v{sdkInfo?.version || "1.0.0"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-stat-shielded">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Shielded Addresses</CardTitle>
            <EyeOff className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.shieldedAddresses || 0}</div>
            <p className="text-xs text-muted-foreground">Stealth addresses generated</p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-payments">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">Private Payments</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.payments?.totalPayments || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.payments?.confirmedPayments || 0} confirmed
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-bundles">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">TX Bundles</CardTitle>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.bundling?.totalBundles || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.bundling?.totalTransactions || 0} transactions bundled
            </p>
          </CardContent>
        </Card>

        <Card data-testid="card-stat-zkml">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm font-medium">zkML Models</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.zkml?.totalModels || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.zkml?.totalProofs || 0} inference proofs
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="shielded" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="shielded" data-testid="tab-shielded">
            <EyeOff className="h-4 w-4 mr-2" />
            Shielded
          </TabsTrigger>
          <TabsTrigger value="payments" data-testid="tab-payments">
            <Lock className="h-4 w-4 mr-2" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="bundling" data-testid="tab-bundling">
            <Layers className="h-4 w-4 mr-2" />
            Bundling
          </TabsTrigger>
          <TabsTrigger value="zkml" data-testid="tab-zkml">
            <Brain className="h-4 w-4 mr-2" />
            zkML
          </TabsTrigger>
        </TabsList>

        <TabsContent value="shielded" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shielded Addresses</CardTitle>
                  <CardDescription>
                    Generate stealth addresses for private transactions
                  </CardDescription>
                </div>
                <Button
                  onClick={() => generateKeysMutation.mutate()}
                  disabled={generateKeysMutation.isPending}
                  data-testid="button-generate-shielded"
                >
                  {generateKeysMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Generate New
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {shieldedAddresses.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <EyeOff className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No shielded addresses yet</p>
                  <p className="text-sm">Generate your first stealth address above</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {shieldedAddresses.map((addr, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`shielded-address-${idx}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm truncate">{addr.publicAddress}</p>
                        <p className="text-xs text-muted-foreground">
                          Created {new Date(addr.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(addr.publicAddress)}
                        data-testid={`button-copy-${idx}`}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>How Shielded Addresses Work</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <h4 className="font-medium">Generate Keys</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Create viewing and spending key pairs for stealth transactions
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <h4 className="font-medium">Derive Address</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    One-time addresses derived from public keys hide recipient identity
                  </p>
                </div>
                <div className="p-4 rounded-md bg-muted/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <h4 className="font-medium">Scan & Spend</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Only viewing key holders can identify incoming payments
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Private Payments</CardTitle>
              <CardDescription>
                Fully encrypted transactions with hidden amounts and parties
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.payments?.pendingPayments || 0}</p>
                  <p className="text-sm text-muted-foreground">Pending</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold text-green-500">{stats?.payments?.confirmedPayments || 0}</p>
                  <p className="text-sm text-muted-foreground">Confirmed</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.payments?.spentPayments || 0}</p>
                  <p className="text-sm text-muted-foreground">Spent</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.payments?.totalNullifiers || 0}</p>
                  <p className="text-sm text-muted-foreground">Nullifiers</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Pedersen Commitments</p>
                    <p className="text-sm text-muted-foreground">Amounts are cryptographically hidden</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Bulletproof Range Proofs</p>
                    <p className="text-sm text-muted-foreground">Verify amounts are positive without revealing them</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Nullifier System</p>
                    <p className="text-sm text-muted-foreground">Prevents double-spending while maintaining privacy</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bundling" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ZK Transaction Bundling</CardTitle>
              <CardDescription>
                Aggregate multiple transactions into efficient ZK proofs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.bundling?.totalBundles || 0}</p>
                  <p className="text-sm text-muted-foreground">Total Bundles</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.bundling?.totalTransactions || 0}</p>
                  <p className="text-sm text-muted-foreground">Transactions</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.bundling?.averageCompressionRatio || 0}x</p>
                  <p className="text-sm text-muted-foreground">Compression</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold text-green-500">
                    {((stats?.bundling?.totalGasSaved || 0) / 1000).toFixed(1)}k
                  </p>
                  <p className="text-sm text-muted-foreground">Gas Saved</p>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Layers className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Merkle Tree Inclusion</p>
                    <p className="text-sm text-muted-foreground">Efficient proof of transaction inclusion</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <Shield className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">Aggregated Groth16 Proofs</p>
                    <p className="text-sm text-muted-foreground">Multiple proofs verified in one operation</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-md bg-muted/50">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <div>
                    <p className="font-medium">Gas Optimization</p>
                    <p className="text-sm text-muted-foreground">Reduce on-chain costs by bundling transactions</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="zkml" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>zkML Templates</CardTitle>
              <CardDescription>
                Zero-knowledge machine learning for verifiable AI inference
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.zkml?.totalModels || 0}</p>
                  <p className="text-sm text-muted-foreground">Deployed Models</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.zkml?.totalProofs || 0}</p>
                  <p className="text-sm text-muted-foreground">Inference Proofs</p>
                </div>
                <div className="text-center p-4 rounded-md bg-muted/30">
                  <p className="text-2xl font-bold">{stats?.zkml?.averageVerificationTime || 0}ms</p>
                  <p className="text-sm text-muted-foreground">Avg Verification</p>
                </div>
              </div>

              <h4 className="font-medium mb-3">Available Templates</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {zkmlTemplates.map((template, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-md border bg-card"
                    data-testid={`zkml-template-${idx}`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 text-primary" />
                      <h5 className="font-medium">{template.name}</h5>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {template.description}
                    </p>
                    <Badge variant="secondary" className="mt-2">
                      {template.modelType}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Builder SDK</CardTitle>
              <CardDescription>
                Integrate privacy features into your applications
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                {sdkInfo?.features.map((feature, idx) => (
                  <Badge key={idx} variant="outline">
                    {feature.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>

              <div className="p-4 rounded-md bg-muted/50 font-mono text-sm">
                <p className="text-muted-foreground mb-2">// Install the SDK</p>
                <p>npm install @pandora-os/sdk</p>
                <p className="text-muted-foreground mt-4 mb-2">// Initialize</p>
                <p>{`import { createSDK } from '@pandora-os/sdk';`}</p>
                <p>{`const sdk = createSDK({ networkId: 'mainnet' });`}</p>
                <p>{`await sdk.initialize();`}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
