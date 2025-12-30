import { createHash, randomBytes } from "crypto";

export interface Transaction {
  id: string;
  type: "transfer" | "swap" | "stake" | "unstake";
  fromAddress: string;
  toAddress: string;
  amount: number;
  token: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export interface BundledTransaction {
  bundleId: string;
  transactions: Transaction[];
  merkleRoot: string;
  aggregatedProof: string;
  gasEstimate: number;
  compressionRatio: number;
  status: "pending" | "verified" | "submitted" | "confirmed" | "failed";
  createdAt: number;
  submittedAt?: number;
  confirmedAt?: number;
}

export interface MerkleProof {
  leaf: string;
  path: string[];
  indices: number[];
  root: string;
}

function hashLeaf(data: string): string {
  return createHash("sha256").update(data).digest("hex");
}

function hashPair(left: string, right: string): string {
  const sorted = [left, right].sort();
  return createHash("sha256").update(sorted[0] + sorted[1]).digest("hex");
}

function buildMerkleTree(leaves: string[]): { root: string; layers: string[][] } {
  if (leaves.length === 0) {
    return { root: hashLeaf("empty"), layers: [[]] };
  }
  
  let paddedLeaves = [...leaves];
  while (paddedLeaves.length > 1 && (paddedLeaves.length & (paddedLeaves.length - 1)) !== 0) {
    paddedLeaves.push(paddedLeaves[paddedLeaves.length - 1]);
  }
  
  const layers: string[][] = [paddedLeaves.map(l => hashLeaf(l))];
  
  while (layers[layers.length - 1].length > 1) {
    const currentLayer = layers[layers.length - 1];
    const nextLayer: string[] = [];
    
    for (let i = 0; i < currentLayer.length; i += 2) {
      const left = currentLayer[i];
      const right = currentLayer[i + 1] || left;
      nextLayer.push(hashPair(left, right));
    }
    
    layers.push(nextLayer);
  }
  
  return { root: layers[layers.length - 1][0], layers };
}

function getMerkleProof(index: number, layers: string[][]): MerkleProof {
  const path: string[] = [];
  const indices: number[] = [];
  let currentIndex = index;
  
  for (let i = 0; i < layers.length - 1; i++) {
    const layer = layers[i];
    const isRight = currentIndex % 2 === 1;
    const siblingIndex = isRight ? currentIndex - 1 : currentIndex + 1;
    
    if (siblingIndex < layer.length) {
      path.push(layer[siblingIndex]);
      indices.push(isRight ? 0 : 1);
    }
    
    currentIndex = Math.floor(currentIndex / 2);
  }
  
  return {
    leaf: layers[0][index],
    path,
    indices,
    root: layers[layers.length - 1][0],
  };
}

function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leaf;
  
  for (let i = 0; i < proof.path.length; i++) {
    const sibling = proof.path[i];
    currentHash = proof.indices[i] === 0
      ? hashPair(sibling, currentHash)
      : hashPair(currentHash, sibling);
  }
  
  return currentHash === proof.root;
}

