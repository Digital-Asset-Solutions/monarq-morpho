import { AccrualPosition, IMarket, Market, MarketId, MarketParams } from "@morpho-org/blue-sdk";
import { morphoAbi } from "@morpho-org/uikit/assets/abis/morpho";
import { oracleAbi } from "@morpho-org/uikit/assets/abis/oracle";
import { Avatar, AvatarFallback, AvatarImage } from "@morpho-org/uikit/components/shadcn/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { formatBalanceWithSymbol, Token, formatLtv, min, tryFormatBalance } from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { blo } from "blo";
import { useState } from "react";
import { Toaster } from "sonner";
import { Address, erc20Abi, parseUnits, Chain, Hex } from "viem";
import { useAccount, useChainId, useReadContract, useReadContracts } from "wagmi";

import { DetailHeader } from "@/components/detail-header";
import { MarketMetrics } from "@/components/metrics-cards";
import { MarketTransactionInterface } from "@/components/position-sidebar";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { type DisplayableCurators } from "@/lib/curators";

interface MarketDetailPageProps {
  market: Market;
  collateralToken: Token;
  loanToken: Token;
  chain: Chain | undefined;
  marketVaults?: { name: string; address: Address; totalAssets: bigint; curators: DisplayableCurators }[];
  onBack: () => void;
  refetchPositions?: () => void;
}

