import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRightLeft,
  Send,
  Coins,
  ArrowUpCircle,
  ArrowDownCircle,
  ExternalLink,
  Copy,
  Check,
} from "lucide-react";
import type { Transaction } from "@shared/schema";
import { useState } from "react";

interface TransactionItemProps {
  transaction: Transaction;
  agentName?: string;
}

const typeIcons: Record<string, typeof ArrowRightLeft> = {
  swap: ArrowRightLeft,
  transfer: Send,
  stake: Coins,
  unstake: Coins,
  lend: ArrowUpCircle,
  borrow: ArrowDownCircle,
  repay: ArrowUpCircle,
  withdraw: ArrowDownCircle,
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  confirmed: "bg-green-500/20 text-green-500 dark:text-green-400",
  failed: "bg-red-500/20 text-red-500 dark:text-red-400",
};

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function truncateSignature(sig: string): string {
  if (sig.length <= 16) return sig;
  return `${sig.slice(0, 8)}...${sig.slice(-8)}`;
}

export function TransactionItem({ transaction, agentName }: TransactionItemProps) {
  const [copied, setCopied] = useState(false);
  const Icon = typeIcons[transaction.type] || ArrowRightLeft;
  const createdAt = new Date(transaction.createdAt);

  const copySignature = async () => {
    await navigator.clipboard.writeText(transaction.signature);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openExplorer = () => {
    window.open(
      `https://solscan.io/tx/${transaction.signature}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div
      className="flex items-center gap-4 p-4 border-b border-border/50 last:border-b-0 hover-elevate active-elevate-2 rounded-md"
      data-testid={`transaction-item-${transaction.id}`}
    >
      <div className="flex-shrink-0 flex flex-col items-center gap-1 w-20">
        <span className="text-xs text-muted-foreground">
          {formatTimeAgo(createdAt)}
        </span>
        {transaction.blockNumber && (
          <span className="text-xs font-mono text-muted-foreground">
            #{transaction.blockNumber.toLocaleString()}
          </span>
        )}
      </div>

      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10">
        <Icon className="h-5 w-5 text-primary" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium capitalize text-foreground">
            {transaction.type}
          </span>
          {agentName && (
            <span className="text-xs text-muted-foreground">
              by {agentName}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground truncate">
          {transaction.description || 
            (transaction.fromToken && transaction.toToken
              ? `${transaction.fromToken} to ${transaction.toToken}`
              : "Transaction executed")}
        </p>
        {transaction.amount && (
          <p className="text-sm font-mono text-foreground">
            {transaction.amount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
            {transaction.fee && (
              <span className="text-muted-foreground ml-2">
                (fee: {transaction.fee.toFixed(6)} SOL)
              </span>
            )}
          </p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Badge className={statusColors[transaction.status] || statusColors.pending}>
          {transaction.status === "pending" && (
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 mr-1.5 animate-pulse" />
          )}
          {transaction.status}
        </Badge>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <code className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
          {truncateSignature(transaction.signature)}
        </code>
        <Button
          variant="ghost"
          size="icon"
          onClick={copySignature}
          data-testid={`button-copy-sig-${transaction.id}`}
        >
          {copied ? (
            <Check className="h-3 w-3 text-green-500" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={openExplorer}
          data-testid={`button-explorer-${transaction.id}`}
        >
          <ExternalLink className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
