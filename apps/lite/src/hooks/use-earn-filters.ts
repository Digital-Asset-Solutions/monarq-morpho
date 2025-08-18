import { useMemo } from "react";
import { Address, erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { type Row } from "@/components/earn-table";
import { type EarnTableFilters } from "@/components/filters/earn-table-header";

export function useEarnFilters(rows: Row[], filters: EarnTableFilters, chainId?: number) {
  const { address: userAddress } = useAccount();

  // Get unique token addresses for balance checks
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<Address>();
    rows.forEach((row) => {
      addresses.add(row.asset.address);
      // Add collateral tokens
      row.vault.collateralAllocations.forEach((_, collateralAddress) => {
        addresses.add(collateralAddress);
      });
    });
    return Array.from(addresses);
  }, [rows]);

  // Fetch user token balances for in-wallet filtering
  const { data: balanceData } = useReadContracts({
    contracts: tokenAddresses.map((address) => ({
      chainId,
      address,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: userAddress ? [userAddress] : undefined,
    })),
    query: {
      enabled: !!userAddress && !!chainId && filters.inWallet,
    },
  });

  const userBalances = useMemo(() => {
    if (!balanceData) return new Map<Address, bigint>();

    const balances = new Map<Address, bigint>();
    tokenAddresses.forEach((address, index) => {
      const balance = balanceData[index];
      if (balance.status === "success") {
        balances.set(address.toLowerCase() as Address, balance.result as bigint);
      }
    });
    return balances;
  }, [balanceData, tokenAddresses]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          row.vault.name,
          row.asset.symbol,
          ...Object.values(row.curators).map((curator) => curator.name),
          row.vault.address,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // In Wallet filter
      if (filters.inWallet) {
        const hasDeposit = (row.userShares ?? 0n) > 0n;
        const hasAssetBalance = userBalances.get(row.asset.address.toLowerCase() as Address) ?? 0n > 0n;
        const hasCollateralBalance = Array.from(row.vault.collateralAllocations.keys()).some(
          (collateralAddress) => userBalances.get(collateralAddress.toLowerCase() as Address) ?? 0n > 0n,
        );

        if (!hasDeposit && !hasAssetBalance && !hasCollateralBalance) {
          return false;
        }
      }

      // Deposit Asset filter
      if (filters.depositAsset && filters.depositAsset !== "all") {
        if (row.asset.address.toLowerCase() !== filters.depositAsset) {
          return false;
        }
      }

      // Curator filter
      if (filters.curator && filters.curator !== "all") {
        const hasCurator = Object.values(row.curators).some(
          (curator) => curator.name.toLowerCase() === filters.curator,
        );
        if (!hasCurator) {
          return false;
        }
      }

      return true;
    });
  }, [rows, filters, userBalances]);

  return filteredRows;
}
