# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
"""
Game2048Platform - GenLayer Intelligent Contract
==================================================

On-chain 2048 Game & Tournament Platform.

Validator model
----------------
Scores are never accepted as a bare client-supplied number. Every submission
carries a 32-bit RNG seed plus the exact move sequence played. Both the
frontend (`Game2048.tsx`) and this contract run the *same* deterministic
2048 engine and the *same* xorshift32 PRNG, seeded identically, so the
contract can independently replay the whole game and compute the score
itself. Because this replay is pure deterministic Python (no LLM/web
access), GenVM's normal leader/validator consensus is what accepts or
rejects the transaction -- validators are agreeing on a verified replay,
not trusting a self-reported figure.

Known limitation: a player can simulate many seeds off-chain before ever
touching the chain, and only submit the run that came out best. Closing
that fully needs a commit-reveal or per-move entropy scheme (a chain
round-trip per tile), which is a bigger UX change than this pass covers.
This validator's job is narrower and still real: it guarantees any
*accepted* score is the mathematically correct result of legal 2048 moves
applied to a legal spawn sequence, not an arbitrary number.
"""

from genlayer import *
from dataclasses import dataclass
import datetime


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

DEFAULT_ENTRY_FEE = u256(1_000_000_000_000_000_000)  # 1 GEN standard wei-style
MAX_PLAUSIBLE_SCORE = u256(20_000_000)
MAX_REPLAY_MOVES = u32(4000)  # replay compute/gas bound


# ---------------------------------------------------------------------------
# EVM Account interface for external transfers (EOA / MetaMask)
# ---------------------------------------------------------------------------

@gl.evm.contract_interface
class _Recipient:
    class View:
        pass

    class Write:
        pass


# ---------------------------------------------------------------------------
# Persistent storage dataclasses
# ---------------------------------------------------------------------------

@allow_storage
@dataclass
class LeaderboardEntry:
    player: Address
    high_score: u256
    games_played: u32
    last_score: u256
    last_submitted_at: u256


@allow_storage
@dataclass
class Tournament:
    tournament_id: u32
    name: str
    creator: Address
    max_participants: u32
    winner_count: u32
    entry_fee: u256
    prize_pool: u256
    deadline_ts: u256
    created_at_ts: u256
    participant_count: u32
    is_finalized: bool
    is_cancelled: bool


# ---------------------------------------------------------------------------
# Plain (non-storage) view-return dataclasses
# ---------------------------------------------------------------------------

@dataclass
class LeaderboardEntryView:
    player: str
    high_score: u256
    games_played: u32
    last_score: u256
    last_submitted_at: u256


@dataclass
class TournamentView:
    exists: bool
    tournament_id: u32
    name: str
    creator: str
    max_participants: u32
    winner_count: u32
    participant_count: u32
    entry_fee: u256
    prize_pool: u256
    deadline_ts: u256
    created_at_ts: u256
    is_finalized: bool
    is_cancelled: bool


@dataclass
class ParticipantStatusView:
    exists: bool
    has_joined: bool
    has_submitted: bool
    has_claimed: bool
    score: u256
    prize_amount: u256


# ---------------------------------------------------------------------------
# Deterministic 2048 replay engine
#
# Every function below is pure (no `self`, no storage access) and MUST stay
# byte-for-byte in sync with the mirrored logic in `Game2048.tsx`
# (`xorshift32`, `SeededRng`, `spawnTileSeeded`, `move`). If either side
# changes the collapse/rotate/RNG algorithm, replay validation will start
# rejecting every legitimate game.
# ---------------------------------------------------------------------------

_SIZE = 4
_MOVE_CHARS = ("U", "D", "L", "R")
_ROTATIONS = {"U": 3, "R": 2, "D": 1, "L": 0}


class _Rng:
    """xorshift32 PRNG - must match `xorshift32`/`SeededRng` in Game2048.tsx."""

    __slots__ = ("state",)

    def __init__(self, seed: int):
        s = seed & 0xFFFFFFFF
        self.state = s if s != 0 else 1

    def next_float(self) -> float:
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= (x >> 17)
        x ^= (x << 5) & 0xFFFFFFFF
        x &= 0xFFFFFFFF
        self.state = x
        return x / 4294967296.0


def _empty_board():
    return [[0] * _SIZE for _ in range(_SIZE)]


