import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import {
  LayoutDashboard,
  Bot,
  Network,
  Activity,
  BarChart3,
  Shield,
  Settings,
  Coins,
  Lock,
  Landmark,
} from "lucide-react";
import { SiX, SiGithub } from "react-icons/si";
import { Button } from "@/components/ui/button";
import logoUrl from "@assets/Desain_tanpa_judul_(12)_1766737921431.png";

const navigationItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Agents",
    url: "/agents",
    icon: Bot,
  },
  {
    title: "Meme Coins",
    url: "/meme-coins",
    icon: Coins,
  },
  {
    title: "Lending",
    url: "/lending",
    icon: Landmark,
  },
  {
    title: "Fleet",
    url: "/fleet",
    icon: Network,
  },
  {
    title: "Transactions",
    url: "/transactions",
    icon: Activity,
  },
  {
    title: "Analytics",
    url: "/analytics",
    icon: BarChart3,
  },
  {
    title: "ZK Proofs",
    url: "/proofs",
    icon: Shield,
  },
  {
    title: "Privacy",
    url: "/privacy",
    icon: Lock,
  },
];

const settingsItems = [
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3">
          <img
            src={logoUrl}
            alt="Pandora OS"
            className="h-10 w-10"
          />
          <div className="flex flex-col">
            <span className="text-lg font-semibold text-foreground" data-testid="text-app-name">
              Pandora OS
            </span>
            <span className="text-xs text-muted-foreground">
              AI Autonomous Agents
            </span>
          </div>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigationItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>System</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {settingsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url} data-testid={`link-nav-${item.title.toLowerCase()}`}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4">
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid="link-social-x"
          >
            <a href="https://x.com/pandoraos_xyz" target="_blank" rel="noopener noreferrer">
              <SiX className="h-4 w-4" />
            </a>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            asChild
            data-testid="link-social-github"
          >
            <a href="https://github.com/PandoraOSgit" target="_blank" rel="noopener noreferrer">
              <SiGithub className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
