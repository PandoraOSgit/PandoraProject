import { createHash, randomBytes } from "crypto";
import { generateNullifier, verifyShieldedAddress } from "./shielded-addresses";

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

const nullifierSet: Set<string> = new Set();
const paymentPool: Map<string, PrivatePayment> = new Map();

export function submitPrivatePayment(payment: PrivatePayment): {
  success: boolean;
  error?: string;
} {
  if (nullifierSet.has(payment.nullifierHash)) {
    return { success: false, error: "Double spend detected: nullifier already used" };
  }
  
  const verification = verifyPrivatePayment(payment);
  if (!verification.valid) {
    return { success: false, error: verification.reason };
  }
  
  nullifierSet.add(payment.nullifierHash);
  payment.status = "confirmed";
  paymentPool.set(payment.id, payment);
  
  return { success: true };
}

export function spendPrivatePayment(
  paymentId: string,
  spendingKey: string,
  newRecipient: string,
  amount: number
): { success: boolean; newPayment?: PrivatePayment; error?: string } {
  const payment = paymentPool.get(paymentId);
  if (!payment) {
    return { success: false, error: "Payment not found" };
  }
  
  if (payment.status === "spent") {
    return { success: false, error: "Payment already spent" };
  }
  
  const nullifier = generateNullifier(spendingKey, payment.commitment);
  const expectedNullifierHash = createHash("sha256").update(nullifier).digest("hex");
  
  if (nullifierSet.has(expectedNullifierHash)) {
    return { success: false, error: "Invalid spending key or already spent" };
  }
  
  payment.status = "spent";
  nullifierSet.add(expectedNullifierHash);
  
  const newPayment = createPrivatePayment(spendingKey, newRecipient, amount);
  const submitted = submitPrivatePayment(newPayment);
  
  if (!submitted.success) {
    return { success: false, error: submitted.error };
  }
  
  return { success: true, newPayment };
}

export function getPrivatePayment(id: string): PrivatePayment | undefined {
  return paymentPool.get(id);
}

export function listPrivatePayments(): PrivatePayment[] {
  return Array.from(paymentPool.values());
}

export function getPaymentPoolStats(): {
  totalPayments: number;
  pendingPayments: number;
  confirmedPayments: number;
  spentPayments: number;
  totalNullifiers: number;
} {
  const payments = Array.from(paymentPool.values());
  return {
    totalPayments: payments.length,
    pendingPayments: payments.filter(p => p.status === "pending").length,
    confirmedPayments: payments.filter(p => p.status === "confirmed").length,
    spentPayments: payments.filter(p => p.status === "spent").length,
    totalNullifiers: nullifierSet.size,
  };
}
