/**
 * Retail quantities and monetary amounts travel as fixed-point 10^-4 integers
 * (1 unit = 10000). The UI works with human units and converts at the edge.
 */
import { formatMoney } from "@payments/common";

export const QUANTITY_SCALE = 10_000;

export function toScaled(humanValue: number): number {
  return Math.round(humanValue * QUANTITY_SCALE);
}

export function fromScaled(scaledValue: number): number {
  return scaledValue / QUANTITY_SCALE;
}

/** Formats a 10^-4 quantity without trailing zero noise (1.2500 -> "1.25"). */
export function formatScaledQuantity(scaledValue: number): string {
  const value = fromScaled(scaledValue);
  if (!Number.isFinite(value)) return "0";
  return value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "");
}

/** Formats a 10^-4 amount as USD currency. */
export function formatScaledMoney(scaledValue: number): string {
  return formatMoney(fromScaled(scaledValue));
}

/** Parses a decimal money input ("12.50", "12,50") into the 10^-4 scale. */
export function parseMoneyInput(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  if (!Number.isFinite(value) || value < 0) return null;
  return toScaled(value);
}


