/**
 * Utility functions for numeric conversions, address formatting,
 * Wei/GEN parsing, and human-readable countdowns across the 2048 dApp.
 */

export function toNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  if (typeof val === "bigint") return Number(val);
  if (typeof val === "string") {
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? 0 : parsed;
  }
  if (typeof val === "object") {
    if ("value" in val) return toNumber(val.value);
    if ("hex" in val) return parseInt(val.hex, 16);
  }
  return Number(val) || 0;
}

export function toBigInt(val: any): bigint {
  if (val === undefined || val === null) return 0n;
  if (typeof val === "bigint") return val;
  if (typeof val === "number") return BigInt(Math.floor(val));
  if (typeof val === "string") {
    try {
      const clean = val.trim();
      return clean.length > 0 ? BigInt(clean) : 0n;
    } catch {
      return 0n;
    }
  }
  if (typeof val === "object") {
    if ("value" in val) return toBigInt(val.value);
    if ("hex" in val) return BigInt(val.hex);
  }
  return 0n;
}

export function formatWeiToGen(wei: any): string {
  const b = toBigInt(wei);
  const ether = Number(b) / 1e18;
  return ether.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });
}

export function parseGenToWei(genStr: string): bigint {
  try {
    const clean = genStr.trim();
    if (!clean) return 0n;
    const parts = clean.split(".");
    const whole = BigInt(parts[0] || "0") * 10n ** 18n;
    if (parts.length > 1) {
      const decimals = parts[1].padEnd(18, "0").slice(0, 18);
      return whole + BigInt(decimals);
    }
    return whole;
  } catch {
    return 0n;
  }
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
