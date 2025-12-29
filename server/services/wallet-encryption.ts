import crypto from "crypto";
import { Keypair } from "@solana/web3.js";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("WALLET_ENCRYPTION_KEY environment variable is required");
  }
  return crypto.createHash("sha256").update(key).digest();
}

export function encryptPrivateKey(secretKey: Uint8Array): string {
  const encryptionKey = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  
  const secretKeyBase64 = Buffer.from(secretKey).toString("base64");
  let encrypted = cipher.update(secretKeyBase64, "utf8", "hex");
  encrypted += cipher.final("hex");
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptPrivateKey(encryptedData: string): Uint8Array {
  const encryptionKey = getEncryptionKey();
  const parts = encryptedData.split(":");
  
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return new Uint8Array(Buffer.from(decrypted, "base64"));
}

export function generateAgentWallet(): { publicKey: string; encryptedPrivateKey: string } {
  const keypair = Keypair.generate();
  const encryptedPrivateKey = encryptPrivateKey(keypair.secretKey);
  
  return {
    publicKey: keypair.publicKey.toBase58(),
    encryptedPrivateKey,
  };
}

export function getAgentKeypair(encryptedPrivateKey: string): Keypair {
  const secretKey = decryptPrivateKey(encryptedPrivateKey);
  return Keypair.fromSecretKey(secretKey);
}
