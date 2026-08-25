/**
 * GenLayer client setup and a typed wrapper around every method exposed by
 * the deployed Game2048Platform Intelligent Contract.
 *
 * Two clients are used, following GenLayer's recommended browser-dApp
 * pattern (see docs.genlayer.com/api-references/genlayer-js):
 *   - `readClient` talks directly to the GenLayer RPC and needs no wallet.
 *   - a per-address `writeClient` is created lazily once MetaMask is
 *     connected, and signs transactions through the injected provider.
 */
import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import type {
  LeaderboardEntryView,
  ParticipantStatusView,
  ReplayEvidence,
  TournamentView,
} from "./types";

export const CONTRACT_ADDRESS = (import.meta.env.VITE_CONTRACT_ADDRESS ||
  "0x5E38c0389DbF553bD54eA962521f11be145c1C3F") as `0x${string}`;

export const CHAIN = testnetBradbury;
export const NETWORK_NAME = "testnetBradbury" as const;

// ---------------------------------------------------------------------------
// Client management
// ---------------------------------------------------------------------------

export const readClient = createClient({ chain: CHAIN });

let cachedWriteAddress: string | null = null;
let cachedWriteClient: ReturnType<typeof createClient> | null = null;

/** Returns a write-capable client bound to `address`, reusing it across calls. */
export function getWriteClient(address: string) {
  if (!cachedWriteClient || cachedWriteAddress !== address) {
    cachedWriteClient = createClient({
      chain: CHAIN,
      account: address as `0x${string}`,
      provider: typeof window !== "undefined" ? window.ethereum : undefined,
    });
    cachedWriteAddress = address;
  }
  return cachedWriteClient;
}

/** Makes sure the connected wallet is switched to GenLayer Testnet Bradbury before writing. */
export async function ensureBradburyNetwork(address: string) {
  const client = getWriteClient(address);
  try {
    await client.connect(NETWORK_NAME);
  } catch (err) {
    // Non-fatal: the wallet may already be on the right chain, or the user
    // dismissed the network-switch prompt — writeContract will surface a
    // clearer error below if the chain is genuinely wrong.
    console.warn("[genlayer] network switch skipped:", err);
  }
  return client;
}

async function waitForAccepted(hash: `0x${string}`) {
  return readClient.waitForTransactionReceipt({
    hash: hash as any,
    status: TransactionStatus.ACCEPTED,
  });
}

// ---------------------------------------------------------------------------
// Reads (no wallet required)
// ---------------------------------------------------------------------------

const read = <T>(functionName: string, args: unknown[] = []) =>
  readClient.readContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as any,
    jsonSafeReturn: true,
  }) as Promise<T>;

export const getOwner = () => read<string>("get_owner");
export const getDefaultEntryFee = () => read<string>("get_default_entry_fee");
export const getMaxPlausibleScore = () => read<string>("get_max_plausible_score");
export const getMaxReplayMoves = () => read<string>("get_max_replay_moves");
export const getHighScore = (player: string) => read<string>("get_high_score", [player]);
export const getPlayerStats = (player: string) =>
  read<LeaderboardEntryView>("get_player_stats", [player]);
export const getLeaderboardPlayerCount = () => read<string>("get_leaderboard_player_count");
export const getLeaderboard = (topN: number) =>
  read<LeaderboardEntryView[]>("get_leaderboard", [topN]);

export const getTournamentCount = () => read<string>("get_tournament_count");
export const listTournamentIds = () => read<string[]>("list_tournament_ids");
export const getTournament = (tournamentId: number) =>
  read<TournamentView>("get_tournament", [tournamentId]);
export const getTournamentParticipants = (tournamentId: number) =>
  read<string[]>("get_tournament_participants", [tournamentId]);
export const getTournamentWinners = (tournamentId: number) =>
  read<string[]>("get_tournament_winners", [tournamentId]);
export const getParticipantStatus = (tournamentId: number, player: string) =>
  read<ParticipantStatusView>("get_participant_status", [tournamentId, player]);

// ---------------------------------------------------------------------------
// Writes (wallet required — every call switches network, sends the tx, then
// waits for it to reach ACCEPTED before resolving)
// ---------------------------------------------------------------------------

async function write(
  address: string,
  functionName: string,
  args: unknown[] = [],
  value: bigint = 0n,
) {
  const client = await ensureBradburyNetwork(address);
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as any,
    value,
  })) as `0x${string}`;
  return waitForAccepted(hash);
}

// --- Free play ---
// `evidence` carries the RNG seed and full move sequence; the contract
// replays them and derives the score itself (see 2048.py, submit_score).
export const submitScore = (address: string, evidence: ReplayEvidence) =>
  write(address, "submit_score", [BigInt(evidence.seed), evidence.moves]);

// --- Tournament admin (owner-only on-chain, enforced by the contract) ---
export const createTournament = (
  address: string,
  params: {
    name: string;
    maxParticipants: number;
    winnerCount: number;
    entryFeeWei: bigint;
    deadlineUnixSeconds: number;
  },
) =>
  write(address, "create_tournament", [
    params.name,
    Math.floor(params.maxParticipants),
    Math.floor(params.winnerCount),
    params.entryFeeWei,
    BigInt(Math.floor(params.deadlineUnixSeconds)),
  ]);

export const cancelTournament = (address: string, tournamentId: number) =>
  write(address, "cancel_tournament", [tournamentId]);

export const transferOwnership = (address: string, newOwner: string) =>
  write(address, "transfer_ownership", [newOwner]);

// --- Tournament participation ---
export const joinTournament = (address: string, tournamentId: number, entryFeeWei: bigint) =>
  write(address, "join_tournament", [tournamentId], entryFeeWei);

export const fundTournament = (address: string, tournamentId: number, amountWei: bigint) =>
  write(address, "fund_tournament", [tournamentId], amountWei);

export const submitTournamentScore = (
  address: string,
  tournamentId: number,
  evidence: ReplayEvidence,
) =>
  write(address, "submit_tournament_score", [
    tournamentId,
    BigInt(evidence.seed),
    evidence.moves,
  ]);

export const finalizeTournament = (address: string, tournamentId: number) =>
  write(address, "finalize_tournament", [tournamentId]);

export const claimPrize = (address: string, tournamentId: number) =>
  write(address, "claim_prize", [tournamentId]);

export const claimRefund = (address: string, tournamentId: number) =>
  write(address, "claim_refund", [tournamentId]);
