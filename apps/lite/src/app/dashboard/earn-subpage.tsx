import { Token } from "@morpho-org/uikit/lib/utils";
import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { Address, Chain, erc20Abi, zeroAddress } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import { EarnTable } from "@/components/earn-table";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useVaults } from "@/hooks/use-vaults";
import { getDisplayableCurators } from "@/lib/curators";
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

  // MARK: Fetch metadata for every ERC20 asset
  const tokenAddresses = useMemo(() => {
    const tokenAddressesSet = new Set(
      vaults.map((vault) => [vault.asset, ...vault.collateralAllocations.keys()]).flat(),
    );
    tokenAddressesSet.delete(zeroAddress);
    const tokenAddresses = [...tokenAddressesSet];
    tokenAddresses.sort(); // sort so that any query keys derived from this don't change
    return tokenAddresses;
  }, [vaults]);

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
    const tokens = new Map<Address, { decimals?: number; symbol?: string }>();
    tokenAddresses.forEach((tokenAddress, idx) => {
      const symbol = tokenData?.[idx * 2 + 0].result as string | undefined;
      const decimals = tokenData?.[idx * 2 + 1].result as number | undefined;
      tokens.set(tokenAddress, { decimals, symbol });
    });
    return tokens;
  }, [tokenAddresses, tokenData]);

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

  const userRows = rows.filter((row) => (row.userShares ?? 0n) > 0n);

  if (status === "reconnecting") return undefined;

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      {userRows.length > 0 && (
        <div className="bg-linear-to-b lg:pt-22 flex h-fit w-full flex-col items-center from-transparent to-white/[0.03] pb-20">
          <EarnTable
            chain={chain}
            rows={userRows}
            depositsMode="userAssets"
            tokens={tokens}
            lendingRewards={lendingRewards}
          />
        </div>
      )}
      {/*
      Outer div ensures background color matches the end of the gradient from the div above,
      allowing rounded corners to show correctly. Inner div defines rounded corners and table background.
      */}
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
