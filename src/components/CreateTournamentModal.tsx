import { useState } from "react";
import { Loader2, Plus, X } from "lucide-react";
import { datetimeLocalToUnixSeconds, parseGenToWei } from "../lib/format";

export interface CreateTournamentInput {
  name: string;
  maxParticipants: number;
  winnerCount: number;
  entryFeeWei: bigint;
  deadlineUnixSeconds: number;
  initialFundGen?: string;
}

interface CreateTournamentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateTournamentInput) => Promise<void>;
  defaultEntryFeeGen: string;
}

function defaultDeadline(): string {
  const d = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}`;
}

export default function CreateTournamentModal({
  open,
  onClose,
  onCreate,
  defaultEntryFeeGen,
}: CreateTournamentModalProps) {
  const [name, setName] = useState("Weekend 2048 Cup");
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [winnerCount, setWinnerCount] = useState(3);
  const [entryFee, setEntryFee] = useState(defaultEntryFeeGen);
  const [initialFund, setInitialFund] = useState("0");
  const [deadline, setDeadline] = useState(defaultDeadline());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const deadlineUnixSeconds = datetimeLocalToUnixSeconds(deadline);
    if (deadlineUnixSeconds <= Math.floor(Date.now() / 1000)) {
      setError("Deadline must be in the future.");
      return;
    }
    if (winnerCount > maxParticipants) {
      setError("Winner count cannot exceed max participants.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        name,
        maxParticipants,
        winnerCount,
        entryFeeWei: parseGenToWei(entryFee),
        deadlineUnixSeconds,
        initialFundGen: initialFund && parseFloat(initialFund) > 0 ? initialFund : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create tournament.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-surface-border bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-50">Create Tournament</h3>
          <button onClick={onClose} className="text-muted hover:text-ink-50">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label">Name</label>
            <input
              className="input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={64}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Max participants</label>
              <input
                type="number"
                min={1}
                className="input"
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(Number(e.target.value))}
                required
              />
            </div>
            <div>
              <label className="label">Winners</label>
              <input
                type="number"
                min={1}
                className="input"
                value={winnerCount}
                onChange={(e) => setWinnerCount(Number(e.target.value))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Entry fee (GEN)</label>
              <input
                className="input"
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
                placeholder="0.05"
                inputMode="decimal"
                required
              />
            </div>
            <div>
              <label className="label">Initial pool (GEN)</label>
              <input
                className="input"
                value={initialFund}
                onChange={(e) => setInitialFund(e.target.value)}
                placeholder="0 (Optional)"
                inputMode="decimal"
              />
            </div>
          </div>

          <div>
            <label className="label">Deadline</label>
            <input
              type="datetime-local"
              className="input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>

          {error && <p className="text-xs text-gold-deep">{error}</p>}

          <button type="submit" disabled={submitting} className="btn-primary w-full">
            {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
            {submitting ? "Creating on-chain…" : "Create tournament"}
          </button>
        </form>
      </div>
    </div>
  );
}
