import { formatUnits } from "viem";

export function getHealthFactorPercent(ltv: bigint | null | undefined, lltv: bigint): number | undefined {
  if (ltv === undefined || ltv === null || lltv <= 0n) return undefined;

  const ltvRatio = Number(formatUnits(ltv, 18));
  const lltvRatio = Number(formatUnits(lltv, 18));
  if (!Number.isFinite(ltvRatio) || !Number.isFinite(lltvRatio) || lltvRatio <= 0) return undefined;

  const health = ((lltvRatio - ltvRatio) / lltvRatio) * 100;
  return Math.max(0, Math.min(100, health));
}
