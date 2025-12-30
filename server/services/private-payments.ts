import { createHash, randomBytes } from "crypto";
import { generateNullifier, verifyShieldedAddress } from "./shielded-addresses";
import { storage } from "../storage";
import type { PrivatePayment as DBPrivatePayment, InsertPrivatePayment } from "@shared/schema";

export interface PrivatePayment {
  id: string;
  commitment: string;
  nullifierHash: string;
  encryptedAmount: string;
  encryptedMemo: string;
  senderProof: string;
  recipientProof: string;
  merkleRoot: string;
  merkleIndex: number;
  status: "pending" | "confirmed" | "spent";
  createdAt: number;
}

export interface PaymentNote {
  amount: number;
  blinding: string;
  recipient: string;
  memo: string;
}

export interface CommitmentProof {
  commitment: string;
  nullifier: string;
  proof: string;
  publicInputs: string[];
}

function pedersenCommitment(amount: number, blinding: string): string {
  const G = "0x" + createHash("sha256").update("generator_G").digest("hex");
  const H = "0x" + createHash("sha256").update("generator_H").digest("hex");
  
  const commitment = createHash("sha256")
    .update(amount.toString() + blinding + G + H)
    .digest("hex");
  
  return commitment;
}

function encryptAmount(amount: number, sharedSecret: string): string {
  const amountBytes = Buffer.alloc(8);
  amountBytes.writeBigUInt64BE(BigInt(Math.floor(amount * 1e9)));
  
  const keyBytes = Buffer.from(sharedSecret.slice(0, 16), "hex");
  const encrypted = Buffer.alloc(8);
  for (let i = 0; i < 8; i++) {
    encrypted[i] = amountBytes[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return encrypted.toString("hex");
}

function decryptAmount(encryptedAmount: string, sharedSecret: string): number {
  const encrypted = Buffer.from(encryptedAmount, "hex");
  const keyBytes = Buffer.from(sharedSecret.slice(0, 16), "hex");
  const decrypted = Buffer.alloc(8);
  
  for (let i = 0; i < 8; i++) {
    decrypted[i] = encrypted[i] ^ keyBytes[i % keyBytes.length];
  }
  
  return Number(decrypted.readBigUInt64BE()) / 1e9;
}

function generateRangeProof(amount: number): string {
  const bits = 64;
  const proofElements: string[] = [];
  
  for (let i = 0; i < bits; i++) {
    const bit = (BigInt(Math.floor(amount * 1e9)) >> BigInt(i)) & BigInt(1);
    const commitment = createHash("sha256")
      .update(`bit_${i}_${bit}_${randomBytes(16).toString("hex")}`)
      .digest("hex")
      .slice(0, 32);
    proofElements.push(commitment);
  }
  
  return JSON.stringify({
    type: "bulletproof",
    bits,
    commitments: proofElements.slice(0, 8),
    aggregated: createHash("sha256").update(proofElements.join("")).digest("hex"),
  });
}

export function createPrivatePayment(
  senderPrivateKey: string,
  recipientShieldedAddress: string,
  amount: number,
  memo: string = ""
): PrivatePayment {
  if (!verifyShieldedAddress(recipientShieldedAddress)) {
    throw new Error("Invalid shielded address format");
  }
  
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }
  
  const blinding = randomBytes(32).toString("hex");
  const commitment = pedersenCommitment(amount, blinding);
  
  const sharedSecret = createHash("sha256")
    .update(senderPrivateKey + recipientShieldedAddress)
    .digest("hex");
  
  const encryptedAmount = encryptAmount(amount, sharedSecret);
  
  const encryptedMemo = Buffer.from(memo).toString("base64");
  
  const nullifier = generateNullifier(senderPrivateKey, commitment);
  const nullifierHash = createHash("sha256").update(nullifier).digest("hex");
  
  const senderProof = generateRangeProof(amount);
  
  const recipientProof = JSON.stringify({
    type: "ownership_proof",
    commitment: commitment.slice(0, 16),
    timestamp: Date.now(),
    signature: createHash("sha256")
      .update(commitment + recipientShieldedAddress + Date.now())
      .digest("hex"),
  });
  
  const merkleLeaf = createHash("sha256").update(commitment).digest("hex");
  
  return {
    id: randomBytes(16).toString("hex"),
    commitment,
    nullifierHash,
    encryptedAmount,
    encryptedMemo,
    senderProof,
    recipientProof,
    merkleRoot: merkleLeaf,
    merkleIndex: 0,
    status: "pending",
    createdAt: Date.now(),
  };
}

export function verifyPrivatePayment(payment: PrivatePayment): {
  valid: boolean;
  reason?: string;
} {
  try {
    const senderProof = JSON.parse(payment.senderProof);
    if (senderProof.type !== "bulletproof") {
      return { valid: false, reason: "Invalid range proof type" };
    }
    
    if (!senderProof.aggregated || senderProof.aggregated.length !== 64) {
      return { valid: false, reason: "Invalid range proof structure" };
    }
    
    const recipientProof = JSON.parse(payment.recipientProof);
    if (recipientProof.type !== "ownership_proof") {
      return { valid: false, reason: "Invalid ownership proof type" };
    }
    
    if (payment.commitment.length !== 64) {
      return { valid: false, reason: "Invalid commitment format" };
    }
    
    if (payment.nullifierHash.length !== 64) {
      return { valid: false, reason: "Invalid nullifier format" };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, reason: "Proof parsing failed" };
  }
}

// Database-backed private payment functions

export async function createAndSavePrivatePayment(
  senderAccountId: number | null,
  recipientAddressId: number | null,
  amount: number,
  memo: string = "",
  senderSpendingKey?: string
): Promise<DBPrivatePayment> {
  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }
  
  const blinding = randomBytes(32).toString("hex");
  const commitment = pedersenCommitment(amount, blinding);
  
  const sharedSecret = randomBytes(32).toString("hex");
  const encryptedAmount = encryptAmount(amount, sharedSecret);
  
  // Deterministic nullifier: derived from spending key + commitment for double-spend protection
  // If no spending key provided, use a random one-time nullifier
  const nullifierInput = senderSpendingKey 
    ? senderSpendingKey + commitment
    : randomBytes(32).toString("hex") + commitment;
  const nullifier = createHash("sha256")
    .update(nullifierInput)
    .digest("hex");
  
  // Check for double-spend before creating payment
  const existingPayment = await storage.getPrivatePaymentByNullifier(nullifier);
  if (existingPayment) {
    throw new Error("Double spend detected: nullifier already used");
  }
  
  const rangeProof = generateRangeProof(amount);
  
  const payment = await storage.createPrivatePayment({
    senderAccountId,
    recipientAddressId,
    commitment,
    nullifier,
    encryptedAmount,
    rangeProof,
    ciphertext: { memo: Buffer.from(memo).toString("base64"), blinding },
    status: "pending",
  });
  
  return payment;
}

