import { useEffect, useState } from "react";
import {
  Trophy,
  Users,
  Clock,
  Gamepad2,
  Send,
  Flag,
  Coins,
  Undo2,
  Ban,
  Loader2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import Game2048 from "./Game2048";
import type { ParticipantStatusView, ReplayEvidence, TournamentView } from "../types";
import {
  formatCountdown,
  formatUnixSeconds,
  formatWeiToGen,
  secondsUntil,
  shortenAddress,
  toNumber,
} from "../lib/format";

type ActionKey = "join" | "submit" | "finalize" | "claim" | "refund" | "cancel";

interface TournamentCardProps {
  tournament: TournamentView;
  participant: ParticipantStatusView | null;
  isOwner: boolean;
  isConnected: boolean;
  isPlaying: boolean;
  liveScore: number;
  onTogglePlay: () => void;
  onScoreChange: (
    score: number,
    gameOver: boolean,
    reachedTarget: boolean,
    evidence: ReplayEvidence,
  ) => void;
  onJoin: () => Promise<void>;
  onSubmitScore: () => Promise<void>;
  onFinalize: () => Promise<void>;
  onClaimPrize: () => Promise<void>;
  onClaimRefund: () => Promise<void>;
  onCancel: () => Promise<void>;
}

export default function TournamentCard({
  tournament: t,
  participant,
  isOwner,
  isConnected,
  isPlaying,
  liveScore,
  onTogglePlay,
  onScoreChange,
  onJoin,
  onSubmitScore,
  onFinalize,
  onClaimPrize,
  onClaimRefund,
  onCancel,
}: TournamentCardProps) {
  const [pending, setPending] = useState<ActionKey | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = secondsUntil(t.deadline_ts);
  const isOpen = !t.is_cancelled && !t.is_finalized && remaining > 0;
  const isAwaitingFinalize = !t.is_cancelled && !t.is_finalized && remaining <= 0;
  const participantCount = toNumber(t.participant_count);
  const maxParticipants = toNumber(t.max_participants);
  const isFull = participantCount >= maxParticipants;

  const run = async (key: ActionKey, action: () => Promise<void>) => {
    setPending(key);
    setActionError(null);
    try {
      await action();
    } catch (err: any) {
      setActionError(err?.message ?? "Transaction failed.");
    } finally {
      setPending(null);
    }
  };

  const statusPill = t.is_cancelled ? (
    <span className="pill border-gold-deep/40 text-gold-deep">Cancelled</span>
  ) : t.is_finalized ? (
    <span className="pill border-emerald-500/40 text-emerald-400">Finalized</span>
  ) : isAwaitingFinalize ? (
    <span className="pill border-chain/40 text-chain-soft">Deadline passed</span>
  ) : (
    <span className="pill border-gold/40 text-gold">
      <Clock size={12} /> {formatCountdown(remaining)}
    </span>
  );

  return (
    <div className="card">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-ink-50">{t.name}</h3>
          <p className="text-xs text-muted">
            #{toNumber(t.tournament_id)} · by {shortenAddress(t.creator)}
          </p>
        </div>
        {statusPill}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <Stat icon={<Coins size={14} />} label="Prize pool" value={`${formatWeiToGen(t.prize_pool)} GEN`} />
        <Stat icon={<Coins size={14} />} label="Entry fee" value={`${formatWeiToGen(t.entry_fee)} GEN`} />
        <Stat
          icon={<Users size={14} />}
          label="Players"
          value={`${participantCount}/${maxParticipants}`}
        />
        <Stat icon={<Trophy size={14} />} label="Winners" value={`Top ${toNumber(t.winner_count)}`} />
      </div>

      <p className="mt-3 text-xs text-muted">Deadline: {formatUnixSeconds(t.deadline_ts)}</p>

      {participant?.has_joined && (
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="pill">Joined</span>
          {participant.has_submitted && (
            <span className="pill">Best submitted: {toNumber(participant.score)}</span>
          )}
          {toNumber(participant.prize_amount) > 0 && !participant.has_claimed && (
            <span className="pill border-gold/40 text-gold">
              Prize ready: {formatWeiToGen(participant.prize_amount)} GEN
            </span>
          )}
          {participant.has_claimed && <span className="pill text-emerald-400">Claimed</span>}
        </div>
      )}

      {actionError && <p className="mt-3 text-xs text-gold-deep">{actionError}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {!isConnected && <p className="text-xs text-muted">Connect your wallet to interact.</p>}

        {isConnected && !t.is_cancelled && isOpen && !participant?.has_joined && !isFull && (
          <ActionButton
            label="Join tournament"
            icon={<Users size={14} />}
            pending={pending === "join"}
            onClick={() => run("join", onJoin)}
          />
        )}

        {isConnected && !t.is_cancelled && isOpen && !participant?.has_joined && isFull && (
          <p className="text-xs text-muted">Tournament is full.</p>
        )}

        {isConnected && !t.is_cancelled && isOpen && participant?.has_joined && (
          <>
            <ActionButton
              label={isPlaying ? "Hide game" : "Play"}
              icon={<Gamepad2 size={14} />}
              variant="ghost"
              onClick={onTogglePlay}
              trailing={isPlaying ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            />
            {isPlaying && (
              <ActionButton
                label={`Submit score (${liveScore})`}
                icon={<Send size={14} />}
                pending={pending === "submit"}
                disabled={liveScore <= 0}
                onClick={() => run("submit", onSubmitScore)}
              />
            )}
          </>
        )}

        {isConnected && !t.is_cancelled && isAwaitingFinalize && (
          <ActionButton
            label="Finalize tournament"
            icon={<Flag size={14} />}
            pending={pending === "finalize"}
            onClick={() => run("finalize", onFinalize)}
          />
        )}

        {isConnected &&
          t.is_finalized &&
          !participant?.has_claimed &&
          toNumber(participant?.prize_amount) > 0 && (
            <ActionButton
              label="Claim prize"
              icon={<Trophy size={14} />}
              pending={pending === "claim"}
              onClick={() => run("claim", onClaimPrize)}
            />
          )}

        {isConnected && t.is_cancelled && participant?.has_joined && !participant?.has_claimed && (
          <ActionButton
            label="Claim refund"
            icon={<Undo2 size={14} />}
            pending={pending === "refund"}
            onClick={() => run("refund", onClaimRefund)}
          />
        )}

        {isConnected && isOwner && !t.is_cancelled && !t.is_finalized && (
          <ActionButton
            label="Cancel tournament"
            icon={<Ban size={14} />}
            variant="ghost"
            pending={pending === "cancel"}
            onClick={() => run("cancel", onCancel)}
          />
        )}
      </div>

      {isPlaying && (
        <div className="mt-4 border-t border-surface-border pt-4">
          <Game2048
            compact
            onScoreChange={(score, gameOver, reachedTarget, evidence) =>
              onScoreChange(score, gameOver, reachedTarget, evidence)
            }
          />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-raised px-3 py-2">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted">
        {icon} {label}
      </div>
      <div className="mt-0.5 font-display text-sm font-bold text-ink-50">{value}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  trailing,
  pending,
  disabled,
  variant = "primary",
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  trailing?: React.ReactNode;
  pending?: boolean;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={pending || disabled}
      className={variant === "primary" ? "btn-primary text-xs" : "btn-ghost text-xs"}
    >
      {pending ? <Loader2 size={14} className="animate-spin" /> : icon}
      {label}
      {trailing}
    </button>
  );
}
