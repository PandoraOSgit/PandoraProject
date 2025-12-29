import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Loader2, Bot, Sparkles, Settings2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useWallet } from "@/contexts/wallet-context";
import { useToast } from "@/hooks/use-toast";
import type { Agent } from "@shared/schema";

const manualCreateSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  type: z.enum(["trading", "staking", "lending", "hedging", "custom"]),
  aiProvider: z.enum(["openai", "gemini", "anthropic"]),
  goal: z.string().min(1, "Goal is required").max(1000),
  strategy: z.string().max(2000).optional(),
});

const aiGenerateSchema = z.object({
  prompt: z.string().min(10, "Please describe what you want the agent to do (at least 10 characters)").max(500),
  aiProvider: z.enum(["openai", "gemini", "anthropic"]),
});

type ManualFormData = z.infer<typeof manualCreateSchema>;
type AIGenerateFormData = z.infer<typeof aiGenerateSchema>;

interface CreateAgentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: Partial<Agent>) => Promise<void>;
  isLoading?: boolean;
}

export function CreateAgentDialog({
  open,
  onOpenChange,
  onSubmit,
  isLoading,
}: CreateAgentDialogProps) {
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const manualForm = useForm<ManualFormData>({
    resolver: zodResolver(manualCreateSchema),
    defaultValues: {
      name: "",
      description: "",
      type: "trading",
      aiProvider: "openai",
      goal: "",
      strategy: "",
    },
  });

  const aiForm = useForm<AIGenerateFormData>({
    resolver: zodResolver(aiGenerateSchema),
    defaultValues: {
      prompt: "",
      aiProvider: "openai",
    },
  });

  const generateMutation = useMutation({
    mutationFn: async (data: AIGenerateFormData) => {
      const response = await apiRequest("POST", "/api/agents/generate", {
        prompt: data.prompt,
        aiProvider: data.aiProvider,
        ownerWallet: publicKey,
      });
      return response.json() as Promise<Agent>;
    },
    onSuccess: (agent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents", publicKey] });
      aiForm.reset();
      onOpenChange(false);
      toast({
        title: "Agent Created",
        description: `${agent.name} is ready to operate.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate agent. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleManualSubmit = async (data: ManualFormData) => {
    await onSubmit(data);
    manualForm.reset();
  };

  const handleAISubmit = (data: AIGenerateFormData) => {
    generateMutation.mutate(data);
  };

  const getProviderLabel = (provider: string) => {
    switch (provider) {
      case "openai": return "GPT-4o";
      case "gemini": return "Gemini 2.5";
      case "anthropic": return "Claude Sonnet";
      default: return provider;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Create New Agent
          </DialogTitle>
          <DialogDescription>
            Configure an AI-powered autonomous agent to operate on Solana mainnet.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "ai" | "manual")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai-create">
              <Sparkles className="h-4 w-4" />
              AI Generate
            </TabsTrigger>
            <TabsTrigger value="manual" className="flex items-center gap-2" data-testid="tab-manual-create">
              <Settings2 className="h-4 w-4" />
              Manual
            </TabsTrigger>
          </TabsList>

          <TabsContent value="ai" className="mt-4">
            <Form {...aiForm}>
              <form onSubmit={aiForm.handleSubmit(handleAISubmit)} className="space-y-4">
                <FormField
                  control={aiForm.control}
                  name="prompt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>What should this agent do?</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Example: I want an aggressive meme coin trader that hunts for newly launched tokens with high volume and good liquidity. It should take calculated risks for maximum gains."
                          className="resize-none"
                          rows={4}
                          {...field}
                          data-testid="textarea-agent-prompt"
                        />
                      </FormControl>
                      <FormDescription>
                        Describe your agent in natural language - AI will generate all the details
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={aiForm.control}
                  name="aiProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Brain</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-ai-provider">
                            <SelectValue placeholder="Select AI provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="openai">{getProviderLabel("openai")}</SelectItem>
                          <SelectItem value="gemini">{getProviderLabel("gemini")}</SelectItem>
                          <SelectItem value="anthropic">{getProviderLabel("anthropic")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which AI model will power this agent's decisions
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel-agent"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={generateMutation.isPending} 
                    data-testid="button-generate-agent"
                  >
                    {generateMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Generate Agent
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="manual" className="mt-4">
            <Form {...manualForm}>
              <form onSubmit={manualForm.handleSubmit(handleManualSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={manualForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Trading Alpha"
                            {...field}
                            data-testid="input-agent-name"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={manualForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Type</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-agent-type">
                              <SelectValue placeholder="Select agent type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="trading">Trading</SelectItem>
                            <SelectItem value="staking">Staking</SelectItem>
                            <SelectItem value="lending">Lending</SelectItem>
                            <SelectItem value="hedging">Hedging</SelectItem>
                            <SelectItem value="custom">Custom</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={manualForm.control}
                  name="aiProvider"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>AI Brain</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-manual-ai-provider">
                            <SelectValue placeholder="Select AI provider" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="openai">{getProviderLabel("openai")}</SelectItem>
                          <SelectItem value="gemini">{getProviderLabel("gemini")}</SelectItem>
                          <SelectItem value="anthropic">{getProviderLabel("anthropic")}</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Choose which AI model will power this agent
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={manualForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Brief description of what this agent does"
                          {...field}
                          data-testid="input-agent-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={manualForm.control}
                  name="goal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Goal</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Maximize SOL yield by identifying high-potential meme coins"
                          className="resize-none"
                          rows={2}
                          {...field}
                          data-testid="textarea-agent-goal"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={manualForm.control}
                  name="strategy"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Monitor trending tokens, analyze liquidity and volume..."
                          className="resize-none"
                          rows={2}
                          {...field}
                          data-testid="textarea-agent-strategy"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    data-testid="button-cancel-agent-manual"
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading} data-testid="button-create-agent">
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      "Create Agent"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
