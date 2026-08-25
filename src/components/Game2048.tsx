import { useCallback, useEffect, useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import type { ReplayEvidence } from "../types";

type Board = number[][];
type Direction = "up" | "down" | "left" | "right";
type MoveCode = "U" | "D" | "L" | "R";

const SIZE = 4;
const DIRECTION_CODE: Record<Direction, MoveCode> = {
  up: "U",
  down: "D",
  left: "L",
  right: "R",
};

const TILE_STYLES: Record<number, { bg: string; text: string }> = {
  2: { bg: "#EEE4DA", text: "#5C4A3A" },
  4: { bg: "#EDE0C8", text: "#5C4A3A" },
  8: { bg: "#F2B179", text: "#FBF6EF" },
  16: { bg: "#F59563", text: "#FBF6EF" },
  32: { bg: "#F67C5F", text: "#FBF6EF" },
  64: { bg: "#F65E3B", text: "#FBF6EF" },
  128: { bg: "#EDCF72", text: "#FBF6EF" },
  256: { bg: "#EDCC61", text: "#FBF6EF" },
  512: { bg: "#EDC850", text: "#FBF6EF" },
  1024: { bg: "#EDC53F", text: "#FBF6EF" },
  2048: { bg: "#EDC22E", text: "#FBF6EF" },
};

function emptyBoard(): Board {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

function emptyCells(board: Board): [number, number][] {
  const cells: [number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

/**
 * Deterministic xorshift32 PRNG. Must stay byte-for-byte identical to the
 * Python replay implementation in `2048.py` (`_Rng`) — every spawn drawn
 * here has to be exactly reproducible on-chain from the same seed.
 */
function xorshift32(state: number): number {
  let x = state >>> 0;
  x ^= (x << 13) >>> 0;
  x = x >>> 0;
  x ^= x >>> 17;
  x ^= (x << 5) >>> 0;
  x = x >>> 0;
  return x >>> 0;
}

class SeededRng {
  state: number;
  constructor(seed: number) {
    this.state = seed >>> 0;
    if (this.state === 0) this.state = 1;
  }
  next(): number {
    this.state = xorshift32(this.state);
    return this.state / 4294967296;
  }
}

function randomSeed(): number {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return crypto.getRandomValues(new Uint32Array(1))[0] >>> 0;
  }
  return Math.floor(Math.random() * 4294967296) >>> 0;
}

/** Spawns a tile using the seeded RNG (not Math.random) so every spawn the
 *  player sees is exactly what the on-chain replay validator will derive. */
function spawnTileSeeded(board: Board, rng: SeededRng): Board {
  const cells = emptyCells(board);
  if (cells.length === 0) return board;
  const idx = Math.min(Math.floor(rng.next() * cells.length), cells.length - 1);
  const [r, c] = cells[idx];
  const next = cloneBoard(board);
  next[r][c] = rng.next() < 0.9 ? 2 : 4;
  return next;
}

/** Slides+merges a single row to the left; returns the new row and points gained. */
function collapseRowLeft(row: number[]): { row: number[]; gained: number } {
  const values = row.filter((v) => v !== 0);
  const result: number[] = [];
  let gained = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] === values[i + 1]) {
      const merged = values[i] * 2;
      result.push(merged);
      gained += merged;
      i++;
    } else {
      result.push(values[i]);
    }
  }
  while (result.length < SIZE) result.push(0);
  return { row: result, gained };
}

function rotateBoardCW(board: Board): Board {
  const next = emptyBoard();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      next[c][SIZE - 1 - r] = board[r][c];
    }
  }
  return next;
}

/** Moves the whole board in `direction` by rotating so the move is always "left". */
function move(board: Board, direction: Direction): { board: Board; gained: number; moved: boolean } {
  let rotations = 0;
  if (direction === "up") rotations = 3;
  if (direction === "right") rotations = 2;
  if (direction === "down") rotations = 1;

  let working = board;
  for (let i = 0; i < rotations; i++) working = rotateBoardCW(working);

  let gained = 0;
  const collapsed = working.map((row) => {
    const { row: newRow, gained: rowGain } = collapseRowLeft(row);
    gained += rowGain;
    return newRow;
  });

  let result = collapsed;
  for (let i = 0; i < (4 - rotations) % 4; i++) result = rotateBoardCW(result);

  const moved = JSON.stringify(result) !== JSON.stringify(board);
  return { board: result, gained, moved };
}

function boardsEqual(a: Board, b: Board): boolean {
  return a.every((row, r) => row.every((v, c) => v === b[r][c]));
}

function canMove(board: Board): boolean {
  if (emptyCells(board).length > 0) return true;
  for (const dir of ["up", "down", "left", "right"] as Direction[]) {
    if (move(board, dir).moved) return true;
  }
  return false;
}

function freshBoard(rng: SeededRng): Board {
  return spawnTileSeeded(spawnTileSeeded(emptyBoard(), rng), rng);
}

export interface Game2048Handle {
  score: number;
  gameOver: boolean;
}

