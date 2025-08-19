import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import { formatBalance, Token } from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { useState } from "react";
import { Toaster } from "sonner";
import { Address, erc20Abi, erc4626Abi, parseUnits } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";

enum Actions {
  Deposit = "Deposit",
  Withdraw = "Withdraw",
}

interface VaultPositionSidebarProps {
  vaultAddress: Address;
  asset: Token;
  userDeposit: bigint;
  onTransactionComplete: () => void;
}

export function VaultPositionSidebar({ 
  vaultAddress, 
  asset, 
  userDeposit,
  onTransactionComplete 
}: VaultPositionSidebarProps) {
  const { address: userAddress } = useAccount();

  const [selectedTab, setSelectedTab] = useState(Actions.Deposit);
  const [textInputValue, setTextInputValue] = useState("");

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: asset.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [userAddress ?? "0x", vaultAddress],
    query: { enabled: !!userAddress, staleTime: 5_000, gcTime: 5_000 },
  });

  const { data: maxes, refetch: refetchMaxes } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: erc4626Abi, functionName: "maxWithdraw", args: [userAddress ?? "0x"] },
      { address: vaultAddress, abi: erc4626Abi, functionName: "maxRedeem", args: [userAddress ?? "0x"] },
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
          args: [vaultAddress, inputValue],
        } as const)
      : undefined;

  const depositTxnConfig =
    userAddress !== undefined && inputValue !== undefined
      ? ({
          address: vaultAddress,
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
            address: vaultAddress,
            abi: erc4626Abi,
            functionName: "redeem",
            args: [maxes![1], userAddress, userAddress],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
        : ({
            address: vaultAddress,
            abi: erc4626Abi,
            functionName: "withdraw",
            args: [inputValue, userAddress, userAddress],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
      : undefined;

  // Calculate projected earnings (placeholder calculations)
  const apy = 0.0607; // 6.07%
  const monthlyEarnings = Number(userDeposit) * apy / 12;
  const yearlyEarnings = Number(userDeposit) * apy;

  return (
    <Card className="sticky top-4">
      <Toaster theme="dark" position="bottom-left" richColors />
      <CardHeader>
        <CardTitle>Your Position</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Position Display */}
        <div>
          <p className="text-sm text-gray-500 mb-1">
            Your Deposit ({asset.symbol})
          </p>
          <p className="text-2xl font-semibold">
            {asset.decimals !== undefined 
              ? formatBalance(userDeposit, asset.decimals, 5)
              : "0.00"}
          </p>
          <p className="text-sm text-gray-400">
            ~${asset.decimals !== undefined 
              ? formatBalance(userDeposit, asset.decimals, 2)
              : "0.00"}
          </p>
        </div>

        {/* Deposit/Withdraw Tabs */}
        <Tabs
          value={selectedTab}
          onValueChange={(value) => {
            setSelectedTab(value as Actions);
            setTextInputValue("");
          }}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2 gap-1 bg-transparent p-0">
            <TabsTrigger 
              className="hover:bg-tertiary rounded-full duration-200 ease-in-out" 
              value={Actions.Deposit}
            >
              {Actions.Deposit}
            </TabsTrigger>
            <TabsTrigger 
              className="hover:bg-tertiary rounded-full duration-200 ease-in-out" 
              value={Actions.Withdraw}
            >
              {Actions.Withdraw}
            </TabsTrigger>
          </TabsList>

          <TabsContent value={Actions.Deposit} className="space-y-4">
            <div className="bg-primary hover:bg-secondary flex flex-col gap-4 rounded-2xl p-4 transition-colors duration-200 ease-in-out">
              <div className="text-secondary-foreground flex items-center justify-between text-xs font-light">
                Deposit {asset.symbol ?? ""}
                <img className="rounded-full" height={16} width={16} src={asset.imageSrc} />
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                maxValue={maxes?.[2]}
                onChange={setTextInputValue}
              />
            </div>
            {approvalTxnConfig ? (
              <TransactionButton
                variables={approvalTxnConfig}
                disabled={inputValue === 0n}
                onTxnReceipt={() => refetchAllowance()}
              >
                Approve
              </TransactionButton>
            ) : (
              <TransactionButton
                variables={depositTxnConfig}
                disabled={!inputValue}
                onTxnReceipt={() => {
                  setTextInputValue("");
                  void refetchMaxes();
                  onTransactionComplete();
                }}
                className="w-full bg-purple-600 hover:bg-purple-700 rounded-full"
              >
                Deposit
              </TransactionButton>
            )}
          </TabsContent>

          <TabsContent value={Actions.Withdraw} className="space-y-4">
            <div className="bg-primary hover:bg-secondary flex flex-col gap-4 rounded-2xl p-4 transition-colors duration-200 ease-in-out">
              <div className="text-secondary-foreground flex items-center justify-between text-xs font-light">
                Withdraw {asset.symbol ?? ""}
                <img className="rounded-full" height={16} width={16} src={asset.imageSrc} />
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                maxValue={maxes?.[0]}
                onChange={setTextInputValue}
              />
            </div>
            <TransactionButton
              variables={withdrawTxnConfig}
              disabled={!inputValue}
              onTxnReceipt={() => {
                setTextInputValue("");
                void refetchMaxes();
                onTransactionComplete();
              }}
              className="w-full rounded-full"
            >
              Withdraw
            </TransactionButton>
          </TabsContent>
        </Tabs>

        {/* Projected Earnings */}
        <div className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">APY</span>
            <span>0.00 → 6.07%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Projected Earnings / Month (USD)</span>
            <span>0.00 → {monthlyEarnings.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Projected Earnings / Year (USD)</span>
            <span>0.00 → {yearlyEarnings.toFixed(3)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}