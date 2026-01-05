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
  tradeAmount: real("trade_amount").notNull().default(0.01),
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
  ownerWallet: text("owner_wallet").notNull(),
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

// Agent Holdings table - Track token positions with entry prices for P/L
export const agentHoldings = pgTable("agent_holdings", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  tokenMint: text("token_mint").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name"),
  quantity: real("quantity").notNull().default(0),
  entryPriceSol: real("entry_price_sol").notNull(),
  currentPriceSol: real("current_price_sol"),
  unrealizedPnlSol: real("unrealized_pnl_sol").default(0),
  unrealizedPnlPercent: real("unrealized_pnl_percent").default(0),
  status: text("status").notNull().default("open"),
  entryTimestamp: timestamp("entry_timestamp").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastUpdatedAt: timestamp("last_updated_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const agentHoldingsRelations = relations(agentHoldings, ({ one }) => ({
  agent: one(agents, {
    fields: [agentHoldings.agentId],
    references: [agents.id],
  }),
}));

export const insertAgentHoldingSchema = createInsertSchema(agentHoldings).omit({
  id: true,
  entryTimestamp: true,
  lastUpdatedAt: true,
});

export type InsertAgentHolding = z.infer<typeof insertAgentHoldingSchema>;
export type AgentHolding = typeof agentHoldings.$inferSelect;

// Agent Traded Token History - PERMANENT record of all tokens ever traded (NEVER deleted)
// This ensures agent never re-buys tokens that were already bought and sold
export const tradedTokenHistory = pgTable("traded_token_history", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").notNull().references(() => agents.id, { onDelete: "cascade" }),
  tokenMint: text("token_mint").notNull(),
  tokenSymbol: text("token_symbol").notNull(),
  tokenName: text("token_name"),
  firstBoughtAt: timestamp("first_bought_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  lastTradedAt: timestamp("last_traded_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  totalBuys: integer("total_buys").notNull().default(1),
  totalSells: integer("total_sells").notNull().default(0),
  totalBoughtSol: real("total_bought_sol").notNull().default(0),
  totalSoldSol: real("total_sold_sol").notNull().default(0),
  realizedPnlSol: real("realized_pnl_sol").notNull().default(0),
});

export const tradedTokenHistoryRelations = relations(tradedTokenHistory, ({ one }) => ({
  agent: one(agents, {
    fields: [tradedTokenHistory.agentId],
    references: [agents.id],
  }),
}));

export const insertTradedTokenHistorySchema = createInsertSchema(tradedTokenHistory).omit({
  id: true,
  firstBoughtAt: true,
  lastTradedAt: true,
});

export type InsertTradedTokenHistory = z.infer<typeof insertTradedTokenHistorySchema>;
export type TradedTokenHistory = typeof tradedTokenHistory.$inferSelect;

// ============================================
// ZK Privacy Layer Tables
// ============================================

// Shielded account status
export const shieldedAccountStatusValues = ["active", "inactive", "compromised"] as const;
export type ShieldedAccountStatus = typeof shieldedAccountStatusValues[number];

