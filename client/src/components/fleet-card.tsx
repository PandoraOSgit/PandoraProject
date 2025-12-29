import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Network, Bot, Play, Pause, Settings, Eye } from "lucide-react";
import type { Fleet } from "@shared/schema";

interface FleetCardProps {
  fleet: Fleet;
  onView?: (fleet: Fleet) => void;
  onToggle?: (fleet: Fleet) => void;
  onSettings?: (fleet: Fleet) => void;
}

const statusColors: Record<string, string> = {
  idle: "bg-muted text-muted-foreground",
  running: "bg-green-500/20 text-green-500 dark:text-green-400",
  paused: "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400",
  error: "bg-red-500/20 text-red-500 dark:text-red-400",
};

export function FleetCard({ fleet, onView, onToggle, onSettings }: FleetCardProps) {
  const isRunning = fleet.status === "running";

  return (
    <Card className="relative overflow-visible backdrop-blur-xl border-border/50" data-testid={`card-fleet-${fleet.id}`}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Network className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-semibold text-foreground truncate" data-testid={`text-fleet-name-${fleet.id}`}>
              {fleet.name}
            </span>
            <span className="text-xs text-muted-foreground truncate">
              {fleet.description || "Agent fleet"}
            </span>
          </div>
        </div>
        <Badge className={statusColors[fleet.status] || statusColors.idle}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${isRunning ? "bg-green-500 animate-pulse" : ""}`} />
          {fleet.status}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Agents</p>
            <p className="text-lg font-semibold flex items-center gap-1" data-testid={`text-fleet-agents-${fleet.id}`}>
              <Bot className="h-4 w-4 text-muted-foreground" />
              {fleet.agentCount}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Total Volume</p>
            <p className="text-lg font-semibold font-mono" data-testid={`text-fleet-volume-${fleet.id}`}>
              ${fleet.totalVolume.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>

        {fleet.strategy && (
          <div className="p-3 rounded-md bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Strategy</p>
            <p className="text-sm text-foreground line-clamp-2">{fleet.strategy}</p>
          </div>
        )}
      </CardContent>

      <CardFooter className="flex items-center justify-between gap-2 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggle?.(fleet)}
          data-testid={`button-toggle-fleet-${fleet.id}`}
        >
          {isRunning ? (
            <>
              <Pause className="h-4 w-4 mr-1" />
              Pause All
            </>
          ) : (
            <>
              <Play className="h-4 w-4 mr-1" />
              Start All
            </>
          )}
        </Button>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onSettings?.(fleet)}
            data-testid={`button-settings-fleet-${fleet.id}`}
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onView?.(fleet)}
            data-testid={`button-view-fleet-${fleet.id}`}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
