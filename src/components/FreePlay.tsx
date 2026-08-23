import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import Game2048 from "./Game2048";
import Leaderboard from "./Leaderboard";
import { submitScore } from "../genlayer";
import type { WalletState } from "../hooks/useWallet";

export default function FreePlay({ wallet }: { wallet: WalletState }) {
  const [liveScore, setLiveScore] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [lastSubmitted, setLastSubmitted] = useState<number | null>(null);
  const [leaderboardKey, setLeaderboardKey] = useState(0);

  const canSubmit = wallet.address && wallet.isCorrectNetwork && liveScore > 0 && !submitting;

  const handleSubmit = async () => {
    if (!wallet.address) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      await submitScore(wallet.address, liveScore);
      setLastSubmitted(liveScore);
      setLeaderboardKey((k) => k + 1);
    } catch (err: any) {
      setSubmitError(err?.message ?? "Failed to submit score.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="card flex flex-col items-center">
        <Game2048 onScoreChange={(score) => setLiveScore(score)} />

        <div className="mt-5 flex w-full flex-col items-center gap-2 border-t border-surface-border pt-5">
          {!wallet.address ? (
            <p className="text-center text-sm text-muted">Connect your wallet to submit scores on-chain.</p>
          ) : !wallet.isCorrectNetwork ? (
            <p className="text-center text-sm text-gold-soft">Switch to GenLayer Bradbury to submit.</p>
          ) : (
            <>
              <button onClick={handleSubmit} disabled={!canSubmit} className="btn-primary w-full sm:w-auto">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submitting ? "Submitting to chain…" : `Submit score (${liveScore})`}
              </button>
              {lastSubmitted !== null && !submitting && !submitError && (
                <p className="flex items-center gap-1.5 text-xs text-emerald-400">
                  <CheckCircle2 size={14} /> Submitted {lastSubmitted} — your on-chain high score updates
                  automatically if this beats it.
                </p>
              )}
              {submitError && <p className="text-xs text-gold-deep">{submitError}</p>}
              <p className="text-center text-[11px] text-muted">
                Only your personal best is kept on-chain — submit anytime, even mid-run.
              </p>
            </>
          )}
        </div>
      </div>

      <Leaderboard currentAddress={wallet.address} refreshKey={leaderboardKey} />
    </div>
  );
}
