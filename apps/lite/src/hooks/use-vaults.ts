import {
  AccrualPosition,
  AccrualVault,
  MarketId,
  Vault,
  VaultMarketAllocation,
  VaultMarketConfig,
  VaultMarketPublicAllocatorConfig,
} from "@morpho-org/blue-sdk";
import { metaMorphoAbi } from "@morpho-org/uikit/assets/abis/meta-morpho";
import { metaMorphoFactoryAbi } from "@morpho-org/uikit/assets/abis/meta-morpho-factory";
import useContractEvents from "@morpho-org/uikit/hooks/use-contract-events/use-contract-events";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { tac } from "@morpho-org/uikit/lib/chains/tac";
import { CORE_DEPLOYMENTS, getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { useEffect, useMemo } from "react";
import { Address, zeroAddress, type Hex } from "viem";
import { useReadContract, useReadContracts } from "wagmi";

import { useMarkets } from "@/hooks/use-markets";
import { useTopNCurators } from "@/hooks/use-top-n-curators";
import { VAULT_BLACKLIST, MARKET_BLACKLIST } from "@/lib/constants";
import { type DisplayableCurators, getDisplayableCurators } from "@/lib/curators";
import { getSeededMarketIds } from "@/lib/eden-markets";
import { getSeededVaultAddresses, getSeededVaultOwners } from "@/lib/eden-vaults";

const STALE_TIME = 5 * 60 * 1000;

interface UseVaultsParams {
  chainId?: number;
  staleTime?: number;
  fetchPrices?: boolean;
  userAddress?: Address;
}

export function useVaults({ chainId, staleTime = STALE_TIME, fetchPrices, userAddress }: UseVaultsParams) {
  const [morpho, factory, factoryV1_1] = useMemo(
    () => [
      getContractDeploymentInfo(chainId, "Morpho"),
      getContractDeploymentInfo(chainId, "MetaMorphoFactory"),
      getContractDeploymentInfo(chainId, "MetaMorphoV1_1Factory"),
    ],
    [chainId],
  );
  const factoryAddresses = useMemo(() => {
    const addresses = [factoryV1_1?.address, factory?.address].filter(Boolean) as Address[];
    if (addresses.length === 0) return undefined;
    return addresses.length === 1 ? addresses[0] : addresses;
  }, [factoryV1_1?.address, factory?.address]);
  const factoriesFromBlock = factory?.fromBlock ?? factoryV1_1?.fromBlock;

  // MARK: Index `MetaMorphoFactory.CreateMetaMorpho` on all factory versions to get a list of all vault addresses
  const {
    logs: { all: createMetaMorphoEvents },
    fractionFetched,
  } = useContractEvents({
    chainId,
    abi: metaMorphoFactoryAbi,
    address: factoryAddresses,
    fromBlock: factoriesFromBlock,
    reverseChronologicalOrder: true,
    eventName: "CreateMetaMorpho",
    strict: true,
    query: { enabled: chainId !== undefined && factoryAddresses !== undefined && factoriesFromBlock !== undefined },
  });

  const seededVaultAddresses = useMemo(() => getSeededVaultAddresses(chainId), [chainId]);
  const metaMorphoAddresses = useMemo(
    () => [...new Set([...createMetaMorphoEvents.map((ev) => ev.args.metaMorpho), ...seededVaultAddresses])],
    [createMetaMorphoEvents, seededVaultAddresses],
  );

  // MARK: Fetch additional data for vaults owned by the top 1000 curators from core deployments
  const topCurators = useTopNCurators({ n: "all", verifiedOnly: true, chainIds: [...CORE_DEPLOYMENTS] });
  const seededVaultOwners = useMemo(() => getSeededVaultOwners(chainId), [chainId]);
  const seededVaultAddressSet = useMemo(
    () => new Set(seededVaultAddresses.map((address) => address.toLowerCase())),
    [seededVaultAddresses],
  );
  const includedOwners = useMemo(
    () =>
      [
        ...new Set([
          ...topCurators.flatMap((curator) => curator.addresses?.map((entry) => entry.address as Address) ?? []),
          ...seededVaultOwners,
        ]),
      ].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase())),
    [topCurators, seededVaultOwners],
  );
  const { data: vaultsData } = useReadContract({
    chainId,
    ...readAccrualVaults(
      morpho?.address ?? "0x",
      metaMorphoAddresses,
      includedOwners,
      // TODO: For now, we use bytecode deployless reads on TAC, since the RPC doesn't support `stateOverride`.
      //       This means we're forfeiting multicall in this special case, but at least it works. Once we have
      //       a TAC RPC that supports `stateOverride`, remove the special case.
      // @ts-expect-error function signature overloading was meant for hard-coded `true` or `false`
      chainId === tac.id,
    ),
    stateOverride: chainId === tac.id ? undefined : [readAccrualVaultsStateOverride()],
    query: {
      enabled: chainId !== undefined && fractionFetched > 0.99 && !!morpho?.address,
      staleTime,
      gcTime: Infinity,
      notifyOnChangeProps: ["data"],
    },
  });

  // Logging of whitelisting status to help curators diagnose their situation.
  useEffect(() => {
    for (const metaMorpho of metaMorphoAddresses) {
      if (vaultsData?.some((vd) => vd.vault.vault === metaMorpho)) continue;
      // Seeded VaultV2 entries are handled by dedicated fallback paths, so this warning is noisy for them.
      if (seededVaultAddressSet.has(metaMorpho.toLowerCase())) continue;
      console.log(`Skipping vault (${metaMorpho}):
- ❌ owner is not whitelisted
`);
    }
  }, [vaultsData, metaMorphoAddresses, seededVaultAddressSet]);

  const seededMarketIds = useMemo(() => getSeededMarketIds(chainId), [chainId]);

  const marketIds = useMemo(
    () => [...new Set([...(vaultsData?.flatMap((d) => d.vault.withdrawQueue) ?? []), ...seededMarketIds])],
    [vaultsData, seededMarketIds],
  );
  const markets = useMarkets({ chainId, marketIds, staleTime, fetchPrices });

  const vaults = useMemo(() => {
    const vaults: AccrualVault[] = [];
    const blacklistedVaults = chainId ? (VAULT_BLACKLIST[chainId] ?? []) : [];

    // Debug logging
    // console.log(`[useVaults] Chain ID: ${chainId}`);
    // console.log(`[useVaults] Blacklisted vaults for chain ${chainId}:`, blacklistedVaults);
    // console.log(`[useVaults] Total vaultsData: ${vaultsData?.length ?? 0}`);

    vaultsData?.forEach((vaultData) => {
      const { vault: address, supplyQueue, withdrawQueue, ...iVault } = vaultData.vault;

      // console.log(`[useVaults] Processing vault: ${vaultData.vault.name} (${address})`);

      // Check if vault is blacklisted
      if (blacklistedVaults.map((addr) => addr.toLowerCase()).includes(address.toLowerCase())) {
        // console.log(`[useVaults] Skipping blacklisted vault '${vaultData.vault.name}' (${address})`);
        return;
      }

      // NOTE: pending values are placeholders
      const vault = new Vault({
        ...iVault,
        address,
        supplyQueue: supplyQueue as MarketId[],
        withdrawQueue: withdrawQueue as MarketId[],
        pendingOwner: zeroAddress,
        pendingGuardian: { value: zeroAddress, validAt: 0n },
        pendingTimelock: { value: 0n, validAt: 0n },
      });

      if (vault.name === "" || vaultData.allocations.some((allocation) => markets[allocation.id] === undefined)) {
        // Detailed logging of filtering reason to help curators diagnose their situation.
        console.log(`Skipping vault '${vault.name}':
- ${vault.name === "" ? "❌" : "✅"} name is defined
- ${vaultData.allocations.some((allocation) => markets[allocation.id] === undefined) ? "❌" : "✅"} fetched constituent markets
`);
        return;
      }

      // NOTE: pending values and `publicAllocatorConfig` are placeholders
      const allocations = vaultData.allocations.map((allocation) => {
        const market = markets[allocation.id];

        return new VaultMarketAllocation({
          config: new VaultMarketConfig({
            vault: address,
            marketId: allocation.id as MarketId,
            cap: allocation.config.cap,
            pendingCap: { value: 0n, validAt: 0n },
            removableAt: allocation.config.removableAt,
            enabled: allocation.config.enabled,
            publicAllocatorConfig: new VaultMarketPublicAllocatorConfig({
              vault: address,
              marketId: allocation.id as MarketId,
              maxIn: 0n,
              maxOut: 0n,
            }),
          }),
          position: new AccrualPosition({ user: address, ...allocation.position }, market),
        });
      });

      vaults.push(new AccrualVault(vault, allocations));
    });
    vaults.sort((a, b) => (a.netApy > b.netApy ? -1 : 1));
    return vaults;
  }, [vaultsData, markets, chainId]);

  // For borrow page: extract market IDs for enabled allocations with supply shares
  const borrowMarketIds = useMemo(
    () => [
      ...new Set([
        ...(vaultsData?.flatMap((d) =>
          d.allocations
            .filter((alloc) => alloc.config.enabled && alloc.position.supplyShares > 0n)
            .map((alloc) => alloc.id),
        ) ?? []),
        ...seededMarketIds,
      ]),
    ],
    [vaultsData, seededMarketIds],
  );

  const borrowMarkets = useMarkets({ chainId, marketIds: borrowMarketIds, staleTime, fetchPrices });

  const borrowMarketsArray = useMemo(() => {
    const blacklistedMarkets = chainId ? (MARKET_BLACKLIST[chainId] ?? []) : [];
    const seededMarketSet = new Set(seededMarketIds.map((id) => id.toLowerCase()));

    // Debug logging
    // console.log(`[useVaults] Chain ID: ${chainId}`);
    // console.log(`[useVaults] Blacklisted markets for chain ${chainId}:`, blacklistedMarkets);

    const marketsArr = Object.values(borrowMarkets).filter((market) => {
      // Check if market is blacklisted
      if (blacklistedMarkets.map((addr) => addr.toLowerCase()).includes(market.id.toLowerCase())) {
        // console.log(`[useVaults] Skipping blacklisted market '${market.id}'`);
        return false;
      }

      const isSeededMarket = seededMarketSet.has(market.id.toLowerCase());
      return (
        (isSeededMarket || market.totalSupplyAssets > 0n) &&
        ![market.params.collateralToken, market.params.loanToken, market.params.irm, market.params.oracle].includes(
          zeroAddress,
        )
      );
    });
    marketsArr.sort((a, b) => {
      const primary = a.params.loanToken.localeCompare(b.params.loanToken);
      const secondary = a.liquidity > b.liquidity ? -1 : 1;
      return primary === 0 ? secondary : primary;
    });
    return marketsArr;
  }, [borrowMarkets, chainId, seededMarketIds]);

  const marketVaults = useMemo(() => {
    const map = new Map<
      Hex,
      { name: string; address: Address; totalAssets: bigint; curators: DisplayableCurators }[]
    >();

    vaultsData?.forEach((vaultData) => {
      vaultData.allocations.forEach((allocation) => {
        if (!allocation.config.enabled || allocation.position.supplyShares === 0n) return;

        if (!map.has(allocation.id)) {
          map.set(allocation.id, []);
        }
        map.get(allocation.id)!.push({
          name: vaultData.vault.name,
          address: vaultData.vault.vault,
          totalAssets: vaultData.vault.totalAssets,
          curators: getDisplayableCurators({ ...vaultData.vault, address: vaultData.vault.vault }, topCurators),
        });
      });
    });

    return map;
  }, [vaultsData, topCurators]);

  // MARK: Fetch user's balance in each vault
  const { data: balanceOfData, refetch: refetchBalanceOf } = useReadContracts({
    contracts: vaultsData?.map(
      (vaultData) =>
        ({
          chainId,
          address: vaultData.vault.vault,
          abi: metaMorphoAbi,
          functionName: "balanceOf",
          args: userAddress && [userAddress],
        }) as const,
    ),
    allowFailure: false,
    query: {
      enabled: chainId !== undefined && !!userAddress,
      staleTime,
      gcTime: Infinity,
    },
  });

  const userShares = useMemo(
    () => Object.fromEntries(vaultsData?.map((vaultData, idx) => [vaultData.vault.vault, balanceOfData?.[idx]]) ?? []),
    [vaultsData, balanceOfData],
  ) as { [vault: Address]: bigint | undefined };

  return {
    vaults,
    vaultsData,
    markets,
    topCurators,
    fractionFetched,
    createMetaMorphoEvents,
    // Borrow-specific exports
    borrowMarkets,
    borrowMarketsArray,
    marketVaults,
    // User balance exports
    userShares,
    refetchBalanceOf,
  };
}
