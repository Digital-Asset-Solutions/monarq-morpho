import { Token } from "@morpho-org/uikit/lib/utils";
import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { Address, Chain, erc20Abi, erc4626Abi, zeroAddress } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { EarnTable, type EarnVaultLike, type Row } from "@/components/earn-table";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useVaults } from "@/hooks/use-vaults";
import { getDisplayableCurators } from "@/lib/curators";
import { getSeededVaults } from "@/lib/eden-vaults";
import { getTokenURI } from "@/lib/tokens";

const STALE_TIME = 5 * 60 * 1000;

export function EarnSubPage() {
  const { status, address: userAddress } = useAccount();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id;

  const lendingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.EARN, userAddress });

  const { vaults, topCurators, userShares } = useVaults({
    chainId,
    staleTime: STALE_TIME,
    userAddress,
  });
  const seededVaults = useMemo(() => getSeededVaults(chainId), [chainId]);
  const seededVaultAddresses = useMemo(() => seededVaults.map((vault) => vault.address), [seededVaults]);

  // MARK: Fetch metadata for every ERC20 asset
  const tokenAddresses = useMemo(() => {
    const tokenAddressesSet = new Set(
      [
        ...vaults.map((vault) => [vault.asset, ...vault.collateralAllocations.keys()]).flat(),
        ...seededVaults.map((vault) => vault.asset),
      ].flat(),
    );
    tokenAddressesSet.delete(zeroAddress);
    const tokenAddresses = [...tokenAddressesSet];
    tokenAddresses.sort(); // sort so that any query keys derived from this don't change
    return tokenAddresses;
  }, [vaults, seededVaults]);

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

  const { data: seededVaultData } = useReadContracts({
    contracts: seededVaultAddresses
      .map((address) => [
        { chainId, address, abi: erc20Abi, functionName: "name" } as const,
        { chainId, address, abi: erc4626Abi, functionName: "totalAssets" } as const,
        { chainId, address, abi: erc20Abi, functionName: "balanceOf", args: userAddress && [userAddress] } as const,
      ])
      .flat(),
    allowFailure: true,
    query: {
      enabled: seededVaultAddresses.length > 0,
      staleTime: STALE_TIME,
      gcTime: Infinity,
    },
  });

  const seededVaultSnapshots = useMemo(() => {
    const snapshots = new Map<Address, { name?: string; totalAssets?: bigint; userShares?: bigint }>();
    seededVaultAddresses.forEach((address, idx) => {
      snapshots.set(address, {
        name: seededVaultData?.[idx * 3 + 0].result as string | undefined,
        totalAssets: seededVaultData?.[idx * 3 + 1].result as bigint | undefined,
        userShares: seededVaultData?.[idx * 3 + 2].result as bigint | undefined,
      });
    });
    return snapshots;
  }, [seededVaultAddresses, seededVaultData]);

  const tokens = useMemo(() => {
    const tokens = new Map<Address, { decimals?: number; symbol?: string }>();
    tokenAddresses.forEach((tokenAddress, idx) => {
      const symbol = tokenData?.[idx * 2 + 0].result as string | undefined;
      const decimals = tokenData?.[idx * 2 + 1].result as number | undefined;
      tokens.set(tokenAddress, { decimals, symbol });
    });
    return tokens;
  }, [tokenAddresses, tokenData]);

  const rows = useMemo(() => {
    const indexedRows: Row[] = vaults.map((vault) => {
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
    const indexedVaultSet = new Set(indexedRows.map((row) => row.vault.address.toLowerCase()));

    const seededRows: Row[] = seededVaults
      .filter((seededVault) => !indexedVaultSet.has(seededVault.address.toLowerCase()))
      .map((seededVault) => {
        const snapshot = seededVaultSnapshots.get(seededVault.address);
        const { decimals, symbol } = tokens.get(seededVault.asset) ?? { decimals: undefined, symbol: undefined };

        const seededVaultLike: EarnVaultLike = {
          address: seededVault.address,
          name: snapshot?.name || seededVault.name,
          owner: seededVault.owner,
          timelock: 0n,
          totalAssets: snapshot?.totalAssets ?? 0n,
          apy: 0n,
          fee: 0n,
          allocations: new Map(),
          collateralAllocations: new Map(),
          toAssets: (shares) => shares,
          getAllocationProportion: () => 0n,
        };

        return {
          vault: seededVaultLike,
          asset: {
            address: seededVault.asset,
            imageSrc: getTokenURI({ symbol, address: seededVault.asset, chainId }),
            symbol,
            decimals,
          } as Token,
          curators: {},
          userShares: snapshot?.userShares,
          imageSrc: getTokenURI({ symbol, address: seededVault.asset, chainId }),
          badgeLabel: "V2",
        };
      });

    return [...indexedRows, ...seededRows];
  }, [vaults, tokens, userShares, topCurators, chainId, seededVaults, seededVaultSnapshots]);

  if (status === "reconnecting") return undefined;

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      <div className="flex grow flex-col">
        <div className="bg-background border-border/50 flex h-full grow justify-center rounded-xl border pb-16 shadow-sm">
          <EarnTable
            chain={chain}
            rows={rows}
            depositsMode="totalAssets"
            tokens={tokens}
            lendingRewards={lendingRewards}
          />
        </div>
      </div>
    </div>
  );
}
