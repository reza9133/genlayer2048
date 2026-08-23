import { useState } from "react";
import { Gamepad2, Trophy, Github, Twitter, Info } from "lucide-react";
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
    <div className="min-h-screen flex flex-col justify-between">
      <div>
        <header className="border-b border-surface-border">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              {/* GenLayer Exact Static Silver Vector Logo */}
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised border border-surface-border p-2 shadow-sm">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 100 100"
                  className="w-full h-full text-ink-50 fill-current"
                >
                  {/* Left Wing / Arrow */}
                  <path d="M 46,10 L 10,90 L 46,78 L 30,62 L 46,46 Z" />
                  {/* Right Wing / Arrow */}
                  <path d="M 54,10 L 90,90 L 54,78 L 70,62 L 54,46 Z" />
                  {/* Corrected Center Diamond / Negative Space Shape */}
                  <path d="M 50,44 L 62,60 L 50,74 L 38,60 Z" fill-rule="evenodd" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-lg font-bold leading-tight text-ink-50">2048 On-Chain</h1>
                <p className="flex items-center gap-1 text-[11px] text-muted">
                  GenLayer Testnet Bradbury · {shortenAddress(CONTRACT_ADDRESS)}
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

          {/* How It Works Section */}
          <section className="mt-12 rounded-2xl border border-surface-border bg-surface p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-3 text-gold">
              <Info size={18} />
              <h3 className="font-display text-lg font-bold text-ink-50">How It Works</h3>
            </div>
            <div className="space-y-3 text-sm text-muted leading-relaxed">
              <p>
                <strong className="text-ink-50">Free Play:</strong> Play the classic 2048 game directly in your browser. When you finish, submit your score on-chain to climb the global leaderboard.
              </p>
              <p>
                <strong className="text-ink-50">Tournaments:</strong> Join active time-boxed tournaments with entry fees. Submit your highest score before the deadline. Top players split the prize pool automatically and can claim rewards anytime.
              </p>
              <p>
                <strong className="text-ink-50">Intelligent Contract:</strong> Powered by GenLayer's deterministic execution layer on the Bradbury Testnet, ensuring trustless scoring and fair prize distribution.
              </p>
            </div>
          </section>
        </main>
      </div>

      {/* Footer with Credits & Socials */}
      <footer className="border-t border-surface-border bg-surface/50 mt-12">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-muted">
          <div>
            <span>Built with ❤️ by </span>
            <a
              href="https://x.com/amirhp771"
              target="_blank"
              rel="noreferrer"
              className="text-gold font-semibold hover:underline"
            >
              @amirhp771
            </a>
          </div>

          <div className="flex items-center gap-4 font-medium">
            <a
              href="https://github.com/reza9133/genlayer2048"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-ink-50 hover:text-gold transition-colors"
            >
              <Github size={15} />
              <span>GitHub</span>
            </a>
            <span className="text-surface-border">·</span>
            <a
              href="https://x.com/amirhp771"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-ink-50 hover:text-gold transition-colors"
            >
              <Twitter size={15} />
              <span>Twitter / X</span>
            </a>
          </div>
        </div>
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