function generateAggregatedProof(transactions: Transaction[]): string {
  const individualProofs = transactions.map((tx, i) => ({
    index: i,
    txHash: hashLeaf(JSON.stringify(tx)),
    validityProof: createHash("sha256")
      .update(tx.id + tx.fromAddress + tx.toAddress + tx.amount)
      .digest("hex"),
  }));
  
  const aggregatedCommitment = createHash("sha256")
    .update(individualProofs.map(p => p.validityProof).join(""))
    .digest("hex");
  
  const proof = {
    type: "groth16_aggregated",
    curve: "bn128",
    numTransactions: transactions.length,
    pi_a: [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    pi_b: [
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
      [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    ],
    pi_c: [randomBytes(32).toString("hex"), randomBytes(32).toString("hex")],
    commitment: aggregatedCommitment,
    individualProofHashes: individualProofs.map(p => p.validityProof.slice(0, 16)),
  };
  
  return JSON.stringify(proof);
}

function estimateGas(transactions: Transaction[]): number {
  const baseGas = 21000;
  const perTxGas = 5000;
  const zkVerificationGas = 200000;
  
  const individualGas = transactions.length * (baseGas + perTxGas * 2);
  const bundledGas = zkVerificationGas + transactions.length * perTxGas;
  
  return bundledGas;
}

function calculateCompressionRatio(transactions: Transaction[]): number {
  const individualSize = transactions.length * 200;
  const bundledSize = 500 + transactions.length * 32;
  
  return individualSize / bundledSize;
}

export function createTransactionBundle(
  transactions: Transaction[]
): BundledTransaction {
  if (transactions.length === 0) {
    throw new Error("Cannot create empty bundle");
  }
  
  if (transactions.length > 100) {
    throw new Error("Bundle size exceeds maximum of 100 transactions");
  }
  
  const txStrings = transactions.map(tx => JSON.stringify(tx));
  const { root, layers } = buildMerkleTree(txStrings);
  
  const aggregatedProof = generateAggregatedProof(transactions);
  const gasEstimate = estimateGas(transactions);
  const compressionRatio = calculateCompressionRatio(transactions);
  
  return {
    bundleId: randomBytes(16).toString("hex"),
    transactions,
    merkleRoot: root,
    aggregatedProof,
    gasEstimate,
    compressionRatio,
    status: "pending",
    createdAt: Date.now(),
  };
}

export function verifyBundle(bundle: BundledTransaction): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  try {
    const proof = JSON.parse(bundle.aggregatedProof);
    
    if (proof.type !== "groth16_aggregated") {
      errors.push("Invalid proof type");
    }
    
    if (proof.numTransactions !== bundle.transactions.length) {
      errors.push("Transaction count mismatch");
    }
    
    if (!proof.pi_a || !proof.pi_b || !proof.pi_c) {
      errors.push("Missing proof elements");
    }
    
  } catch {
    errors.push("Failed to parse aggregated proof");
  }
  
  const txStrings = bundle.transactions.map(tx => JSON.stringify(tx));
  const { root } = buildMerkleTree(txStrings);
  
  if (root !== bundle.merkleRoot) {
    errors.push("Merkle root verification failed");
  }
  
  for (const tx of bundle.transactions) {
    if (!tx.id || !tx.fromAddress || !tx.toAddress) {
      errors.push(`Invalid transaction: ${tx.id}`);
    }
    if (tx.amount <= 0) {
      errors.push(`Invalid amount in transaction: ${tx.id}`);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getTransactionProof(
  bundle: BundledTransaction,
  transactionIndex: number
): MerkleProof | null {
  if (transactionIndex < 0 || transactionIndex >= bundle.transactions.length) {
    return null;
  }
  
  const txStrings = bundle.transactions.map(tx => JSON.stringify(tx));
  const { layers } = buildMerkleTree(txStrings);
  
  return getMerkleProof(transactionIndex, layers);
}

export function verifyTransactionInclusion(
  transactionData: string,
  proof: MerkleProof
): boolean {
  const txHash = hashLeaf(transactionData);
  
  if (txHash !== proof.leaf) {
    return false;
  }
  
  return verifyMerkleProof(proof);
}

const bundlePool: Map<string, BundledTransaction> = new Map();

export function submitBundle(bundle: BundledTransaction): {
  success: boolean;
  error?: string;
} {
  const verification = verifyBundle(bundle);
  if (!verification.valid) {
    return { success: false, error: verification.errors.join("; ") };
  }
  
  bundle.status = "verified";
  bundle.submittedAt = Date.now();
  bundlePool.set(bundle.bundleId, bundle);
  
  setTimeout(() => {
    const b = bundlePool.get(bundle.bundleId);
    if (b && b.status === "verified") {
      b.status = "confirmed";
      b.confirmedAt = Date.now();
    }
  }, 2000);
  
  return { success: true };
}

export function getBundle(bundleId: string): BundledTransaction | undefined {
  return bundlePool.get(bundleId);
}

export function listBundles(): BundledTransaction[] {
  return Array.from(bundlePool.values());
}

export function getBundlingStats(): {
  totalBundles: number;
  totalTransactions: number;
  averageCompressionRatio: number;
  totalGasSaved: number;
} {
  const bundles = Array.from(bundlePool.values());
  const totalTransactions = bundles.reduce((sum, b) => sum + b.transactions.length, 0);
  const avgCompression = bundles.length > 0
    ? bundles.reduce((sum, b) => sum + b.compressionRatio, 0) / bundles.length
    : 0;
  
  const individualGas = totalTransactions * 26000;
  const bundledGas = bundles.reduce((sum, b) => sum + b.gasEstimate, 0);
  
  return {
    totalBundles: bundles.length,
    totalTransactions,
    averageCompressionRatio: Math.round(avgCompression * 100) / 100,
    totalGasSaved: individualGas - bundledGas,
  };
}
