import { AccrualPosition } from "@morpho-org/blue-sdk";
import { morphoAbi } from "@morpho-org/uikit/assets/abis/morpho";
import { getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { useMemo } from "react";
import { useAccount, useReadContracts } from "wagmi";

import { useVaults } from "@/hooks/use-vaults";

const restructure = (position: readonly [bigint, bigint, bigint]) => ({
  supplyShares: position[0],
  borrowShares: position[1],
  collateral: position[2],
});

const STALE_TIME = 5 * 60 * 1000;

export function useUserPositions(chainId?: number) {
  const { address: userAddress } = useAccount();

  const morpho = useMemo(() => getContractDeploymentInfo(chainId, "Morpho"), [chainId]);

  const {
    borrowMarketsArray: markets,
    userShares,
    vaultsData,
  } = useVaults({
    chainId,
    staleTime: STALE_TIME,
    fetchPrices: false,
    userAddress,
  });

  // Fetch user positions in borrow markets
  const { data: userPositions } = useReadContracts({
    contracts: markets.map(
      (market) =>
        ({
          chainId,
          address: morpho?.address ?? "0x",
          abi: morphoAbi,
          functionName: "position",
          args: userAddress ? [market.id, userAddress] : undefined,
        }) as const,
    ),
    allowFailure: false,
    query: {
      enabled: !!morpho && !!userAddress && !!chainId && markets.length > 0,
      staleTime: STALE_TIME,
      gcTime: Infinity,
      select: (data) => data?.map(restructure),
    },
  });

  // Check if user has any borrow positions
  const hasBorrowPositions = useMemo(() => {
    if (!userPositions || !userAddress) return false;

    return markets.some((market, idx) => {
      const positionData = userPositions[idx];
      if (!positionData) return false;

      const position = new AccrualPosition(
        {
          user: userAddress,
          ...positionData,
        },
        market,
      );

      return position.borrowShares > 0n || position.collateral > 0n;
    });
  }, [markets, userPositions, userAddress]);

  // Check if user has any vault shares
  const hasVaultPositions = useMemo(() => {
    if (!userAddress || !vaultsData) return false;

    return Object.values(userShares).some((shares) => shares && shares > 0n);
  }, [userShares, userAddress, vaultsData]);

  const hasPositions = hasBorrowPositions || hasVaultPositions;

  return {
    hasPositions,
    hasBorrowPositions,
    hasVaultPositions,
  };
}
