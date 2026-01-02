import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertAgentSchema, insertFleetSchema, insertTransactionSchema, insertZkProofSchema } from "@shared/schema";
import { authStore, createLoginMessage } from "./services/auth";
import { requireWalletAuth } from "./middleware/auth";
import { executeAgentAnalysis, generateAgentRecommendation } from "./services/ai-agent";
import { getBalance, getSolPrice, getSlotInfo, getNetworkStats, validateAddress, getRecentTransactions } from "./services/solana";
import { createBalanceProof, createDecisionProof, createStrategyProof, verifyProof } from "./services/zk-proofs";
import { prepareTransferTransaction, broadcastSignedTransaction, confirmTransaction } from "./services/transaction-builder";
import { generateAgentWallet, getAgentKeypair } from "./services/wallet-encryption";
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import { getTrendingTokens, getNewLaunches, analyzeToken, isDexScreenerAvailable, type NewTokenLaunch } from "./services/dexscreener";
import { getMemeCoinOpportunities, analyzeMemeCoins, executeMemeTradeForAgent, getAgentTokenHoldings, sellAllHoldings, evaluateHoldingsForSell, type MemeTradeDecision } from "./services/meme-coin-agent";
import { getSwapQuote } from "./services/jupiter-swap";
import { generateAgentConfig, getProviderDisplayName } from "./services/multi-ai-provider";
import type { AIProvider } from "@shared/schema";
import {
  generateStealthKeyPair,
  generateShieldedAddress,
  createShieldedAccountWithKeys,
  generateAndSaveShieldedAddress,
  listShieldedAddressesFromDB,
  getShieldedAccountsByOwner,
} from "./services/shielded-addresses";
import {
  createPrivatePayment,
  verifyPrivatePayment,
  createAndSavePrivatePayment,
  listPrivatePaymentsFromDB,
  getPaymentPoolStatsFromDB,
  confirmPrivatePaymentInDB,
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
import {
  generateSolanaStealthKeyPair,
  deriveStealthAddress,
  serializeStealthKeyPair,
  getStealthTransferInfo,
  verifyECDHRoundTrip,
} from "./services/solana-stealth";

export async function registerRoutes(server: Server, app: Express): Promise<void> {
  // Auth routes
  app.post("/api/auth/challenge", async (req, res) => {
    try {
      const { wallet } = req.body;
      if (!wallet) {
        return res.status(400).json({ error: "Wallet address is required" });
      }
      const challenge = authStore.generateChallenge(wallet);
      res.json(challenge);
    } catch (error) {
      console.error("Error generating challenge:", error);
      res.status(500).json({ error: "Failed to generate challenge" });
    }
  });

  app.post("/api/auth/verify", async (req, res) => {
    try {
      const { wallet, nonce, signature } = req.body;
      if (!wallet || !nonce || !signature) {
        return res.status(400).json({ error: "Wallet, nonce, and signature are required" });
      }
      const result = authStore.verifySignature(wallet, nonce, signature);
      if (!result) {
        return res.status(401).json({ error: "Invalid signature or expired challenge" });
      }
      res.json(result);
    } catch (error) {
      console.error("Error verifying signature:", error);
      res.status(500).json({ error: "Failed to verify signature" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    try {
      const { sessionToken } = req.body;
      if (sessionToken) {
        authStore.invalidateSession(sessionToken);
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Error during logout:", error);
      res.status(500).json({ error: "Failed to logout" });
    }
  });

  app.get("/api/auth/session", requireWalletAuth, async (req, res) => {
    try {
      res.json({ wallet: req.auth!.wallet });
    } catch (error) {
      console.error("Error validating session:", error);
      res.status(500).json({ error: "Failed to validate session" });
    }
  });

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
      const ownerWallet = req.query.owner as string | undefined;
      if (!ownerWallet) {
        return res.status(400).json({ error: "owner query parameter is required" });
      }
      const fleets = await storage.getAllFleets(ownerWallet);
      res.json(fleets);
    } catch (error) {
      console.error("Error fetching fleets:", error);
      res.status(500).json({ error: "Failed to fetch fleets" });
    }
  });

  app.get("/api/fleets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string | undefined;
      const fleet = await storage.getFleet(id);
      if (!fleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      if (ownerWallet && fleet.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied" });
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
      if (!result.data.ownerWallet) {
        return res.status(400).json({ error: "ownerWallet is required" });
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
      const ownerWallet = req.query.owner as string | undefined;
      
      const existingFleet = await storage.getFleet(id);
      if (!existingFleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      if (ownerWallet && existingFleet.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      const fleet = await storage.updateFleet(id, req.body);
      res.json(fleet);
    } catch (error) {
      console.error("Error updating fleet:", error);
      res.status(500).json({ error: "Failed to update fleet" });
    }
  });

  app.delete("/api/fleets/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string | undefined;
      
      const existingFleet = await storage.getFleet(id);
      if (!existingFleet) {
        return res.status(404).json({ error: "Fleet not found" });
      }
      if (ownerWallet && existingFleet.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied" });
      }
      
      await storage.deleteFleet(id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting fleet:", error);
      res.status(500).json({ error: "Failed to delete fleet" });
    }
  });

  app.get("/api/transactions", requireWalletAuth, async (req, res) => {
    try {
      const owner = req.auth!.wallet;
      const transactions = await storage.getTransactionsByOwner(owner);
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

  app.get("/api/zk-proofs", requireWalletAuth, async (req, res) => {
    try {
      const owner = req.auth!.wallet;
      const proofs = await storage.getZkProofsByOwner(owner);
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

  // Get agent's token holdings
  app.get("/api/agents/:id/holdings", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string;
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!ownerWallet || agent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied - you don't own this agent" });
      }
      
      if (!agent.walletAddress) {
        return res.status(400).json({ error: "Agent does not have a wallet" });
      }
      
      const holdings = await getAgentTokenHoldings(agent);
      
      res.json({
        agentId: agent.id,
        agentName: agent.name,
        walletAddress: agent.walletAddress,
        holdings,
      });
    } catch (error) {
      console.error("Error getting agent holdings:", error);
      res.status(500).json({ error: "Failed to get token holdings" });
    }
  });

  // Execute a sell for an agent (sell all tokens or specific token)
  app.post("/api/agents/:id/execute-sell", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string || req.body.ownerWallet;
      const { tokenMint } = req.body; // Optional: specific token to sell
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

      // Create a sell decision
      const sellDecision: MemeTradeDecision = {
        shouldTrade: true,
        action: "sell",
        tokenMint: tokenMint || undefined,
        confidence: 1.0,
        reasoning: "Manual sell triggered by owner",
        riskLevel: "low",
      };
      
      const result = await executeMemeTradeForAgent(agent, sellDecision);
      
      res.json({
        executed: result.success,
        result,
        explorerUrl: result.signature ? `https://solscan.io/tx/${result.signature}` : undefined,
      });
    } catch (error) {
      console.error("Error executing sell:", error);
      res.status(500).json({ error: "Failed to execute sell" });
    }
  });

  // Execute SELL ALL for an agent (emergency button)
  // Accepts holdings array from frontend to avoid re-fetching (which can fail due to rate limits)
  app.post("/api/agents/:id/sell-all", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string || req.body.ownerWallet;
      const holdingsToSell = req.body.holdings as Array<{
        tokenMint: string;
        tokenSymbol: string;
        tokenName?: string;
        quantity: number;
        currentValueSol: number;
      }> | undefined;
      
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

      console.log(`[API] SELL ALL triggered for agent ${agent.name} by owner`);
      
      // If holdings passed from frontend, use them directly (more reliable)
      if (holdingsToSell && holdingsToSell.length > 0) {
        console.log(`[API] Using ${holdingsToSell.length} holdings from frontend`);
        const { sellHoldingsDirectly } = await import("./services/meme-coin-agent");
        const result = await sellHoldingsDirectly(agent, holdingsToSell);
        
        return res.json({
          success: true,
          soldCount: result.soldCount,
          totalSoldSol: result.totalSoldSol,
          results: result.results,
        });
      }
      
      // Fallback: fetch from blockchain (may fail due to rate limits)
      const result = await sellAllHoldings(agent);
      
      res.json({
        success: true,
        soldCount: result.soldCount,
        totalSoldSol: result.totalSoldSol,
        results: result.results,
      });
    } catch (error) {
      console.error("Error executing sell all:", error);
      res.status(500).json({ error: "Failed to execute sell all" });
    }
  });

  // Get holdings with P/L evaluation
  app.get("/api/agents/:id/holdings-pnl", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const ownerWallet = req.query.owner as string;
      const agent = await storage.getAgent(id);
      
      if (!agent) {
        return res.status(404).json({ error: "Agent not found" });
      }
      
      if (!ownerWallet || agent.ownerWallet !== ownerWallet) {
        return res.status(403).json({ error: "Access denied - you don't own this agent" });
      }
      
      const evaluation = await evaluateHoldingsForSell(agent);
      
      res.json({
        agentId: agent.id,
        agentName: agent.name,
        holdings: evaluation.holdings,
        sellCandidates: evaluation.sellCandidates,
        totalUnrealizedPnlSol: evaluation.totalUnrealizedPnlSol,
        totalUnrealizedPnlPercent: evaluation.totalUnrealizedPnlPercent,
      });
    } catch (error) {
      console.error("Error getting holdings P/L:", error);
      res.status(500).json({ error: "Failed to get holdings P/L" });
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

  // Shielded Addresses - Database-backed
  app.post("/api/privacy/generate-keys", async (req, res) => {
    try {
      const { ownerWallet } = req.body;
      
      if (ownerWallet) {
        // Save to database
        const { account, keyPair } = await createShieldedAccountWithKeys(ownerWallet);
        const shieldedAddress = await generateAndSaveShieldedAddress(account.id);
        
        res.json({
          keyPair: {
            viewingPublicKey: keyPair.viewingPublicKey,
            spendingPublicKey: keyPair.spendingPublicKey,
          },
          account,
          shieldedAddress,
        });
      } else {
        // In-memory generation for compatibility
        const keyPair = generateStealthKeyPair();
        const shieldedAddress = generateShieldedAddress(
          keyPair.viewingPublicKey,
          keyPair.spendingPublicKey
        );
        
        res.json({
          keyPair: {
            viewingPublicKey: keyPair.viewingPublicKey,
            spendingPublicKey: keyPair.spendingPublicKey,
          },
          shieldedAddress,
        });
      }
    } catch (error) {
      console.error("Error generating shielded keys:", error);
      res.status(500).json({ error: "Failed to generate shielded keys" });
    }
  });

  app.get("/api/privacy/shielded-addresses", async (req, res) => {
    try {
      const ownerWallet = req.query.owner as string | undefined;
      const addresses = await listShieldedAddressesFromDB(ownerWallet);
      res.json(addresses);
    } catch (error) {
      console.error("Error listing shielded addresses:", error);
      res.status(500).json({ error: "Failed to list shielded addresses" });
    }
  });

  // Private Payments - Database-backed
  app.post("/api/privacy/payments", async (req, res) => {
    try {
      const { senderAccountId, recipientAddressId, amount, memo, senderSpendingKey } = req.body;
      
      if (!amount || amount <= 0) {
        return res.status(400).json({ error: "Valid positive amount is required" });
      }
      
      // senderSpendingKey is required for deterministic nullifier derivation and double-spend protection
      if (!senderSpendingKey || typeof senderSpendingKey !== "string" || senderSpendingKey.length < 32) {
        return res.status(400).json({ error: "senderSpendingKey is required (min 32 chars) for secure double-spend protection" });
      }
      
      const payment = await createAndSavePrivatePayment(
        senderAccountId || null, 
        recipientAddressId || null, 
        amount, 
        memo,
        senderSpendingKey
      );
      
      // Confirm the payment with verification
      const confirmResult = await confirmPrivatePaymentInDB(payment.id);
      
      if (!confirmResult.success) {
        return res.status(400).json({ error: confirmResult.error, payment });
      }
      
      res.json({ payment: confirmResult.payment, submitted: true });
    } catch (error: any) {
      console.error("Error creating private payment:", error);
      res.status(500).json({ error: error.message || "Failed to create private payment" });
    }
  });

  app.get("/api/privacy/payments", async (_req, res) => {
    try {
      const payments = await listPrivatePaymentsFromDB();
      res.json(payments);
    } catch (error) {
      console.error("Error listing private payments:", error);
      res.status(500).json({ error: "Failed to list private payments" });
    }
  });

  app.get("/api/privacy/payments/stats", async (_req, res) => {
    try {
      const stats = await getPaymentPoolStatsFromDB();
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
          "solana_stealth_transfers",
        ],
        networks: ["mainnet", "devnet", "testnet"],
        aiProviders: ["openai", "gemini", "anthropic"],
      });
    } catch (error) {
      console.error("Error getting SDK info:", error);
      res.status(500).json({ error: "Failed to get SDK info" });
    }
  });

  // Solana Stealth Transfer Routes
  app.get("/api/stealth/info", async (_req, res) => {
    try {
      const info = getStealthTransferInfo();
      const ecdhVerification = verifyECDHRoundTrip();
      res.json({ ...info, ecdhVerification });
    } catch (error) {
      console.error("Error getting stealth transfer info:", error);
      res.status(500).json({ error: "Failed to get stealth transfer info" });
    }
  });

  app.post("/api/stealth/generate-keypair", async (_req, res) => {
    try {
      const keyPair = generateSolanaStealthKeyPair();
      const serialized = serializeStealthKeyPair(keyPair);
      
      res.json({
        viewingPublicKey: serialized.viewingPublicKey,
        spendingPublicKey: serialized.spendingPublicKey,
        encryptedViewingPrivateKey: serialized.encryptedViewingPrivateKey,
        encryptedSpendingPrivateKey: serialized.encryptedSpendingPrivateKey,
        message: "Ed25519 stealth keypair generated. Private keys are encrypted with AES-256-GCM.",
      });
    } catch (error) {
      console.error("Error generating stealth keypair:", error);
      res.status(500).json({ error: "Failed to generate stealth keypair" });
    }
  });

  app.post("/api/stealth/derive-address", async (req, res) => {
    try {
      const { viewingPublicKey, spendingPublicKey } = req.body;
      
      if (!viewingPublicKey || !spendingPublicKey) {
        return res.status(400).json({ error: "viewingPublicKey and spendingPublicKey are required" });
      }
      
      const { Keypair } = await import("@solana/web3.js");
      const ephemeralKeypair = Keypair.generate();
      const viewingPubkey = new PublicKey(viewingPublicKey);
      const spendingPubkey = new PublicKey(spendingPublicKey);
      
      const stealthAddress = deriveStealthAddress(
        viewingPubkey,
        spendingPubkey,
        ephemeralKeypair
      );
      
      res.json({
        stealthAddress: stealthAddress.address,
        ephemeralPublicKey: stealthAddress.ephemeralPublicKey,
        encryptedMeta: stealthAddress.encryptedMeta,
        message: "Stealth address derived using Ed25519 key exchange",
      });
    } catch (error) {
      console.error("Error deriving stealth address:", error);
      res.status(500).json({ error: "Failed to derive stealth address" });
    }
  });

  // Recover stealth address and check balance
  app.post("/api/stealth/recover", async (req, res) => {
    try {
      const { encryptedViewingPrivateKey, encryptedSpendingPrivateKey, ephemeralPublicKey } = req.body;
      
      if (!encryptedViewingPrivateKey || !encryptedSpendingPrivateKey || !ephemeralPublicKey) {
        return res.status(400).json({ 
          error: "encryptedViewingPrivateKey, encryptedSpendingPrivateKey, and ephemeralPublicKey are required" 
        });
      }
      
      const { recoverStealthKeypair } = await import("./services/solana-stealth");
      const { Connection, PublicKey: SolPubKey, LAMPORTS_PER_SOL } = await import("@solana/web3.js");
      const { createHash, createDecipheriv } = await import("crypto");
      
      // Decrypt function (same as in solana-stealth.ts)
      const decryptData = (encryptedData: string): string => {
        const encKey = process.env.WALLET_ENCRYPTION_KEY;
        if (!encKey) throw new Error("WALLET_ENCRYPTION_KEY required");
        const key = createHash("sha256").update(encKey).digest();
        const parts = encryptedData.split(":");
        if (parts.length !== 3) throw new Error("Invalid encrypted data format");
        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      };
      
      // Decrypt the private keys directly
      const viewingSecretKeyHex = decryptData(encryptedViewingPrivateKey);
      const spendingSecretKeyHex = decryptData(encryptedSpendingPrivateKey);
      
      // Convert from hex to Uint8Array (64 bytes each)
      const viewingSecretKey = Buffer.from(viewingSecretKeyHex, "hex");
      const spendingSecretKey = Buffer.from(spendingSecretKeyHex, "hex");
      
      const ephemeralPubkey = new SolPubKey(ephemeralPublicKey);
      
      // Recover the stealth keypair using first 32 bytes (seed) of each key
      const stealthKeypair = recoverStealthKeypair(
        viewingSecretKey.slice(0, 32),
        spendingSecretKey.slice(0, 32),
        ephemeralPubkey
      );
      
      // Check balance on mainnet
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const balance = await connection.getBalance(stealthKeypair.publicKey);
      
      res.json({
        stealthAddress: stealthKeypair.publicKey.toBase58(),
        balanceLamports: balance,
        balanceSOL: balance / LAMPORTS_PER_SOL,
        canWithdraw: balance > 5000, // Need at least 5000 lamports for tx fee
        message: balance > 0 ? "Funds found in stealth address!" : "No funds in stealth address",
      });
    } catch (error: any) {
      console.error("Error recovering stealth address:", error);
      res.status(500).json({ error: error.message || "Failed to recover stealth address" });
    }
  });

  // Withdraw from stealth address
  app.post("/api/stealth/withdraw", async (req, res) => {
    try {
      const { 
        encryptedViewingPrivateKey, 
        encryptedSpendingPrivateKey, 
        ephemeralPublicKey,
        destinationAddress 
      } = req.body;
      
      if (!encryptedViewingPrivateKey || !encryptedSpendingPrivateKey || !ephemeralPublicKey || !destinationAddress) {
        return res.status(400).json({ 
          error: "encryptedViewingPrivateKey, encryptedSpendingPrivateKey, ephemeralPublicKey, and destinationAddress are required" 
        });
      }
      
      const { withdrawFromStealthAddress } = await import("./services/solana-stealth");
      const { Connection, PublicKey: SolPubKey } = await import("@solana/web3.js");
      const { createHash, createDecipheriv } = await import("crypto");
      
      // Validate destination address
      try {
        new SolPubKey(destinationAddress);
      } catch {
        return res.status(400).json({ error: "Invalid destination address" });
      }
      
      // Decrypt function
      const decryptData = (encryptedData: string): string => {
        const encKey = process.env.WALLET_ENCRYPTION_KEY;
        if (!encKey) throw new Error("WALLET_ENCRYPTION_KEY required");
        const key = createHash("sha256").update(encKey).digest();
        const parts = encryptedData.split(":");
        if (parts.length !== 3) throw new Error("Invalid encrypted data format");
        const [ivHex, authTagHex, encrypted] = parts;
        const iv = Buffer.from(ivHex, "hex");
        const authTag = Buffer.from(authTagHex, "hex");
        const decipher = createDecipheriv("aes-256-gcm", key, iv);
        decipher.setAuthTag(authTag);
        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
        return decrypted;
      };
      
      // Decrypt the private keys directly
      const viewingSecretKeyHex = decryptData(encryptedViewingPrivateKey);
      const spendingSecretKeyHex = decryptData(encryptedSpendingPrivateKey);
      const viewingSecretKey = Buffer.from(viewingSecretKeyHex, "hex");
      const spendingSecretKey = Buffer.from(spendingSecretKeyHex, "hex");
      
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      
      const signature = await withdrawFromStealthAddress(
        connection,
        viewingSecretKey.slice(0, 32),
        spendingSecretKey.slice(0, 32),
        ephemeralPublicKey,
        destinationAddress
      );
      
      res.json({
        signature,
        explorerUrl: `https://solscan.io/tx/${signature}`,
        message: "Withdrawal successful! Funds transferred to destination address.",
      });
    } catch (error: any) {
      console.error("Error withdrawing from stealth address:", error);
      res.status(500).json({ error: error.message || "Failed to withdraw from stealth address" });
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
      const paymentStats = await getPaymentPoolStatsFromDB();
      const bundlingStats = getBundlingStats();
      const zkmlStats = getZkMLStats();
      const shieldedAddresses = await listShieldedAddressesFromDB();
      
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
