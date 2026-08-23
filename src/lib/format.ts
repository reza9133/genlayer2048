import type { Numeric } from "../types";

const WEI_PER_GEN = 1_000_000_000_000_000_000n;

/** Normalize a contract numeric return value (number | string | bigint) to a bigint. */
export function toBigInt(value: Numeric | undefined | null): bigint {
  if (value === undefined || value === null) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(Math.trunc(value));
  const trimmed = value.trim();
  if (trimmed === "") return 0n;
  try {
    return BigInt(trimmed);
  } catch {
    // Fell back from a non-integer numeric string (shouldn't happen for u32/u256 fields).
    return BigInt(Math.trunc(Number(trimmed)) || 0);
  }
}

/** Normalize a contract numeric return value to a regular JS number (safe for small fields). */
export function toNumber(value: Numeric | undefined | null): number {
  return Number(toBigInt(value));
}

/** Convert a whole-GEN amount entered by a user (e.g. "0.05") into wei as a bigint. */
export function parseGenToWei(amount: string): bigint {
  const trimmed = amount.trim();
  if (!trimmed) return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  const paddedFrac = (frac + "0".repeat(18)).slice(0, 18);
  const wholeBig = BigInt(whole || "0");
  const fracBig = BigInt(paddedFrac || "0");
  return wholeBig * WEI_PER_GEN + fracBig;
}

/** Format a wei bigint (or numeric-like value) as a human GEN amount string. */
export function formatWeiToGen(value: Numeric | undefined | null, maxDecimals = 4): string {
  const wei = toBigInt(value);
  const whole = wei / WEI_PER_GEN;
  const remainder = wei % WEI_PER_GEN;
  if (remainder === 0n) return whole.toString();
  const fracStr = remainder.toString().padStart(18, "0").slice(0, maxDecimals).replace(/0+$/, "");
  return fracStr ? `${whole.toString()}.${fracStr}` : whole.toString();
}

export function shortenAddress(address: string | undefined | null, chars = 4): string {
  if (!address) return "—";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}…${address.slice(-chars)}`;
}

export function formatUnixSeconds(value: Numeric | undefined | null): string {
  const seconds = toNumber(value);
  if (!seconds) return "—";
  return new Date(seconds * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function secondsUntil(value: Numeric | undefined | null): number {
  const seconds = toNumber(value);
  return seconds - Math.floor(Date.now() / 1000);
}

export function formatCountdown(secondsRemaining: number): string {
  if (secondsRemaining <= 0) return "Closed";
  const d = Math.floor(secondsRemaining / 86400);
  const h = Math.floor((secondsRemaining % 86400) / 3600);
  const m = Math.floor((secondsRemaining % 3600) / 60);
  const s = Math.floor(secondsRemaining % 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function datetimeLocalToUnixSeconds(datetimeLocal: string): number {
  return Math.floor(new Date(datetimeLocal).getTime() / 1000);
}
