import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "@/lib/theme";
import { useState } from "react";
import {
  Settings,
  Moon,
  Sun,
  Wallet,
  Bell,
  Shield,
  Zap,
  ExternalLink,
} from "lucide-react";

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  const [notifications, setNotifications] = useState(true);
  const [autoExecute, setAutoExecute] = useState(false);
  const [zkPrivacy, setZkPrivacy] = useState(true);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground" data-testid="text-settings-title">
          Settings
        </h1>
        <p className="text-muted-foreground">
          Configure your Pandora OS preferences
        </p>
      </div>

      <div className="space-y-6">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Customize how Pandora OS looks and feels
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme-toggle">Dark Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Switch between light and dark themes
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch
                  id="theme-toggle"
                  checked={theme === "dark"}
                  onCheckedChange={toggleTheme}
                  data-testid="switch-theme"
                />
                <Moon className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Wallet Connection
            </CardTitle>
            <CardDescription>
              Connect your Solana wallet for on-chain operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 rounded-md bg-muted/50 border border-border/50">
              <p className="text-sm text-muted-foreground mb-3">
                Connect a Solana wallet to enable real on-chain transactions for your agents.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="gap-2" data-testid="button-connect-phantom">
                  <img
                    src="https://phantom.app/img/phantom-logo.svg"
                    alt="Phantom"
                    className="h-4 w-4"
                  />
                  Phantom
                </Button>
                <Button variant="outline" className="gap-2" data-testid="button-connect-solflare">
                  Solflare
                </Button>
                <Button variant="outline" className="gap-2" data-testid="button-connect-backpack">
                  Backpack
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
            <CardDescription>
              Configure alert preferences for agent activities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="notifications">Transaction Alerts</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified when agents execute transactions
                </p>
              </div>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={setNotifications}
                data-testid="switch-notifications"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              Agent Execution
            </CardTitle>
            <CardDescription>
              Control how agents execute operations
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="auto-execute">Auto-Execute</Label>
                <p className="text-sm text-muted-foreground">
                  Allow agents to execute transactions without manual approval
                </p>
              </div>
              <Switch
                id="auto-execute"
                checked={autoExecute}
                onCheckedChange={setAutoExecute}
                data-testid="switch-auto-execute"
              />
            </div>
            {autoExecute && (
              <div className="p-3 rounded-md bg-yellow-500/10 border border-yellow-500/30">
                <p className="text-sm text-yellow-600 dark:text-yellow-400">
                  Warning: Enabling auto-execute allows agents to make transactions without
                  your confirmation. Use with caution on mainnet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              ZK proof and privacy settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="zk-privacy">ZK Privacy Mode</Label>
                <p className="text-sm text-muted-foreground">
                  Enable zero-knowledge proofs for all agent operations
                </p>
              </div>
              <Switch
                id="zk-privacy"
                checked={zkPrivacy}
                onCheckedChange={setZkPrivacy}
                data-testid="switch-zk-privacy"
              />
            </div>

            <Separator />

            <div className="p-4 rounded-md bg-primary/5 border border-primary/20">
              <div className="flex items-start gap-3">
                <Shield className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium text-foreground">Privacy Protected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Your sensitive data including balances, strategies, and AI decisions
                    are protected using zero-knowledge proofs. Only succinct cryptographic
                    proofs are shared on-chain.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader>
            <CardTitle>Resources</CardTitle>
            <CardDescription>
              Documentation and support
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start gap-2" asChild>
              <a
                href="https://solana.com/docs"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-solana-docs"
              >
                <ExternalLink className="h-4 w-4" />
                Solana Documentation
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" asChild>
              <a
                href="https://docs.ezkl.xyz"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-ezkl-docs"
              >
                <ExternalLink className="h-4 w-4" />
                EZKL Documentation (zkML)
              </a>
            </Button>
            <Button variant="ghost" className="w-full justify-start gap-2" asChild>
              <a
                href="https://solscan.io"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-solscan"
              >
                <ExternalLink className="h-4 w-4" />
                Solscan Explorer
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
