import { AccrualPosition } from "@morpho-org/blue-sdk";
import { restructure } from "@morpho-org/blue-sdk-viem";
import { morphoAbi } from "@morpho-org/uikit/assets/abis/morpho";
import { getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { Token } from "@morpho-org/uikit/lib/utils";
import { useMemo } from "react";
import { useOutletContext } from "react-router";
import { type Address, erc20Abi, type Chain, type Hex } from "viem";
import { useAccount, useReadContracts } from "wagmi";

import {
  //BorrowPositionTable,
  BorrowTable,
} from "@/components/borrow-table";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useVaults } from "@/hooks/use-vaults";
import { getTokenURI } from "@/lib/tokens";

const STALE_TIME = 5 * 60 * 1000;

// This cannot be inlined because TanStack needs a stable reference to avoid re-renders.
function restructurePositions(data: (readonly [bigint, bigint, bigint])[]) {
  return data.map((x) => restructure(x, { abi: morphoAbi, name: "position", args: ["0x", "0x"] }));
}

export function BorrowSubPage() {
  const { status, address: userAddress } = useAccount();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id;

  const morpho = useMemo(() => getContractDeploymentInfo(chainId, "Morpho"), [chainId]);

  const borrowingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.BORROW, userAddress });

  const { borrowMarketsArray: marketsArr, marketVaults } = useVaults({
    chainId,
    staleTime: STALE_TIME,
    fetchPrices: true,
    userAddress,
  });

  const { data: erc20Symbols } = useReadContracts({
    contracts: marketsArr
      .map((market) => [
        { chainId, address: market.params.collateralToken, abi: erc20Abi, functionName: "symbol" } as const,
        { chainId, address: market.params.loanToken, abi: erc20Abi, functionName: "symbol" } as const,
      ])
      .flat(),
    allowFailure: true,
    query: { staleTime: Infinity, gcTime: Infinity },
  });

  const { data: erc20Decimals } = useReadContracts({
    contracts: marketsArr
      .map((market) => [
        { chainId, address: market.params.collateralToken, abi: erc20Abi, functionName: "decimals" } as const,
        { chainId, address: market.params.loanToken, abi: erc20Abi, functionName: "decimals" } as const,
      ])
      .flat(),
    allowFailure: true,
    query: { staleTime: Infinity, gcTime: Infinity },
  });

  const { data: positionsRaw, refetch: refetchPositionsRaw } = useReadContracts({
    contracts: marketsArr.map(
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
      staleTime: 1 * 60 * 1000,
      gcTime: Infinity,
      enabled: !!morpho,
      select: restructurePositions,
    },
  });

  const positions = useMemo(() => {
    if (marketsArr.length === 0 || positionsRaw === undefined || userAddress === undefined) {
      return undefined;
    }

    const map = new Map<Hex, AccrualPosition>();
    positionsRaw?.forEach((positionRaw, idx) => {
      const market = marketsArr[idx];
      map.set(market.id, new AccrualPosition({ user: userAddress, ...positionRaw }, market));
    });
    return map;
  }, [marketsArr, positionsRaw, userAddress]);

  const tokens = useMemo(() => {
    const map = new Map<Address, Token>();
    marketsArr.forEach((market, idx) => {
      const collateralTokenSymbol = erc20Symbols?.[idx * 2].result;
      const loanTokenSymbol = erc20Symbols?.[idx * 2 + 1].result;
      map.set(market.params.collateralToken, {
        address: market.params.collateralToken,
        symbol: collateralTokenSymbol,
        decimals: erc20Decimals?.[idx * 2].result,
        imageSrc: getTokenURI({ symbol: collateralTokenSymbol, address: market.params.collateralToken, chainId }),
      });
      map.set(market.params.loanToken, {
        address: market.params.loanToken,
        symbol: loanTokenSymbol,
        decimals: erc20Decimals?.[idx * 2 + 1].result,
        imageSrc: getTokenURI({ symbol: loanTokenSymbol, address: market.params.loanToken, chainId }),
      });
    });
    return map;
  }, [marketsArr, erc20Symbols, erc20Decimals, chainId]);

  if (status === "reconnecting") return undefined;

  const userMarkets = marketsArr.filter((market) => positions?.get(market.id)?.collateral ?? 0n > 0n);
  console.log(userMarkets);

  // Show message if no markets are available
  if (marketsArr.length === 0) {
    return (
      <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
        <div className="flex h-96 items-center justify-center">
          <div className="text-center">
            <h2 className="mb-2 text-xl font-semibold">No borrow markets available</h2>
            <p className="text-muted-foreground">There are currently no borrow markets available on this chain</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      {/* {userMarkets.length > 0 && (
        <div className="bg-linear-to-b lg:pt-22 flex h-fit w-full flex-col items-center from-transparent to-white/[0.03] pb-20">
          <div className="text-primary-foreground w-full">
            <BorrowPositionTable
              chain={chain}
              markets={userMarkets}
              tokens={tokens}
              positions={positions}
              borrowingRewards={borrowingRewards}
              refetchPositions={refetchPositionsRaw}
            />
          </div>
        </div>
      )} */}
      {/*
      Outer div ensures background color matches the end of the gradient from the div above,
      allowing rounded corners to show correctly. Inner div defines rounded corners and table background.
      */}
      <div className="flex grow flex-col">
        <div className="bg-background border-border/50 flex h-full grow justify-center rounded-xl border pb-16 shadow-sm">
          <div className="text-primary-foreground w-full">
            <BorrowTable
              chain={chain}
              markets={marketsArr}
              tokens={tokens}
              marketVaults={marketVaults}
              borrowingRewards={borrowingRewards}
              refetchPositions={refetchPositionsRaw}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
