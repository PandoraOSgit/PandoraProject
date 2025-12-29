import { Connection, PublicKey, Transaction, VersionedTransaction, Keypair } from "@solana/web3.js";

const JUPITER_API_BASE = "https://quote-api.jup.ag/v6";
const RPC_URL = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

export interface SwapQuote {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: string;
  routePlan: RouteStep[];
}

export interface RouteStep {
  swapInfo: {
    ammKey: string;
    label: string;
    inputMint: string;
    outputMint: string;
    inAmount: string;
    outAmount: string;
    feeAmount: string;
    feeMint: string;
  };
  percent: number;
}

export interface SwapResult {
  success: boolean;
  signature?: string;
  inputAmount?: number;
  outputAmount?: number;
  error?: string;
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

export async function getSwapQuote(
  inputMint: string,
  outputMint: string,
  amount: number,
  slippageBps: number = 50
): Promise<SwapQuote | null> {
  try {
    const amountInLamports = Math.floor(amount * 1e9);
    
    const url = `${JUPITER_API_BASE}/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountInLamports}&slippageBps=${slippageBps}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error("[Jupiter] Quote request failed:", response.status);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("[Jupiter] Error getting swap quote:", error);
    return null;
  }
}

export async function executeSwap(
  quote: SwapQuote,
  userPublicKey: string,
  keypair?: Keypair
): Promise<SwapResult> {
  try {
    const swapResponse = await fetch(`${JUPITER_API_BASE}/swap`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey,
        wrapAndUnwrapSol: true,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: 10000,
      }),
    });

    if (!swapResponse.ok) {
      const errorData = await swapResponse.json();
      return {
        success: false,
        error: errorData.error || "Failed to create swap transaction",
      };
    }

    const { swapTransaction } = await swapResponse.json();

    if (!keypair) {
      return {
        success: false,
        error: "No keypair provided for signing",
      };
    }

    const connection = new Connection(RPC_URL, "confirmed");
    
    const swapTransactionBuf = Buffer.from(swapTransaction, "base64");
    const transaction = VersionedTransaction.deserialize(swapTransactionBuf);
    
    transaction.sign([keypair]);

    const signature = await connection.sendTransaction(transaction, {
      skipPreflight: false,
      maxRetries: 3,
    });

    const confirmation = await connection.confirmTransaction(signature, "confirmed");

    if (confirmation.value.err) {
      return {
        success: false,
        error: `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
      };
    }

    const inputAmount = parseInt(quote.inAmount) / 1e9;
    const outputAmount = parseInt(quote.outAmount) / 1e9;

    console.log(`[Jupiter] Swap executed: ${signature}`);
    console.log(`[Jupiter] Swapped ${inputAmount} for ${outputAmount}`);

    return {
      success: true,
      signature,
      inputAmount,
      outputAmount,
    };
  } catch (error) {
    console.error("[Jupiter] Error executing swap:", error);
    return {
      success: false,
      error: String(error),
    };
  }
}

export async function buyToken(
  tokenMint: string,
  solAmount: number,
  keypair: Keypair,
  slippageBps: number = 100
): Promise<SwapResult> {
  console.log(`[Jupiter] Buying ${tokenMint} with ${solAmount} SOL`);

  const quote = await getSwapQuote(SOL_MINT, tokenMint, solAmount, slippageBps);
  
  if (!quote) {
    return {
      success: false,
      error: "Failed to get swap quote",
    };
  }

  const priceImpact = parseFloat(quote.priceImpactPct);
  if (priceImpact > 5) {
    return {
      success: false,
      error: `Price impact too high: ${priceImpact.toFixed(2)}%`,
    };
  }

  return executeSwap(quote, keypair.publicKey.toBase58(), keypair);
}

export async function sellToken(
  tokenMint: string,
  tokenAmount: number,
  keypair: Keypair,
  slippageBps: number = 100
): Promise<SwapResult> {
  console.log(`[Jupiter] Selling ${tokenAmount} of ${tokenMint}`);

  const quote = await getSwapQuote(tokenMint, SOL_MINT, tokenAmount, slippageBps);
  
  if (!quote) {
    return {
      success: false,
      error: "Failed to get swap quote",
    };
  }

  return executeSwap(quote, keypair.publicKey.toBase58(), keypair);
}

export async function getTokenPrice(tokenMint: string): Promise<number | null> {
  try {
    const quote = await getSwapQuote(tokenMint, SOL_MINT, 1, 50);
    
    if (!quote) {
      return null;
    }

    const outputSol = parseInt(quote.outAmount) / 1e9;
    return outputSol;
  } catch (error) {
    console.error("[Jupiter] Error getting token price:", error);
    return null;
  }
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export async function getTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  try {
    const connection = new Connection(RPC_URL, "confirmed");
    const pubkey = new PublicKey(walletAddress);
    
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });

    const balances: TokenBalance[] = [];

    for (const account of tokenAccounts.value) {
      const info = account.account.data.parsed.info;
      const balance = info.tokenAmount;

      if (balance.uiAmount > 0) {
        balances.push({
          mint: info.mint,
          amount: parseInt(balance.amount),
          decimals: balance.decimals,
          uiAmount: balance.uiAmount,
        });
      }
    }

    return balances;
  } catch (error) {
    console.error("[Jupiter] Error getting token balances:", error);
    return [];
  }
}
