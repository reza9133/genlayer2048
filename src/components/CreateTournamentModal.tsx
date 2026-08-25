import { useState } from "react";
import { X } from "lucide-react";
import { parseGenToWei } from "../lib/format";

export interface CreateTournamentInput {
  name: string;
  maxParticipants: number;
  winnerCount: number;
  entryFeeWei: bigint;
  deadlineUnixSeconds: number;
  initialFundWei?: bigint;
}

interface CreateTournamentModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (input: CreateTournamentInput) => Promise<void>;
  defaultEntryFeeGen: string;
}

function defaultDeadlineLocal(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function CreateTournamentModal({
  open,
  onClose,
  onCreate,
  defaultEntryFeeGen,
}: CreateTournamentModalProps) {
  const [name, setName] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("16");
  const [winnerCount, setWinnerCount] = useState("3");
  const [entryFeeGen, setEntryFeeGen] = useState(defaultEntryFeeGen);
  const [initialFundGen, setInitialFundGen] = useState("");
  const [deadlineLocal, setDeadlineLocal] = useState(defaultDeadlineLocal());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const reset = () => {
    setName("");
    setMaxParticipants("16");
    setWinnerCount("3");
    setEntryFeeGen(defaultEntryFeeGen);
    setInitialFundGen("");
    setDeadlineLocal(defaultDeadlineLocal());
    setError(null);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      setError("Tournament name is required.");
      return;
    }

    const maxParticipantsNum = Number.parseInt(maxParticipants, 10);
    if (!Number.isFinite(maxParticipantsNum) || maxParticipantsNum <= 0) {
      setError("Max participants must be a positive whole number.");
      return;
    }

    const winnerCountNum = Number.parseInt(winnerCount, 10);
    if (!Number.isFinite(winnerCountNum) || winnerCountNum <= 0) {
      setError("Winner count must be a positive whole number.");
      return;
    }
    if (winnerCountNum > maxParticipantsNum) {
      setError("Winner count can't exceed max participants.");
      return;
    }

    const deadlineMs = new Date(deadlineLocal).getTime();
    if (!Number.isFinite(deadlineMs)) {
      setError("Please choose a valid deadline.");
      return;
    }
    const deadlineUnixSeconds = Math.floor(deadlineMs / 1000);
    if (deadlineUnixSeconds <= Math.floor(Date.now() / 1000)) {
      setError("Deadline must be in the future.");
      return;
    }

    let entryFeeWei: bigint;
    let initialFundWei: bigint | undefined;
    try {
      entryFeeWei = parseGenToWei(entryFeeGen || "0");
      initialFundWei = initialFundGen.trim() === "" ? undefined : parseGenToWei(initialFundGen);
    } catch (err: any) {
      setError(err?.message ?? "Invalid GEN amount.");
      return;
    }

    setSubmitting(true);
    try {
      await onCreate({
        name: trimmedName,
        maxParticipants: maxParticipantsNum,
        winnerCount: winnerCountNum,
        entryFeeWei,
        deadlineUnixSeconds,
        initialFundWei,
      });
      reset();
      onClose();
    } catch (err: any) {
      setError(err?.message ?? "Failed to create tournament.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="card w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-ink-50">Create tournament</h3>
          <button onClick={handleClose} className="btn-ghost !p-1.5" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm text-muted">
            Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Friday Night 2048"
              className="input"
              maxLength={80}
              required
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Max participants
              <input
                type="number"
                min={1}
                step={1}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="input"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Winners
              <input
                type="number"
                min={1}
                step={1}
                value={winnerCount}
                onChange={(e) => setWinnerCount(e.target.value)}
                className="input"
                required
              />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-sm text-muted">
              Entry fee (GEN)
              <input
                type="text"
                inputMode="decimal"
                value={entryFeeGen}
                onChange={(e) => setEntryFeeGen(e.target.value)}
                placeholder="0.05"
                className="input"
                required
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-muted">
              Initial prize pool (GEN)
              <input
                type="text"
                inputMode="decimal"
                value={initialFundGen}
                onChange={(e) => setInitialFundGen(e.target.value)}
                placeholder="Optional"
                className="input"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm text-muted">
            Deadline
            <input
              type="datetime-local"
              value={deadlineLocal}
              onChange={(e) => setDeadlineLocal(e.target.value)}
              className="input"
              required
            />
          </label>

          {error && <p className="text-xs text-gold-deep">{error}</p>}

          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={handleClose} className="btn-ghost text-sm" disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-chain text-sm" disabled={submitting}>
              {submitting ? "Creating..." : "Create tournament"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
