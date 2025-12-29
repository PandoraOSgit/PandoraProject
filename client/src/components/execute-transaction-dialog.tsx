import { useState } from "react";
import { useWallet } from "@/contexts/wallet-context";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Send, Wallet, AlertTriangle, CheckCircle } from "lucide-react";
import type { Agent } from "@shared/schema";

interface ExecuteTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agent: Agent | null;
}

type TransactionStep = "input" | "preparing" | "signing" | "broadcasting" | "confirming" | "success" | "error";

export function ExecuteTransactionDialog({ open, onOpenChange, agent }: ExecuteTransactionDialogProps) {
  const { connected, publicKey, balance, signTransaction, refreshBalance } = useWallet();
  const { toast } = useToast();
  
  const [step, setStep] = useState<TransactionStep>("input");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [txSignature, setTxSignature] = useState("");
  const [error, setError] = useState("");

  const resetForm = () => {
    setStep("input");
    setRecipient("");
    setAmount("");
    setMemo("");
    setTxSignature("");
    setError("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const executeTransaction = async () => {
    if (!connected || !publicKey) {
      toast({
        title: "Wallet not connected",
        description: "Please connect your Phantom wallet first.",
        variant: "destructive",
      });
      return;
    }

    if (!recipient || !amount) {
      setError("Please fill in all required fields");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (balance !== null && amountNum > balance) {
      setError("Insufficient balance");
      return;
    }

    try {
      setStep("preparing");
      setError("");

      const prepareResponse = await fetch("/api/transactions/prepare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromPubkey: publicKey,
          toPubkey: recipient,
          amount: amountNum,
          memo: memo || undefined,
        }),
      });

      if (!prepareResponse.ok) {
        const errorData = await prepareResponse.json();
        throw new Error(errorData.error || "Failed to prepare transaction");
      }

      const { serializedTransaction, recentBlockhash, lastValidBlockHeight } = await prepareResponse.json();

      setStep("signing");
      
      const signedTransaction = await signTransaction(serializedTransaction);
      
      if (!signedTransaction) {
        throw new Error("Transaction signing was cancelled or failed");
      }

      setStep("broadcasting");
      
      const broadcastResponse = await fetch("/api/transactions/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signedTransaction,
          agentId: agent?.id,
          type: "transfer",
          amount: amountNum,
          description: memo || `Agent ${agent?.name || 'manual'} transfer`,
        }),
      });

      if (!broadcastResponse.ok) {
        const errorData = await broadcastResponse.json();
        throw new Error(errorData.error || "Failed to broadcast transaction");
      }

      const broadcastResult = await broadcastResponse.json();

      setStep("confirming");
      
      const confirmResponse = await fetch("/api/transactions/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature: broadcastResult.signature,
          blockhash: recentBlockhash,
          lastValidBlockHeight,
        }),
      });

      const confirmResult = await confirmResponse.json();
      
      if (confirmResult.confirmed) {
        setTxSignature(broadcastResult.signature);
        setStep("success");
        
        await refreshBalance();
        
        toast({
          title: "Transaction confirmed",
          description: `Successfully sent ${amountNum} SOL`,
        });
      } else {
        throw new Error(confirmResult.error || "Transaction failed to confirm");
      }

    } catch (err) {
      console.error("Transaction error:", err);
      setError(err instanceof Error ? err.message : "Transaction failed");
      setStep("error");
    }
  };

  const shortenSignature = (sig: string) => `${sig.slice(0, 8)}...${sig.slice(-8)}`;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Execute Transaction
          </DialogTitle>
          <DialogDescription>
            {agent ? `Execute a transaction for agent: ${agent.name}` : "Send SOL to another wallet"}
          </DialogDescription>
        </DialogHeader>

        {!connected ? (
          <div className="py-8 text-center space-y-4">
            <Wallet className="h-12 w-12 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Please connect your Phantom wallet to execute transactions.</p>
          </div>
        ) : step === "input" ? (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="recipient">Recipient Address</Label>
              <Input
                id="recipient"
                placeholder="Solana wallet address..."
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                className="font-mono text-sm"
                data-testid="input-recipient"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="amount">Amount (SOL)</Label>
              <div className="relative">
                <Input
                  id="amount"
                  type="number"
                  step="0.001"
                  min="0"
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="input-amount"
                />
                {balance !== null && (
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setAmount(String(Math.max(0, balance - 0.01)))}
                  >
                    Max: {balance.toFixed(4)}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="memo">Memo (optional)</Label>
              <Input
                id="memo"
                placeholder="Transaction memo..."
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                data-testid="input-memo"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-red-500">
                <AlertTriangle className="h-4 w-4" />
                {error}
              </div>
            )}
          </div>
        ) : step === "success" ? (
          <div className="py-8 text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-500" />
            <div>
              <p className="font-medium text-foreground">Transaction Confirmed</p>
              <p className="text-sm text-muted-foreground mt-1">
                Successfully sent {amount} SOL
              </p>
            </div>
            <div className="bg-muted/50 rounded-md p-3">
              <p className="text-xs text-muted-foreground mb-1">Transaction Signature</p>
              <a
                href={`https://solscan.io/tx/${txSignature}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-primary hover:underline"
                data-testid="link-tx-signature"
              >
                {shortenSignature(txSignature)}
              </a>
            </div>
          </div>
        ) : step === "error" ? (
          <div className="py-8 text-center space-y-4">
            <AlertTriangle className="h-12 w-12 mx-auto text-red-500" />
            <div>
              <p className="font-medium text-foreground">Transaction Failed</p>
              <p className="text-sm text-red-500 mt-1">{error}</p>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center space-y-4">
            <Loader2 className="h-12 w-12 mx-auto animate-spin text-primary" />
            <div>
              <p className="font-medium text-foreground">
                {step === "preparing" && "Preparing transaction..."}
                {step === "signing" && "Please sign in your wallet..."}
                {step === "broadcasting" && "Broadcasting to network..."}
                {step === "confirming" && "Confirming transaction..."}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {step === "signing" && "Check your Phantom wallet for the signature request"}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === "input" && connected && (
            <>
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel-tx">
                Cancel
              </Button>
              <Button onClick={executeTransaction} data-testid="button-execute-tx">
                <Send className="h-4 w-4 mr-2" />
                Send Transaction
              </Button>
            </>
          )}
          {(step === "success" || step === "error") && (
            <Button onClick={handleClose} data-testid="button-close-tx">
              Close
            </Button>
          )}
          {step === "error" && (
            <Button variant="outline" onClick={resetForm} data-testid="button-retry-tx">
              Try Again
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
