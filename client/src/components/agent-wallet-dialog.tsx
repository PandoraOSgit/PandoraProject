import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Wallet, ArrowUpRight, ArrowDownLeft, Copy, ExternalLink, AlertCircle, Settings, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/contexts/wallet-context";
import type { Agent } from "@shared/schema";

interface AgentWalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
}

interface WalletInfo {
  hasWallet: boolean;
  address: string | null;
  balance: number;
  spendingLimit: number;
  dailySpent: number;
  lastSpendingReset: string | null;
}

export function AgentWalletDialog({ open, onOpenChange, agent }: AgentWalletDialogProps) {
  const { toast } = useToast();
  const { publicKey } = useWallet();
  
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawAddress, setWithdrawAddress] = useState("");
  const [spendingLimit, setSpendingLimit] = useState("");
  const [executing, setExecuting] = useState(false);

  useEffect(() => {
    if (open && agent) {
      fetchWalletInfo();
    }
  }, [open, agent]);

  useEffect(() => {
    if (publicKey) {
      setWithdrawAddress(publicKey);
    }
  }, [publicKey]);

  const fetchWalletInfo = async () => {
    if (!agent) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/wallet`);
      if (response.ok) {
        const data = await response.json();
        setWalletInfo(data);
        setSpendingLimit(data.spendingLimit.toString());
      }
    } catch (err) {
      console.error("Failed to fetch wallet info:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (walletInfo?.address) {
      navigator.clipboard.writeText(walletInfo.address);
      toast({ title: "Copied", description: "Agent wallet address copied to clipboard" });
    }
  };

  const handleWithdraw = async () => {
    if (!agent || !withdrawAmount || !withdrawAddress) return;
    
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }

    if (walletInfo && amount > walletInfo.balance) {
      toast({ title: "Insufficient balance", variant: "destructive" });
      return;
    }

    setExecuting(true);
    try {
      const response = await fetch(`/api/agents/${agent.id}/wallet/withdraw`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, toAddress: withdrawAddress }),
      });

      const result = await response.json();
      
      if (response.ok) {
        toast({ 
          title: "Withdrawal successful", 
          description: `Withdrew ${amount} SOL. New balance: ${result.newBalance.toFixed(4)} SOL` 
        });
        setWithdrawAmount("");
        fetchWalletInfo();
      } else {
        toast({ title: "Withdrawal failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to withdraw", variant: "destructive" });
    } finally {
      setExecuting(false);
    }
  };

  const handleUpdateSpendingLimit = async () => {
    if (!agent) return;
    
    const limit = parseFloat(spendingLimit);
    if (isNaN(limit) || limit < 0) {
      toast({ title: "Invalid spending limit", variant: "destructive" });
      return;
    }

    try {
      const response = await fetch(`/api/agents/${agent.id}/spending-limit`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spendingLimit: limit }),
      });

      if (response.ok) {
        toast({ title: "Spending limit updated", description: `New limit: ${limit} SOL/day` });
        fetchWalletInfo();
      } else {
        const result = await response.json();
        toast({ title: "Update failed", description: result.error, variant: "destructive" });
      }
    } catch (err) {
      toast({ title: "Error", description: "Failed to update spending limit", variant: "destructive" });
    }
  };

  const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            {agent?.name} Wallet
          </DialogTitle>
          <DialogDescription>
            Manage your agent's autonomous wallet
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !walletInfo?.hasWallet ? (
          <div className="py-8 text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">
              This agent does not have a wallet. Set the WALLET_ENCRYPTION_KEY secret to enable agent wallets.
            </p>
          </div>
        ) : (
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="withdraw" data-testid="tab-withdraw">Withdraw</TabsTrigger>
              <TabsTrigger value="settings" data-testid="tab-settings">Settings</TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="space-y-4 pt-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Wallet Address</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-sm flex-1 truncate" data-testid="text-wallet-address">
                      {walletInfo.address}
                    </code>
                    <Button size="icon" variant="ghost" onClick={copyAddress} data-testid="button-copy-address">
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      onClick={() => window.open(`https://solscan.io/account/${walletInfo.address}`, "_blank")}
                      data-testid="button-view-explorer"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Balance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-wallet-balance">
                      {walletInfo.balance.toFixed(4)} <span className="text-sm text-muted-foreground">SOL</span>
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">Daily Limit</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-2xl font-bold" data-testid="text-spending-limit">
                      {walletInfo.spendingLimit} <span className="text-sm text-muted-foreground">SOL</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Spent today: {walletInfo.dailySpent.toFixed(4)} SOL
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 rounded-md p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>To deposit:</strong> Send SOL directly to the wallet address above. The balance will update automatically.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="withdraw" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="withdraw-amount">Amount (SOL)</Label>
                <Input
                  id="withdraw-amount"
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="0.1"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  data-testid="input-withdraw-amount"
                />
                <p className="text-xs text-muted-foreground">
                  Available: {walletInfo.balance.toFixed(4)} SOL
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="withdraw-address">Destination Address</Label>
                <Input
                  id="withdraw-address"
                  placeholder="Solana wallet address"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  className="font-mono text-sm"
                  data-testid="input-withdraw-address"
                />
              </div>

              <Button 
                onClick={handleWithdraw} 
                disabled={executing || !withdrawAmount || !withdrawAddress}
                className="w-full"
                data-testid="button-withdraw"
              >
                {executing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowUpRight className="h-4 w-4 mr-2" />
                )}
                Withdraw
              </Button>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label htmlFor="spending-limit">Daily Spending Limit (SOL)</Label>
                <div className="flex gap-2">
                  <Input
                    id="spending-limit"
                    type="number"
                    step="0.1"
                    min="0"
                    value={spendingLimit}
                    onChange={(e) => setSpendingLimit(e.target.value)}
                    data-testid="input-spending-limit"
                  />
                  <Button onClick={handleUpdateSpendingLimit} data-testid="button-update-limit">
                    <Settings className="h-4 w-4 mr-2" />
                    Update
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Maximum amount the agent can spend per day in autonomous mode.
                </p>
              </div>

              <Card className="border-yellow-500/20 bg-yellow-500/5">
                <CardContent className="pt-4">
                  <div className="flex gap-2">
                    <AlertCircle className="h-5 w-5 text-yellow-500 shrink-0" />
                    <div className="text-sm">
                      <p className="font-medium text-yellow-500">Security Notice</p>
                      <p className="text-muted-foreground">
                        Agent wallets enable autonomous execution. Only deposit what you're willing to risk.
                        Set conservative spending limits.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
