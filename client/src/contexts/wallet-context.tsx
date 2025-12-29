import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { apiRequest } from "@/lib/queryClient";

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: string | null;
  balance: number | null;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  signTransaction: (serializedTx: string) => Promise<string | null>;
  error: string | null;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error("useWallet must be used within a WalletProvider");
  }
  return context;
}

interface PhantomProvider {
  isPhantom?: boolean;
  connect: (opts?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  on: (event: string, callback: (...args: unknown[]) => void) => void;
  off: (event: string, callback: (...args: unknown[]) => void) => void;
  signAndSendTransaction: (transaction: Uint8Array, options?: { skipPreflight?: boolean }) => Promise<{ signature: string }>;
  signTransaction: (transaction: Uint8Array) => Promise<Uint8Array>;
}

declare global {
  interface Window {
    solana?: PhantomProvider;
  }
}

interface WalletProviderProps {
  children: ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return;
    try {
      const response = await fetch(`/api/solana/balance/${publicKey}`);
      if (response.ok) {
        const data = await response.json();
        setBalance(data.sol);
      }
    } catch (err) {
      console.error("Failed to fetch balance:", err);
    }
  }, [publicKey]);

  const connect = async () => {
    if (!window.solana?.isPhantom) {
      setError("Phantom wallet not found. Please install Phantom extension.");
      window.open("https://phantom.app/", "_blank");
      return;
    }

    try {
      setConnecting(true);
      setError(null);
      const response = await window.solana.connect();
      const pubKey = response.publicKey.toString();
      setPublicKey(pubKey);
      setConnected(true);
      
      try {
        const balanceResponse = await fetch(`/api/solana/balance/${pubKey}`);
        if (balanceResponse.ok) {
          const data = await balanceResponse.json();
          setBalance(data.sol);
        }
      } catch (err) {
        console.error("Failed to fetch balance:", err);
      }
    } catch (err) {
      console.error("Failed to connect wallet:", err);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setConnecting(false);
    }
  };

  const disconnect = () => {
    if (window.solana) {
      window.solana.disconnect();
    }
    setConnected(false);
    setPublicKey(null);
    setBalance(null);
    setError(null);
  };

  const signTransaction = useCallback(async (serializedTxBase64: string): Promise<string | null> => {
    if (!window.solana?.isPhantom || !connected) {
      setError("Wallet not connected");
      return null;
    }

    try {
      const base64Decoded = atob(serializedTxBase64);
      const transactionBytes = new Uint8Array(base64Decoded.length);
      for (let i = 0; i < base64Decoded.length; i++) {
        transactionBytes[i] = base64Decoded.charCodeAt(i);
      }
      
      const signedTx = await window.solana.signTransaction(transactionBytes);
      
      let signedBase64 = '';
      for (let i = 0; i < signedTx.length; i++) {
        signedBase64 += String.fromCharCode(signedTx[i]);
      }
      signedBase64 = btoa(signedBase64);
      
      return signedBase64;
    } catch (err) {
      console.error("Failed to sign transaction:", err);
      setError(err instanceof Error ? err.message : "Transaction signing failed");
      return null;
    }
  }, [connected]);

  useEffect(() => {
    const checkConnection = async () => {
      if (window.solana?.isPhantom && window.solana.isConnected) {
        try {
          const response = await window.solana.connect({ onlyIfTrusted: true });
          const pubKey = response.publicKey.toString();
          setPublicKey(pubKey);
          setConnected(true);
          
          try {
            const balanceResponse = await fetch(`/api/solana/balance/${pubKey}`);
            if (balanceResponse.ok) {
              const data = await balanceResponse.json();
              setBalance(data.sol);
            }
          } catch (err) {
            console.error("Failed to fetch balance:", err);
          }
        } catch {
          // User hasn't trusted this app yet
        }
      }
    };
    
    const timer = setTimeout(checkConnection, 100);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (window.solana) {
      const handleDisconnect = async () => {
        try {
          await window.solana?.disconnect();
        } catch (err) {
          console.error("Error during disconnect:", err);
        }
        setConnected(false);
        setPublicKey(null);
        setBalance(null);
      };

      const handleAccountChange = async (newPublicKey: unknown) => {
        if (newPublicKey && typeof newPublicKey === 'object' && 'toString' in newPublicKey) {
          const pubKey = (newPublicKey as { toString(): string }).toString();
          setPublicKey(pubKey);
          setBalance(null);
          
          try {
            const balanceResponse = await fetch(`/api/solana/balance/${pubKey}`);
            if (balanceResponse.ok) {
              const data = await balanceResponse.json();
              setBalance(data.sol);
            }
          } catch (err) {
            console.error("Failed to fetch balance after account change:", err);
          }
        } else {
          handleDisconnect();
        }
      };

      window.solana.on("disconnect", handleDisconnect);
      window.solana.on("accountChanged", handleAccountChange);

      return () => {
        window.solana?.off("disconnect", handleDisconnect);
        window.solana?.off("accountChanged", handleAccountChange);
      };
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        connected,
        connecting,
        publicKey,
        balance,
        connect,
        disconnect,
        refreshBalance,
        signTransaction,
        error,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
