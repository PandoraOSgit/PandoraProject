import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertFleetSchema, insertTransactionSchema, insertZkProofSchema } from "@shared/schema";
import { executeAgentAnalysis, generateAgentRecommendation } from "./services/ai-agent";
import { getBalance, getSolPrice, getSlotInfo, getNetworkStats, validateAddress, getRecentTransactions } from "./services/solana";
import { createBalanceProof, createDecisionProof, createStrategyProof, verifyProof } from "./services/zk-proofs";
import { prepareTransferTransaction, broadcastSignedTransaction, confirmTransaction } from "./services/transaction-builder";
import { generateAgentWallet, getAgentKeypair } from "./services/wallet-encryption";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { getTrendingTokens, getNewLaunches, analyzeToken, isDexScreenerAvailable, type NewTokenLaunch } from "./services/dexscreener";
import { getMemeCoinOpportunities, analyzeMemeCoins, executeMemeTradeForAgent } from "./services/meme-coin-agent";
import { getSwapQuote } from "./services/jupiter-swap";
import { generateAgentConfig, getProviderDisplayName } from "./services/multi-ai-provider";
import type { AIProvider } from "@shared/schema";
import {
  generateStealthKeyPair,
  generateShieldedAddress,
  listShieldedAddresses,
  registerShieldedAddress,
} from "./services/shielded-addresses";
import {
  createPrivatePayment,
  submitPrivatePayment,
  listPrivatePayments,
  getPaymentPoolStats,
  verifyPrivatePayment,
} from "./services/private-payments";
import {
  createTransactionBundle,
  submitBundle,
  listBundles,
  getBundlingStats,
  verifyBundle,
} from "./services/zk-bundling";
import { createSDK, SDKVersion } from "./services/builder-sdk";
import {
  listModelTemplates,
  createFromTemplate,
  registerModel,
  listModels,
  generateInferenceProof,
  verifyInferenceProof,
  getZkMLStats,
  getModel,
} from "./services/zkml-templates";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  app.get("/api/agents", async (req, res) => {
    try {
      const ownerWallet = req.query.owner as string | undefined;
      if (!ownerWallet) {
        return res.status(400).json({ error: "Owner wallet address is required" });
      }
      const agents = await storage.getAllAgents(ownerWallet);
      res.json(agents);
    } catch (error) {
      console.error("Error fetching agents:", error);
      res.status(500).json({ error: "Failed to fetch agents" });
    }
  });

  app.get("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string | undefined;
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (ownerWallet && agent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied" });
      }
      res.json(agent);
    } catch (error) {
      console.error("Error fetching agent:", error);
      res.status(500).json({ error: "Failed to fetch agent" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      const { ownerWallet, ...body } = req.body;
      
      if (!ownerWallet) {
        return res.status(400).json({ error: "Owner wallet address is required" });
      }
      
      const result = insertAgentSchema.safeParse(body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request body", details: result.error.format() });
      }
      
      let walletData: { publicKey: string; encryptedPrivateKey: string } | null = null;
      try {
        walletData = generateAgentWallet();
      } catch (err) {
        console.warn("Could not generate agent wallet (encryption key may not be set):", err);
      }
      
      const agentData = {
        ...result.data,
        ownerWallet,
        walletAddress: walletData?.publicKey || null,
        encryptedPrivateKey: walletData?.encryptedPrivateKey || null,
      };
      
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error creating agent:", error);
      res.status(500).json({ error: "Failed to create agent" });
    }
  });

  app.post("/api/agents/generate", async (req, res) => {
    try {
      const { prompt, aiProvider, ownerWallet } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Prompt is required" });
      }
      
      if (!ownerWallet) {
        return res.status(400).json({ error: "Owner wallet address is required" });
      }
      
      const provider = (aiProvider as AIProvider) || "openai";
      console.log(`[API] Generating agent config with ${getProviderDisplayName(provider)}`);
      
      const generatedConfig = await generateAgentConfig(prompt, provider);
      
      let walletData: { publicKey: string; encryptedPrivateKey: string } | null = null;
      try {
        walletData = generateAgentWallet();
      } catch (err) {
        console.warn("Could not generate agent wallet:", err);
      }
      
      const agentData = {
        ...generatedConfig,
        aiProvider: provider,
        prompt,
        ownerWallet,
        walletAddress: walletData?.publicKey || null,
        encryptedPrivateKey: walletData?.encryptedPrivateKey || null,
      };
      
      const agent = await storage.createAgent(agentData);
      res.status(201).json(agent);
    } catch (error) {
      console.error("Error generating agent:", error);
      res.status(500).json({ error: "Failed to generate agent" });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { ownerWallet: requestOwner, ...updateData } = req.body;
      
      const existingAgent = await storage.getAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (requestOwner && existingAgent.ownerWallet !== requestOwner) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const agent = await storage.updateAgent(id, updateData);
      res.json(agent);
    } catch (error) {
      console.error("Error updating agent:", error);
      res.status(500).json({ error: "Failed to update agent" });
    }
  });

  app.delete("/api/agents/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string | undefined;
      
      const existingAgent = await storage.getAgent(id);
      if (!existingAgent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      if (ownerWallet && existingAgent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteAgent(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting agent:", error);
      res.status(500).json({ error: "Failed to delete agent" });
    }
  });

  app.get("/api/fleets", async (req, res) => {
    try {
      const fleets = await storage.getAllFleets();
      res.json(fleets);
    } catch (error) {
      console.error("Error fetching fleets:", error);
      res.status(500).json({ error: "Failed to fetch fleets" });
    }
  });

  app.get("/api/fleets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fleet = await storage.getFleet(id);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      res.json(fleet);
    } catch (error) {
      console.error("Error fetching fleet:", error);
      res.status(500).json({ error: "Failed to fetch fleet" });
    }
  });

  app.post("/api/fleets", async (req, res) => {
    try {
      const result = insertFleetSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request body", details: result.error.format() });
      }
      const fleet = await storage.createFleet(result.data);
      res.status(201).json(fleet);
    } catch (error) {
      console.error("Error creating fleet:", error);
      res.status(500).json({ error: "Failed to create fleet" });
    }
  });

  app.patch("/api/fleets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fleet = await storage.updateFleet(id, req.body);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      res.json(fleet);
    } catch (error) {
      console.error("Error updating fleet:", error);
      res.status(500).json({ error: "Failed to update fleet" });
    }
  });

  app.delete("/api/fleets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.deleteFleet(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fleet:", error);
      res.status(500).json({ error: "Failed to delete fleet" });
    }
  });

  app.get("/api/transactions", async (req, res) => {
    try {
      const transactions = await storage.getAllTransactions();
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/agents/:id/transactions", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const transactions = await storage.getTransactionsByAgent(agentId);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/transactions", async (req, res) => {
    try {
      const result = insertTransactionSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request body", details: result.error.format() });
      }
      const transaction = await storage.createTransaction(result.data);
      res.status(201).json(transaction);
    } catch (error) {
      console.error("Error creating transaction:", error);
      res.status(500).json({ error: "Failed to create transaction" });
    }
  });

  app.patch("/api/transactions/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const transaction = await storage.updateTransaction(id, req.body);
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }
      res.json(transaction);
    } catch (error) {
      console.error("Error updating transaction:", error);
      res.status(500).json({ error: "Failed to update transaction" });
    }
  });

  app.get("/api/zk-proofs", async (req, res) => {
    try {
      const proofs = await storage.getAllZkProofs();
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching ZK proofs:", error);
      res.status(500).json({ error: "Failed to fetch ZK proofs" });
    }
  });

  app.get("/api/agents/:id/zk-proofs", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const proofs = await storage.getZkProofsByAgent(agentId);
      res.json(proofs);
    } catch (error) {
      console.error("Error fetching ZK proofs:", error);
      res.status(500).json({ error: "Failed to fetch ZK proofs" });
    }
  });

  app.post("/api/zk-proofs", async (req, res) => {
    try {
      const result = insertZkProofSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ error: "Invalid request body", details: result.error.format() });
      }
      const proof = await storage.createZkProof(result.data);
      res.status(201).json(proof);
    } catch (error) {
      console.error("Error creating ZK proof:", error);
      res.status(500).json({ error: "Failed to create ZK proof" });
    }
  });

  app.patch("/api/zk-proofs/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const proof = await storage.updateZkProof(id, req.body);
      if (!proof) {
        return res.status(404).json({ error: "ZK proof not found" });
      }
      res.json(proof);
    } catch (error) {
      console.error("Error updating ZK proof:", error);
      res.status(500).json({ error: "Failed to update ZK proof" });
    }
  });

  app.get("/api/agents/:id/decisions", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const decisions = await storage.getDecisionsByAgent(agentId);
      res.json(decisions);
    } catch (error) {
      console.error("Error fetching decisions:", error);
      res.status(500).json({ error: "Failed to fetch decisions" });
    }
  });

  app.post("/api/agents/:id/analyze", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const decision = await executeAgentAnalysis(agentId);
      if (!decision) {
        return res.status(404).json({ error: "Agent not found or not running" });
      }
      res.json(decision);
    } catch (error) {
      console.error("Error analyzing agent:", error);
      res.status(500).json({ error: "Failed to analyze agent" });
    }
  });

  app.get("/api/agents/:id/recommendation", async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const agent = await storage.getAgent(agentId);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      const recommendation = await generateAgentRecommendation(agent);
      res.json({ recommendation });
    } catch (error) {
      console.error("Error generating recommendation:", error);
      res.status(500).json({ error: "Failed to generate recommendation" });
    }
  });

  app.get("/api/solana/price", async (req, res) => {
    try {
      const price = await getSolPrice();
      res.json({ price, currency: "USD" });
    } catch (error) {
      console.error("Error fetching SOL price:", error);
      res.status(500).json({ error: "Failed to fetch SOL price" });
    }
  });

  app.get("/api/solana/network", async (req, res) => {
    try {
      const [slotInfo, networkStats] = await Promise.all([
        getSlotInfo(),
        getNetworkStats(),
      ]);
      res.json({ ...slotInfo, ...networkStats });
    } catch (error) {
      console.error("Error fetching network info:", error);
      res.status(500).json({ error: "Failed to fetch network info" });
    }
  });

  app.get("/api/solana/balance/:address", async (req, res) => {
    try {
      const address = req.params.address;
      const isValid = await validateAddress(address);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid Solana address" });
      }
      const balance = await getBalance(address);
      res.json(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      res.status(500).json({ error: "Failed to fetch balance" });
    }
  });

  app.get("/api/solana/transactions/:address", async (req, res) => {
    try {
      const address = req.params.address;
      const limit = parseInt(req.query.limit as string) || 10;
      const isValid = await validateAddress(address);
      if (!isValid) {
        return res.status(400).json({ error: "Invalid Solana address" });
      }
      const transactions = await getRecentTransactions(address, limit);
      res.json(transactions);
    } catch (error) {
      console.error("Error fetching transactions:", error);
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.post("/api/zk-proofs/generate/balance", async (req, res) => {
    try {
      const { agentId, balance, threshold } = req.body;
      if (!agentId || balance === undefined || threshold === undefined) {
        return res.status(400).json({ error: "Missing required fields: agentId, balance, threshold" });
      }
      const proof = await createBalanceProof(agentId, balance, threshold);
      res.status(201).json(proof);
    } catch (error) {
      console.error("Error generating balance proof:", error);
      res.status(500).json({ error: "Failed to generate balance proof" });
    }
  });

  app.post("/api/zk-proofs/generate/decision", async (req, res) => {
    try {
      const { agentId, decisionId, confidence } = req.body;
      if (!agentId || !decisionId || confidence === undefined) {
        return res.status(400).json({ error: "Missing required fields: agentId, decisionId, confidence" });
      }
      const proof = await createDecisionProof(agentId, decisionId, confidence);
      res.status(201).json(proof);
    } catch (error) {
      console.error("Error generating decision proof:", error);
      res.status(500).json({ error: "Failed to generate decision proof" });
    }
  });

  app.post("/api/zk-proofs/generate/strategy", async (req, res) => {
    try {
      const { agentId, strategyExecuted, complianceScore } = req.body;
      if (!agentId || strategyExecuted === undefined || complianceScore === undefined) {
        return res.status(400).json({ error: "Missing required fields: agentId, strategyExecuted, complianceScore" });
      }
      const proof = await createStrategyProof(agentId, strategyExecuted, complianceScore);
      res.status(201).json(proof);
    } catch (error) {
      console.error("Error generating strategy proof:", error);
      res.status(500).json({ error: "Failed to generate strategy proof" });
    }
  });

  app.post("/api/zk-proofs/verify", async (req, res) => {
    try {
      const { proofData } = req.body;
      if (!proofData) {
        return res.status(400).json({ error: "Missing required field: proofData" });
      }
      const result = await verifyProof(proofData);
      res.json(result);
    } catch (error) {
      console.error("Error verifying proof:", error);
      res.status(500).json({ error: "Failed to verify proof" });
    }
  });

  app.post("/api/transactions/prepare", async (req, res) => {
    try {
      const { fromPubkey, toPubkey, amount, memo } = req.body;
      if (!fromPubkey || !toPubkey || amount === undefined) {
        return res.status(400).json({ error: "Missing required fields: fromPubkey, toPubkey, amount" });
      }
      
      if (typeof amount !== 'number' || amount <= 0 || amount > 1000000) {
        return res.status(400).json({ error: "Invalid amount: must be between 0 and 1,000,000 SOL" });
      }
      
      const isFromValid = await validateAddress(fromPubkey);
      const isToValid = await validateAddress(toPubkey);
      if (!isFromValid || !isToValid) {
        return res.status(400).json({ error: "Invalid Solana address" });
      }
      
      const balance = await getBalance(fromPubkey);
      if (!balance || balance.sol < amount + 0.001) {
        return res.status(400).json({ error: "Insufficient balance for transfer and fees" });
      }
      
      const preparedTx = await prepareTransferTransaction(fromPubkey, toPubkey, amount, memo);
      res.json(preparedTx);
    } catch (error) {
      console.error("Error preparing transaction:", error);
      res.status(500).json({ error: "Failed to prepare transaction" });
    }
  });

  app.post("/api/transactions/broadcast", async (req, res) => {
    try {
      const { signedTransaction, agentId, type, amount, description } = req.body;
      if (!signedTransaction) {
        return res.status(400).json({ error: "Missing required field: signedTransaction" });
      }
      
      const result = await broadcastSignedTransaction(signedTransaction);
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }
      
      if (agentId) {
        await storage.createTransaction({
          agentId,
          signature: result.signature,
          type: type || "transfer",
          status: "pending",
          amount: amount || 0,
          description: description || "Agent transaction",
          fee: 0,
        });
      }
      
      res.json({ signature: result.signature, status: "pending" });
    } catch (error) {
      console.error("Error broadcasting transaction:", error);
      res.status(500).json({ error: "Failed to broadcast transaction" });
    }
  });

  app.post("/api/transactions/confirm", async (req, res) => {
    try {
      const { signature, blockhash, lastValidBlockHeight } = req.body;
      if (!signature || !blockhash || !lastValidBlockHeight) {
        return res.status(400).json({ error: "Missing required fields: signature, blockhash, lastValidBlockHeight" });
      }
      
      const result = await confirmTransaction(signature, blockhash, lastValidBlockHeight);
      
      const txs = await storage.getAllTransactions();
      const tx = txs.find(t => t.signature === signature);
      
      if (tx) {
        if (result.confirmed) {
          await storage.updateTransaction(tx.id, { 
            status: "confirmed",
            blockNumber: result.slot || 0,
            confirmedAt: new Date()
          });
        } else {
          await storage.updateTransaction(tx.id, { 
            status: "failed",
            description: `${tx.description} - Error: ${result.error || 'Unknown'}`
          });
        }
      }
      
      res.json(result);
    } catch (error) {
      console.error("Error confirming transaction:", error);
      res.status(500).json({ error: "Failed to confirm transaction", confirmed: false });
    }
  });

  app.get("/api/agents/:id/wallet", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!agent.walletAddress) {
        return res.json({ 
          hasWallet: false, 
          address: null, 
          balance: 0,
          spendingLimit: agent.spendingLimit,
          dailySpent: agent.dailySpent
        });
      }
      
      let balance = 0;
      try {
        const balanceResult = await getBalance(agent.walletAddress);
        balance = balanceResult?.sol ?? 0;
      } catch (err) {
        console.warn("Could not fetch agent wallet balance:", err);
      }
      
      await storage.updateAgent(id, { walletBalance: balance });
      
      res.json({
        hasWallet: true,
        address: agent.walletAddress,
        balance,
        spendingLimit: agent.spendingLimit,
        dailySpent: agent.dailySpent,
        lastSpendingReset: agent.lastSpendingReset
      });
    } catch (error) {
      console.error("Error fetching agent wallet:", error);
      res.status(500).json({ error: "Failed to fetch agent wallet" });
    }
  });

  app.post("/api/agents/:id/wallet/withdraw", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { amount, toAddress } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      
      if (!toAddress || !validateAddress(toAddress)) {
        return res.status(400).json({ error: "Invalid destination address" });
      }
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!agent.encryptedPrivateKey) {
        return res.status(400).json({ error: "Agent does not have a wallet" });
      }
      
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      
      let keypair;
      try {
        keypair = getAgentKeypair(agent.encryptedPrivateKey);
      } catch (err) {
        return res.status(500).json({ error: "Failed to access agent wallet" });
      }
      
      const balance = await connection.getBalance(keypair.publicKey);
      const amountLamports = amount * LAMPORTS_PER_SOL;
      
      if (balance < amountLamports + 5000) {
        return res.status(400).json({ error: "Insufficient balance (including fees)" });
      }
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports: amountLamports,
        })
      );
      
      const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
      
      const newBalance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;
      await storage.updateAgent(id, { walletBalance: newBalance });
      
      await storage.createTransaction({
        agentId: id,
        signature,
        type: "withdraw",
        status: "confirmed",
        amount,
        description: `Withdrew ${amount} SOL to ${toAddress.slice(0, 8)}...`,
      });
      
      res.json({ 
        success: true, 
        signature, 
        newBalance,
        explorerUrl: `https://solscan.io/tx/${signature}`
      });
    } catch (error) {
      console.error("Error withdrawing from agent wallet:", error);
      res.status(500).json({ error: "Failed to withdraw from agent wallet" });
    }
  });

  app.patch("/api/agents/:id/spending-limit", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { spendingLimit } = req.body;
      
      if (typeof spendingLimit !== "number" || spendingLimit < 0) {
        return res.status(400).json({ error: "Invalid spending limit" });
      }
      
      const agent = await storage.updateAgent(id, { spendingLimit });
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      res.json({ success: true, spendingLimit: agent.spendingLimit });
    } catch (error) {
      console.error("Error updating spending limit:", error);
      res.status(500).json({ error: "Failed to update spending limit" });
    }
  });

  app.post("/api/agents/:id/execute-autonomous", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { toAddress, amount, memo } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }
      
      if (!toAddress || !validateAddress(toAddress)) {
        return res.status(400).json({ error: "Invalid destination address" });
      }
      
      const agent = await storage.getAgent(id);
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!agent.encryptedPrivateKey) {
        return res.status(400).json({ error: "Agent does not have a wallet" });
      }
      
      const now = new Date();
      const lastReset = agent.lastSpendingReset ? new Date(agent.lastSpendingReset) : null;
      const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      let dailySpent = agent.dailySpent;
      if (!lastReset || lastReset < dayStart) {
        dailySpent = 0;
        await storage.updateAgent(id, { dailySpent: 0, lastSpendingReset: now });
      }
      
      if (dailySpent + amount > agent.spendingLimit) {
        return res.status(400).json({ 
          error: `Transaction exceeds daily spending limit. Limit: ${agent.spendingLimit} SOL, Spent today: ${dailySpent} SOL, Requested: ${amount} SOL`
        });
      }
      
      const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
      const connection = new Connection(rpcUrl, "confirmed");
      
      let keypair;
      try {
        keypair = getAgentKeypair(agent.encryptedPrivateKey);
      } catch (err) {
        return res.status(500).json({ error: "Failed to access agent wallet" });
      }
      
      const balance = await connection.getBalance(keypair.publicKey);
      const amountLamports = amount * LAMPORTS_PER_SOL;
      
      if (balance < amountLamports + 5000) {
        return res.status(400).json({ error: "Insufficient agent wallet balance" });
      }
      
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(toAddress),
          lamports: amountLamports,
        })
      );
      
      const signature = await sendAndConfirmTransaction(connection, transaction, [keypair]);
      
      const newBalance = await connection.getBalance(keypair.publicKey) / LAMPORTS_PER_SOL;
      const newDailySpent = dailySpent + amount;
      
      await storage.updateAgent(id, { 
        walletBalance: newBalance,
        dailySpent: newDailySpent,
        totalTransactions: agent.totalTransactions + 1,
        totalVolume: agent.totalVolume + amount,
        lastActiveAt: now
      });
      
      await storage.createTransaction({
        agentId: id,
        signature,
        type: "transfer",
        status: "confirmed",
        amount,
        description: memo || `Autonomous transfer to ${toAddress.slice(0, 8)}...`,
      });
      
      res.json({ 
        success: true, 
        signature, 
        newBalance,
        dailySpent: newDailySpent,
        remainingLimit: agent.spendingLimit - newDailySpent,
        explorerUrl: `https://solscan.io/tx/${signature}`
      });
    } catch (error) {
      console.error("Error executing autonomous transaction:", error);
      res.status(500).json({ error: "Failed to execute autonomous transaction" });
    }
  });

  app.get("/api/dexscreener/status", async (req, res) => {
    res.json({ 
      connected: isDexScreenerAvailable(),
      message: "DexScreener API connected - live token data available"
    });
  });

  app.get("/api/meme/trending", async (req, res) => {
    try {
      const timeframe = (req.query.timeframe as "1h" | "6h" | "24h") || "1h";
      const tokens = await getTrendingTokens(timeframe);
      const analyses = tokens.slice(0, 10).map(token => analyzeToken(token));
      
      res.json({
        tokens,
        analyses,
        isLiveData: true,
        source: "DexScreener",
      });
    } catch (error) {
      console.error("Error fetching trending tokens:", error);
      res.status(500).json({ error: "Failed to fetch trending tokens" });
    }
  });

  app.get("/api/meme/opportunities", async (req, res) => {
    try {
      const opportunities = await getMemeCoinOpportunities();
      res.json({
        ...opportunities,
        isLiveData: true,
        source: "DexScreener",
      });
    } catch (error) {
      console.error("Error fetching meme opportunities:", error);
      res.status(500).json({ error: "Failed to fetch meme opportunities" });
    }
  });

  app.get("/api/meme/new-launches", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const launches = await getNewLaunches(limit);
      res.json({
        launches,
        isLiveData: true,
        source: "DexScreener",
      });
    } catch (error) {
      console.error("Error fetching new launches:", error);
      res.status(500).json({ error: "Failed to fetch new launches" });
    }
  });

  app.get("/api/meme/stream", async (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("Access-Control-Allow-Origin", "*");

    res.write("event: connected\ndata: {\"status\": \"connected\", \"source\": \"DexScreener\"}\n\n");

    const seenMints = new Set<string>();

    const heartbeatInterval = setInterval(() => {
      res.write("event: heartbeat\ndata: {\"time\": " + Date.now() + "}\n\n");
    }, 30000);

    const pollInterval = setInterval(async () => {
      try {
        const launches = await getNewLaunches(10);
        for (const token of launches) {
          if (!seenMints.has(token.mint)) {
            seenMints.add(token.mint);
            res.write(`event: new_token\ndata: ${JSON.stringify(token)}\n\n`);
          }
        }
        if (seenMints.size > 1000) {
          const mintArray = Array.from(seenMints);
          mintArray.slice(0, 500).forEach(m => seenMints.delete(m));
        }
      } catch (error) {
        console.error("Error polling new launches:", error);
      }
    }, 60000);

    req.on("close", () => {
      clearInterval(heartbeatInterval);
      clearInterval(pollInterval);
    });
  });

  app.post("/api/agents/:id/analyze-meme", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string || req.body.ownerWallet;
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!ownerWallet || agent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied - you don't own this agent" });
      }
      
      const decision = await analyzeMemeCoins(agent);
      
      res.json({
        agentId: id,
        agentName: agent.name,
        decision,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error analyzing meme coins:", error);
      res.status(500).json({ error: "Failed to analyze meme coins" });
    }
  });

  app.post("/api/agents/:id/execute-meme-trade", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string || req.body.ownerWallet;
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!ownerWallet || agent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied - you don't own this agent" });
      }
      
      if (!agent.encryptedPrivateKey) {
        return res.status(400).json({ error: "Agent does not have a wallet" });
      }
      
      const decision = await analyzeMemeCoins(agent);
      
      if (!decision.shouldTrade) {
        return res.json({
          executed: false,
          decision,
          message: "AI decided not to trade at this time",
        });
      }
      
      const result = await executeMemeTradeForAgent(agent, decision);
      
      res.json({
        executed: result.success,
        decision,
        result,
        explorerUrl: result.signature ? `https://solscan.io/tx/${result.signature}` : undefined,
      });
    } catch (error) {
      console.error("Error executing meme trade:", error);
      res.status(500).json({ error: "Failed to execute meme trade" });
    }
  });

  app.get("/api/jupiter/quote", async (req, res) => {
    try {
      const { inputMint, outputMint, amount, slippage } = req.query;
      
      if (!inputMint || !outputMint || !amount) {
        return res.status(400).json({ error: "inputMint, outputMint, and amount are required" });
      }
      
      const quote = await getSwapQuote(
        inputMint as string,
        outputMint as string,
        parseFloat(amount as string),
        parseInt(slippage as string) || 50
      );
      
      if (!quote) {
        return res.status(404).json({ error: "No route found for this swap" });
      }
      
      res.json(quote);
    } catch (error) {
      console.error("Error getting Jupiter quote:", error);
      res.status(500).json({ error: "Failed to get swap quote" });
    }
  });

  // ============ ZK PRIVACY LAYER ROUTES ============

  // Shielded Addresses
  app.post("/api/privacy/generate-keys", async (_req, res) => {
    try {
      const keyPair = generateStealthKeyPair();
      const shieldedAddress = generateShieldedAddress(
        keyPair.viewingPublicKey,
        keyPair.spendingPublicKey
      );
      registerShieldedAddress(shieldedAddress);
      
      res.json({
        keyPair: {
          viewingPublicKey: keyPair.viewingPublicKey,
          spendingPublicKey: keyPair.spendingPublicKey,
        },
        shieldedAddress,
      });
    } catch (error) {
      console.error("Error generating shielded keys:", error);
      res.status(500).json({ error: "Failed to generate shielded keys" });
    }
  });

  app.get("/api/privacy/shielded-addresses", async (_req, res) => {
    try {
      const addresses = listShieldedAddresses();
      res.json(addresses);
    } catch (error) {
      console.error("Error listing shielded addresses:", error);
      res.status(500).json({ error: "Failed to list shielded addresses" });
    }
  });

  // Private Payments
  app.post("/api/privacy/payments", async (req, res) => {
    try {
      const { senderPrivateKey, recipientAddress, amount, memo } = req.body;
      
      if (!senderPrivateKey || !recipientAddress || !amount) {
        return res.status(400).json({ error: "senderPrivateKey, recipientAddress, and amount are required" });
      }
      
      const payment = createPrivatePayment(senderPrivateKey, recipientAddress, amount, memo);
      const result = submitPrivatePayment(payment);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ payment, submitted: true });
    } catch (error) {
      console.error("Error creating private payment:", error);
      res.status(500).json({ error: "Failed to create private payment" });
    }
  });

  app.get("/api/privacy/payments", async (_req, res) => {
    try {
      const payments = listPrivatePayments();
      res.json(payments);
    } catch (error) {
      console.error("Error listing private payments:", error);
      res.status(500).json({ error: "Failed to list private payments" });
    }
  });

  app.get("/api/privacy/payments/stats", async (_req, res) => {
    try {
      const stats = getPaymentPoolStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting payment stats:", error);
      res.status(500).json({ error: "Failed to get payment stats" });
    }
  });

  // ZK Transaction Bundling
  app.post("/api/privacy/bundles", async (req, res) => {
    try {
      const { transactions } = req.body;
      
      if (!transactions || !Array.isArray(transactions) || transactions.length === 0) {
        return res.status(400).json({ error: "transactions array is required" });
      }
      
      const bundle = createTransactionBundle(transactions);
      const result = submitBundle(bundle);
      
      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }
      
      res.json({ bundle, submitted: true });
    } catch (error) {
      console.error("Error creating bundle:", error);
      res.status(500).json({ error: "Failed to create transaction bundle" });
    }
  });

  app.get("/api/privacy/bundles", async (_req, res) => {
    try {
      const bundles = listBundles();
      res.json(bundles);
    } catch (error) {
      console.error("Error listing bundles:", error);
      res.status(500).json({ error: "Failed to list bundles" });
    }
  });

  app.get("/api/privacy/bundles/stats", async (_req, res) => {
    try {
      const stats = getBundlingStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting bundling stats:", error);
      res.status(500).json({ error: "Failed to get bundling stats" });
    }
  });

  app.post("/api/privacy/bundles/verify", async (req, res) => {
    try {
      const { bundle } = req.body;
      if (!bundle) {
        return res.status(400).json({ error: "bundle is required" });
      }
      
      const result = verifyBundle(bundle);
      res.json(result);
    } catch (error) {
      console.error("Error verifying bundle:", error);
      res.status(500).json({ error: "Failed to verify bundle" });
    }
  });

  // Builder SDK Info
  app.get("/api/sdk/info", async (_req, res) => {
    try {
      res.json({
        version: SDKVersion,
        features: [
          "shielded_addresses",
          "private_payments",
          "zk_bundling",
          "zkml_templates",
          "multi_ai_agents",
        ],
        networks: ["mainnet", "devnet", "testnet"],
        aiProviders: ["openai", "gemini", "anthropic"],
      });
    } catch (error) {
      console.error("Error getting SDK info:", error);
      res.status(500).json({ error: "Failed to get SDK info" });
    }
  });

  // zkML Templates
  app.get("/api/zkml/templates", async (_req, res) => {
    try {
      const templates = listModelTemplates();
      res.json(templates);
    } catch (error) {
      console.error("Error listing zkML templates:", error);
      res.status(500).json({ error: "Failed to list zkML templates" });
    }
  });

  app.post("/api/zkml/models", async (req, res) => {
    try {
      const { templateType, name, configOverrides } = req.body;
      
      if (!templateType || !name) {
        return res.status(400).json({ error: "templateType and name are required" });
      }
      
      const model = createFromTemplate(templateType, name, configOverrides);
      registerModel(model);
      
      res.json(model);
    } catch (error) {
      console.error("Error creating zkML model:", error);
      res.status(500).json({ error: "Failed to create zkML model" });
    }
  });

  app.get("/api/zkml/models", async (_req, res) => {
    try {
      const models = listModels();
      res.json(models);
    } catch (error) {
      console.error("Error listing zkML models:", error);
      res.status(500).json({ error: "Failed to list zkML models" });
    }
  });

  app.post("/api/zkml/inference", async (req, res) => {
    try {
      const { modelId, input } = req.body;
      
      if (!modelId || !input) {
        return res.status(400).json({ error: "modelId and input are required" });
      }
      
      const model = getModel(modelId);
      if (!model) {
        return res.status(404).json({ error: "Model not found" });
      }
      
      const proof = generateInferenceProof(model, input);
      const verification = verifyInferenceProof(proof, model);
      
      res.json({ proof, verification });
    } catch (error) {
      console.error("Error running zkML inference:", error);
      res.status(500).json({ error: "Failed to run zkML inference" });
    }
  });

  app.get("/api/zkml/stats", async (_req, res) => {
    try {
      const stats = getZkMLStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting zkML stats:", error);
      res.status(500).json({ error: "Failed to get zkML stats" });
    }
  });

  // Privacy Layer Overview Stats
  app.get("/api/privacy/stats", async (_req, res) => {
    try {
      const paymentStats = getPaymentPoolStats();
      const bundlingStats = getBundlingStats();
      const zkmlStats = getZkMLStats();
      const shieldedAddresses = listShieldedAddresses();
      
      res.json({
        shieldedAddresses: shieldedAddresses.length,
        payments: paymentStats,
        bundling: bundlingStats,
        zkml: zkmlStats,
      });
    } catch (error) {
      console.error("Error getting privacy stats:", error);
      res.status(500).json({ error: "Failed to get privacy stats" });
    }
  });
}
