import { AlertTriangle, Wallet } from "lucide-react";
import type { WalletState } from "../hooks/useWallet";
import { shortenAddress } from "../lib/format";

export default function WalletButton({ wallet }: { wallet: WalletState }) {
  const { address, hasMetaMask, isCorrectNetwork, connecting, switching, connect, switchToBradbury } =
    wallet;

  if (!hasMetaMask) {
    return (
      <a
        href="https://metamask.io/download/"
        target="_blank"
        rel="noreferrer"
        className="btn-ghost text-sm"
      >
        <Wallet size={16} /> Install MetaMask
      </a>
    );
  }

  if (!address) {
    return (
      <button onClick={connect} disabled={connecting} className="btn-primary text-sm">
        <Wallet size={16} /> {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <button onClick={switchToBradbury} disabled={switching} className="btn-chain text-sm">
        <AlertTriangle size={16} /> {switching ? "Switching…" : "Switch to Bradbury"}
      </button>
    );
  }

  return (
    <div className="pill">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      {shortenAddress(address)}
    </div>
  );
}