interface Game2048Props {
  /**
   * Called on every state change so a parent can read the live score and
   * the replayable evidence (e.g. to enable "Submit Score"). `evidence`
   * is what gets sent on-chain — the contract replays it to derive and
   * verify the score itself instead of trusting `score` directly.
   */
  onScoreChange?: (
    score: number,
    gameOver: boolean,
    reachedTarget: boolean,
    evidence: ReplayEvidence,
  ) => void;
  /** Compact styling for embedding inside a smaller panel. */
  compact?: boolean;
}

export default function Game2048({ onScoreChange, compact }: Game2048Props) {
  const seedRef = useRef<number>(randomSeed());
  const rngRef = useRef<SeededRng>();
  if (!rngRef.current) rngRef.current = new SeededRng(seedRef.current);
  const movesRef = useRef<MoveCode[]>([]);

  const [board, setBoard] = useState<Board>(() => freshBoard(rngRef.current!));
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  const reachedTarget = board.some((row) => row.some((v) => v >= 2048));

  useEffect(() => {
    onScoreChange?.(score, gameOver, reachedTarget, {
      seed: String(seedRef.current),
      moves: movesRef.current.join(""),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [score, gameOver, reachedTarget]);

  const restart = useCallback(() => {
    seedRef.current = randomSeed();
    rngRef.current = new SeededRng(seedRef.current);
    movesRef.current = [];
    setBoard(freshBoard(rngRef.current));
    setScore(0);
    setGameOver(false);
    setWon(false);
  }, []);

  const handleMove = useCallback(
    (direction: Direction) => {
      if (gameOver) return;
      setBoard((prevBoard) => {
        const { board: moved, gained, moved: didMove } = move(prevBoard, direction);
        if (!didMove) return prevBoard;
        movesRef.current.push(DIRECTION_CODE[direction]);
        const withSpawn = spawnTileSeeded(moved, rngRef.current!);
        setScore((s) => {
          const next = s + gained;
          setBest((b) => Math.max(b, next));
          return next;
        });
        if (!won && withSpawn.some((row) => row.some((v) => v >= 2048))) {
          setWon(true);
        }
        if (!canMove(withSpawn)) {
          setGameOver(true);
        }
        return boardsEqual(withSpawn, prevBoard) ? prevBoard : withSpawn;
      });
    },
    [gameOver, won],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: "up",
        ArrowDown: "down",
        ArrowLeft: "left",
        ArrowRight: "right",
        w: "up",
        s: "down",
        a: "left",
        d: "right",
      };
      const dir = map[e.key];
      if (dir) {
        e.preventDefault();
        handleMove(dir);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleMove]);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = { x: t.clientX, y: t.clientY };
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - touchStart.current.x;
    const dy = t.clientY - touchStart.current.y;
    const threshold = 24;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      handleMove(dx > 0 ? "right" : "left");
    } else {
      handleMove(dy > 0 ? "down" : "up");
    }
    touchStart.current = null;
  };

  const tileSize = compact ? "h-16 w-16 text-lg" : "h-[74px] w-[74px] text-2xl sm:h-20 sm:w-20 sm:text-3xl";

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex gap-2">
          <div className="rounded-lg bg-surface-raised px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted">Score</div>
            <div className="font-display text-lg font-bold text-gold">{score}</div>
          </div>
          <div className="rounded-lg bg-surface-raised px-3 py-1.5 text-center">
            <div className="text-[10px] uppercase tracking-wide text-muted">Best (session)</div>
            <div className="font-display text-lg font-bold text-ink-50">{best}</div>
          </div>
        </div>
        <button onClick={restart} className="btn-ghost !px-3 !py-1.5 text-xs">
          <RotateCcw size={14} /> New game
        </button>
      </div>

      <div
        className="relative rounded-2xl bg-surface-raised p-2.5 shadow-tile sm:p-3"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="grid grid-cols-4 gap-2.5 sm:gap-3">
          {board.flatMap((row, r) =>
            row.map((value, c) => {
              const style = TILE_STYLES[value];
              return (
                <div
                  key={`${r}-${c}`}
                  className={`flex ${tileSize} items-center justify-center rounded-lg font-display font-bold ${
                    value ? "animate-pop" : ""
                  }`}
                  style={{
                    background: style?.bg ?? "rgba(255,255,255,0.04)",
                    color: style?.text ?? "transparent",
                  }}
                >
                  {value > 0 ? value : ""}
                </div>
              );
            }),
          )}
        </div>

        {(gameOver || won) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-2xl bg-ink-900/85 backdrop-blur-sm">
            <p className="font-display text-xl font-bold text-ink-50">
              {gameOver ? "Game over" : "2048!"}
            </p>
            <p className="text-sm text-muted">Final score: {score}</p>
            {won && !gameOver ? (
              <button onClick={() => setWon(false)} className="btn-ghost text-xs">
                Keep playing
              </button>
            ) : (
              <button onClick={restart} className="btn-primary text-sm">
                <RotateCcw size={14} /> Play again
              </button>
            )}
          </div>
        )}
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        Arrow keys / WASD, or swipe on mobile.
      </p>
    </div>
  );
}
