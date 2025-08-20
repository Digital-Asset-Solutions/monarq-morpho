import { formatUnits } from "viem";

import { Input } from "@/components/shadcn/input";

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

export function TokenAmountInput({
  decimals,
  value,
  maxValue,
  usdPrice,
  onChange,
}: {
  decimals?: number;
  value: string;
  maxValue?: bigint;
  usdPrice?: number;
  onChange: (value: string) => void;
}) {
  const textMaxValue = maxValue !== undefined && decimals !== undefined ? formatUnits(maxValue, decimals) : undefined;
  const usdValue = usdPrice && parseFloat(value) > 0 ? parseFloat(value) * usdPrice : undefined;

  return (
    <div>
      <Input
        className="caret-morpho-brand mb-2 border-none p-0 font-mono text-2xl font-bold shadow-none"
        type="text"
        placeholder="0"
        value={value}
        onChange={(ev) => {
          const validValue = validateTokenAmountInput(ev.target.value, decimals ?? 18);
          if (validValue != null) onChange(validValue);
        }}
        disabled={decimals === undefined}
      />
      <div className="flex items-center justify-between">
        {usdPrice && usdValue && (
          <p className="text-primary-foreground text-right text-xs font-light">${usdValue.toFixed(2)}</p>
        )}

        {textMaxValue && (
          <p className="text-primary-foreground ml-auto text-right text-xs font-light">
            {textMaxValue}{" "}
            <span className="text-morpho-brand cursor-pointer" onClick={() => onChange(textMaxValue)}>
              MAX
            </span>{" "}
          </p>
        )}
      </div>
    </div>
  );
}
