import { useState } from "react";
import { Blocks, Gamepad2, Trophy } from "lucide-react";
import WalletButton from "./components/WalletButton";
import FreePlay from "./components/FreePlay";
import TournamentDashboard from "./components/TournamentDashboard";
import { useWallet } from "./hooks/useWallet";
import { CONTRACT_ADDRESS } from "./genlayer";
import { shortenAddress } from "./lib/format";

type Tab = "play" | "tournaments";

export default function App() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("play");

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-border">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gold font-display font-black text-ink-900">
              2K
            </div>
            <div>
              <h1 className="font-display text-lg font-bold leading-tight text-ink-50">2048 On-Chain</h1>
              <p className="flex items-center gap-1 text-[11px] text-muted">
                <Blocks size={11} /> GenLayer Testnet Bradbury · {shortenAddress(CONTRACT_ADDRESS)}
              </p>
            </div>
          </div>
          <WalletButton wallet={wallet} />
        </div>
      </header>

      <nav className="mx-auto flex max-w-5xl gap-2 px-4 pt-6 sm:px-6">
        <TabButton active={tab === "play"} onClick={() => setTab("play")} icon={<Gamepad2 size={16} />}>
          Free Play
        </TabButton>
        <TabButton
          active={tab === "tournaments"}
          onClick={() => setTab("tournaments")}
          icon={<Trophy size={16} />}
        >
          Tournaments
        </TabButton>
      </nav>

      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {wallet.error && (
          <div className="mb-4 rounded-lg border border-gold-deep/40 bg-gold-deep/10 px-4 py-2 text-sm text-gold-soft">
            {wallet.error}
          </div>
        )}

        {tab === "play" ? <FreePlay wallet={wallet} /> : <TournamentDashboard wallet={wallet} />}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 pt-4 text-center text-xs text-muted sm:px-6">
        Scores are self-reported and capped at a sanity bound on-chain — this is a casual leaderboard, not
        an anti-cheat system.
      </footer>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
        active ? "bg-surface-raised text-gold" : "text-muted hover:text-ink-50"
      }`}
    >
      {icon} {children}
    </button>
  );
}