def _empty_cells(board):
    cells = []
    for r in range(_SIZE):
        for c in range(_SIZE):
            if board[r][c] == 0:
                cells.append((r, c))
    return cells


def _spawn_tile(board, rng: _Rng):
    cells = _empty_cells(board)
    if not cells:
        return board, False
    idx = int(rng.next_float() * len(cells))
    if idx >= len(cells):
        idx = len(cells) - 1
    r, c = cells[idx]
    board[r][c] = 2 if rng.next_float() < 0.9 else 4
    return board, True


def _collapse_row_left(row):
    values = [v for v in row if v != 0]
    result = []
    gained = 0
    i = 0
    while i < len(values):
        if i + 1 < len(values) and values[i] == values[i + 1]:
            merged = values[i] * 2
            result.append(merged)
            gained += merged
            i += 2
        else:
            result.append(values[i])
            i += 1
    while len(result) < _SIZE:
        result.append(0)
    return result, gained


def _rotate_cw(board):
    next_b = _empty_board()
    for r in range(_SIZE):
        for c in range(_SIZE):
            next_b[c][_SIZE - 1 - r] = board[r][c]
    return next_b


def _move_board(board, direction: str):
    rotations = _ROTATIONS[direction]
    working = board
    for _ in range(rotations):
        working = _rotate_cw(working)

    gained = 0
    collapsed = []
    for row in working:
        new_row, row_gain = _collapse_row_left(row)
        collapsed.append(new_row)
        gained += row_gain

    result = collapsed
    for _ in range((4 - rotations) % 4):
        result = _rotate_cw(result)

    moved = result != board
    return result, gained, moved


def _replay_moves(seed: int, moves: str):
    """Replays (seed, moves) through the 2048 engine.

    Returns (final_score, is_valid). is_valid is False if the evidence is
    malformed, contains an illegal/no-op move, or produces an implausible
    score -- any of which means the submission is rejected outright rather
    than silently corrected.
    """
    if len(moves) > int(MAX_REPLAY_MOVES):
        return 0, False

    rng = _Rng(seed)
    board = _empty_board()
    board, ok1 = _spawn_tile(board, rng)
    board, ok2 = _spawn_tile(board, rng)
    if not (ok1 and ok2):
        return 0, False

    total_score = 0
    for ch in moves:
        if ch not in _MOVE_CHARS:
            return 0, False
        new_board, gained, moved = _move_board(board, ch)
        if not moved:
            # A recorded move that doesn't change the board can't come from
            # a genuine playthrough -- the UI only records moves that did.
            return 0, False
        board = new_board
        total_score += gained
        if total_score > int(MAX_PLAUSIBLE_SCORE):
            return 0, False
        board, _ = _spawn_tile(board, rng)

    return total_score, True


# ---------------------------------------------------------------------------
# Contract
# ---------------------------------------------------------------------------

