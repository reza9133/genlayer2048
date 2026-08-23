import { useCallback, useEffect, useState } from "react";
import { CHAIN } from "../genlayer";

const BRADBURY_CHAIN_ID_HEX = `0x${CHAIN.id.toString(16)}`;
const BRADBURY_RPC_URL = CHAIN.rpcUrls.default.http[0];
const BRADBURY_EXPLORER_URL = CHAIN.blockExplorers?.default.url ?? "https://explorer-bradbury.genlayer.com";

export interface WalletState {
  address: string | null;
  chainIdHex: string | null;
  isCorrectNetwork: boolean;
  hasMetaMask: boolean;
  connecting: boolean;
  switching: boolean;
  error: string | null;
  connect: () => Promise<void>;
  switchToBradbury: () => Promise<void>;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<string | null>(null);
  const [chainIdHex, setChainIdHex] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasMetaMask = typeof window !== "undefined" && Boolean(window.ethereum);

  const refreshChain = useCallback(async () => {
    if (!hasMetaMask) return;
    try {
      const id: string = await window.ethereum.request({ method: "eth_chainId" });
      setChainIdHex(id);
    } catch {
      // ignore — accounts/chain listeners will retry on next event
    }
  }, [hasMetaMask]);

  const connect = useCallback(async () => {
    if (!hasMetaMask) {
      setError("MetaMask not detected. Install it from metamask.io to continue.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      setAddress(accounts[0] ?? null);
      await refreshChain();
    } catch (err: any) {
      setError(err?.message ?? "Failed to connect wallet.");
    } finally {
      setConnecting(false);
    }
  }, [hasMetaMask, refreshChain]);

  const switchToBradbury = useCallback(async () => {
    if (!hasMetaMask) return;
    setSwitching(true);
    setError(null);
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: BRADBURY_CHAIN_ID_HEX }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: BRADBURY_CHAIN_ID_HEX,
                chainName: "GenLayer Testnet Bradbury",
                nativeCurrency: { name: "GEN", symbol: "GEN", decimals: 18 },
                rpcUrls: [BRADBURY_RPC_URL],
                blockExplorerUrls: [BRADBURY_EXPLORER_URL],
              },
            ],
          });
        } catch (addError: any) {
          setError(addError?.message ?? "Failed to add GenLayer Bradbury to your wallet.");
        }
      } else if (switchError?.code !== 4001) {
        setError(switchError?.message ?? "Failed to switch network.");
      }
    } finally {
      await refreshChain();
      setSwitching(false);
    }
  }, [hasMetaMask, refreshChain]);

  useEffect(() => {
    if (!hasMetaMask) return;
    const eth = window.ethereum;

    const handleAccounts = (accounts: string[]) => setAddress(accounts[0] ?? null);
    const handleChain = (id: string) => setChainIdHex(id);

    eth.request({ method: "eth_accounts" }).then(handleAccounts).catch(() => {});
    refreshChain();

    eth.on?.("accountsChanged", handleAccounts);
    eth.on?.("chainChanged", handleChain);
    return () => {
      eth.removeListener?.("accountsChanged", handleAccounts);
      eth.removeListener?.("chainChanged", handleChain);
    };
  }, [hasMetaMask, refreshChain]);

  return {
    address,
    chainIdHex,
    isCorrectNetwork: chainIdHex === BRADBURY_CHAIN_ID_HEX,
    hasMetaMask,
    connecting,
    switching,
    error,
    connect,
    switchToBradbury,
  };
}
