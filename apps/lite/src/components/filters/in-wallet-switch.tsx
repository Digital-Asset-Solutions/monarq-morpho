interface InWalletSwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  className?: string;
}

export function InWalletSwitch({ value, onChange, className }: InWalletSwitchProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <label className="flex cursor-pointer items-center gap-2">
        <div
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            value ? "bg-secondary" : "bg-gray-300"
          }`}
          onClick={() => onChange(!value)}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              value ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </div>
        <span className="text-primary-foreground text-sm font-medium">In Wallet</span>
      </label>
    </div>
  );
}
