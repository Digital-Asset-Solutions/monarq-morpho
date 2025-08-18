import { Market } from "@morpho-org/blue-sdk";
import { Token } from "@morpho-org/uikit/lib/utils";
import { useMemo } from "react";
import { Address, erc20Abi } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { type BorrowTableFilters } from "@/components/filters/borrow-table-header";

export function useBorrowFilters(
  markets: Market[],
  tokens: Map<Address, Token>,
  filters: BorrowTableFilters,
  chainId?: number,
) {
  const { address: userAddress } = useAccount();

  // Get unique token addresses for balance checks
  const tokenAddresses = useMemo(() => {
    const addresses = new Set<Address>();
    markets.forEach((market) => {
      addresses.add(market.params.collateralToken);
      addresses.add(market.params.loanToken);
    });
    return Array.from(addresses);
  }, [markets]);

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

  const filteredMarkets = useMemo(() => {
    return markets.filter((market) => {
      const collateralToken = tokens.get(market.params.collateralToken);
      const loanToken = tokens.get(market.params.loanToken);

      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const searchableText = [
          collateralToken?.symbol,
          loanToken?.symbol,
          market.id,
          market.params.collateralToken,
          market.params.loanToken,
        ]
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(searchLower)) {
          return false;
        }
      }

      // In Wallet filter - check if user has collateral or loan tokens
      if (filters.inWallet) {
        const hasCollateralBalance =
          userBalances.get(market.params.collateralToken.toLowerCase() as Address) ?? 0n > 0n;
        const hasLoanBalance = userBalances.get(market.params.loanToken.toLowerCase() as Address) ?? 0n > 0n;

        if (!hasCollateralBalance && !hasLoanBalance) {
          return false;
        }
      }

      // Borrow Asset filter (collateral token)
      if (filters.borrowAsset && filters.borrowAsset !== "all") {
        if (market.params.collateralToken.toLowerCase() !== filters.borrowAsset) {
          return false;
        }
      }

      // Loan Token filter
      if (filters.loanToken && filters.loanToken !== "all") {
        if (market.params.loanToken.toLowerCase() !== filters.loanToken) {
          return false;
        }
      }

      return true;
    });
  }, [markets, tokens, filters, userBalances]);

  return filteredMarkets;
}
