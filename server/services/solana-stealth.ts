import { Keypair, PublicKey, Connection, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { createHash, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { storage } from "../storage";
import nacl from "tweetnacl";

const ENCRYPTION_ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.WALLET_ENCRYPTION_KEY;
  if (!key) {
    throw new Error("WALLET_ENCRYPTION_KEY required for stealth transfers");
  }
  return createHash("sha256").update(key).digest();
}

function encryptData(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function decryptData(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");
  if (parts.length !== 3) throw new Error("Invalid encrypted data format");
  
  const [ivHex, authTagHex, encrypted] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export interface SolanaStealthKeyPair {
  viewingKeypair: Keypair;
  spendingKeypair: Keypair;
  viewingPublicKey: string;
  spendingPublicKey: string;
}

export interface StealthAddress {
  address: string;
  ephemeralPublicKey: string;
  encryptedMeta: string;
}

export interface StealthTransferResult {
  signature: string;
  stealthAddress: string;
  amount: number;
  commitment: string;
}

export function generateSolanaStealthKeyPair(): SolanaStealthKeyPair {
  const viewingKeypair = Keypair.generate();
  const spendingKeypair = Keypair.generate();
  
  return {
    viewingKeypair,
    spendingKeypair,
    viewingPublicKey: viewingKeypair.publicKey.toBase58(),
    spendingPublicKey: spendingKeypair.publicKey.toBase58(),
  };
}

function ed25519PrivateKeyToX25519(ed25519PrivateKey: Uint8Array): Uint8Array {
  const hash = createHash("sha512").update(ed25519PrivateKey.slice(0, 32)).digest();
  hash[0] &= 248;
  hash[31] &= 127;
  hash[31] |= 64;
  return new Uint8Array(hash.slice(0, 32));
}

function ed25519PublicKeyToX25519(ed25519PublicKey: Uint8Array): Uint8Array {
  const yBytes = new Uint8Array(ed25519PublicKey);
  yBytes[31] &= 0x7F;
  
  const ONE = BigInt(1);
  const P = BigInt("57896044618658097711785492504343953926634992332820282019728792003956564819949");
  
  function mod(a: bigint, m: bigint): bigint {
    return ((a % m) + m) % m;
  }
  
  function modInverse(a: bigint, m: bigint): bigint {
    let [old_r, r] = [a, m];
    let [old_s, s] = [ONE, BigInt(0)];
    while (r !== BigInt(0)) {
      const q = old_r / r;
      [old_r, r] = [r, old_r - q * r];
      [old_s, s] = [s, old_s - q * s];
    }
    return mod(old_s, m);
  }
  
  let yBigInt = BigInt(0);
  for (let i = yBytes.length - 1; i >= 0; i--) {
    yBigInt = yBigInt * BigInt(256) + BigInt(yBytes[i]);
  }
  yBigInt = mod(yBigInt, P);
  
  const numerator = mod(ONE + yBigInt, P);
  const denominator = mod(ONE - yBigInt, P);
  const u = mod(numerator * modInverse(denominator, P), P);
  
  const uBytes = new Uint8Array(32);
  let temp = u;
  for (let i = 0; i < 32; i++) {
    uBytes[i] = Number(temp % BigInt(256));
    temp = temp / BigInt(256);
  }
  
  return uBytes;
}

export function deriveSharedSecretECDH(
  privateKeyBytes: Uint8Array,
  publicKeyBytes: Uint8Array
): Buffer {
  const x25519PrivateKey = ed25519PrivateKeyToX25519(privateKeyBytes);
  const x25519PublicKey = ed25519PublicKeyToX25519(publicKeyBytes);
  
  const sharedSecret = nacl.scalarMult(x25519PrivateKey, x25519PublicKey);
  
  return createHash("sha256").update(sharedSecret).digest();
}

export function deriveStealthAddress(
  recipientViewingPubkey: PublicKey,
  recipientSpendingPubkey: PublicKey,
  ephemeralKeypair: Keypair
): StealthAddress {
  const sharedSecret = deriveSharedSecretECDH(
    ephemeralKeypair.secretKey.slice(0, 32),
    recipientViewingPubkey.toBytes()
  );
  
  const stealthSeed = createHash("sha256")
    .update(Buffer.concat([sharedSecret, recipientSpendingPubkey.toBytes()]))
    .digest();
  
  const stealthKeypair = Keypair.fromSeed(stealthSeed);
  
  const meta = {
    ephemeralPubkey: ephemeralKeypair.publicKey.toBase58(),
    recipientViewingPubkey: recipientViewingPubkey.toBase58(),
    recipientSpendingPubkey: recipientSpendingPubkey.toBase58(),
    timestamp: Date.now(),
  };
  
  return {
    address: stealthKeypair.publicKey.toBase58(),
    ephemeralPublicKey: ephemeralKeypair.publicKey.toBase58(),
    encryptedMeta: encryptData(JSON.stringify(meta)),
  };
}

export function recoverStealthKeypair(
  viewingPrivateKey: Uint8Array,
  spendingPrivateKey: Uint8Array,
  ephemeralPublicKey: PublicKey
): Keypair {
  const sharedSecret = deriveSharedSecretECDH(
    viewingPrivateKey,
    ephemeralPublicKey.toBytes()
  );
  
  const fullSpendingKey = Buffer.alloc(64);
  Buffer.from(spendingPrivateKey).copy(fullSpendingKey, 0);
  const spendingPubkey = Keypair.fromSecretKey(fullSpendingKey).publicKey;
  
  const stealthSeed = createHash("sha256")
    .update(Buffer.concat([sharedSecret, spendingPubkey.toBytes()]))
    .digest();
  
  return Keypair.fromSeed(stealthSeed);
}

export async function createStealthTransfer(
  connection: Connection,
  senderKeypair: Keypair,
  recipientViewingPubkey: string,
  recipientSpendingPubkey: string,
  amountSOL: number
): Promise<StealthTransferResult> {
  const ephemeralKeypair = Keypair.generate();
  
  const viewingPubkey = new PublicKey(recipientViewingPubkey);
  const spendingPubkey = new PublicKey(recipientSpendingPubkey);
  
  const stealthAddress = deriveStealthAddress(
    viewingPubkey,
    spendingPubkey,
    ephemeralKeypair
  );
  
  const stealthPubkey = new PublicKey(stealthAddress.address);
  const lamports = Math.floor(amountSOL * LAMPORTS_PER_SOL);
  
  const commitment = createHash("sha256")
    .update(`${stealthAddress.address}:${lamports}:${Date.now()}`)
    .digest("hex");
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: stealthPubkey,
      lamports,
    })
  );
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = senderKeypair.publicKey;
  
  transaction.sign(senderKeypair);
  
  const signature = await connection.sendRawTransaction(transaction.serialize());
  
  await connection.confirmTransaction(signature, "confirmed");
  
  return {
    signature,
    stealthAddress: stealthAddress.address,
    amount: amountSOL,
    commitment,
  };
}

