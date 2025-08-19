import { AccrualVault, Vault, VaultMarketAllocation, VaultMarketConfig, VaultMarketPublicAllocatorConfig, AccrualPosition } from "@morpho-org/blue-sdk";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { MORPHO_DEPLOYMENTS } from "@morpho-org/uikit/lib/deployments";
import { keepPreviousData } from "@tanstack/react-query";
import { useMemo } from "react";
import { Address, zeroAddress, erc4626Abi } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

import { useMarkets } from "@/hooks/use-markets";

const STALE_TIME = 30 * 1000; // 30 seconds

export function useVault({ 
  chainId, 
  vaultAddress,
  userAddress,
}: { 
  chainId: number | undefined; 
  vaultAddress: Address;
  userAddress?: Address;
}) {
  const morpho = MORPHO_DEPLOYMENTS[chainId!];
  
  // Fetch single vault data using existing readAccrualVaults function
  const { data: vaultData, refetch: refetchVault } = useReadContract({
    chainId,
    ...readAccrualVaults(
      morpho?.address ?? "0x",
      [vaultAddress],
      [zeroAddress], // We'll get the actual owner from the vault data
    ),
    stateOverride: [readAccrualVaultsStateOverride()],
    query: {
      enabled: chainId !== undefined && !!morpho?.address,
      staleTime: STALE_TIME,
      placeholderData: keepPreviousData,
    },
  });

  // Get the first (and only) vault from the array
  const rawVaultData = vaultData?.[0];
  
  // Get market IDs from vault data
  const marketIds = useMemo(() => 
    rawVaultData?.vault.withdrawQueue ?? [], 
    [rawVaultData]
  );
  
  // Fetch market data
  const markets = useMarkets({ chainId, marketIds, staleTime: STALE_TIME });

  // Fetch user position if userAddress provided
  const { data: userPositionData, refetch: refetchPosition } = useReadContracts({
    contracts: [
      { 
        address: vaultAddress, 
        abi: erc4626Abi, 
        functionName: "balanceOf", 
        args: [userAddress ?? "0x"] 
      },
      { 
        address: vaultAddress, 
        abi: erc4626Abi, 
        functionName: "maxWithdraw", 
        args: [userAddress ?? "0x"] 
      },
    ],
    allowFailure: false,
    query: { 
      enabled: !!userAddress && !!vaultAddress,
      staleTime: STALE_TIME,
      placeholderData: keepPreviousData,
    },
  });

  // Transform data into AccrualVault instance
  const vault = useMemo(() => {
    if (!rawVaultData || !markets) return undefined;
    
    const { vault: address, supplyQueue, withdrawQueue, ...iVault } = rawVaultData.vault;
    
    // Create Vault instance similar to earn-subpage.tsx
    const vault = new Vault({
      ...iVault,
      address,
      supplyQueue: supplyQueue as any[],
      withdrawQueue: withdrawQueue as any[],
      pendingOwner: zeroAddress,
      pendingGuardian: { value: zeroAddress, validAt: 0n },
      pendingTimelock: { value: 0n, validAt: 0n },
    });

    // Create allocations
    const allocations = rawVaultData.allocations.map((allocation) => {
      const market = markets[allocation.id];
      if (!market) return null;

      return new VaultMarketAllocation({
        config: new VaultMarketConfig({
          vault: address,
          marketId: allocation.id as any,
          cap: allocation.config.cap,
          pendingCap: { value: 0n, validAt: 0n },
          removableAt: allocation.config.removableAt,
          enabled: allocation.config.enabled,
          publicAllocatorConfig: new VaultMarketPublicAllocatorConfig({
            vault: address,
            marketId: allocation.id as any,
            maxIn: 0n,
            maxOut: 0n,
          }),
        }),
        position: new AccrualPosition({ user: address, ...allocation.position }, market),
      });
    }).filter(Boolean);

    return new AccrualVault(vault, allocations as VaultMarketAllocation[]);
  }, [rawVaultData, markets]);

  const userShares = userPositionData?.[0];
  const maxWithdrawAmount = userPositionData?.[1];

  return {
    vault,
    userShares,
    maxWithdrawAmount,
    isLoading: !vault,
    refetch: () => {
      void refetchVault();
      void refetchPosition();
    }
  };
}