import { Token } from "@morpho-org/uikit/lib/utils";
import { Address } from "viem";

import { AssetSelect } from "./asset-select";
import { CuratorSelect } from "./curator-select";
import { InWalletSwitch } from "./in-wallet-switch";
import { SearchBar } from "./search-bar";
import { type DisplayableCurators } from "@/lib/curators";

export interface EarnTableFilters {
  search: string;
  inWallet: boolean;
  depositAsset: string;
  curator: string;
}

interface EarnTableHeaderProps {
  filters: EarnTableFilters;
  onFiltersChange: (filters: EarnTableFilters) => void;
  tokens: Map<Address, Token>;
  curators: { [name: string]: DisplayableCurators[string] }[];
  className?: string;
}

export function EarnTableHeader({ 
  filters, 
  onFiltersChange, 
  tokens, 
  curators, 
  className 
}: EarnTableHeaderProps) {
  const updateFilter = (key: keyof EarnTableFilters, value: string | boolean) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  return (
    <div className={`flex flex-wrap items-center gap-4 p-4 bg-primary/5 border-b border-border/50 ${className}`}>
      <InWalletSwitch
        value={filters.inWallet}
        onChange={(value) => updateFilter('inWallet', value)}
      />
      
      <AssetSelect
        value={filters.depositAsset}
        onChange={(value) => updateFilter('depositAsset', value)}
        tokens={tokens}
        placeholder="Deposit Asset"
        className="w-fit border border-border"
      />
      
      <CuratorSelect
        value={filters.curator}
        onChange={(value) => updateFilter('curator', value)}
        curators={curators}
        className="w-fit border border-border"
        />
      <SearchBar
        value={filters.search}
        onChange={(value) => updateFilter('search', value)}
        placeholder="Search"
        className="w-fit xl:w-fit xl:ml-auto border rounded-lg px-2 py-0.5"
      />
    </div>
  );
}
