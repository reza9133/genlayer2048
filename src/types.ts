// Numeric contract fields can come back as number | string | bigint depending
// on the SDK's return-encoding mode, so every numeric field is typed loosely
// here and normalized with the helpers in `lib/format.ts` before use.
export type Numeric = number | string | bigint;
export interface LeaderboardEntryView {
  player: string;
  high_score: Numeric;
  games_played: Numeric;
  last_score: Numeric;
  last_submitted_at: Numeric;
}
export interface TournamentView {
  exists: boolean;
  tournament_id: Numeric;
  name: string;
  creator: string;
  max_participants: Numeric;
  winner_count: Numeric;
  participant_count: Numeric;
  entry_fee: Numeric;
  prize_pool: Numeric;
  deadline_ts: Numeric;
  created_at_ts: Numeric;
  is_finalized: boolean;
  is_cancelled: boolean;
}
export interface ParticipantStatusView {
  exists: boolean;
  has_joined: boolean;
  has_submitted: boolean;
  has_claimed: boolean;
  score: Numeric;
  prize_amount: Numeric;
}
export type TournamentPhase =
  | "upcoming" // shouldn't normally happen (created_at is always <= now) but kept for safety
  | "cancelled"
  | "open" // before deadline, accepting joins/scores
  | "awaiting_finalize" // deadline passed, not finalized yet
  | "finalized";

/**
 * Replayable proof of a game: the RNG seed the game was played with, and the
 * exact sequence of accepted moves ('U'/'D'/'L'/'R', one char per move).
 * The contract independently replays this through the same deterministic
 * 2048 engine to compute the score itself — see `submit_score` /
 * `submit_tournament_score` in 2048.py.
 */
export interface ReplayEvidence {
  seed: string;
  moves: string;
}
