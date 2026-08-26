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
  "0x60e0eD2bbd5776Ada0CBE94dC99D19414e731E6c") as `0x${string}`;

export const CHAIN = testnetBradbury;
export const NETWORK_NAME = "testnetBradbury" as const;

export const readClient = createClient({ chain: CHAIN });

let cachedWriteAddress: string | null = null;
let cachedWriteClient: ReturnType<typeof createClient> | null = null;

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

export async function ensureBradburyNetwork(address: string) {
  const client = getWriteClient(address);
  try {
    await client.connect(NETWORK_NAME);
  } catch (err) {
    console.warn("[genlayer] network switch skipped:", err);
  }
  return client;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStatus(
  hash: `0x${string}`,
  status: TransactionStatus = TransactionStatus.ACCEPTED,
  { retries = 30, retryDelayMs = 2000 }: { retries?: number; retryDelayMs?: number } = {},
) {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await readClient.waitForTransactionReceipt({
        hash: hash as any,
        status,
        interval: 2000,
        retries: 60,
      });
    } catch (err) {
      lastError = err;
      if (attempt < retries) {
        await sleep(retryDelayMs);
      }
    }
  }
  throw lastError;
}

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

async function write(
  address: string,
  functionName: string,
  args: unknown[] = [],
  value: bigint = 0n,
  waitStatus: TransactionStatus = TransactionStatus.ACCEPTED,
) {
  const client = await ensureBradburyNetwork(address);
  const hash = (await client.writeContract({
    address: CONTRACT_ADDRESS,
    functionName,
    args: args as any,
    value,
  })) as `0x${string}`;
  return waitForStatus(hash, waitStatus);
}

export const submitScore = (address: string, evidence: ReplayEvidence) =>
  write(address, "submit_score", [BigInt(evidence.seed), evidence.moves]);

export const createTournament = (
  address: string,
  params: {
    name: string;
    maxParticipants: number;
    winnerCount: number;
    entryFeeWei: bigint;
    deadlineUnixSeconds: number;
    initialFundWei?: bigint;
  },
) =>
  write(
    address,
    "create_tournament",
    [
      params.name,
      Math.floor(params.maxParticipants),
      Math.floor(params.winnerCount),
      params.entryFeeWei,
      BigInt(Math.floor(params.deadlineUnixSeconds)),
    ],
    params.initialFundWei ?? 0n,
  );

export const cancelTournament = (address: string, tournamentId: number) =>
  write(address, "cancel_tournament", [tournamentId]);

export const transferOwnership = (address: string, newOwner: string) =>
  write(address, "transfer_ownership", [newOwner]);

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
  write(
    address,
    "claim_prize",
    [tournamentId],
    0n,
    TransactionStatus.FINALIZED,
  );

export const claimRefund = (address: string, tournamentId: number) =>
  write(
    address,
    "claim_refund",
    [tournamentId],
    0n,
    TransactionStatus.FINALIZED,
  );
