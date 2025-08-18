import { AccrualVault } from "@morpho-org/blue-sdk";
import { Avatar, AvatarFallback, AvatarImage } from "@morpho-org/uikit/components/shadcn/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { formatBalanceWithSymbol, Token, formatLtv } from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { blo } from "blo";
// @ts-expect-error: this package lacks types
import humanizeDuration from "humanize-duration";
import { useState } from "react";
import { Toaster } from "sonner";
import { Address, erc20Abi, erc4626Abi, parseUnits, Chain } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { AllocationTable } from "@/components/allocation-table";
import { DetailHeader } from "@/components/detail-header";
import { VaultMetrics } from "@/components/metrics-cards";
import { VaultTransactionInterface } from "@/components/position-sidebar";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { type DisplayableCurators } from "@/lib/curators";

interface VaultDetailPageProps {
  vault: AccrualVault;
  asset: Token;
  chain: Chain | undefined;
  curators: DisplayableCurators;
  tokens: Map<Address, { decimals?: number; symbol?: string }>;
  onBack: () => void;
  refetchPositions?: () => void;
}

export function VaultDetailPage({
  vault,
  asset,
  chain,
  curators,
  tokens,
  onBack,
  refetchPositions
}: VaultDetailPageProps) {
  const { address: userAddress } = useAccount();
  const [textInputValue, setTextInputValue] = useState("");

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: asset.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [userAddress ?? "0x", vault.address],
    query: { enabled: !!userAddress, staleTime: 5_000, gcTime: 5_000 },
  });

  const { data: maxes, refetch: refetchMaxes } = useReadContracts({
    contracts: [
      { address: vault.address, abi: erc4626Abi, functionName: "maxWithdraw", args: [userAddress ?? "0x"] },
      { address: vault.address, abi: erc4626Abi, functionName: "maxRedeem", args: [userAddress ?? "0x"] },
      { address: asset.address, abi: erc20Abi, functionName: "balanceOf", args: [userAddress ?? "0x"] },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress, staleTime: 1 * 60 * 1000, placeholderData: keepPreviousData },
  });

  const inputValue = asset.decimals !== undefined ? parseUnits(textInputValue, asset.decimals) : undefined;
  const isMaxed = inputValue === maxes?.[0];

  const approvalTxnConfig =
    userAddress !== undefined && inputValue !== undefined && allowance !== undefined && allowance < inputValue
      ? ({
          address: asset.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [vault.address, inputValue],
        } as const)
      : undefined;

  const depositTxnConfig =
    userAddress !== undefined && inputValue !== undefined
      ? ({
          address: vault.address,
          abi: erc4626Abi,
          functionName: "deposit",
          args: [inputValue, userAddress],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const withdrawTxnConfig =
    userAddress !== undefined && inputValue !== undefined
      ? isMaxed
        ? ({
            address: vault.address,
            abi: erc4626Abi,
            functionName: "redeem",
            args: [maxes![1], userAddress, userAddress],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
        : ({
            address: vault.address,
            abi: erc4626Abi,
            functionName: "withdraw",
            args: [inputValue, userAddress, userAddress],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
      : undefined;

  const onTxnReceipt = () => {
    void refetchAllowance();
    void refetchMaxes();
    void refetchPositions?.();
  };

  // Get main curator info
  const mainCurator = Object.values(curators).find(curator => 
    curator.roles.some(role => role.name === "Owner") || curator.shouldAlwaysShow
  ) || Object.values(curators)[0];

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <Toaster theme="dark" position="bottom-left" richColors />
      
      <DetailHeader
        title={vault.name || "Vault"}
        onBack={onBack}
        icon={
          <Avatar className="h-12 w-12 rounded-full">
            <AvatarImage src={asset.imageSrc} alt="Vault" />
            <AvatarFallback>
              <img src={blo(vault.address)} />
            </AvatarFallback>
          </Avatar>
        }
      />

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Main Content */}
        <div className="flex-1 space-y-8">
          {/* Metrics */}
          <VaultMetrics
            totalDeposits={vault.totalAssets}
            liquidity={vault.totalAssets} // For vaults, this is the same
            apy={vault.apy}
            userDeposit={maxes?.[0]}
            assetDecimals={asset.decimals}
            assetSymbol={asset.symbol}
          />

          {/* About the Vault */}
          <Card>
            <CardHeader>
              <CardTitle>About the Vault</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-secondary-foreground leading-relaxed">
                Stake your ${asset.symbol} and start raking in some chill passive earnings with $s{asset.symbol}! 
                Stake your ${asset.symbol} and start raking in some chill passive earnings with $s{asset.symbol}! 
                Stake your ${asset.symbol} and start raking in some chill passive earnings with $s{asset.symbol}!
              </p>
            </CardContent>
          </Card>

          {/* Vault Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Vault Token</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6 rounded-full">
                    <AvatarImage src={asset.imageSrc} alt="Asset" />
                    <AvatarFallback>
                      <img src={blo(asset.address)} />
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium">{asset.symbol}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Performance Fee</CardTitle>
              </CardHeader>
              <CardContent>
                <span className="font-medium">{formatLtv(vault.fee)}</span>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-secondary-foreground">Curator</CardTitle>
              </CardHeader>
              <CardContent>
                {mainCurator ? (
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 rounded-full">
                      <AvatarImage src={mainCurator.imageSrc ?? ""} alt="Curator" />
                      <AvatarFallback>
                        <img src={blo(mainCurator.name.padEnd(42, "0").slice(0, 42) as Address)} />
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{mainCurator.name}</span>
                  </div>
                ) : (
                  <span className="text-secondary-foreground">Unknown</span>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Market Allocation */}
          <AllocationTable vault={vault} chain={chain} tokens={tokens} />
        </div>

        {/* Sidebar */}
        <div className="w-full lg:w-80">
          <VaultTransactionInterface
            token={asset}
            userPosition={maxes?.[0]}
            maxWithdraw={maxes?.[0]}
            userBalance={maxes?.[2]}
            allowance={allowance}
            onTransactionComplete={onTxnReceipt}
            approvalTxnConfig={approvalTxnConfig}
            depositTxnConfig={depositTxnConfig}
            withdrawTxnConfig={withdrawTxnConfig}
          />
        </div>
      </div>
    </div>
  );
}
