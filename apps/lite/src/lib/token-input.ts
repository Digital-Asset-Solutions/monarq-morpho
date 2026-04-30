import { parseUnits } from "viem";

export const MAX_TOKEN_INPUT_DECIMALS = 6;

export function getTokenInputMaxDecimals(tokenDecimals?: number): number | undefined {
  if (tokenDecimals === undefined) return undefined;
  return Math.min(tokenDecimals, MAX_TOKEN_INPUT_DECIMALS);
}

export function parseTokenInput(value: string, tokenDecimals?: number): bigint | undefined {
  if (tokenDecimals === undefined) return undefined;

  const normalized = value.trim().replace(",", ".");
  if (normalized.length === 0 || !/^\d*\.?\d*$/.test(normalized)) return undefined;

  const [integerPartRaw, fractionalPartRaw = ""] = normalized.split(".");
  const integerPart = integerPartRaw.length > 0 ? integerPartRaw : "0";
  const maxInputDecimals = getTokenInputMaxDecimals(tokenDecimals) ?? tokenDecimals;
  const truncatedFractional = fractionalPartRaw.slice(0, maxInputDecimals);
  const safeValue = truncatedFractional.length > 0 ? `${integerPart}.${truncatedFractional}` : integerPart;

  try {
    return parseUnits(safeValue, tokenDecimals);
  } catch {
    return undefined;
  }
}
