import { sql } from "drizzle-orm";
import { pgTable, text, varchar, serial, integer, timestamp, boolean, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// Re-export chat models
export * from "./models/chat";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  walletAddress: text("wallet_address"),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Agent status enum values
export const agentStatusValues = ["idle", "running", "paused", "error", "completed"] as const;
export type AgentStatus = typeof agentStatusValues[number];

// Agent type enum values  
export const agentTypeValues = ["trading", "staking", "lending", "hedging", "custom"] as const;
export type AgentType = typeof agentTypeValues[number];

// AI provider enum values
export const aiProviderValues = ["openai", "anthropic", "gemini"] as const;
export type AIProvider = typeof aiProviderValues[number];

// Agents table - Autonomous AI agents
export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type").notNull().default("custom"),
  status: text("status").notNull().default("idle"),
  aiProvider: text("ai_provider").notNull().default("openai"),
  ownerWallet: text("owner_wallet"),
  walletAddress: text("wallet_address"),
  encryptedPrivateKey: text("encrypted_private_key"),
  walletBalance: real("wallet_balance").notNull().default(0),
  spendingLimit: real("spending_limit").notNull().default(1),
  dailySpent: real("daily_spent").notNull().default(0),
  lastSpendingReset: timestamp("last_spending_reset"),
  goal: text("goal").notNull(),
  strategy: text("strategy"),
  prompt: text("prompt"),
  parameters: jsonb("parameters").$type<Record<string, unknown>>().default({}),
  totalTransactions: integer("total_transactions").notNull().default(0),
  successRate: real("success_rate").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  profitLoss: real("profit_loss").notNull().default(0),
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  fleetId: integer("fleet_id"),
});

export const agentsRelations = relations(agents, ({ one, many }) => ({
  fleet: one(fleets, {
    fields: [agents.fleetId],
    references: [fleets.id],
  }),
  transactions: many(transactions),
  zkProofs: many(zkProofs),
}));

export const insertAgentSchema = createInsertSchema(agents).omit({
  id: true,
  createdAt: true,
  encryptedPrivateKey: true,
  walletBalance: true,
  dailySpent: true,
  lastSpendingReset: true,
  totalTransactions: true,
  successRate: true,
  totalVolume: true,
  profitLoss: true,
  lastActiveAt: true,
});

export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;

// Fleets table - Groups of coordinated agents
export const fleets = pgTable("fleets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  strategy: text("strategy"),
  status: text("status").notNull().default("idle"),
  agentCount: integer("agent_count").notNull().default(0),
  totalVolume: real("total_volume").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const fleetsRelations = relations(fleets, ({ many }) => ({
  agents: many(agents),
}));

export const insertFleetSchema = createInsertSchema(fleets).omit({
  id: true,
  createdAt: true,
  agentCount: true,
  totalVolume: true,
});

export type InsertFleet = z.infer<typeof insertFleetSchema>;
export type Fleet = typeof fleets.$inferSelect;

// Transaction type enum
export const transactionTypeValues = ["swap", "transfer", "stake", "unstake", "lend", "borrow", "repay", "withdraw"] as const;
export type TransactionType = typeof transactionTypeValues[number];

// Transaction status enum
export const transactionStatusValues = ["pending", "confirmed", "failed"] as const;
export type TransactionStatus = typeof transactionStatusValues[number];

// Transactions table - On-chain agent actions
export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  signature: text("signature").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull().default("pending"),
  fromToken: text("from_token"),
  toToken: text("to_token"),
  amount: real("amount"),
  fee: real("fee"),
  blockNumber: integer("block_number"),
  description: text("description"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export const transactionsRelations = relations(transactions, ({ one }) => ({
  agent: one(agents, {
    fields: [transactions.agentId],
    references: [agents.id],
  }),
}));

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
});

export type InsertTransaction = z.infer<typeof insertTransactionSchema>;
export type Transaction = typeof transactions.$inferSelect;

// ZK Proofs table - Privacy-preserving proofs
export const zkProofs = pgTable("zk_proofs", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  proofType: text("proof_type").notNull(),
  proofData: text("proof_data").notNull(),
  publicInputs: jsonb("public_inputs").$type<string[]>().default([]),
  verified: boolean("verified").notNull().default(false),
  verificationTime: integer("verification_time"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const zkProofsRelations = relations(zkProofs, ({ one }) => ({
  agent: one(agents, {
    fields: [zkProofs.agentId],
    references: [agents.id],
  }),
  transaction: one(transactions, {
    fields: [zkProofs.transactionId],
    references: [transactions.id],
  }),
}));

export const insertZkProofSchema = createInsertSchema(zkProofs).omit({
  id: true,
  createdAt: true,
});

export type InsertZkProof = z.infer<typeof insertZkProofSchema>;
export type ZkProof = typeof zkProofs.$inferSelect;

// Agent decision logs - AI decision history
export const agentDecisions = pgTable("agent_decisions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  decision: text("decision").notNull(),
  reasoning: text("reasoning"),
  confidence: real("confidence"),
  actionTaken: text("action_taken"),
  outcome: text("outcome"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agentDecisionsRelations = relations(agentDecisions, ({ one }) => ({
  agent: one(agents, {
    fields: [agentDecisions.agentId],
    references: [agents.id],
  }),
}));

export const insertAgentDecisionSchema = createInsertSchema(agentDecisions).omit({
  id: true,
  createdAt: true,
});

export type InsertAgentDecision = z.infer<typeof insertAgentDecisionSchema>;
export type AgentDecision = typeof agentDecisions.$inferSelect;
