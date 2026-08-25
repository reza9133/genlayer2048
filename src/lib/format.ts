import type { Numeric } from "../types";

const WEI_PER_GEN = 1_000_000_000_000_000_000n;

export function toBigInt(value: Numeric | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return 0n;
    return BigInt(Math.trunc(value));
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0n;
    try {
      if (trimmed.startsWith("0x") || trimmed.startsWith("0X")) return BigInt(trimmed);
      const withoutFraction = trimmed.split(".")[0];
      return BigInt(withoutFraction);
    } catch {
      return 0n;
    }
  }
  try {
    return toBigInt(String(value));
  } catch {
    return 0n;
  }
}

export function toNumber(value: Numeric | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed === "") return 0;
    const n = Number(trimmed);
    if (!Number.isNaN(n)) return n;
    try {
      return Number(toBigInt(trimmed));
    } catch {
      return 0;
    }
  }
  try {
    return toNumber(String(value));
  } catch {
    return 0;
  }
}

export function toBool(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "bigint") return value !== 0n;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }
  return Boolean(value);
}

export function formatWeiToGen(value: Numeric | null | undefined, maxDecimals = 4): string {
  const wei = toBigInt(value);
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;

  const whole = abs / WEI_PER_GEN;
  const remainder = abs % WEI_PER_GEN;

  if (remainder === 0n) {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }

  const fractionDigits = remainder.toString().padStart(18, "0").slice(0, maxDecimals);
  const trimmed = fractionDigits.replace(/0+$/, "");
  if (trimmed === "") {
    return `${negative ? "-" : ""}${whole.toString()}`;
  }
  return `${negative ? "-" : ""}${whole.toString()}.${trimmed}`;
}

export function parseGenToWei(input: string): bigint {
  const trimmed = input.trim();
  if (trimmed === "") return 0n;
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === ".") {
    throw new Error(`"${input}" is not a valid GEN amount`);
  }
  const [wholePart, fractionPart = ""] = trimmed.split(".");
  const whole = wholePart === "" ? 0n : BigInt(wholePart);
  const fraction = fractionPart.slice(0, 18).padEnd(18, "0");
  return whole * WEI_PER_GEN + (fraction === "" ? 0n : BigInt(fraction));
}

export function formatUnixSeconds(sec: any): string {
  const s = toNumber(sec);
  if (s <= 0) return "—";
  return new Date(s * 1000).toLocaleString();
}

export function secondsUntil(deadlineSec: any): number {
  const d = toNumber(deadlineSec);
  const now = Math.floor(Date.now() / 1000);
  return d - now;
}

export function formatCountdown(sec: number): string {
  if (sec <= 0) return "Ended";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  return `${h}h ${remM}m`;
}

export function shortenAddress(addr: string): string {
  if (!addr || addr.length < 10) return addr || "";
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function datetimeLocalToUnixSeconds(dtLocal: string): number {
  const ms = new Date(dtLocal).getTime();
  return Math.floor(ms / 1000);
}
