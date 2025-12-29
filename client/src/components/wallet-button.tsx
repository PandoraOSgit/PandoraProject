import { useWallet } from "@/contexts/wallet-context";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut, Copy, Check, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

export function WalletButton() {
  const { connected, connecting, publicKey, balance, connect, disconnect, refreshBalance, error } = useWallet();
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();
  const lastError = useRef<string | null>(null);

  useEffect(() => {
    if (error && error !== lastError.current) {
      lastError.current = error;
      toast({
        title: "Wallet Error",
        description: error,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast({
        title: "Address copied",
        description: "Wallet address copied to clipboard",
      });
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  if (!connected) {
    return (
      <Button
        onClick={connect}
        disabled={connecting}
        variant="default"
        className="gap-2"
        data-testid="button-connect-wallet"
      >
        <Wallet className="h-4 w-4" />
        {connecting ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="gap-2 font-mono"
          data-testid="button-wallet-menu"
        >
          <Wallet className="h-4 w-4" />
          <span>{shortenAddress(publicKey || "")}</span>
          {balance !== null && (
            <span className="text-muted-foreground">
              ({balance.toFixed(2)} SOL)
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5">
          <p className="text-sm font-medium">Connected Wallet</p>
          <p className="text-xs font-mono text-muted-foreground truncate">
            {publicKey}
          </p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress} data-testid="menu-copy-address">
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          {copied ? "Copied!" : "Copy Address"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={refreshBalance} data-testid="menu-refresh-balance">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Balance
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} data-testid="menu-disconnect">
          <LogOut className="mr-2 h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
