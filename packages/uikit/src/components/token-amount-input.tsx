import { formatUnits } from "viem";

import { Input } from "@/components/shadcn/input";
import { formatReadableDecimalNumber } from "@/lib/utils";

function validateTokenAmountInput(input: string, maxDecimals: number): string | null {
  if (input === "" || input === "0") {
    return "";
  } else if (input === ".") {
    return "0.";
  }

  const re = new RegExp(`^[0-9\b]+[.\b]?[0-9\b]{0,}$`);
  if (!re.test(input)) return null;

  const decimalIndex = input.indexOf(".");
  return decimalIndex > -1 ? input.slice(0, decimalIndex + maxDecimals + 1) : input;
}

function trimTrailingZeroes(value: string): string {
  if (!value.includes(".")) return value;
  return value.replace(/\.?0+$/, "");
}

function clampDisplayDecimals(value: string, maxDecimals: number): string {
  if (!value.includes(".")) return value;
  const [intPart, fracPart = ""] = value.split(".");
  const clamped = fracPart.slice(0, maxDecimals);
  return trimTrailingZeroes(clamped.length > 0 ? `${intPart}.${clamped}` : intPart);
}

export function TokenAmountInput({
  decimals,
  maxInputDecimals,
  value,
  maxValue,
  usdPrice,
  symbol,
  onChange,
}: {
  decimals?: number;
  maxInputDecimals?: number;
  value: string;
  maxValue?: bigint;
  usdPrice?: number;
  symbol?: string;
  onChange: (value: string) => void;
}) {
  const effectiveMaxInputDecimals = maxInputDecimals ?? decimals ?? 18;
  const textMaxValueRaw =
    maxValue !== undefined && decimals !== undefined ? formatUnits(maxValue, decimals) : undefined;
  const textMaxValue =
    textMaxValueRaw !== undefined ? clampDisplayDecimals(textMaxValueRaw, effectiveMaxInputDecimals) : undefined;
  const usdValue = usdPrice && parseFloat(value) > 0 ? parseFloat(value) * usdPrice : undefined;

  return (
    <div>
      <Input
        className="caret-morpho-brand border-none p-0 text-2xl font-bold shadow-none"
        type="text"
        placeholder="0"
        value={value}
        onChange={(ev) => {
          const validValue = validateTokenAmountInput(ev.target.value, effectiveMaxInputDecimals);
          if (validValue != null) onChange(validValue);
        }}
        disabled={decimals === undefined}
      />
      <div className="flex h-5 items-center justify-between">
        {usdPrice !== undefined && usdValue !== undefined ? (
          <p className="text-muted-foreground text-right text-xs font-light">
            ${formatReadableDecimalNumber({ value: usdValue, maxDecimals: 2, letters: false })}
          </p>
        ) : (
          <p className="text-muted-foreground text-right text-xs font-light">
            {}
            $0.00
          </p>
        )}

        {textMaxValue && (
          <p className="text-muted-foreground ml-auto text-right text-xs font-light">
            {}
            {textMaxValue} {symbol ?? ""}{" "}
            <span className="text-morpho-brand cursor-pointer font-bold" onClick={() => onChange(textMaxValue)}>
              Max.
            </span>
          </p>
        )}
      </div>
    </div>
  );
}
