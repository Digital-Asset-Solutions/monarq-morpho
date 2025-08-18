import { Token } from "@morpho-org/uikit/lib/utils";
import { Address } from "viem";

import { AssetSelect } from "./asset-select";
import { InWalletSwitch } from "./in-wallet-switch";
import { LoanTokenSelect } from "./loan-token-select";
import { SearchBar } from "./search-bar";

export interface BorrowTableFilters {
  search: string;
  inWallet: boolean;
  borrowAsset: string;
  loanToken: string;
}

interface BorrowTableHeaderProps {
  filters: BorrowTableFilters;
  onFiltersChange: (filters: BorrowTableFilters) => void;
  tokens: Map<Address, Token>;
  className?: string;
}

export function BorrowTableHeader({ filters, onFiltersChange, tokens, className }: BorrowTableHeaderProps) {
  const updateFilter = (key: keyof BorrowTableFilters, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className={`bg-primary/5 border-border/50 flex flex-wrap items-center gap-4 border-b p-4 ${className}`}>
      <InWalletSwitch value={filters.inWallet} onChange={(value) => updateFilter("inWallet", value)} />

      <AssetSelect
        value={filters.borrowAsset}
        onChange={(value) => updateFilter("borrowAsset", value)}
        tokens={tokens}
        placeholder="Borrow Asset"
        className="border-border w-fit border"
        customAllPlaceholder="All Collaterals"
      />

      <LoanTokenSelect
        value={filters.loanToken}
        onChange={(value) => updateFilter("loanToken", value)}
        tokens={tokens}
        className="border-border w-fit border"
      />

      <SearchBar
        value={filters.search}
        onChange={(value) => updateFilter("search", value)}
        placeholder="Search"
        className="w-full rounded-lg border px-2 py-0.5 xl:ml-auto xl:w-fit"
      />
    </div>
  );
}