export async function scanForStealthPayments(
  connection: Connection,
  viewingPrivateKey: Uint8Array,
  spendingPrivateKey: Uint8Array,
  knownEphemeralKeys: string[]
): Promise<{ address: string; balance: number }[]> {
  const results: { address: string; balance: number }[] = [];
  
  for (const ephemeralKeyStr of knownEphemeralKeys) {
    try {
      const ephemeralPubkey = new PublicKey(ephemeralKeyStr);
      const stealthKeypair = recoverStealthKeypair(
        viewingPrivateKey,
        spendingPrivateKey,
        ephemeralPubkey
      );
      
      const balance = await connection.getBalance(stealthKeypair.publicKey);
      
      if (balance > 0) {
        results.push({
          address: stealthKeypair.publicKey.toBase58(),
          balance: balance / LAMPORTS_PER_SOL,
        });
      }
    } catch (e) {
      continue;
    }
  }
  
  return results;
}

export async function withdrawFromStealthAddress(
  connection: Connection,
  viewingPrivateKey: Uint8Array,
  spendingPrivateKey: Uint8Array,
  ephemeralPublicKey: string,
  destinationAddress: string
): Promise<string> {
  const ephemeralPubkey = new PublicKey(ephemeralPublicKey);
  const stealthKeypair = recoverStealthKeypair(
    viewingPrivateKey,
    spendingPrivateKey,
    ephemeralPubkey
  );
  
  const balance = await connection.getBalance(stealthKeypair.publicKey);
  
  if (balance === 0) {
    throw new Error("No funds in stealth address");
  }
  
  const destination = new PublicKey(destinationAddress);
  
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: stealthKeypair.publicKey,
      toPubkey: destination,
      lamports: balance - 5000,
    })
  );
  
  const { blockhash } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = stealthKeypair.publicKey;
  
  transaction.sign(stealthKeypair);
  
  const signature = await connection.sendRawTransaction(transaction.serialize());
  
  await connection.confirmTransaction(signature, "confirmed");
  
  return signature;
}

