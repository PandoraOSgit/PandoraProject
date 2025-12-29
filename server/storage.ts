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
  users,
  agents,
  fleets,
  transactions,
  zkProofs,
  agentDecisions,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  getAllAgents(ownerWallet?: string): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent | undefined>;
  createAgent(agent: InsertAgent): Promise<Agent>;
  updateAgent(id: number, data: Partial<Agent>): Promise<Agent | undefined>;
  deleteAgent(id: number): Promise<void>;
  
  getAllFleets(): Promise<Fleet[]>;
  getFleet(id: number): Promise<Fleet | undefined>;
  createFleet(fleet: InsertFleet): Promise<Fleet>;
  updateFleet(id: number, data: Partial<Fleet>): Promise<Fleet | undefined>;
  deleteFleet(id: number): Promise<void>;
  
  getAllTransactions(): Promise<Transaction[]>;
  getTransactionsByAgent(agentId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransaction(id: number, data: Partial<Transaction>): Promise<Transaction | undefined>;
  
  getAllZkProofs(): Promise<ZkProof[]>;
  getZkProofsByAgent(agentId: number): Promise<ZkProof[]>;
  createZkProof(proof: InsertZkProof): Promise<ZkProof>;
  updateZkProof(id: number, data: Partial<ZkProof>): Promise<ZkProof | undefined>;
  
  getDecisionsByAgent(agentId: number): Promise<AgentDecision[]>;
  createAgentDecision(decision: InsertAgentDecision): Promise<AgentDecision>;
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

  async getAllFleets(): Promise<Fleet[]> {
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
}

export const storage = new DatabaseStorage();
