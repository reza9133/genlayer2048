import { useEffect, useState } from "react";
import { Crown, RefreshCw } from "lucide-react";
import { getLeaderboard } from "../genlayer";
import type { LeaderboardEntryView } from "../types";
import { shortenAddress, toNumber } from "../lib/format";

const RANK_COLORS = ["text-gold", "text-ink-50/80", "text-gold-soft/80"];

export default function Leaderboard({
  currentAddress,
  refreshKey,
}: {
  currentAddress: string | null;
  refreshKey: number;
}) {
  const [entries, setEntries] = useState<LeaderboardEntryView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await getLeaderboard(20);
      setEntries(rows ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load leaderboard.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  return (
    <div className="card">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink-50">Global Leaderboard</h3>
        <button onClick={load} className="text-muted transition-colors hover:text-chain-soft" title="Refresh">
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && <p className="text-sm text-gold-deep">{error}</p>}

      {!error && entries.length === 0 && !loading && (
        <p className="text-sm text-muted">No scores submitted yet — be the first.</p>
      )}

      <ol className="scrollbar-thin max-h-96 space-y-1.5 overflow-y-auto pr-1">
        {entries.map((entry, i) => {
          const isYou = currentAddress && entry.player.toLowerCase() === currentAddress.toLowerCase();
          return (
            <li
              key={entry.player}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${
                isYou ? "border border-chain/50 bg-chain/10" : "bg-surface-raised"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`w-5 text-right font-display font-bold ${RANK_COLORS[i] ?? "text-muted"}`}>
                  {i === 0 ? <Crown size={16} className="inline text-gold" /> : i + 1}
                </span>
                <span className="font-medium text-ink-50">
                  {shortenAddress(entry.player)} {isYou && <span className="text-chain-soft">(you)</span>}
                </span>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-gold">{toNumber(entry.high_score)}</div>
                <div className="text-[10px] text-muted">{toNumber(entry.games_played)} games</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