// Shielded Accounts - Master accounts with viewing/spending keys
export const shieldedAccounts = pgTable("shielded_accounts", {
  id: serial("id").primaryKey(),
  ownerWallet: text("owner_wallet").notNull(),
  viewingPublicKey: text("viewing_public_key").notNull(),
  spendingPublicKey: text("spending_public_key").notNull(),
  encryptedViewingPrivateKey: text("encrypted_viewing_private_key"),
  encryptedSpendingPrivateKey: text("encrypted_spending_private_key"),
  status: text("status").notNull().default("active"),
  lastScannedSlot: integer("last_scanned_slot"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const insertShieldedAccountSchema = createInsertSchema(shieldedAccounts).omit({
  id: true,
  createdAt: true,
  lastScannedSlot: true,
});

export type InsertShieldedAccount = z.infer<typeof insertShieldedAccountSchema>;
export type ShieldedAccount = typeof shieldedAccounts.$inferSelect;

// Shielded address status
export const shieldedAddressStatusValues = ["unused", "used", "expired"] as const;
export type ShieldedAddressStatus = typeof shieldedAddressStatusValues[number];

// Shielded Addresses - One-time stealth addresses derived from accounts
export const shieldedAddresses = pgTable("shielded_addresses", {
  id: serial("id").primaryKey(),
  accountId: integer("account_id").notNull().references(() => shieldedAccounts.id, { onDelete: "cascade" }),
  publicAddress: text("public_address").notNull().unique(),
  ephemeralPublicKey: text("ephemeral_public_key").notNull(),
  stealthMeta: jsonb("stealth_meta").$type<Record<string, unknown>>().default({}),
  status: text("status").notNull().default("unused"),
  onchainSignature: text("onchain_signature"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const shieldedAddressesRelations = relations(shieldedAddresses, ({ one }) => ({
  account: one(shieldedAccounts, {
    fields: [shieldedAddresses.accountId],
    references: [shieldedAccounts.id],
  }),
}));

export const insertShieldedAddressSchema = createInsertSchema(shieldedAddresses).omit({
  id: true,
  createdAt: true,
  onchainSignature: true,
});

export type InsertShieldedAddress = z.infer<typeof insertShieldedAddressSchema>;
export type ShieldedAddress = typeof shieldedAddresses.$inferSelect;

// Private payment status
export const privatePaymentStatusValues = ["pending", "confirmed", "spent", "failed"] as const;
export type PrivatePaymentStatus = typeof privatePaymentStatusValues[number];

// Private Payments - Payments with hidden amounts using commitments
export const privatePayments = pgTable("private_payments", {
  id: serial("id").primaryKey(),
  senderAccountId: integer("sender_account_id").references(() => shieldedAccounts.id, { onDelete: "set null" }),
  recipientAddressId: integer("recipient_address_id").references(() => shieldedAddresses.id, { onDelete: "set null" }),
  commitment: text("commitment").notNull(),
  nullifier: text("nullifier").unique(),
  encryptedAmount: text("encrypted_amount").notNull(),
  rangeProof: text("range_proof"),
  ciphertext: jsonb("ciphertext").$type<Record<string, unknown>>().default({}),
  status: text("status").notNull().default("pending"),
  merkleIndex: integer("merkle_index"),
  merkleRoot: text("merkle_root"),
  onchainSignature: text("onchain_signature"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  confirmedAt: timestamp("confirmed_at"),
});

export const privatePaymentsRelations = relations(privatePayments, ({ one }) => ({
  senderAccount: one(shieldedAccounts, {
    fields: [privatePayments.senderAccountId],
    references: [shieldedAccounts.id],
  }),
  recipientAddress: one(shieldedAddresses, {
    fields: [privatePayments.recipientAddressId],
    references: [shieldedAddresses.id],
  }),
}));

export const insertPrivatePaymentSchema = createInsertSchema(privatePayments).omit({
  id: true,
  createdAt: true,
  confirmedAt: true,
  onchainSignature: true,
  merkleIndex: true,
  merkleRoot: true,
});

export type InsertPrivatePayment = z.infer<typeof insertPrivatePaymentSchema>;
export type PrivatePayment = typeof privatePayments.$inferSelect;

// ZK Bundle status
export const zkBundleStatusValues = ["pending", "submitted", "confirmed", "failed"] as const;
export type ZkBundleStatus = typeof zkBundleStatusValues[number];

// ZK Bundles - Aggregated transaction bundles with Merkle proofs
export const zkBundles = pgTable("zk_bundles", {
  id: serial("id").primaryKey(),
  ownerWallet: text("owner_wallet").notNull(),
  bundleRoot: text("bundle_root").notNull(),
  aggregatedProof: text("aggregated_proof"),
  transactionCount: integer("transaction_count").notNull().default(0),
  compressionRatio: real("compression_ratio").notNull().default(1),
  gasSaved: integer("gas_saved").notNull().default(0),
  status: text("status").notNull().default("pending"),
  submittedSignature: text("submitted_signature"),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  submittedAt: timestamp("submitted_at"),
});

export const insertZkBundleSchema = createInsertSchema(zkBundles).omit({
  id: true,
  createdAt: true,
  submittedAt: true,
  submittedSignature: true,
});

export type InsertZkBundle = z.infer<typeof insertZkBundleSchema>;
export type ZkBundle = typeof zkBundles.$inferSelect;

// ZK Bundle Items - Individual transactions in a bundle
export const zkBundleItems = pgTable("zk_bundle_items", {
  id: serial("id").primaryKey(),
  bundleId: integer("bundle_id").notNull().references(() => zkBundles.id, { onDelete: "cascade" }),
  transactionId: integer("transaction_id").references(() => transactions.id, { onDelete: "set null" }),
  paymentId: integer("payment_id").references(() => privatePayments.id, { onDelete: "set null" }),
  merkleProof: jsonb("merkle_proof").$type<string[]>().default([]),
  leafIndex: integer("leaf_index").notNull(),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const zkBundleItemsRelations = relations(zkBundleItems, ({ one }) => ({
  bundle: one(zkBundles, {
    fields: [zkBundleItems.bundleId],
    references: [zkBundles.id],
  }),
  transaction: one(transactions, {
    fields: [zkBundleItems.transactionId],
    references: [transactions.id],
  }),
  payment: one(privatePayments, {
    fields: [zkBundleItems.paymentId],
    references: [privatePayments.id],
  }),
}));

export const insertZkBundleItemSchema = createInsertSchema(zkBundleItems).omit({
  id: true,
  createdAt: true,
});

export type InsertZkBundleItem = z.infer<typeof insertZkBundleItemSchema>;
export type ZkBundleItem = typeof zkBundleItems.$inferSelect;

// zkML model types
export const zkmlModelTypeValues = ["classification", "regression", "anomaly_detection", "sentiment_analysis", "price_prediction", "risk_assessment"] as const;
export type ZkmlModelType = typeof zkmlModelTypeValues[number];

// zkML Models - Zero-knowledge machine learning models
export const zkmlModels = pgTable("zkml_models", {
  id: serial("id").primaryKey(),
  ownerWallet: text("owner_wallet").notNull(),
  name: text("name").notNull(),
  modelType: text("model_type").notNull(),
  config: jsonb("config").$type<Record<string, unknown>>().default({}),
  weightsCommitment: text("weights_commitment"),
  verificationKey: text("verification_key"),
  version: text("version").notNull().default("1.0.0"),
  isActive: boolean("is_active").notNull().default(true),
  totalInferences: integer("total_inferences").notNull().default(0),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at"),
});

export const insertZkmlModelSchema = createInsertSchema(zkmlModels).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  totalInferences: true,
});

export type InsertZkmlModel = z.infer<typeof insertZkmlModelSchema>;
export type ZkmlModel = typeof zkmlModels.$inferSelect;

// zkML Inference Proofs - Verifiable inference results
export const zkmlInferenceProofs = pgTable("zkml_inference_proofs", {
  id: serial("id").primaryKey(),
  modelId: integer("model_id").notNull().references(() => zkmlModels.id, { onDelete: "cascade" }),
  inputHash: text("input_hash").notNull(),
  outputHash: text("output_hash").notNull(),
  proof: text("proof").notNull(),
  publicInputs: jsonb("public_inputs").$type<string[]>().default([]),
  verified: boolean("verified").notNull().default(false),
  verificationTime: integer("verification_time"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const zkmlInferenceProofsRelations = relations(zkmlInferenceProofs, ({ one }) => ({
  model: one(zkmlModels, {
    fields: [zkmlInferenceProofs.modelId],
    references: [zkmlModels.id],
  }),
}));

export const insertZkmlInferenceProofSchema = createInsertSchema(zkmlInferenceProofs).omit({
  id: true,
  createdAt: true,
});

export type InsertZkmlInferenceProof = z.infer<typeof insertZkmlInferenceProofSchema>;
export type ZkmlInferenceProof = typeof zkmlInferenceProofs.$inferSelect;

// Lending Protocol enum values
export const lendingProtocolValues = ["solend", "marginfi"] as const;
export type LendingProtocol = typeof lendingProtocolValues[number];

// Lending Position status enum values
export const lendingPositionStatusValues = ["active", "closed", "liquidated"] as const;
export type LendingPositionStatus = typeof lendingPositionStatusValues[number];

// Lending Positions - Track user lending/borrowing positions
export const lendingPositions = pgTable("lending_positions", {
  id: serial("id").primaryKey(),
  ownerWallet: text("owner_wallet").notNull(),
  agentId: integer("agent_id").references(() => agents.id, { onDelete: "set null" }),
  protocol: text("protocol").notNull(),
  symbol: text("symbol").notNull(),
  mint: text("mint").notNull(),
  positionType: text("position_type").notNull(), // "deposit" or "borrow"
  amount: real("amount").notNull().default(0),
  amountUSD: real("amount_usd").notNull().default(0),
  entryAPY: real("entry_apy").notNull().default(0),
  currentAPY: real("current_apy").notNull().default(0),
  earnedInterest: real("earned_interest").notNull().default(0),
  owedInterest: real("owed_interest").notNull().default(0),
  healthFactor: real("health_factor"),
  status: text("status").notNull().default("active"),
  txSignature: text("tx_signature"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: timestamp("updated_at"),
});

export const lendingPositionsRelations = relations(lendingPositions, ({ one }) => ({
  agent: one(agents, {
    fields: [lendingPositions.agentId],
    references: [agents.id],
  }),
}));

export const insertLendingPositionSchema = createInsertSchema(lendingPositions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  closedAt: true,
  earnedInterest: true,
  owedInterest: true,
});

export type InsertLendingPosition = z.infer<typeof insertLendingPositionSchema>;
export type LendingPosition = typeof lendingPositions.$inferSelect;
