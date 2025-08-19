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
import { morphoAbi } from "@morpho-org/uikit/assets/abis/morpho";
import useContractEvents from "@morpho-org/uikit/hooks/use-contract-events/use-contract-events";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { tac } from "@morpho-org/uikit/lib/chains/tac";
import { CORE_DEPLOYMENTS, getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { Token } from "@morpho-org/uikit/lib/utils";
import { useEffect, useMemo } from "react";
import { useOutletContext } from "react-router";
import { Address, Chain, erc20Abi, zeroAddress, type Hex } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { BorrowPositionTable } from "@/components/borrow-table";
import { EarnTable } from "@/components/earn-table";
import { useMarkets } from "@/hooks/use-markets";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useTopNCurators } from "@/hooks/use-top-n-curators";
import { getDisplayableCurators } from "@/lib/curators";
import { getTokenURI } from "@/lib/tokens";

const restructure = (position: readonly [bigint, bigint, bigint]) => ({
  supplyShares: position[0],
  borrowShares: position[1],
  collateral: position[2],
});

const STALE_TIME = 5 * 60 * 1000;

export function DashboardSubPage() {
  const { status, address: userAddress } = useAccount();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id;

  const [morpho, factory, factoryV1_1] = useMemo(
    () => [
      getContractDeploymentInfo(chainId, "Morpho"),
      getContractDeploymentInfo(chainId, "MetaMorphoFactory"),
      getContractDeploymentInfo(chainId, "MetaMorphoV1_1Factory"),
    ],
    [chainId],
  );

  const lendingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.EARN, userAddress });
  const borrowingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.BORROW, userAddress });

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
      staleTime: STALE_TIME,
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
  const markets = useMarkets({ chainId, marketIds, staleTime: STALE_TIME });
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

  // MARK: Fetch metadata for every ERC20 asset (including market tokens)
  const tokenAddresses = useMemo(() => {
    const tokenAddressesSet = new Set(
      vaults.map((vault) => [vault.asset, ...vault.collateralAllocations.keys()]).flat(),
    );

    // Add all market tokens (loan and collateral tokens)
    Object.values(markets).forEach((market) => {
      tokenAddressesSet.add(market.params.loanToken);
      tokenAddressesSet.add(market.params.collateralToken);
    });

    tokenAddressesSet.delete(zeroAddress);
    const tokenAddresses = [...tokenAddressesSet];
    tokenAddresses.sort(); // sort so that any query keys derived from this don't change
    return tokenAddresses;
  }, [vaults, markets]);

  const { data: tokenData } = useReadContracts({
    contracts: tokenAddresses
      .map((asset) => [
        { chainId, address: asset, abi: erc20Abi, functionName: "symbol" } as const,
        { chainId, address: asset, abi: erc20Abi, functionName: "decimals" } as const,
      ])
      .flat(),
    allowFailure: true,
    query: { staleTime: Infinity, gcTime: Infinity },
  });

  const tokens = useMemo(() => {
    const tokens = new Map<Address, Token>();
    tokenAddresses.forEach((tokenAddress, idx) => {
      const symbol = tokenData?.[idx * 2 + 0].result as string | undefined;
      const decimals = tokenData?.[idx * 2 + 1].result as number | undefined;
      tokens.set(tokenAddress, {
        address: tokenAddress,
        decimals,
        symbol,
        imageSrc: getTokenURI({ symbol, address: tokenAddress, chainId }),
      });
    });
    return tokens;
  }, [tokenAddresses, tokenData, chainId]);

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
      staleTime: STALE_TIME,
      gcTime: Infinity,
    },
  });

  const userShares = useMemo(
    () => Object.fromEntries(vaultsData?.map((vaultData, idx) => [vaultData.vault.vault, balanceOfData?.[idx]]) ?? []),
    [vaultsData, balanceOfData],
  ) as { [vault: Address]: bigint | undefined };

  const rows = useMemo(() => {
    return vaults.map((vault) => {
      const { decimals, symbol } = tokens.get(vault.asset) ?? { decimals: undefined, symbol: undefined };

      return {
        vault,
        asset: {
          address: vault.asset,
          imageSrc: getTokenURI({ symbol, address: vault.asset, chainId }),
          symbol,
          decimals,
        } as Token,
        curators: getDisplayableCurators(vault, topCurators),
        userShares: userShares[vault.address],
        imageSrc: getTokenURI({ symbol, address: vault.asset, chainId }),
      };
    });
  }, [vaults, tokens, userShares, topCurators, chainId]);

  // Filter rows to only show vaults where user has actual positions
  const userRows = useMemo(() => {
    return rows.filter((row) => row.userShares && row.userShares > 0n);
  }, [rows]);

  // MARK: Fetch user's borrow positions from Morpho
  const { data: userPositions, refetch: refetchPositions } = useReadContracts({
    contracts: Object.values(markets).map(
      (market) =>
        ({
          chainId,
          address: morpho?.address,
          abi: morphoAbi,
          functionName: "position",
          args: [market.id, userAddress],
        }) as const,
    ),
    allowFailure: false,
    query: {
      enabled: chainId !== undefined && !!userAddress && !!morpho?.address,
      staleTime: STALE_TIME,
      gcTime: Infinity,
    },
  });

  // Process user positions into a map
  const positionsMap = useMemo(() => {
    const map = new Map<Hex, AccrualPosition>();
    Object.values(markets).forEach((market, idx) => {
      const positionData = userPositions?.[idx] as readonly [bigint, bigint, bigint] | undefined;
      if (positionData) {
        const restructuredPosition = restructure(positionData);
        const position = new AccrualPosition(
          {
            user: userAddress ?? zeroAddress,
            ...restructuredPosition,
          },
          market,
        );
        map.set(market.id, position);
      }
    });
    return map;
  }, [markets, userPositions, userAddress]);

  // Filter markets to only show those where user has positions
  const userBorrowMarkets = useMemo(() => {
    return Object.values(markets).filter((market) => {
      const position = positionsMap.get(market.id);
      return position && (position.borrowShares > 0n || position.collateral > 0n);
    });
  }, [markets, positionsMap]);

  if (status === "reconnecting") return undefined;

  return (
    <div className="w-[calc(100vw-35px)] space-y-6 md:w-full">
      {/* Show earn table if user has earn positions */}
      {userRows.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="flex items-center justify-start gap-2 p-4">
            <h2 className="text-xl">Earn</h2>
            <span className="bg-secondary/10 text-secondary mt-1 rounded-full px-2 py-1 text-xs">
              {userRows.length} positions / 100$
            </span>
          </div>
          <EarnTable
            chain={chain}
            rows={userRows}
            depositsMode="userAssets"
            tokens={tokens}
            lendingRewards={lendingRewards}
            refetchPositions={refetchBalanceOf}
            displayHeader={false}
          />
        </div>
      )}

      {/* Show borrow table if user has borrow positions */}
      {userBorrowMarkets.length > 0 && (
        <div className="rounded-xl bg-white">
          <div className="flex items-center justify-start gap-2 p-4">
            <h2 className="text-xl">Borrow</h2>
            <span className="bg-secondary/10 text-secondary mt-1 rounded-full px-2 py-1 text-xs">
              {userBorrowMarkets.length} positions / 100$
            </span>
          </div>
          <BorrowPositionTable
            chain={chain}
            markets={userBorrowMarkets}
            tokens={tokens}
            positions={positionsMap}
            borrowingRewards={borrowingRewards}
            refetchPositions={refetchPositions}
            displayHeader={false}
          />
        </div>
      )}

      {/* Show message if no positions */}
      {userRows.length === 0 && userBorrowMarkets.length === 0 && (
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold">No positions found</h2>
            <p className="text-muted-foreground">You don't have any earn or borrow positions yet</p>
          </div>
        </div>
      )}
    </div>
  );
}