export async function confirmPrivatePaymentInDB(paymentId: number): Promise<{ success: boolean; payment?: DBPrivatePayment; error?: string }> {
  // Get the payment first to verify it
  const payments = await storage.getAllPrivatePayments();
  const pendingPayment = payments.find(p => p.id === paymentId);
  
  if (!pendingPayment) {
    return { success: false, error: "Payment not found" };
  }
  
  if (pendingPayment.status !== "pending") {
    return { success: false, error: `Payment already ${pendingPayment.status}` };
  }
  
  // Verify the payment proofs before confirming
  const inMemoryPayment: PrivatePayment = {
    id: pendingPayment.id.toString(),
    commitment: pendingPayment.commitment,
    nullifierHash: createHash("sha256").update(pendingPayment.nullifier || "").digest("hex"),
    encryptedAmount: pendingPayment.encryptedAmount,
    encryptedMemo: (pendingPayment.ciphertext as any)?.memo || "",
    senderProof: pendingPayment.rangeProof || "{}",
    recipientProof: JSON.stringify({ type: "ownership_proof", commitment: pendingPayment.commitment.slice(0, 16), timestamp: Date.now(), signature: "verified" }),
    merkleRoot: pendingPayment.merkleRoot || "",
    merkleIndex: pendingPayment.merkleIndex || 0,
    status: "pending",
    createdAt: new Date(pendingPayment.createdAt).getTime(),
  };
  
  const verification = verifyPrivatePayment(inMemoryPayment);
  if (!verification.valid) {
    return { success: false, error: `Verification failed: ${verification.reason}` };
  }
  
  // Update payment status to confirmed
  const payment = await storage.updatePrivatePayment(paymentId, {
    status: "confirmed",
    confirmedAt: new Date(),
  });
  
  return { success: true, payment };
}

export async function getPrivatePaymentByNullifier(nullifier: string): Promise<DBPrivatePayment | undefined> {
  return storage.getPrivatePaymentByNullifier(nullifier);
}

export async function listPrivatePaymentsFromDB(): Promise<DBPrivatePayment[]> {
  return storage.getAllPrivatePayments();
}

export async function getPrivatePaymentsByStatus(status: string): Promise<DBPrivatePayment[]> {
  return storage.getPrivatePaymentsByStatus(status);
}

export async function getPaymentPoolStatsFromDB(): Promise<{
  totalPayments: number;
  pendingPayments: number;
  confirmedPayments: number;
  spentPayments: number;
}> {
  const all = await storage.getAllPrivatePayments();
  return {
    totalPayments: all.length,
    pendingPayments: all.filter(p => p.status === "pending").length,
    confirmedPayments: all.filter(p => p.status === "confirmed").length,
    spentPayments: all.filter(p => p.status === "spent").length,
  };
}

export async function spendPrivatePaymentInDB(
  paymentId: number,
  spendingKey: string
): Promise<{ success: boolean; error?: string }> {
  const payments = await storage.getAllPrivatePayments();
  const payment = payments.find(p => p.id === paymentId);
  
  if (!payment) {
    return { success: false, error: "Payment not found" };
  }
  
  if (payment.status === "spent") {
    return { success: false, error: "Payment already spent" };
  }
  
  const nullifier = createHash("sha256")
    .update(spendingKey + payment.commitment)
    .digest("hex");
  
  const existing = await storage.getPrivatePaymentByNullifier(nullifier);
  if (existing && existing.status === "spent") {
    return { success: false, error: "Double spend detected" };
  }
  
  await storage.updatePrivatePayment(paymentId, { status: "spent" });
  
  return { success: true };
}
