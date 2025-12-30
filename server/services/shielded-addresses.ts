import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";

export interface ShieldedAddress {
  publicAddress: string;
  viewingKey: string;
  spendingKeyHash: string;
  stealthMeta: string;
  createdAt: number;
}

export interface StealthKeyPair {
  viewingPrivateKey: string;
  viewingPublicKey: string;
  spendingPrivateKey: string;
  spendingPublicKey: string;
}

export interface ShieldedTransaction {
  id: string;
  fromShielded: string;
  toShielded: string;
  encryptedAmount: string;
  commitment: string;
  nullifier: string;
  proof: string;
  timestamp: number;
}

function generateKeyPair(): { privateKey: string; publicKey: string } {
  const privateKey = randomBytes(32).toString("hex");
  const publicKey = createHash("sha256")
    .update(privateKey)
    .digest("hex");
  return { privateKey, publicKey };
}

function deriveSharedSecret(privateKey: string, publicKey: string): string {
  return createHash("sha256")
    .update(privateKey + publicKey)
    .digest("hex");
}

function encryptWithKey(data: string, key: string): string {
  const iv = randomBytes(16);
  const keyBuffer = Buffer.from(key.slice(0, 32), "hex");
  const cipher = createCipheriv("aes-128-cbc", keyBuffer.slice(0, 16), iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptWithKey(encryptedData: string, key: string): string {
  const [ivHex, encrypted] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const keyBuffer = Buffer.from(key.slice(0, 32), "hex");
  const decipher = createDecipheriv("aes-128-cbc", keyBuffer.slice(0, 16), iv);
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function generateStealthKeyPair(): StealthKeyPair {
  const viewing = generateKeyPair();
  const spending = generateKeyPair();
  
  return {
    viewingPrivateKey: viewing.privateKey,
    viewingPublicKey: viewing.publicKey,
    spendingPrivateKey: spending.privateKey,
    spendingPublicKey: spending.publicKey,
  };
}

export function generateShieldedAddress(
  viewingPublicKey: string,
  spendingPublicKey: string
): ShieldedAddress {
  const ephemeralKey = randomBytes(32).toString("hex");
  
  const sharedSecret = deriveSharedSecret(ephemeralKey, viewingPublicKey);
  
  const stealthPublicKey = createHash("sha256")
    .update(sharedSecret + spendingPublicKey)
    .digest("hex");
  
  const publicAddress = "zk" + stealthPublicKey.slice(0, 40);
  
  const stealthMeta = Buffer.from(JSON.stringify({
    ephemeralPublicKey: createHash("sha256").update(ephemeralKey).digest("hex"),
    encryptedData: encryptWithKey(ephemeralKey, sharedSecret.slice(0, 32)),
  })).toString("base64");
  
  return {
    publicAddress,
    viewingKey: viewingPublicKey,
    spendingKeyHash: createHash("sha256").update(spendingPublicKey).digest("hex").slice(0, 16),
    stealthMeta,
    createdAt: Date.now(),
  };
}

export function deriveShieldedAddress(
  recipientViewingKey: string,
  recipientSpendingKey: string,
  senderPrivateKey: string
): { address: ShieldedAddress; ephemeralPublicKey: string } {
  const sharedSecret = deriveSharedSecret(senderPrivateKey, recipientViewingKey);
  
  const stealthKey = createHash("sha256")
    .update(sharedSecret + recipientSpendingKey)
    .digest("hex");
  
  const publicAddress = "zk" + stealthKey.slice(0, 40);
  const ephemeralPublicKey = createHash("sha256").update(senderPrivateKey).digest("hex");
  
  return {
    address: {
      publicAddress,
      viewingKey: recipientViewingKey,
      spendingKeyHash: createHash("sha256").update(recipientSpendingKey).digest("hex").slice(0, 16),
      stealthMeta: Buffer.from(JSON.stringify({ ephemeralPublicKey })).toString("base64"),
      createdAt: Date.now(),
    },
    ephemeralPublicKey,
  };
}

export function scanForPayments(
  viewingPrivateKey: string,
  spendingPublicKey: string,
  transactions: Array<{ stealthMeta: string; commitment: string }>
): Array<{ index: number; amount: string }> {
  const foundPayments: Array<{ index: number; amount: string }> = [];
  
  for (let i = 0; i < transactions.length; i++) {
    const tx = transactions[i];
    try {
      const meta = JSON.parse(Buffer.from(tx.stealthMeta, "base64").toString());
      const sharedSecret = deriveSharedSecret(viewingPrivateKey, meta.ephemeralPublicKey);
      
      const expectedAddress = "zk" + createHash("sha256")
        .update(sharedSecret + spendingPublicKey)
        .digest("hex")
        .slice(0, 40);
      
      if (tx.commitment.includes(expectedAddress.slice(2, 10))) {
        foundPayments.push({
          index: i,
          amount: "encrypted",
        });
      }
    } catch {
      continue;
    }
  }
  
  return foundPayments;
}

export function generateNullifier(
  spendingPrivateKey: string,
  commitment: string
): string {
  return createHash("sha256")
    .update(spendingPrivateKey + commitment)
    .digest("hex");
}

export function verifyShieldedAddress(address: string): boolean {
  return address.startsWith("zk") && address.length === 42;
}

const shieldedAddressRegistry: Map<string, ShieldedAddress> = new Map();

export function registerShieldedAddress(address: ShieldedAddress): void {
  shieldedAddressRegistry.set(address.publicAddress, address);
}

export function getShieldedAddress(publicAddress: string): ShieldedAddress | undefined {
  return shieldedAddressRegistry.get(publicAddress);
}

export function listShieldedAddresses(): ShieldedAddress[] {
  return Array.from(shieldedAddressRegistry.values());
}
