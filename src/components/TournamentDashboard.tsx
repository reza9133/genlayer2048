import { useCallback, useEffect, useState } from "react";
import { Plus, RefreshCw } from "lucide-react";
import TournamentCard from "./TournamentCard";
import CreateTournamentModal, { type CreateTournamentInput } from "./CreateTournamentModal";
import {
  claimPrize,
  claimRefund,
  cancelTournament,
  createTournament,
  finalizeTournament,
  getDefaultEntryFee,
  getOwner,
  getParticipantStatus,
  getTournament,
  getTournamentCount,
  joinTournament,
  listTournamentIds,
  submitTournamentScore,
} from "../genlayer";
import type { ParticipantStatusView, ReplayEvidence, TournamentView } from "../types";
import type { WalletState } from "../hooks/useWallet";
import { formatWeiToGen, toBigInt, toBool, toNumber } from "../lib/format";

interface Row {
  tournament: TournamentView;
  participant: ParticipantStatusView | null;
}

function sortRows(rows: Row[]): Row[] {
  const rank = (t: TournamentView) => {
    if (toBool(t.is_cancelled)) return 3;
    if (toBool(t.is_finalized)) return 2;
    const open = toNumber(t.deadline_ts) > Math.floor(Date.now() / 1000);
    return open ? 0 : 1;
  };
  return [...rows].sort((a, b) => rank(a.tournament) - rank(b.tournament));
}

export default function TournamentDashboard({ wallet }: { wallet: WalletState }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [owner, setOwner] = useState<string | null>(null);
  const [defaultEntryFeeGen, setDefaultEntryFeeGen] = useState("0.05");
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTournamentId, setActiveTournamentId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rawIds, rawCount, ownerAddr, defaultFeeWei] = await Promise.all([
        listTournamentIds().catch(() => []),
        getTournamentCount().catch(() => "0"),
        getOwner().catch(() => ""),
        getDefaultEntryFee().catch(() => "0"),
      ]);

      setOwner(ownerAddr);
      setDefaultEntryFeeGen(formatWeiToGen(defaultFeeWei));

      const count = toNumber(rawCount);
      const parsedIds = new Set<number>();

      if (Array.isArray(rawIds)) {
        for (const item of rawIds) {
          const num = toNumber(item);
          if (num > 0) parsedIds.add(num);
        }
      }

      for (let i = 1; i <= count; i++) {
        parsedIds.add(i);
      }

      const idList = Array.from(parsedIds).sort((a, b) => a - b);

      const tournaments = await Promise.all(
        idList.map(async (id) => {
          try {
            return await getTournament(id);
          } catch {
            return null;
          }
        }),
      );

      const validTournaments = tournaments.filter(
        (t): t is TournamentView =>
          t !== null &&
          (toBool(t.exists) || toNumber(t.tournament_id) > 0),
      );

      let participants: (ParticipantStatusView | null)[] = validTournaments.map(() => null);
      if (wallet.address) {
        participants = await Promise.all(
          validTournaments.map((t) =>
            getParticipantStatus(toNumber(t.tournament_id), wallet.address!).catch(() => null),
          ),
        );
      }

      const nextRows: Row[] = validTournaments.map((t, i) => ({
        tournament: t,
        participant: participants[i],
      }));

      setRows(sortRows(nextRows));
    } catch (err: any) {
      console.error("[TournamentDashboard load error]", err);
      setError(err?.message ?? "Failed to load tournaments.");
    } finally {
      setLoading(false);
    }
  }, [wallet.address]);

  useEffect(() => {
    load();
  }, [load]);

  const isOwner =
    !!wallet.address && !!owner && wallet.address.toLowerCase() === owner.toLowerCase();

  const requireAddress = () => {
    if (!wallet.address) throw new Error("Connect your wallet first.");
    return wallet.address;
  };

  const handleCreate = async (input: CreateTournamentInput) => {
    const address = requireAddress();

    await createTournament(
      address,
      {
        name: input.name,
        maxParticipants: input.maxParticipants,
        winnerCount: input.winnerCount,
        entryFeeWei: input.entryFeeWei,
        deadlineUnixSeconds: input.deadlineUnixSeconds,
        initialFundWei: input.initialFundWei,
      },
    );

    await load();
  };

  const handleJoin = async (t: TournamentView) => {
    const address = requireAddress();
    await joinTournament(address, toNumber(t.tournament_id), toBigInt(t.entry_fee));
    await load();
  };

  const handleSubmitScore = async (t: TournamentView, evidence: ReplayEvidence) => {
    const address = requireAddress();
    await submitTournamentScore(address, toNumber(t.tournament_id), evidence);
    await load();
  };

  const handleFinalize = async (t: TournamentView) => {
    const address = requireAddress();
    await finalizeTournament(address, toNumber(t.tournament_id));
    await load();
  };

  const handleClaimPrize = async (t: TournamentView) => {
    const address = requireAddress();
    await claimPrize(address, toNumber(t.tournament_id));
    await load();
  };

  const handleClaimRefund = async (t: TournamentView) => {
    const address = requireAddress();
    await claimRefund(address, toNumber(t.tournament_id));
    await load();
  };

  const handleCancel = async (t: TournamentView) => {
    const address = requireAddress();
    await cancelTournament(address, toNumber(t.tournament_id));
    await load();
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-ink-50">Tournaments</h2>
          <p className="text-sm text-muted">Pay to join, submit your best score, top scorers split the pool.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="btn-ghost text-sm">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} /> Refresh
          </button>
          {isOwner && (
            <button onClick={() => setModalOpen(true)} className="btn-chain text-sm">
              <Plus size={14} /> Create tournament
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-gold-deep">{error}</p>}

      {!loading && rows.length === 0 && !error && (
        <div className="card text-center text-sm text-muted">
          No tournaments yet.{" "}
          {isOwner ? "Create the first one above." : "Check back once the platform owner opens one."}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(({ tournament, participant }) => {
          const id = toNumber(tournament.tournament_id);
          const isPlaying = activeTournamentId === id;
          return (
            <TournamentCard
              key={id}
              tournament={tournament}
              participant={participant}
              isOwner={isOwner}
              isConnected={!!wallet.address && wallet.isCorrectNetwork}
              isPlaying={isPlaying}
              onTogglePlay={() => setActiveTournamentId(isPlaying ? null : id)}
              onJoin={() => handleJoin(tournament)}
              onSubmitScore={(evidence) => handleSubmitScore(tournament, evidence)}
              onFinalize={() => handleFinalize(tournament)}
              onClaimPrize={() => handleClaimPrize(tournament)}
              onClaimRefund={() => handleClaimRefund(tournament)}
              onCancel={() => handleCancel(tournament)}
            />
          );
        })}
      </div>

      <CreateTournamentModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreate={handleCreate}
        defaultEntryFeeGen={defaultEntryFeeGen}
      />
    </div>
  );
}