export function MarketDetailPage({
  market,
  collateralToken,
  loanToken,
  chain,
  marketVaults = [],
  onBack,
  refetchPositions
}: MarketDetailPageProps) {
  const chainId = useChainId();
  const { address: userAddress } = useAccount();
  const [textInputValue, setTextInputValue] = useState("");

  const morpho = getContractDeploymentInfo(chainId, "Morpho").address;

  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: [
      {
        address: collateralToken.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [userAddress ?? "0x"],
      },
      {
        address: loanToken.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [userAddress ?? "0x"],
      },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress, staleTime: 1 * 60 * 1000, placeholderData: keepPreviousData },
  });

  const { data: positionRaw, refetch: refetchPosition } = useReadContract({
    address: morpho,
    abi: morphoAbi,
    functionName: "position",
    args: userAddress ? [market.id, userAddress] : undefined,
    query: { staleTime: 1 * 60 * 1000, placeholderData: keepPreviousData },
  });

  const { data: price } = useReadContract({
    address: market.params.oracle,
    abi: oracleAbi,
    functionName: "price",
    query: { staleTime: 1 * 60 * 1000, placeholderData: keepPreviousData, refetchInterval: 1 * 60 * 1000 },
  });

  const { data: allowances, refetch: refetchAllowances } = useReadContracts({
    contracts: [
      {
        address: collateralToken.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress ?? "0x", morpho],
      },
      {
        address: loanToken.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress ?? "0x", morpho],
      },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress, staleTime: 5_000, gcTime: 5_000 },
  });

  // Create position object if we have position data
  const position = positionRaw && price ? 
    new AccrualPosition(
        {
          user: userAddress ?? "0x",
        supplyShares: positionRaw[0],
        borrowShares: positionRaw[1],
        collateral: positionRaw[2],
      },
      market as IMarket,
    ) : undefined;

  const inputValue = parseUnits(textInputValue || "0", collateralToken.decimals ?? 18);

  // Transaction configurations
  const supplyTxnConfig = userAddress && inputValue > 0n ? {
    address: morpho,
    abi: morphoAbi,
    functionName: "supplyCollateral",
    args: [market.params, inputValue, userAddress, "0x" as Hex],
    dataSuffix: TRANSACTION_DATA_SUFFIX,
  } as const : undefined;

  const withdrawTxnConfig = userAddress && inputValue > 0n ? {
    address: morpho,
    abi: morphoAbi,
    functionName: "withdrawCollateral",
    args: [market.params, inputValue, userAddress, userAddress],
    dataSuffix: TRANSACTION_DATA_SUFFIX,
  } as const : undefined;

  const borrowTxnConfig = userAddress && inputValue > 0n ? {
    address: morpho,
    abi: morphoAbi,
    functionName: "borrow",
    args: [market.params, inputValue, 0n, userAddress, userAddress],
    dataSuffix: TRANSACTION_DATA_SUFFIX,
  } as const : undefined;

  const repayTxnConfig = userAddress && inputValue > 0n ? {
    address: morpho,
    abi: morphoAbi,
    functionName: "repay",
    args: [market.params, inputValue, 0n, userAddress, "0x" as Hex],
    dataSuffix: TRANSACTION_DATA_SUFFIX,
  } as const : undefined;

  const approvalTxnConfigs: [any?, any?] = [
    allowances?.[0] !== undefined && inputValue > allowances[0] ? {
      address: collateralToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [morpho, inputValue],
    } as const : undefined,
    allowances?.[1] !== undefined && inputValue > allowances[1] ? {
      address: loanToken.address,
      abi: erc20Abi,
      functionName: "approve",
      args: [morpho, inputValue],
    } as const : undefined,
  ];

  const onTxnReceipt = () => {
    void refetchBalances();
    void refetchPosition();
    void refetchAllowances();
    void refetchPositions?.();
  };

  // Get main vault info
  const mainVault = marketVaults[0];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Toaster theme="dark" position="bottom-left" richColors />
      
      <DetailHeader
        title={`${collateralToken.symbol} / ${loanToken.symbol}`}
        subtitle="Market"
        onBack={onBack}
        icon={
          <div className="flex items-center">
            <Avatar className="h-10 w-10 rounded-full">
              <AvatarImage src={collateralToken.imageSrc} alt="Collateral" />
              <AvatarFallback>
                <img src={blo(collateralToken.address)} />
              </AvatarFallback>
            </Avatar>
            <Avatar className="h-10 w-10 rounded-full -ml-2">
              <AvatarImage src={loanToken.imageSrc} alt="Loan" />
              <AvatarFallback>
                <img src={blo(loanToken.address)} />
              </AvatarFallback>
            </Avatar>
          </div>
        }
      />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Metrics */}
          <MarketMetrics
            lltv={market.params.lltv}
            liquidity={market.liquidity}
            borrowRate={market.borrowApy}
            userCollateral={position?.collateral}
            userBorrowed={position?.borrowAssets}
            collateralDecimals={collateralToken.decimals}
            collateralSymbol={collateralToken.symbol}
            loanDecimals={loanToken.decimals}
            loanSymbol={loanToken.symbol}
          />

          {/* About the Market */}
          <Card>
            <CardHeader>
              <CardTitle>About the Market</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary-foreground leading-relaxed">
                Supply {collateralToken.symbol} as collateral and borrow {loanToken.symbol} on this Morpho market.
                The liquidation loan-to-value (LLTV) is {formatLtv(market.params.lltv)}, providing a 
                safe borrowing environment with competitive rates.
              </p>
            </CardContent>
          </Card>

          {/* Market Details */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Collateral Token</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 rounded-full">
                    <AvatarImage src={collateralToken.imageSrc} alt="Collateral" />
                    <AvatarFallback>
                      <img src={blo(collateralToken.address)} />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{collateralToken.symbol}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Loan Token</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 rounded-full">
                    <AvatarImage src={loanToken.imageSrc} alt="Loan" />
                    <AvatarFallback>
                      <img src={blo(loanToken.address)} />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{loanToken.symbol}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">LLTV</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="font-medium">{formatLtv(market.params.lltv)}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Oracle</CardTitle>
              </CardHeader>
              <CardContent>
                <code className="text-sm">{market.params.oracle.slice(0, 10)}...</code>
              </CardContent>
            </Card>
          </div>

          {/* Vault Listings */}
          {marketVaults.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Vault Listings</CardTitle>
                <p className="text-sm text-secondary-foreground">
                  Vaults that provide liquidity to this market
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {marketVaults.map((vault) => {
                    const mainCurator = Object.values(vault.curators).find(curator => 
                      curator.roles.some(role => role.name === "Owner") || curator.shouldAlwaysShow
                    ) || Object.values(vault.curators)[0];

                    return (
                      <div key={vault.address} className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {mainCurator?.imageSrc && (
                            <Avatar className="h-8 w-8 rounded-full">
                              <AvatarImage src={mainCurator.imageSrc} alt="Curator" />
                              <AvatarFallback>
                                <img src={blo(vault.address)} />
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div>
                            <div className="font-medium">{vault.name}</div>
                            <div className="text-sm text-secondary-foreground">
                              {mainCurator ? mainCurator.name : "Unknown curator"}
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium">
                            {loanToken.decimals !== undefined
                              ? formatBalanceWithSymbol(vault.totalAssets, loanToken.decimals, loanToken.symbol, 2, true)
                              : "－"}
                          </div>
                          <div className="text-sm text-secondary-foreground">Total Supply</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80">
          <MarketTransactionInterface
            collateralToken={collateralToken}
            loanToken={loanToken}
            userCollateral={position?.collateral}
            userBorrowed={position?.borrowAssets}
            maxBorrow={position?.maxBorrowAssets}
            userCollateralBalance={balances?.[0]}
            userLoanBalance={balances?.[1]}
            allowances={allowances}
            onTransactionComplete={onTxnReceipt}
            supplyTxnConfig={supplyTxnConfig}
            withdrawTxnConfig={withdrawTxnConfig}
            borrowTxnConfig={borrowTxnConfig}
            repayTxnConfig={repayTxnConfig}
            approvalTxnConfigs={approvalTxnConfigs}
          />
        </div>
      </div>
    </div>
  );
}

