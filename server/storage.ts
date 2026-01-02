import {
  type User,
  type InsertUser,
  type Agent,
  type InsertAgent,
  type Fleet,
  type InsertFleet,
  type Transaction,
  type InsertTransaction,
  type ZkProof,
  type InsertZkProof,
  type AgentDecision,
  type InsertAgentDecision,
  type AgentHolding,
  type InsertAgentHolding,
  type TradedTokenHistory,
  type InsertTradedTokenHistory,
  type ShieldedAccount,
  type InsertShieldedAccount,
  type ShieldedAddress,
  type InsertShieldedAddress,
  type PrivatePayment,
  type InsertPrivatePayment,
  type ZkBundle,
  type InsertZkBundle,
  type ZkBundleItem,
  type InsertZkBundleItem,
  type ZkmlModel,
  type InsertZkmlModel,
  type ZkmlInferenceProof,
  type InsertZkmlInferenceProof,
  users,
  agents,
  fleets,
  transactions,
  zkProofs,
  agentDecisions,
  agentHoldings,
  tradedTokenHistory,
  shieldedAccounts,
  shieldedAddresses,
  privatePayments,
  zkBundles,
  zkBundleItems,
  zkmlModels,
  zkmlInferenceProofs,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllAgents(ownerWallet?: string): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  
  getAllFleets(ownerWallet?: string): Promise<Fleet[]>;
  getFleet(id: number): Promise<Fleet | undefined>;
  createFleet(fleet: InsertFleet): Promise<Fleet>;
  updateFleet(id: number, data: Partial<Fleet>): Promise<Fleet | undefined>;
  deleteFleet(id: number): Promise<void>;
  
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByOwner(ownerWallet: string): Promise<Transaction[]>;
  getTransactionsByAgent(agentId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction | undefined>;
  
  getAllZkProofs(): Promise<ZkProof[]>;
  getZkProofsByOwner(ownerWallet: string): Promise<ZkProof[]>;
  getZkProofsByAgent(agentId: number): Promise<ZkProof[]>;
  createZkProof(proof: InsertZkProof): Promise<ZkProof>;
  updateZkProof(id: number, data: Partial<ZkProof>): Promise<ZkProof | undefined>;
  
  getDecisionsByAgent(agentId: number): Promise<AgentDecision[]>;
  createAgentDecision(decision: InsertAgentDecision): Promise<AgentDecision>;
  
  // Agent Holdings - P/L Tracking
  getAgentHoldings(agentId: number): Promise<AgentHolding[]>;
  getAgentHoldingByToken(agentId: number, tokenMint: string): Promise<AgentHolding | undefined>;
  createAgentHolding(holding: InsertAgentHolding): Promise<AgentHolding>;
  updateAgentHolding(id: number, data: Partial<AgentHolding>): Promise<AgentHolding | undefined>;
  deleteAgentHolding(id: number): Promise<void>;
  
  // Traded Token History - PERMANENT record (never deleted)
  getTradedTokenHistory(agentId: number): Promise<TradedTokenHistory[]>;
  getTradedToken(agentId: number, tokenMint: string): Promise<TradedTokenHistory | undefined>;
  hasAgentTradedToken(agentId: number, tokenMint: string): Promise<boolean>;
  recordTokenTrade(agentId: number, tokenMint: string, tokenSymbol: string, tokenName: string | null, action: "buy" | "sell", amountSol: number): Promise<TradedTokenHistory>;
  
  // Privacy Layer - Shielded Accounts
  getAllShieldedAccounts(): Promise<ShieldedAccount[]>;
  getShieldedAccountsByOwner(ownerWallet: string): Promise<ShieldedAccount[]>;
  getShieldedAccount(id: number): Promise<ShieldedAccount | undefined>;
  createShieldedAccount(account: InsertShieldedAccount): Promise<ShieldedAccount>;
  updateShieldedAccount(id: number, data: Partial<ShieldedAccount>): Promise<ShieldedAccount | undefined>;
  
  // Privacy Layer - Shielded Addresses
  getShieldedAddressesByAccount(accountId: number): Promise<ShieldedAddress[]>;
  getShieldedAddressByPublicAddress(publicAddress: string): Promise<ShieldedAddress | undefined>;
  createShieldedAddress(address: InsertShieldedAddress): Promise<ShieldedAddress>;
  updateShieldedAddress(id: number, data: Partial<ShieldedAddress>): Promise<ShieldedAddress | undefined>;
  getAllShieldedAddresses(ownerWallet?: string): Promise<ShieldedAddress[]>;
  
  // Privacy Layer - Private Payments
  getAllPrivatePayments(): Promise<PrivatePayment[]>;
  getPrivatePaymentsByStatus(status: string): Promise<PrivatePayment[]>;
  createPrivatePayment(payment: InsertPrivatePayment): Promise<PrivatePayment>;
  updatePrivatePayment(id: number, data: Partial<PrivatePayment>): Promise<PrivatePayment | undefined>;
  getPrivatePaymentByNullifier(nullifier: string): Promise<PrivatePayment | undefined>;
  
  // Privacy Layer - ZK Bundles
  getAllZkBundles(ownerWallet?: string): Promise<ZkBundle[]>;
  getZkBundle(id: number): Promise<ZkBundle | undefined>;
  createZkBundle(bundle: InsertZkBundle): Promise<ZkBundle>;
  updateZkBundle(id: number, data: Partial<ZkBundle>): Promise<ZkBundle | undefined>;
  createZkBundleItem(item: InsertZkBundleItem): Promise<ZkBundleItem>;
  getZkBundleItems(bundleId: number): Promise<ZkBundleItem[]>;
  
  // Privacy Layer - zkML Models
  getAllZkmlModels(ownerWallet?: string): Promise<ZkmlModel[]>;
  getZkmlModel(id: number): Promise<ZkmlModel | undefined>;
  createZkmlModel(model: InsertZkmlModel): Promise<ZkmlModel>;
  updateZkmlModel(id: number, data: Partial<ZkmlModel>): Promise<ZkmlModel | undefined>;
  
  // Privacy Layer - zkML Inference Proofs
  getZkmlInferenceProofsByModel(modelId: number): Promise<ZkmlInferenceProof[]>;
  createZkmlInferenceProof(proof: InsertZkmlInferenceProof): Promise<ZkmlInferenceProof>;
  updateZkmlInferenceProof(id: number, data: Partial<ZkmlInferenceProof>): Promise<ZkmlInferenceProof | undefined>;
  getAllZkmlInferenceProofs(): Promise<ZkmlInferenceProof[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getAllAgents(ownerWallet?: string): Promise<Agent[]> {
    if (ownerWallet) {
      return db.select().from(agents).where(eq(agents.ownerWallet, ownerWallet)).orderBy(desc(agents.createdAt));
    }
    return db.select().from(agents).orderBy(desc(agents.createdAt));
  }

  async getAgent(id: number): Promise<Agent | undefined> {
    const [agent] = await db.select().from(agents).where(eq(agents.id, id));
    return agent || undefined;
  }

  async createAgent(insertAgent: InsertAgent): Promise<Agent> {
    const [agent] = await db.insert(agents).values(insertAgent).returning();
    return agent;
  }

  async updateAgent(id: number, data: Partial<Agent>): Promise<Agent | undefined> {
    const [agent] = await db.update(agents).set(data).where(eq(agents.id, id)).returning();
    return agent || undefined;
  }

  async deleteAgent(id: number): Promise<void> {
    await db.delete(agents).where(eq(agents.id, id));
  }

  async getAllFleets(ownerWallet?: string): Promise<Fleet[]> {
    if (ownerWallet) {
      return db.select().from(fleets).where(eq(fleets.ownerWallet, ownerWallet)).orderBy(desc(fleets.createdAt));
    }
    return db.select().from(fleets).orderBy(desc(fleets.createdAt));
  }

  async getFleet(id: number): Promise<Fleet | undefined> {
    const [fleet] = await db.select().from(fleets).where(eq(fleets.id, id));
    return fleet || undefined;
  }

  async createFleet(insertFleet: InsertFleet): Promise<Fleet> {
    const [fleet] = await db.insert(fleets).values(insertFleet).returning();
    return fleet;
  }

  async updateFleet(id: number, data: Partial<Fleet>): Promise<Fleet | undefined> {
    const [fleet] = await db.update(fleets).set(data).where(eq(fleets.id, id)).returning();
    return fleet || undefined;
  }

  async deleteFleet(id: number): Promise<void> {
    await db.delete(fleets).where(eq(fleets.id, id));
  }

  async getAllTransactions(): Promise<Transaction[]> {
    return db.select().from(transactions).orderBy(desc(transactions.createdAt));
  }

  async getTransactionsByOwner(ownerWallet: string): Promise<Transaction[]> {
    // Get all agents owned by this wallet, then get their transactions
    const ownerAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.ownerWallet, ownerWallet));
    const agentIds = ownerAgents.map(a => a.id);
    
    if (agentIds.length === 0) {
      return [];
    }
    
    // Get transactions for all agents owned by this wallet
    const allTransactions: Transaction[] = [];
    for (const agentId of agentIds) {
      const agentTransactions = await db.select().from(transactions).where(eq(transactions.agentId, agentId));
      allTransactions.push(...agentTransactions);
    }
    
    // Sort by createdAt descending
    return allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getTransactionsByAgent(agentId: number): Promise<Transaction[]> {
    return db.select().from(transactions).where(eq(transactions.agentId, agentId)).orderBy(desc(transactions.createdAt));
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db.insert(transactions).values(insertTransaction).returning();
    return transaction;
  }

  async updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction | undefined> {
    const [transaction] = await db.update(transactions).set(data).where(eq(transactions.id, id)).returning();
    return transaction || undefined;
  }

  async getAllZkProofs(): Promise<ZkProof[]> {
    return db.select().from(zkProofs).orderBy(desc(zkProofs.createdAt));
  }

  async getZkProofsByOwner(ownerWallet: string): Promise<ZkProof[]> {
    // Get all agents owned by this wallet, then get their ZK proofs
    const ownerAgents = await db.select({ id: agents.id }).from(agents).where(eq(agents.ownerWallet, ownerWallet));
    const agentIds = ownerAgents.map(a => a.id);
    
    if (agentIds.length === 0) {
      return [];
    }
    
    // Get ZK proofs for all agents owned by this wallet
    const allProofs: ZkProof[] = [];
    for (const agentId of agentIds) {
      const agentProofs = await db.select().from(zkProofs).where(eq(zkProofs.agentId, agentId));
      allProofs.push(...agentProofs);
    }
    
    // Sort by createdAt descending
    return allProofs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getZkProofsByAgent(agentId: number): Promise<ZkProof[]> {
    return db.select().from(zkProofs).where(eq(zkProofs.agentId, agentId)).orderBy(desc(zkProofs.createdAt));
  }

  async createZkProof(insertProof: InsertZkProof): Promise<ZkProof> {
    const [proof] = await db.insert(zkProofs).values(insertProof).returning();
    return proof;
  }

  async updateZkProof(id: number, data: Partial<ZkProof>): Promise<ZkProof | undefined> {
    const [proof] = await db.update(zkProofs).set(data).where(eq(zkProofs.id, id)).returning();
    return proof || undefined;
  }

  async getDecisionsByAgent(agentId: number): Promise<AgentDecision[]> {
    return db.select().from(agentDecisions).where(eq(agentDecisions.agentId, agentId)).orderBy(desc(agentDecisions.createdAt));
  }

  async createAgentDecision(insertDecision: InsertAgentDecision): Promise<AgentDecision> {
    const [decision] = await db.insert(agentDecisions).values(insertDecision).returning();
    return decision;
  }

  // Agent Holdings - P/L Tracking
  async getAgentHoldings(agentId: number): Promise<AgentHolding[]> {
    return db.select().from(agentHoldings).where(eq(agentHoldings.agentId, agentId)).orderBy(desc(agentHoldings.entryTimestamp));
  }

  async getAgentHoldingByToken(agentId: number, tokenMint: string): Promise<AgentHolding | undefined> {
    const [holding] = await db.select().from(agentHoldings).where(
      and(eq(agentHoldings.agentId, agentId), eq(agentHoldings.tokenMint, tokenMint))
    );
    return holding || undefined;
  }

  async createAgentHolding(insertHolding: InsertAgentHolding): Promise<AgentHolding> {
    const [holding] = await db.insert(agentHoldings).values(insertHolding).returning();
    return holding;
  }

  async updateAgentHolding(id: number, data: Partial<AgentHolding>): Promise<AgentHolding | undefined> {
    const [holding] = await db.update(agentHoldings).set(data).where(eq(agentHoldings.id, id)).returning();
    return holding || undefined;
  }

  async deleteAgentHolding(id: number): Promise<void> {
    await db.delete(agentHoldings).where(eq(agentHoldings.id, id));
  }

  // Traded Token History - PERMANENT record of all tokens ever traded (never deleted)
  async getTradedTokenHistory(agentId: number): Promise<TradedTokenHistory[]> {
    return db.select().from(tradedTokenHistory)
      .where(eq(tradedTokenHistory.agentId, agentId))
      .orderBy(desc(tradedTokenHistory.lastTradedAt));
  }

  async getTradedToken(agentId: number, tokenMint: string): Promise<TradedTokenHistory | undefined> {
    const [record] = await db.select().from(tradedTokenHistory)
      .where(and(
        eq(tradedTokenHistory.agentId, agentId),
        eq(tradedTokenHistory.tokenMint, tokenMint)
      ));
    return record || undefined;
  }

  async hasAgentTradedToken(agentId: number, tokenMint: string): Promise<boolean> {
    const record = await this.getTradedToken(agentId, tokenMint);
    return !!record;
  }

  async recordTokenTrade(
    agentId: number, 
    tokenMint: string, 
    tokenSymbol: string, 
    tokenName: string | null, 
    action: "buy" | "sell", 
    amountSol: number
  ): Promise<TradedTokenHistory> {
    const existing = await this.getTradedToken(agentId, tokenMint);
    
    if (existing) {
      // Update existing record
      const updates: Partial<TradedTokenHistory> = {
        lastTradedAt: new Date(),
      };
      
      if (action === "buy") {
        updates.totalBuys = existing.totalBuys + 1;
        updates.totalBoughtSol = existing.totalBoughtSol + amountSol;
      } else {
        updates.totalSells = existing.totalSells + 1;
        updates.totalSoldSol = existing.totalSoldSol + amountSol;
        updates.realizedPnlSol = (existing.totalSoldSol + amountSol) - existing.totalBoughtSol;
      }
      
      const [updated] = await db.update(tradedTokenHistory)
        .set(updates)
        .where(eq(tradedTokenHistory.id, existing.id))
        .returning();
      return updated;
    } else {
      // Create new record (first trade of this token)
      const [created] = await db.insert(tradedTokenHistory).values({
        agentId,
        tokenMint,
        tokenSymbol,
        tokenName,
        totalBuys: action === "buy" ? 1 : 0,
        totalSells: action === "sell" ? 1 : 0,
        totalBoughtSol: action === "buy" ? amountSol : 0,
        totalSoldSol: action === "sell" ? amountSol : 0,
        realizedPnlSol: 0,
      }).returning();
      return created;
    }
  }

  // Privacy Layer - Shielded Accounts
  async getAllShieldedAccounts(): Promise<ShieldedAccount[]> {
    return db.select().from(shieldedAccounts).orderBy(desc(shieldedAccounts.createdAt));
  }
  
  async getShieldedAccountsByOwner(ownerWallet: string): Promise<ShieldedAccount[]> {
    return db.select().from(shieldedAccounts).where(eq(shieldedAccounts.ownerWallet, ownerWallet)).orderBy(desc(shieldedAccounts.createdAt));
  }

  async getShieldedAccount(id: number): Promise<ShieldedAccount | undefined> {
    const [account] = await db.select().from(shieldedAccounts).where(eq(shieldedAccounts.id, id));
    return account || undefined;
  }

  async createShieldedAccount(insertAccount: InsertShieldedAccount): Promise<ShieldedAccount> {
    const [account] = await db.insert(shieldedAccounts).values(insertAccount).returning();
    return account;
  }

  async updateShieldedAccount(id: number, data: Partial<ShieldedAccount>): Promise<ShieldedAccount | undefined> {
    const [account] = await db.update(shieldedAccounts).set(data).where(eq(shieldedAccounts.id, id)).returning();
    return account || undefined;
  }

  // Privacy Layer - Shielded Addresses
  async getShieldedAddressesByAccount(accountId: number): Promise<ShieldedAddress[]> {
    return db.select().from(shieldedAddresses).where(eq(shieldedAddresses.accountId, accountId)).orderBy(desc(shieldedAddresses.createdAt));
  }

  async getShieldedAddressByPublicAddress(publicAddress: string): Promise<ShieldedAddress | undefined> {
    const [address] = await db.select().from(shieldedAddresses).where(eq(shieldedAddresses.publicAddress, publicAddress));
    return address || undefined;
  }

  async createShieldedAddress(insertAddress: InsertShieldedAddress): Promise<ShieldedAddress> {
    const [address] = await db.insert(shieldedAddresses).values(insertAddress).returning();
    return address;
  }

  async updateShieldedAddress(id: number, data: Partial<ShieldedAddress>): Promise<ShieldedAddress | undefined> {
    const [address] = await db.update(shieldedAddresses).set(data).where(eq(shieldedAddresses.id, id)).returning();
    return address || undefined;
  }

  async getAllShieldedAddresses(ownerWallet?: string): Promise<ShieldedAddress[]> {
    if (ownerWallet) {
      const accounts = await this.getShieldedAccountsByOwner(ownerWallet);
      const accountIds = accounts.map(a => a.id);
      if (accountIds.length === 0) return [];
      const results: ShieldedAddress[] = [];
      for (const accountId of accountIds) {
        const addrs = await this.getShieldedAddressesByAccount(accountId);
        results.push(...addrs);
      }
      return results;
    }
    return db.select().from(shieldedAddresses).orderBy(desc(shieldedAddresses.createdAt));
  }

  // Privacy Layer - Private Payments
  async getAllPrivatePayments(): Promise<PrivatePayment[]> {
    return db.select().from(privatePayments).orderBy(desc(privatePayments.createdAt));
  }

  async getPrivatePaymentsByStatus(status: string): Promise<PrivatePayment[]> {
    return db.select().from(privatePayments).where(eq(privatePayments.status, status)).orderBy(desc(privatePayments.createdAt));
  }

  async createPrivatePayment(insertPayment: InsertPrivatePayment): Promise<PrivatePayment> {
    const [payment] = await db.insert(privatePayments).values(insertPayment).returning();
    return payment;
  }

  async updatePrivatePayment(id: number, data: Partial<PrivatePayment>): Promise<PrivatePayment | undefined> {
    const [payment] = await db.update(privatePayments).set(data).where(eq(privatePayments.id, id)).returning();
    return payment || undefined;
  }

  async getPrivatePaymentByNullifier(nullifier: string): Promise<PrivatePayment | undefined> {
    const [payment] = await db.select().from(privatePayments).where(eq(privatePayments.nullifier, nullifier));
    return payment || undefined;
  }

  // Privacy Layer - ZK Bundles
  async getAllZkBundles(ownerWallet?: string): Promise<ZkBundle[]> {
    if (ownerWallet) {
      return db.select().from(zkBundles).where(eq(zkBundles.ownerWallet, ownerWallet)).orderBy(desc(zkBundles.createdAt));
    }
    return db.select().from(zkBundles).orderBy(desc(zkBundles.createdAt));
  }

  async getZkBundle(id: number): Promise<ZkBundle | undefined> {
    const [bundle] = await db.select().from(zkBundles).where(eq(zkBundles.id, id));
    return bundle || undefined;
  }

  async createZkBundle(insertBundle: InsertZkBundle): Promise<ZkBundle> {
    const [bundle] = await db.insert(zkBundles).values(insertBundle).returning();
    return bundle;
  }

  async updateZkBundle(id: number, data: Partial<ZkBundle>): Promise<ZkBundle | undefined> {
    const [bundle] = await db.update(zkBundles).set(data).where(eq(zkBundles.id, id)).returning();
    return bundle || undefined;
  }

  async createZkBundleItem(insertItem: InsertZkBundleItem): Promise<ZkBundleItem> {
    const [item] = await db.insert(zkBundleItems).values(insertItem).returning();
    return item;
  }

  async getZkBundleItems(bundleId: number): Promise<ZkBundleItem[]> {
    return db.select().from(zkBundleItems).where(eq(zkBundleItems.bundleId, bundleId)).orderBy(zkBundleItems.leafIndex);
  }

  // Privacy Layer - zkML Models
  async getAllZkmlModels(ownerWallet?: string): Promise<ZkmlModel[]> {
    if (ownerWallet) {
      return db.select().from(zkmlModels).where(eq(zkmlModels.ownerWallet, ownerWallet)).orderBy(desc(zkmlModels.createdAt));
    }
    return db.select().from(zkmlModels).orderBy(desc(zkmlModels.createdAt));
  }

  async getZkmlModel(id: number): Promise<ZkmlModel | undefined> {
    const [model] = await db.select().from(zkmlModels).where(eq(zkmlModels.id, id));
    return model || undefined;
  }

  async createZkmlModel(insertModel: InsertZkmlModel): Promise<ZkmlModel> {
    const [model] = await db.insert(zkmlModels).values(insertModel).returning();
    return model;
  }

  async updateZkmlModel(id: number, data: Partial<ZkmlModel>): Promise<ZkmlModel | undefined> {
    const [model] = await db.update(zkmlModels).set(data).where(eq(zkmlModels.id, id)).returning();
    return model || undefined;
  }

  // Privacy Layer - zkML Inference Proofs
  async getZkmlInferenceProofsByModel(modelId: number): Promise<ZkmlInferenceProof[]> {
    return db.select().from(zkmlInferenceProofs).where(eq(zkmlInferenceProofs.modelId, modelId)).orderBy(desc(zkmlInferenceProofs.createdAt));
  }

  async createZkmlInferenceProof(insertProof: InsertZkmlInferenceProof): Promise<ZkmlInferenceProof> {
    const [proof] = await db.insert(zkmlInferenceProofs).values(insertProof).returning();
    return proof;
  }

  async updateZkmlInferenceProof(id: number, data: Partial<ZkmlInferenceProof>): Promise<ZkmlInferenceProof | undefined> {
    const [proof] = await db.update(zkmlInferenceProofs).set(data).where(eq(zkmlInferenceProofs.id, id)).returning();
    return proof || undefined;
  }

  async getAllZkmlInferenceProofs(): Promise<ZkmlInferenceProof[]> {
    return db.select().from(zkmlInferenceProofs).orderBy(desc(zkmlInferenceProofs.createdAt));
  }
}

export const storage = new DatabaseStorage();
