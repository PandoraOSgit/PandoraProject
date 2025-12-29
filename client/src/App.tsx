import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/lib/theme";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { WalletProvider } from "@/contexts/wallet-context";
import { WalletButton } from "@/components/wallet-button";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import AgentsPage from "@/pages/agents";
import FleetPage from "@/pages/fleet";
import TransactionsPage from "@/pages/transactions";
import AnalyticsPage from "@/pages/analytics";
import ProofsPage from "@/pages/proofs";
import SettingsPage from "@/pages/settings";
import MemeCoinsPage from "@/pages/meme-coins";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/agents" component={AgentsPage} />
      <Route path="/meme-coins" component={MemeCoinsPage} />
      <Route path="/fleet" component={FleetPage} />
      <Route path="/transactions" component={TransactionsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/proofs" component={ProofsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WalletProvider>
          <TooltipProvider>
            <SidebarProvider style={style as React.CSSProperties}>
              <div className="flex h-screen w-full">
                <AppSidebar />
                <div className="flex flex-col flex-1 overflow-hidden">
                  <header className="flex items-center justify-between gap-4 p-3 border-b border-border/50 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <div className="flex items-center gap-2">
                      <WalletButton />
                      <ThemeToggle />
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
            <Toaster />
          </TooltipProvider>
        </WalletProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