class Game2048Platform(gl.Contract):
    owner: Address
    next_tournament_id: u32

    leaderboard: TreeMap[Address, LeaderboardEntry]
    leaderboard_players: DynArray[Address]

    tournaments: TreeMap[u32, Tournament]
    tournament_ids: DynArray[u32]

    tournament_participant_at: TreeMap[str, Address]
    tournament_joined: TreeMap[str, bool]
    tournament_submitted: TreeMap[str, bool]
    tournament_claimed: TreeMap[str, bool]
    tournament_scores: TreeMap[str, u256]
    tournament_winner_count: TreeMap[u32, u32]
    tournament_winner_at: TreeMap[str, Address]
    tournament_prize_amounts: TreeMap[str, u256]

    def __init__(self):
        self.owner = gl.message.sender_address
        self.next_tournament_id = u32(1)

    def _require_owner(self) -> None:
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only the contract owner may perform this action")

    def _now_ts(self) -> u256:
        # GenVM exposes a deterministic transaction time: every validator
        # replaying this transaction computes the same value, which is what
        # makes on-chain deadline enforcement possible at all (the previous
        # implementation returned a hardcoded 0 and enforced nothing).
        return u256(int(datetime.datetime.now().timestamp()))

    def _get_tournament_or_raise(self, tournament_id: u32) -> Tournament:
        t = self.tournaments.get(tournament_id, None)
        if t is None:
            raise gl.vm.UserError("Tournament does not exist")
        return t

    @gl.public.write
    def submit_score(self, seed: u256, moves: str) -> None:
        player = gl.message.sender_address

        total_score, is_valid = _replay_moves(int(seed), moves)
        if not is_valid:
            raise gl.vm.UserError("Move evidence failed replay validation")

        score = u256(total_score)
        if score > MAX_PLAUSIBLE_SCORE:
            raise gl.vm.UserError("Score exceeds the maximum plausible value")

        now_ts = self._now_ts()
        existing = self.leaderboard.get(player, None)

        if existing is None:
            self.leaderboard[player] = LeaderboardEntry(
                player=player,
                high_score=score,
                games_played=u32(1),
                last_score=score,
                last_submitted_at=now_ts,
            )
            self.leaderboard_players.append(player)
        else:
            new_high = existing.high_score if existing.high_score > score else score
            self.leaderboard[player] = LeaderboardEntry(
                player=player,
                high_score=new_high,
                games_played=u32(int(existing.games_played) + 1),
                last_score=score,
                last_submitted_at=now_ts,
            )

    @gl.public.write
    def create_tournament(
        self,
        name: str,
        max_participants: u32,
        winner_count: u32,
        entry_fee: u256,
        deadline_timestamp: u256,
    ) -> u32:
        self._require_owner()

        max_participants = u32(max_participants)
        winner_count = u32(winner_count)
        entry_fee = u256(entry_fee)
        deadline_timestamp = u256(deadline_timestamp)

        if len(name) == 0:
            raise gl.vm.UserError("Tournament name cannot be empty")
        if max_participants == 0:
            raise gl.vm.UserError("max_participants must be greater than zero")
        if winner_count == 0:
            raise gl.vm.UserError("winner_count must be greater than zero")
        if winner_count > max_participants:
            raise gl.vm.UserError("winner_count cannot exceed max_participants")

        now_ts = self._now_ts()
        if int(deadline_timestamp) <= int(now_ts):
            raise gl.vm.UserError("deadline_timestamp must be in the future")

        tid = self.next_tournament_id
        self.next_tournament_id = u32(int(tid) + 1)

        self.tournaments[tid] = Tournament(
            tournament_id=tid,
            name=name,
            creator=gl.message.sender_address,
            max_participants=max_participants,
            winner_count=winner_count,
            entry_fee=entry_fee,
            prize_pool=u256(0),
            deadline_ts=deadline_timestamp,
            created_at_ts=now_ts,
            participant_count=u32(0),
            is_finalized=False,
            is_cancelled=False,
        )
        self.tournament_ids.append(tid)

        return tid

    @gl.public.write
    def cancel_tournament(self, tournament_id: u32) -> None:
        self._require_owner()
        tournament_id = u32(tournament_id)

        t = self._get_tournament_or_raise(tournament_id)
        if t.is_finalized:
            raise gl.vm.UserError("Cannot cancel a tournament that is already finalized")
        if t.is_cancelled:
            raise gl.vm.UserError("Tournament is already cancelled")

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=t.prize_pool,
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=t.participant_count,
            is_finalized=t.is_finalized,
            is_cancelled=True,
        )

    @gl.public.write.payable
    def join_tournament(self, tournament_id: u32) -> None:
        tournament_id = u32(tournament_id)
        player = gl.message.sender_address
        paid = u256(gl.message.value)

        tid_str = str(int(tournament_id))
        player_str = str(player)
        join_key = f"{tid_str}_{player_str}"

        t = self._get_tournament_or_raise(tournament_id)
        if t.is_cancelled:
            raise gl.vm.UserError("Tournament has been cancelled")
        if t.is_finalized:
            raise gl.vm.UserError("Tournament has already been finalized")

        now_ts = self._now_ts()
        if int(now_ts) >= int(t.deadline_ts):
            raise gl.vm.UserError("Tournament deadline has passed")

        if int(t.participant_count) >= int(t.max_participants):
            raise gl.vm.UserError("Tournament is full")

        if self.tournament_joined.get(join_key, False):
            raise gl.vm.UserError("Player has already joined this tournament")

        # Strict fee validation restored
        if paid != t.entry_fee:
            raise gl.vm.UserError("Incorrect entry fee amount sent")

        # --- Effects ---
        self.tournament_joined[join_key] = True

        idx = int(t.participant_count)
        part_key = f"{tid_str}_{idx}"
        self.tournament_participant_at[part_key] = player

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=u256(int(t.prize_pool) + int(paid)),
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=u32(idx + 1),
            is_finalized=t.is_finalized,
            is_cancelled=t.is_cancelled,
        )

    @gl.public.write.payable
    def fund_tournament(self, tournament_id: u32) -> None:
        tournament_id = u32(tournament_id)
        amount = u256(gl.message.value)

        t = self._get_tournament_or_raise(tournament_id)
        if t.is_finalized:
            raise gl.vm.UserError("Cannot fund a tournament that is already finalized")
        if t.is_cancelled:
            raise gl.vm.UserError("Cannot fund a cancelled tournament")
        if amount == 0:
            raise gl.vm.UserError("Must send a positive amount to fund the prize pool")

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=u256(int(t.prize_pool) + int(amount)),
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=t.participant_count,
            is_finalized=t.is_finalized,
            is_cancelled=t.is_cancelled,
        )

    @gl.public.write
    def submit_tournament_score(self, tournament_id: u32, seed: u256, moves: str) -> None:
        tournament_id = u32(tournament_id)
        player = gl.message.sender_address

        tid_str = str(int(tournament_id))
        player_str = str(player)
        action_key = f"{tid_str}_{player_str}"

        t = self._get_tournament_or_raise(tournament_id)
        if t.is_cancelled:
            raise gl.vm.UserError("Tournament has been cancelled")

        if not self.tournament_joined.get(action_key, False):
            raise gl.vm.UserError("You must join this tournament before submitting a score")

        now_ts = self._now_ts()
        if int(now_ts) >= int(t.deadline_ts):
            raise gl.vm.UserError("Tournament submission deadline has passed")

        total_score, is_valid = _replay_moves(int(seed), moves)
        if not is_valid:
            raise gl.vm.UserError("Move evidence failed replay validation")

        score = u256(total_score)
        if score > MAX_PLAUSIBLE_SCORE:
            raise gl.vm.UserError("Score exceeds the maximum plausible value")

        previous_best = self.tournament_scores.get(action_key, u256(0))
        if score > previous_best:
            self.tournament_scores[action_key] = score

        self.tournament_submitted[action_key] = True

    @gl.public.write
    def finalize_tournament(self, tournament_id: u32) -> None:
        tournament_id = u32(tournament_id)
        t = self._get_tournament_or_raise(tournament_id)
        tid_str = str(int(tournament_id))

        if t.is_cancelled:
            raise gl.vm.UserError("Tournament has been cancelled")
        if t.is_finalized:
            raise gl.vm.UserError("Tournament has already been finalized")

        now_ts = self._now_ts()
        if int(now_ts) < int(t.deadline_ts):
            raise gl.vm.UserError("Tournament deadline has not passed yet")

        actual_players = int(t.participant_count)
        ranked = []
        for i in range(actual_players):
            part_key = f"{tid_str}_{i}"
            p = self.tournament_participant_at.get(part_key, None)
            if p is not None:
                score_key = f"{tid_str}_{str(p)}"
                s = self.tournament_scores.get(score_key, None)
                if s is not None:
                    ranked.append((p, s))

        ranked.sort(key=lambda row: int(row[1]), reverse=True)

        winner_count = int(t.winner_count)
        n_winners = winner_count if len(ranked) >= winner_count else len(ranked)

        self.tournament_winner_count[tournament_id] = u32(n_winners)

        if n_winners > 0:
            pool = int(t.prize_pool)
            base_share = pool // n_winners
            remainder = pool % n_winners

            for i in range(n_winners):
                winner_addr = ranked[i][0]
                win_key = f"{tid_str}_{i}"
                self.tournament_winner_at[win_key] = winner_addr

                share = base_share
                if i == 0:
                    share += remainder

                prize_key = f"{tid_str}_{str(winner_addr)}"
                self.tournament_prize_amounts[prize_key] = u256(share)

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=t.prize_pool,
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=t.participant_count,
            is_finalized=True,
            is_cancelled=t.is_cancelled,
        )

    @gl.public.write
    def claim_prize(self, tournament_id: u32) -> None:
        tournament_id = u32(tournament_id)
        player = gl.message.sender_address

        tid_str = str(int(tournament_id))
        player_str = str(player)
        action_key = f"{tid_str}_{player_str}"

        t = self._get_tournament_or_raise(tournament_id)
        if t.is_cancelled:
            raise gl.vm.UserError("Tournament has been cancelled")
        if not t.is_finalized:
            raise gl.vm.UserError("Tournament has not been finalized yet")

        if self.tournament_claimed.get(action_key, False):
            raise gl.vm.UserError("Prize already claimed")

        amount = self.tournament_prize_amounts.get(action_key, u256(0))
        if amount == 0:
            raise gl.vm.UserError("No prize available for this address")

        # --- Effects before interaction ---
        self.tournament_claimed[action_key] = True
        self.tournament_prize_amounts[action_key] = u256(0)

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=u256(int(t.prize_pool) - int(amount)),
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=t.participant_count,
            is_finalized=t.is_finalized,
            is_cancelled=t.is_cancelled,
        )

        # --- Interaction: actually move the funds to EOA / MetaMask ---
        _Recipient(Address(player)).emit_transfer(value=amount)

    @gl.public.write
    def claim_refund(self, tournament_id: u32) -> None:
        tournament_id = u32(tournament_id)
        player = gl.message.sender_address

        tid_str = str(int(tournament_id))
        player_str = str(player)
        action_key = f"{tid_str}_{player_str}"

        t = self._get_tournament_or_raise(tournament_id)
        if not t.is_cancelled:
            raise gl.vm.UserError("Tournament was not cancelled")

        if not self.tournament_joined.get(action_key, False):
            raise gl.vm.UserError("You did not join this tournament")

        if self.tournament_claimed.get(action_key, False):
            raise gl.vm.UserError("Refund already claimed")

        refund_amount = t.entry_fee
        if refund_amount == 0:
            raise gl.vm.UserError("Nothing to refund for this tournament")

        # --- Effects before interaction ---
        self.tournament_claimed[action_key] = True

        self.tournaments[tournament_id] = Tournament(
            tournament_id=t.tournament_id,
            name=t.name,
            creator=t.creator,
            max_participants=t.max_participants,
            winner_count=t.winner_count,
            entry_fee=t.entry_fee,
            prize_pool=u256(int(t.prize_pool) - int(refund_amount)),
            deadline_ts=t.deadline_ts,
            created_at_ts=t.created_at_ts,
            participant_count=t.participant_count,
            is_finalized=t.is_finalized,
            is_cancelled=t.is_cancelled,
        )

        # --- Interaction: actually move the funds to EOA / MetaMask ---
        _Recipient(Address(player)).emit_transfer(value=refund_amount)

    @gl.public.write
    def transfer_ownership(self, new_owner: Address) -> None:
        self._require_owner()
        self.owner = Address(new_owner)

    @gl.public.write.payable
    def receive_funds(self) -> None:
        pass

    # =====================================================================
    # VIEWS
    # =====================================================================

    @gl.public.view
    def get_owner(self) -> str:
        try:
            return str(self.owner)
        except Exception:
            return ""

    @gl.public.view
    def get_default_entry_fee(self) -> u256:
        return DEFAULT_ENTRY_FEE

    @gl.public.view
    def get_max_plausible_score(self) -> u256:
        return MAX_PLAUSIBLE_SCORE

    @gl.public.view
    def get_max_replay_moves(self) -> u32:
        return MAX_REPLAY_MOVES

    @gl.public.view
    def get_high_score(self, player_address: str) -> u256:
        try:
            addr = Address(player_address)
        except Exception:
            return u256(0)
        entry = self.leaderboard.get(addr, None)
        if entry is None:
            return u256(0)
        return entry.high_score

    @gl.public.view
    def get_player_stats(self, player_address: str) -> LeaderboardEntryView:
        try:
            addr = Address(player_address)
            entry = self.leaderboard.get(addr, None)
            if entry is None:
                return LeaderboardEntryView(
                    player=player_address,
                    high_score=u256(0),
                    games_played=u32(0),
                    last_score=u256(0),
                    last_submitted_at=u256(0),
                )
            return LeaderboardEntryView(
                player=str(addr),
                high_score=entry.high_score,
                games_played=entry.games_played,
                last_score=entry.last_score,
                last_submitted_at=entry.last_submitted_at,
            )
        except Exception:
            return LeaderboardEntryView(
                player=player_address,
                high_score=u256(0),
                games_played=u32(0),
                last_score=u256(0),
                last_submitted_at=u256(0),
            )

    @gl.public.view
    def get_leaderboard_player_count(self) -> u32:
        try:
            return u32(len(self.leaderboard_players))
        except Exception:
            return u32(0)

    @gl.public.view
    def get_leaderboard(self, top_n: u32) -> list[LeaderboardEntryView]:
        try:
            n = int(top_n)
            if n <= 0:
                return []

            rows: list[LeaderboardEntryView] = []
            for addr in self.leaderboard_players:
                entry = self.leaderboard.get(addr, None)
                if entry is not None:
                    rows.append(
                        LeaderboardEntryView(
                            player=str(addr),
                            high_score=entry.high_score,
                            games_played=entry.games_played,
                            last_score=entry.last_score,
                            last_submitted_at=entry.last_submitted_at,
                        )
                    )
            rows.sort(key=lambda r: int(r.high_score), reverse=True)
            return rows[:n]
        except Exception:
            return []

    @gl.public.view
    def get_tournament_count(self) -> u32:
        try:
            return u32(int(self.next_tournament_id) - 1)
        except Exception:
            return u32(0)

    @gl.public.view
    def list_tournament_ids(self) -> list[u32]:
        try:
            return [tid for tid in self.tournament_ids]
        except Exception:
            return []

    @gl.public.view
    def get_tournament(self, tournament_id: u32) -> TournamentView:
        try:
            tid = u32(tournament_id)
            t = self.tournaments.get(tid, None)
            if t is None:
                return TournamentView(
                    exists=False, tournament_id=tid, name="", creator="",
                    max_participants=u32(0), winner_count=u32(0),
                    participant_count=u32(0), entry_fee=u256(0),
                    prize_pool=u256(0), deadline_ts=u256(0),
                    created_at_ts=u256(0), is_finalized=False, is_cancelled=False,
                )
            return TournamentView(
                exists=True,
                tournament_id=tid,
                name=t.name,
                creator=str(t.creator),
                max_participants=t.max_participants,
                winner_count=t.winner_count,
                participant_count=t.participant_count,
                entry_fee=t.entry_fee,
                prize_pool=t.prize_pool,
                deadline_ts=t.deadline_ts,
                created_at_ts=t.created_at_ts,
                is_finalized=t.is_finalized,
                is_cancelled=t.is_cancelled,
            )
        except Exception:
            return TournamentView(
                exists=False, tournament_id=u32(0), name="", creator="",
                max_participants=u32(0), winner_count=u32(0),
                participant_count=u32(0), entry_fee=u256(0),
                prize_pool=u256(0), deadline_ts=u256(0),
                created_at_ts=u256(0), is_finalized=False, is_cancelled=False,
            )

    @gl.public.view
    def get_tournament_participants(self, tournament_id: u32) -> list[str]:
        try:
            tid = u32(tournament_id)
            t = self.tournaments.get(tid, None)
            if t is None:
                return []

            plist = []
            for i in range(int(t.participant_count)):
                p = self.tournament_participant_at.get(f"{int(tid)}_{i}", None)
                if p is not None:
                    plist.append(str(p))
            return plist
        except Exception:
            return []

    @gl.public.view
    def get_tournament_winners(self, tournament_id: u32) -> list[str]:
        try:
            tid = u32(tournament_id)
            w_count = self.tournament_winner_count.get(tid, u32(0))

            wlist = []
            for i in range(int(w_count)):
                w = self.tournament_winner_at.get(f"{int(tid)}_{i}", None)
                if w is not None:
                    wlist.append(str(w))
            return wlist
        except Exception:
            return []

    @gl.public.view
    def get_participant_status(
        self, tournament_id: u32, player_address: str
    ) -> ParticipantStatusView:
        try:
            tid_str = str(int(tournament_id))
            addr_str = str(Address(player_address))
            action_key = f"{tid_str}_{addr_str}"

            has_joined = bool(self.tournament_joined.get(action_key, False))
            has_submitted = bool(self.tournament_submitted.get(action_key, False))
            has_claimed = bool(self.tournament_claimed.get(action_key, False))
            score = self.tournament_scores.get(action_key, u256(0))
            prize_amount = self.tournament_prize_amounts.get(action_key, u256(0))

            return ParticipantStatusView(
                exists=True,
                has_joined=has_joined,
                has_submitted=has_submitted,
                has_claimed=has_claimed,
                score=score,
                prize_amount=prize_amount,
            )
        except Exception:
            return ParticipantStatusView(False, False, False, False, u256(0), u256(0))
