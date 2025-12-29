import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { FleetCard } from "@/components/fleet-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Network, Plus, Search, Loader2, Bot, Activity } from "lucide-react";
import type { Fleet, Agent } from "@shared/schema";

const createFleetSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  strategy: z.string().max(2000).optional(),
});

type CreateFleetFormData = z.infer<typeof createFleetSchema>;

function FleetCardSkeleton() {
  return (
    <Card className="backdrop-blur-xl border-border/50">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          </div>
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-6 w-20" />
            </div>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-md" />
      </div>
    </Card>
  );
}

export default function FleetPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const form = useForm<CreateFleetFormData>({
    resolver: zodResolver(createFleetSchema),
    defaultValues: {
      name: "",
      description: "",
      strategy: "",
    },
  });

  const { data: fleets, isLoading } = useQuery<Fleet[]>({
    queryKey: ["/api/fleets"],
  });

  const { data: agents } = useQuery<Agent[]>({
    queryKey: ["/api/agents"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateFleetFormData) => {
      return apiRequest("POST", "/api/fleets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "Fleet created",
        description: "Your new fleet has been created successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create fleet. Please try again.",
        variant: "destructive",
      });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (fleet: Fleet) => {
      const newStatus = fleet.status === "running" ? "paused" : "running";
      return apiRequest("PATCH", `/api/fleets/${fleet.id}`, { status: newStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/fleets"] });
      toast({
        title: "Fleet updated",
        description: "Fleet status has been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update fleet status.",
        variant: "destructive",
      });
    },
  });

  const filteredFleets = fleets?.filter((fleet) =>
    fleet.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fleet.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalAgents = agents?.length || 0;
  const fleetsWithAgents = fleets?.filter((f) => f.agentCount > 0).length || 0;
  const totalVolume = fleets?.reduce((sum, f) => sum + f.totalVolume, 0) || 0;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-fleet-title">
            Fleet Management
          </h1>
          <p className="text-muted-foreground">
            Coordinate swarms of agents for complex workflows
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-create-fleet">
          <Plus className="h-4 w-4 mr-2" />
          Create Fleet
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Fleets</span>
            <Network className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fleets?.length || 0}</div>
            <p className="text-xs text-muted-foreground">{fleetsWithAgents} active</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Total Agents</span>
            <Bot className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAgents}</div>
            <p className="text-xs text-muted-foreground">across all fleets</p>
          </CardContent>
        </Card>
        <Card className="backdrop-blur-xl border-border/50">
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0 pb-2">
            <span className="text-sm font-medium text-muted-foreground">Combined Volume</span>
            <Activity className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">
              ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <p className="text-xs text-muted-foreground">total traded</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search fleets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-fleets"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <FleetCardSkeleton key={i} />
          ))}
        </div>
      ) : !filteredFleets || filteredFleets.length === 0 ? (
        <Card className="backdrop-blur-xl border-border/50">
          <EmptyState
            icon={<Network className="h-8 w-8" />}
            title={searchQuery ? "No matching fleets" : "No fleets yet"}
            description={
              searchQuery
                ? "Try adjusting your search to find fleets"
                : "Create agent fleets to coordinate multiple agents for complex workflows and swarm intelligence"
            }
            actionLabel={!searchQuery ? "Create Fleet" : undefined}
            onAction={() => setDialogOpen(true)}
            testId="empty-fleets"
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredFleets.map((fleet) => (
            <FleetCard
              key={fleet.id}
              fleet={fleet}
              onToggle={(f) => toggleMutation.mutate(f)}
            />
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Create New Fleet
            </DialogTitle>
            <DialogDescription>
              Create an agent fleet to coordinate multiple agents for complex workflows.
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Alpha Trading Fleet"
                        {...field}
                        data-testid="input-fleet-name"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Brief description of this fleet's purpose"
                        {...field}
                        data-testid="input-fleet-description"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="strategy"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Coordination Strategy (Optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe how agents in this fleet should coordinate..."
                        className="resize-none"
                        rows={3}
                        {...field}
                        data-testid="textarea-fleet-strategy"
                      />
                    </FormControl>
                    <FormDescription>
                      Define the coordination strategy for agents in this fleet
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-fleet"
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending} data-testid="button-submit-fleet">
                  {createMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Fleet"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
