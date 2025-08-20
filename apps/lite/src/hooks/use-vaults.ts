import {
  AccrualPosition,
  AccrualVault,
  MarketId,
  Vault,
  VaultMarketAllocation,
  VaultMarketConfig,
  VaultMarketPublicAllocatorConfig,
} from "@morpho-org/blue-sdk";
import { metaMorphoFactoryAbi } from "@morpho-org/uikit/assets/abis/meta-morpho-factory";
import useContractEvents from "@morpho-org/uikit/hooks/use-contract-events/use-contract-events";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { tac } from "@morpho-org/uikit/lib/chains/tac";
import { CORE_DEPLOYMENTS, getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { useEffect, useMemo } from "react";
import { Address, zeroAddress, type Hex } from "viem";
import { useReadContract } from "wagmi";

import { useMarkets } from "@/hooks/use-markets";
import { useTopNCurators } from "@/hooks/use-top-n-curators";
import { type DisplayableCurators, getDisplayableCurators } from "@/lib/curators";

const STALE_TIME = 5 * 60 * 1000;

interface UseVaultsParams {
  chainId?: number;
  staleTime?: number;
  fetchPrices?: boolean;
}

export function useVaults({ chainId, staleTime = STALE_TIME, fetchPrices }: UseVaultsParams) {
  const [morpho, factory, factoryV1_1] = useMemo(
    () => [
      getContractDeploymentInfo(chainId, "Morpho"),
      getContractDeploymentInfo(chainId, "MetaMorphoFactory"),
      getContractDeploymentInfo(chainId, "MetaMorphoV1_1Factory"),
    ],
    [chainId],
  );

  // MARK: Index `MetaMorphoFactory.CreateMetaMorpho` on all factory versions to get a list of all vault addresses
  const {
    logs: { all: createMetaMorphoEvents },
    fractionFetched,
  } = useContractEvents({
    chainId,
    abi: metaMorphoFactoryAbi,
    address: factoryV1_1 ? [factoryV1_1.address].concat(factory ? [factory.address] : []) : [],
    fromBlock: factory?.fromBlock ?? factoryV1_1?.fromBlock,
    reverseChronologicalOrder: true,
    eventName: "CreateMetaMorpho",
    strict: true,
    query: { enabled: chainId !== undefined },
  });

  // MARK: Fetch additional data for vaults owned by the top 1000 curators from core deployments
  const topCurators = useTopNCurators({ n: "all", verifiedOnly: true, chainIds: [...CORE_DEPLOYMENTS] });
  const { data: vaultsData } = useReadContract({
    chainId,
    ...readAccrualVaults(
      morpho?.address ?? "0x",
      createMetaMorphoEvents.map((ev) => ev.args.metaMorpho),
      // NOTE: This assumes that if a curator controls an address on one chain, they control it across all chains.
      topCurators.flatMap((curator) => curator.addresses?.map((entry) => entry.address as Address) ?? []),
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
    for (const ev of createMetaMorphoEvents) {
      if (vaultsData?.some((vd) => vd.vault.vault === ev.args.metaMorpho)) continue;
      console.log(`Skipping vault '${ev.args.name}' (${ev.args.metaMorpho}):
- ❌ owner is not whitelisted
`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vaultsData]);

  const marketIds = useMemo(() => [...new Set(vaultsData?.flatMap((d) => d.vault.withdrawQueue) ?? [])], [vaultsData]);
  const markets = useMarkets({ chainId, marketIds, staleTime, fetchPrices });

  const vaults = useMemo(() => {
    const vaults: AccrualVault[] = [];
    vaultsData?.forEach((vaultData) => {
      const { vault: address, supplyQueue, withdrawQueue, ...iVault } = vaultData.vault;
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
  }, [vaultsData, markets]);

  // For borrow page: extract market IDs for enabled allocations with supply shares
  const borrowMarketIds = useMemo(
    () => [
      ...new Set(
        vaultsData?.flatMap((d) =>
          d.allocations
            .filter((alloc) => alloc.config.enabled && alloc.position.supplyShares > 0n)
            .map((alloc) => alloc.id),
        ) ?? [],
      ),
    ],
    [vaultsData],
  );

  const borrowMarkets = useMarkets({ chainId, marketIds: borrowMarketIds, staleTime, fetchPrices });

  const borrowMarketsArray = useMemo(() => {
    const marketsArr = Object.values(borrowMarkets).filter(
      (market) =>
        market.totalSupplyAssets > 0n &&
        ![market.params.collateralToken, market.params.loanToken, market.params.irm, market.params.oracle].includes(
          zeroAddress,
        ),
    );
    marketsArr.sort((a, b) => {
      const primary = a.params.loanToken.localeCompare(b.params.loanToken);
      const secondary = a.liquidity > b.liquidity ? -1 : 1;
      return primary === 0 ? secondary : primary;
    });
    return marketsArr;
  }, [borrowMarkets]);

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
  };
}