export function serializeStealthKeyPair(keyPair: SolanaStealthKeyPair): {
  encryptedViewingPrivateKey: string;
  encryptedSpendingPrivateKey: string;
  viewingPublicKey: string;
  spendingPublicKey: string;
} {
  return {
    encryptedViewingPrivateKey: encryptData(
      Buffer.from(keyPair.viewingKeypair.secretKey).toString("hex")
    ),
    encryptedSpendingPrivateKey: encryptData(
      Buffer.from(keyPair.spendingKeypair.secretKey).toString("hex")
    ),
    viewingPublicKey: keyPair.viewingPublicKey,
    spendingPublicKey: keyPair.spendingPublicKey,
  };
}

export function deserializeStealthKeyPair(serialized: {
  encryptedViewingPrivateKey: string;
  encryptedSpendingPrivateKey: string;
  viewingPublicKey: string;
  spendingPublicKey: string;
}): SolanaStealthKeyPair {
  const viewingSecretKey = Buffer.from(
    decryptData(serialized.encryptedViewingPrivateKey),
    "hex"
  );
  const spendingSecretKey = Buffer.from(
    decryptData(serialized.encryptedSpendingPrivateKey),
    "hex"
  );
  
  return {
    viewingKeypair: Keypair.fromSecretKey(viewingSecretKey),
    spendingKeypair: Keypair.fromSecretKey(spendingSecretKey),
    viewingPublicKey: serialized.viewingPublicKey,
    spendingPublicKey: serialized.spendingPublicKey,
  };
}

export function getStealthTransferInfo(): {
  description: string;
  features: string[];
  securityLevel: string;
} {
  return {
    description: "Solana Stealth Transfer Protocol using Ed25519 key exchange",
    features: [
      "X25519 ECDH for secure key exchange via nacl.scalarMult",
      "Ed25519 to X25519 key conversion with sign bit masking",
      "Ephemeral keypairs for each transfer (unlinkability)",
      "AES-256-GCM encryption for metadata",
      "Deterministic stealth address derivation",
      "Compatible with Solana mainnet",
    ],
    securityLevel: "Production-ready with real Solana integration",
  };
}

export function verifyECDHRoundTrip(): { success: boolean; details: string } {
  try {
    const recipientKeyPair = generateSolanaStealthKeyPair();
    const ephemeralKeypair = Keypair.generate();
    
    const senderSharedSecret = deriveSharedSecretECDH(
      ephemeralKeypair.secretKey.slice(0, 32),
      recipientKeyPair.viewingKeypair.publicKey.toBytes()
    );
    
    const recipientSharedSecret = deriveSharedSecretECDH(
      recipientKeyPair.viewingKeypair.secretKey.slice(0, 32),
      ephemeralKeypair.publicKey.toBytes()
    );
    
    const senderHex = senderSharedSecret.toString("hex");
    const recipientHex = recipientSharedSecret.toString("hex");
    
    if (senderHex === recipientHex) {
      return {
        success: true,
        details: `ECDH verified: shared secrets match (${senderHex.slice(0, 16)}...)`,
      };
    } else {
      return {
        success: false,
        details: `ECDH failed: sender=${senderHex.slice(0, 16)}... recipient=${recipientHex.slice(0, 16)}...`,
      };
    }
  } catch (error: any) {
    return {
      success: false,
      details: `ECDH error: ${error.message}`,
    };
  }
}
