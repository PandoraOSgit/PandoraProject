import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pause, Play, Settings, Eye, TrendingUp, TrendingDown, Activity, Send, Brain, Wallet, Zap, Coins } from "lucide-react";
import type { Agent } from "@shared/schema";

const aiProviderLabels: Record<string, string> = {
  openai: "GPT-4o",
  gemini: "Gemini",
  anthropic: "Claude",
};

const aiProviderColors: Record<string, string> = {
  openai: "bg-emerald-500/20 text-emerald-500 dark:bg-emerald-500/20 dark:text-emerald-400",
  gemini: "bg-blue-500/20 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400",
  anthropic: "bg-orange-500/20 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400",
};

interface AgentCardProps {
  agent: Agent;
  onView?: (agent: Agent) => void;
  onToggle?: (agent: Agent) => void;
  onSettings?: (agent: Agent) => void;
  onExecute?: (agent: Agent) => void;
  onAnalyze?: (agent: Agent) => void;
  onWallet?: (agent: Agent) => void;
  onMemeTrade?: (agent: Agent) => void;
}

const statusColors: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-500 dark:bg-green-500/20 dark:text-green-400",
  paused: "bg-yellow-500/20 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400",
  error: "bg-red-500/20 text-red-500 dark:bg-red-500/20 dark:text-red-400",
  completed: "bg-blue-500/20 text-blue-500 dark:bg-blue-500/20 dark:text-blue-400",
};

const typeColors: Record<string, string> = {
  trading: "bg-purple-500/20 text-purple-500 dark:bg-purple-500/20 dark:text-purple-400",
  staking: "bg-cyan-500/20 text-cyan-500 dark:bg-cyan-500/20 dark:text-cyan-400",
  lending: "bg-orange-500/20 text-orange-500 dark:bg-orange-500/20 dark:text-orange-400",
  hedging: "bg-pink-500/20 text-pink-500 dark:bg-pink-500/20 dark:text-pink-400",
  custom: "bg-gray-500/20 text-gray-500 dark:bg-gray-500/20 dark:text-gray-400",
};

function generateGradientFromId(id: number): string {
  const hue1 = (id * 137) % 360;
  const hue2 = (hue1 + 40) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 60%), hsl(${hue2}, 70%, 50%))`;
}

export function AgentCard({ agent, onView, onToggle, onSettings, onExecute, onAnalyze, onWallet, onMemeTrade }: AgentCardProps) {
  const isRunning = agent.status === "running";
  const isProfitable = agent.profitLoss >= 0;
  const hasWallet = !!agent.walletAddress && !!agent.encryptedPrivateKey;
  const isAutonomous = isRunning && hasWallet;

  return (
    <Card className="relative backdrop-blur-xl border-border/50" data-testid={`card-agent-${agent.id}`}>
      {isAutonomous && (
        <div className="absolute top-2 right-2 z-10">
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 border border-green-500/30">
                <Zap className="h-3 w-3 text-green-500 animate-pulse" />
                <span className="text-xs font-medium text-green-500">AUTO</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <p>Agent is trading autonomously every 60 seconds</p>
            </TooltipContent>
          </Tooltip>
        </div>
      )}
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div
              className="h-10 w-10 rounded-full flex-shrink-0"
              style={{ background: generateGradientFromId(agent.id) }}
            />
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-foreground truncate" data-testid={`text-agent-name-${agent.id}`}>
                {agent.name}
              </span>
              <span className="text-xs text-muted-foreground truncate">
                {agent.description || "No description"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end mt-6">
            <Badge className={aiProviderColors[agent.aiProvider] || aiProviderColors.openai} variant="secondary">
              <Brain className="h-3 w-3 mr-1" />
              {aiProviderLabels[agent.aiProvider] || "AI"}
            </Badge>
            <Badge className={typeColors[agent.type] || typeColors.custom} variant="secondary">
              {agent.type}
            </Badge>
            <Badge className={statusColors[agent.status] || statusColors.idle} variant="secondary">
              <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isRunning ? "bg-green-500 animate-pulse" : ""}`} />
              {agent.status}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Transactions</p>
            <p className="text-lg font-semibold flex items-center gap-1" data-testid={`text-agent-txns-${agent.id}`}>
              <Activity className="h-4 w-4 text-muted-foreground" />
              {agent.totalTransactions.toLocaleString()}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Success Rate</p>
            <p className="text-lg font-semibold" data-testid={`text-agent-success-${agent.id}`}>
              {(agent.successRate * 100).toFixed(1)}%
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Volume</p>
            <p className="text-lg font-semibold font-mono" data-testid={`text-agent-volume-${agent.id}`}>
              ${agent.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">P/L</p>
            <p
              className={`text-lg font-semibold font-mono flex items-center gap-1 ${
                isProfitable ? "text-green-500" : "text-red-500"
              }`}
              data-testid={`text-agent-pnl-${agent.id}`}
            >
              {isProfitable ? (
                <TrendingUp className="h-4 w-4" />
              ) : (
                <TrendingDown className="h-4 w-4" />
              )}
              {isProfitable ? "+" : ""}
              ${agent.profitLoss.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {agent.goal && (
          <div className="p-3 rounded-md bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Goal</p>
            <p className="text-sm text-foreground line-clamp-2">{agent.goal}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex flex-wrap items-center justify-between gap-2 pt-2">
        <div className="flex items-center gap-1 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggle?.(agent)}
            data-testid={`button-toggle-agent-${agent.id}`}
          >
            {isRunning ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onAnalyze?.(agent)}
            data-testid={`button-analyze-agent-${agent.id}`}
          >
            <Brain className="h-4 w-4 mr-1" />
            Analyze
          </Button>
          <Button
            size="sm"
            onClick={() => onExecute?.(agent)}
            data-testid={`button-execute-agent-${agent.id}`}
          >
            <Send className="h-4 w-4 mr-1" />
            Execute
          </Button>
          {agent.type === "trading" && hasWallet && (
            <Button
              size="sm"
              variant="outline"
              className="border-purple-500/50 text-purple-400"
              onClick={() => onMemeTrade?.(agent)}
              data-testid={`button-meme-trade-agent-${agent.id}`}
            >
              <Coins className="h-4 w-4 mr-1" />
              Meme Trade
            </Button>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onWallet?.(agent)}
            data-testid={`button-wallet-agent-${agent.id}`}
          >
            <Wallet className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSettings?.(agent)}
            data-testid={`button-settings-agent-${agent.id}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView?.(agent)}
            data-testid={`button-view-agent-${agent.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
