import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: number;
  changeLabel?: string;
  icon?: React.ReactNode;
  trend?: "up" | "down" | "neutral";
  testId?: string;
}

export function StatsCard({
  title,
  value,
  change,
  changeLabel,
  icon,
  trend,
  testId,
}: StatsCardProps) {
  const getTrendColor = () => {
    if (trend === "up") return "text-green-500";
    if (trend === "down") return "text-red-500";
    return "text-muted-foreground";
  };

  const getTrendIcon = () => {
    if (trend === "up") return <TrendingUp className="h-3 w-3" />;
    if (trend === "down") return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  return (
    <Card className="backdrop-blur-xl border-border/50" data-testid={testId}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        {icon && (
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {(change !== undefined || changeLabel) && (
          <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor()}`}>
            {trend && getTrendIcon()}
            {change !== undefined && (
              <span>
                {change >= 0 ? "+" : ""}
                {change.toFixed(1)}%
              </span>
            )}
            {changeLabel && (
              <span className="text-muted-foreground ml-1">{changeLabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
