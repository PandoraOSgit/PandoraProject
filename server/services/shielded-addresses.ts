import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { storage } from "../storage";
import type { ShieldedAccount, ShieldedAddress as DBShieldedAddress, InsertShieldedAccount, InsertShieldedAddress } from "@shared/schema";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getPrivacyEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("WALLET_ENCRYPTION_KEY environment variable is required for privacy features");
  }
  return createHash("sha256").update(key).digest();
}

function encryptString(plaintext: string): string {
  const encryptionKey = getPrivacyEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
  
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptString(encryptedData: string): string {
  const encryptionKey = getPrivacyEncryptionKey();
  const parts = encryptedData.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

export interface ShieldedAddressLocal {
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
): ShieldedAddressLocal {
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
): { address: ShieldedAddressLocal; ephemeralPublicKey: string } {
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

// Database-backed functions for shielded accounts and addresses

export async function createShieldedAccountWithKeys(
  ownerWallet: string
): Promise<{ account: ShieldedAccount; keyPair: StealthKeyPair }> {
  const keyPair = generateStealthKeyPair();
  
  // Encrypt private keys using AES-256-GCM before storing
  const encryptedViewingPrivateKey = encryptString(keyPair.viewingPrivateKey);
  const encryptedSpendingPrivateKey = encryptString(keyPair.spendingPrivateKey);
  
  const account = await storage.createShieldedAccount({
    ownerWallet,
    viewingPublicKey: keyPair.viewingPublicKey,
    spendingPublicKey: keyPair.spendingPublicKey,
    encryptedViewingPrivateKey,
    encryptedSpendingPrivateKey,
    status: "active",
  });
  
  return { account, keyPair };
}

export function decryptAccountKeys(account: ShieldedAccount): StealthKeyPair {
  if (!account.encryptedViewingPrivateKey || !account.encryptedSpendingPrivateKey) {
    throw new Error("Account does not have encrypted keys");
  }
  
  // Check if keys are in encrypted format (iv:authTag:ciphertext)
  const isEncrypted = account.encryptedViewingPrivateKey.includes(":");
  
  if (isEncrypted) {
    return {
      viewingPrivateKey: decryptString(account.encryptedViewingPrivateKey),
      viewingPublicKey: account.viewingPublicKey,
      spendingPrivateKey: decryptString(account.encryptedSpendingPrivateKey),
      spendingPublicKey: account.spendingPublicKey,
    };
  } else {
    // Legacy unencrypted format - reject for security
    throw new Error("Account has legacy unencrypted keys. Please run key migration.");
  }
}

// Check if a string is in the encrypted format (iv:authTag:ciphertext)
function isEncryptedFormat(value: string): boolean {
  return value.includes(":") && value.split(":").length === 3;
}

// One-time migration to encrypt any old plaintext keys
export async function migrateUnencryptedKeys(): Promise<{ migrated: number; skipped: number; errors: number }> {
  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  
  try {
    const allAccounts = await storage.getAllShieldedAccounts();
    
    for (const account of allAccounts) {
      try {
        // Check if keys are already encrypted
        if (account.encryptedViewingPrivateKey && isEncryptedFormat(account.encryptedViewingPrivateKey)) {
          skipped++;
          continue;
        }
        
        // Old plaintext key found - encrypt and update
        if (account.encryptedViewingPrivateKey && account.encryptedSpendingPrivateKey) {
          const encryptedViewingKey = encryptString(account.encryptedViewingPrivateKey);
          const encryptedSpendingKey = encryptString(account.encryptedSpendingPrivateKey);
          
          await storage.updateShieldedAccount(account.id, {
            encryptedViewingPrivateKey: encryptedViewingKey,
            encryptedSpendingPrivateKey: encryptedSpendingKey,
          });
          
          migrated++;
          console.log(`[Security] Migrated encryption for shielded account ${account.id}`);
        }
      } catch (e) {
        errors++;
        console.error(`[Security] Failed to migrate account ${account.id}:`, e);
      }
    }
    
    console.log(`[Security] Key migration complete: ${migrated} migrated, ${skipped} already encrypted, ${errors} errors`);
  } catch (e) {
    console.error("[Security] Key migration failed:", e);
  }
  
  return { migrated, skipped, errors };
}

export async function generateAndSaveShieldedAddress(
  accountId: number
): Promise<DBShieldedAddress> {
  const account = await storage.getShieldedAccount(accountId);
  if (!account) {
    throw new Error("Account not found");
  }
  
  const localAddress = generateShieldedAddress(
    account.viewingPublicKey,
    account.spendingPublicKey
  );
  
  const meta = JSON.parse(Buffer.from(localAddress.stealthMeta, "base64").toString());
  
  const dbAddress = await storage.createShieldedAddress({
    accountId,
    publicAddress: localAddress.publicAddress,
    ephemeralPublicKey: meta.ephemeralPublicKey,
    stealthMeta: { raw: localAddress.stealthMeta },
    status: "unused",
  });
  
  return dbAddress;
}

export async function getShieldedAddressFromDB(publicAddress: string): Promise<DBShieldedAddress | undefined> {
  return storage.getShieldedAddressByPublicAddress(publicAddress);
}

export async function listShieldedAddressesFromDB(ownerWallet?: string): Promise<DBShieldedAddress[]> {
  return storage.getAllShieldedAddresses(ownerWallet);
}

export async function getShieldedAccountsByOwner(ownerWallet: string): Promise<ShieldedAccount[]> {
  return storage.getShieldedAccountsByOwner(ownerWallet);
}

export async function markAddressAsUsed(addressId: number): Promise<void> {
  await storage.updateShieldedAddress(addressId, { status: "used" });
}
