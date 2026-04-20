import { AccrualVault, VaultMarketAllocation } from "@morpho-org/blue-sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import {
  computeNetApy,
  formatApy,
  formatBalanceWithSymbol,
  formatReadableDecimalNumber,
  getChainSlug,
  Token,
} from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import {
  Address,
  Chain,
  encodeAbiParameters,
  erc20Abi,
  erc4626Abi,
  formatUnits,
  parseAbiParameters,
  parseUnits,
} from "viem";
import { useReadContracts, useAccount, useReadContract } from "wagmi";

import { SortableTableHead, type SortDirection, useSorting, createSortHandler } from "@/components/sortable-table-head";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { MerklOpportunities, useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useToken } from "@/hooks/use-token";
import { useTokens } from "@/hooks/use-tokens";
import { useVaults } from "@/hooks/use-vaults";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { DisplayableCurators, getDisplayableCurators } from "@/lib/curators";
import { getSeededVaults, type SeededVault } from "@/lib/eden-vaults";
import { useTokenPrices } from "@/lib/prices";

enum Actions {
  Deposit = "Deposit",
  Withdraw = "Withdraw",
}

const STALE_TIME = 5 * 60 * 1000;

const STYLE_TAB = "hover:bg-primary rounded-sm x-5 duration-200 ease-in-out cursor-pointer";
const STYLE_INPUT_WRAPPER =
  "bg-[#F9FAFB] border border-[#F2F4F7] flex flex-col rounded-lg p-4 transition-colors duration-200 ease-in-out";
const STYLE_INPUT_HEADER = "flex items-start justify-between text-xs font-light";

const vaultV2ManagementAbi = [
  {
    type: "function",
    name: "isAllocator",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ type: "bool" }],
  },
  { type: "function", name: "liquidityAdapter", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  {
    type: "function",
    name: "setLiquidityAdapterAndData",
    stateMutability: "nonpayable",
    inputs: [
      { name: "newLiquidityAdapter", type: "address" },
      { name: "newLiquidityData", type: "bytes" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "allocate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "adapter", type: "address" },
      { name: "data", type: "bytes" },
      { name: "assets", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "deallocate",
    stateMutability: "nonpayable",
    inputs: [
      { name: "adapter", type: "address" },
      { name: "data", type: "bytes" },
      { name: "assets", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

const morphoMarketReadAbi = [
  {
    type: "function",
    name: "market",
    stateMutability: "view",
    inputs: [{ name: "id", type: "bytes32" }],
    outputs: [
      { name: "totalSupplyAssets", type: "uint128" },
      { name: "totalSupplyShares", type: "uint128" },
      { name: "totalBorrowAssets", type: "uint128" },
      { name: "totalBorrowShares", type: "uint128" },
      { name: "lastUpdate", type: "uint128" },
      { name: "fee", type: "uint128" },
    ],
  },
] as const;

const MORPHO_EDEN_ADDRESS = "0xF050a2BB0468FF23cF2964AC182196C94D6815C3" as const;

// Header Section Component
function VaultHeader() {
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainSlug = chain ? getChainSlug(chain) : "ethereum";

  return (
    <div className="flex items-center justify-between pb-5">
      <div className="flex items-center gap-4">
        <Link
          to={`/${chainSlug}/earn`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
    </div>
  );
}

// Vault Title Section Component
function VaultTitleSection({ title, imageSrc }: { title: string; imageSrc: string }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full">
        <span className="text-lg font-bold text-white">
          <img src={imageSrc} alt={title} className="rounded-full" />
        </span>
      </div>
      <h1 className="text-3xl font-bold">{title}</h1>
    </div>
  );
}

// Stats Grid Component
function StatsGrid({
  vault,
  userShare,
  tokenPriceInUSD,
  rewards,
}: {
  vault: AccrualVault;
  userShare: bigint;
  tokenPriceInUSD: number;
  rewards: MerklOpportunities;
}) {
  const rewardsApy = parseUnits(rewards.reduce((acc, x) => acc + x.apr, 0).toString(), 16);
  const { netApy } = computeNetApy(vault.apy, vault.fee, rewardsApy, "earn");
  const totalDeposits = Number(formatUnits(vault.totalSupply, 18)) * tokenPriceInUSD;
  const liquidity = Number(formatUnits(vault.totalAssets, 18)) * tokenPriceInUSD;
  const yourDeposit = Number(formatUnits(userShare, 18)) * tokenPriceInUSD;

  return (
    <div className="mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Total Deposits</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: totalDeposits, maxDecimals: 2, letters: true })}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Liquidity</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: liquidity, maxDecimals: 2, letters: true })}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Net APY</p>
        <p className="text-2xl font-semibold">{formatApy(netApy)}</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Your Deposit</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: yourDeposit, maxDecimals: 2, letters: true })}
        </p>
      </div>
    </div>
  );
}

// About Section Component
// function AboutSection() {
//   return (
//     <div className="mb-8">
//       <h2 className="text-lg font-semibold">About the Vault</h2>
//       <p className="text-muted-foreground text-sm leading-relaxed">
//         Stake your $USDp and start raking in some chill passive earnings with $sUSDp!Stake your $USDp and start raking
//         in some chill passive earnings with $sUSDp!Stake your $USDp and start raking in some chill passive earnings with
//         $sUSDp!
//       </p>
//     </div>
//   );
// }

// Vault Details Grid Component
function VaultDetailsGrid({
  vault,
  asset,
  curators,
}: {
  vault: AccrualVault;
  asset: Token;
  curators: DisplayableCurators;
}) {
  const fee = Number(formatUnits(vault.fee, 18)) * 100;

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Vault Token</p>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full">
            <span className="text-xs text-white">
              <img src={asset.imageSrc} alt={asset.symbol} className="h-6 w-6 rounded-full" />
            </span>
          </div>
          <span className="font-semibold">{asset.symbol}</span>
        </div>
      </div>
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Performance Fee</p>
        <p className="font-semibold">{formatReadableDecimalNumber({ value: fee, maxDecimals: 2 })}%</p>
      </div>
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Curators</p>
        <div className="flex items-center gap-2">
          {Object.keys(curators).length > 0 ? (
            Object.values(curators).map((curator) => (
              <div className="flex items-center gap-1">
                <img src={curator.imageSrc ?? ""} alt={curator.name} className="h-6 w-6 rounded-full" />
                {curator.name}
              </div>
            ))
          ) : (
            <p>No curators</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Market Allocation Section Component
function MarketAllocationSection({
  allocations,
  chainId,
  asset,
  tokenPriceInUSD,
  chain,
}: {
  allocations: Map<string, VaultMarketAllocation> | undefined;
  chainId: number;
  asset: Token;
  tokenPriceInUSD: number;
  chain?: Chain;
}) {
  // Collect all unique token addresses from allocations
  const allocationTokenAddresses = useMemo(() => {
    const tokenAddressesSet = new Set<Address>();
    allocations?.forEach((allocation) => {
      tokenAddressesSet.add(allocation.position.market.params.collateralToken);
      tokenAddressesSet.add(allocation.position.market.params.loanToken);
    });
    return Array.from(tokenAddressesSet);
  }, [allocations]);

  // Fetch all allocation tokens at once
  const allocationTokens = useTokens(allocationTokenAddresses, chainId);

  const formattedAllocations = useMemo(() => {
    return [...(allocations?.values() ?? [])].map((allocation) => {
      const collateralToken = allocation.position.market.params.collateralToken;
      const loanToken = allocation.position.market.params.loanToken;
      const collateralAsset = allocationTokens.get(collateralToken);
      const loanAsset = allocationTokens.get(loanToken);
      const supply =
        Number(formatUnits(allocation.position.market.totalSupplyAssets, asset?.decimals ?? 18)) *
        (tokenPriceInUSD ?? 0);
      const cap = Number(formatUnits(allocation.config.cap, asset?.decimals ?? 18)) * (tokenPriceInUSD ?? 0);

      return {
        marketId: allocation.position.market.id,
        collateralAsset,
        loanAsset,
        supply,
        cap,
      };
    });
  }, [allocations, allocationTokens, asset?.decimals, tokenPriceInUSD]);

  // LITE APP: chainSlug not needed - dedicated to Lisk
  // const chainSlug = chain ? getChainSlug(chain) : "ethereum"; // Original chain slug - commented for rollback

  // Sort state
  const [sort, setSort] = useState<{ column: string | null; direction: SortDirection }>({
    column: null,
    direction: null,
  });

  // Sort handler
  const handleSort = createSortHandler(sort, setSort);

  // Get sort value for an allocation
  const getSortValue = (allocation: (typeof formattedAllocations)[0], column: string): number => {
    switch (column) {
      case "allocation_percent":
        return (allocation.supply / formattedAllocations.reduce((acc, x) => acc + x.supply, 0)) * 100;
      case "allocation_usd":
        return allocation.supply;
      case "supply_cap":
        return allocation.cap;
      default:
        return 0;
    }
  };

  // Apply sorting
  const sortedAllocations = useSorting(formattedAllocations, sort, getSortValue);

  return (
    <div className="mb-8 rounded-lg border bg-white py-6 shadow-sm">
      <div className="mb-6 flex items-center justify-start gap-2 px-5">
        <h2 className="text-xl font-semibold">Market Allocation</h2>
        <span className="bg-secondary/10 text-secondary mt-1 rounded-full px-2 py-1 text-xs">
          {allocations?.size ?? 0} Allocation{(allocations?.size ?? 0) !== 1 ? "s" : ""}
        </span>
      </div>

      <div>
        <div className="border-border bg-muted/50 grid grid-cols-5 gap-4 border-b px-4 py-2 text-sm font-medium">
          <div className="col-span-2 flex items-center gap-1">Market</div>
          <SortableTableHead
            sortKey="allocation_percent"
            currentSort={sort}
            onSort={handleSort}
            className="flex items-center gap-1 p-0 text-sm font-medium"
          >
            Allocation (%)
          </SortableTableHead>
          <SortableTableHead
            sortKey="allocation_usd"
            currentSort={sort}
            onSort={handleSort}
            className="flex items-center gap-1 p-0 text-sm font-medium"
          >
            Allocation ($)
          </SortableTableHead>
          <SortableTableHead
            sortKey="supply_cap"
            currentSort={sort}
            onSort={handleSort}
            className="flex items-center gap-1 p-0 text-sm font-medium"
          >
            Supply Cap
          </SortableTableHead>
        </div>

        <div>
          {sortedAllocations.length > 0 ? (
            sortedAllocations.map((allocation, index) => {
              const chainSlug = chain ? getChainSlug(chain) : "ethereum";
              return (
                <Link key={index} to={`/${chainSlug}/market/${allocation.marketId}`} className="contents">
                  <div className="hover:bg-primary grid cursor-pointer grid-cols-5 items-center gap-4 border-b p-4">
                    <div className="col-span-2 flex items-center gap-2">
                      {allocation.collateralAsset && (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full">
                          <img
                            src={allocation.collateralAsset.imageSrc}
                            alt={allocation.collateralAsset.symbol}
                            className="h-6 w-6 rounded-full"
                          />
                        </div>
                      )}
                      {allocation.loanAsset && (
                        <div className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full">
                          <img
                            src={allocation.loanAsset.imageSrc}
                            alt={allocation.loanAsset.symbol}
                            className="-ml-3 h-6 w-6 rounded-full"
                          />
                        </div>
                      )}
                      <span className="font-medium">
                        {allocation.collateralAsset?.symbol} / {allocation.loanAsset?.symbol}
                      </span>
                    </div>
                    <div className="text-muted-foreground text-sm">
                      {formatReadableDecimalNumber({
                        value: (allocation.supply / sortedAllocations.reduce((acc, x) => acc + x.supply, 0)) * 100,
                        maxDecimals: 2,
                        letters: true,
                      })}
                      %
                    </div>
                    <div className="text-muted-foreground text-sm">
                      $
                      {formatReadableDecimalNumber({
                        value: allocation.supply,
                        maxDecimals: 2,
                        letters: true,
                      })}
                    </div>
                    <div className="text-muted-foreground text-sm">
                      ${formatReadableDecimalNumber({ value: allocation.cap, maxDecimals: 2, letters: true })}
                    </div>
                  </div>
                </Link>
              );
            })
          ) : (
            <p className="text-muted-foreground p-4 text-center">No allocations</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Interaction Section Component
function InteractionSection({
  vaultAddress,
  asset,
  userShare,
  vault,
  tokenPriceInUSD,
  rewards,
  refetchBalanceOf,
}: {
  vaultAddress: Address;
  asset: Token;
  userShare: bigint;
  vault: AccrualVault;
  tokenPriceInUSD: number;
  rewards: MerklOpportunities;
  refetchBalanceOf: () => void;
}) {
  const { address: userAddress } = useAccount();
  const [selectedTab, setSelectedTab] = useState(Actions.Deposit);
  const [textInputValue, setTextInputValue] = useState("");

  const tolerance = 1n;
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

  // Compute user's deposit as asset equivalent of shares; this matches dashboard logic
  // Only compute when we have valid user shares, otherwise show 0
  const currentAssets = userShare && userShare > 0n ? vault.toAssets(userShare) : 0n;
  const userAssetBalance = formatUnits(currentAssets, asset.decimals ?? 18);
  const projectedAssetBalance = formatUnits(
    selectedTab === Actions.Deposit ? currentAssets + (inputValue ?? 0n) : currentAssets - (inputValue ?? 0n),
    asset.decimals ?? 18,
  );
  const rewardsApy = parseUnits(rewards.reduce((acc, x) => acc + x.apr, 0).toString(), 16);
  const { netApy } = computeNetApy(vault.apy, vault.fee, rewardsApy, "earn");
  const apyToComputeEarnings = formatUnits(netApy, 18);
  const yearlyEarningsUSD = parseFloat(userAssetBalance) * parseFloat(apyToComputeEarnings) * (tokenPriceInUSD ?? 0);
  const monthlyEarningsUSD = yearlyEarningsUSD / 12;
  const projectedYearlyEarningsUSD =
    parseFloat(projectedAssetBalance) * parseFloat(apyToComputeEarnings) * (tokenPriceInUSD ?? 0);
  const projectedMonthlyEarningsUSD = projectedYearlyEarningsUSD / 12;

  // Check if user has enough balance for deposit
  const hasEnoughBalanceForDeposit =
    selectedTab === Actions.Deposit
      ? inputValue !== undefined && inputValue > 0n && maxes?.[2] !== undefined && maxes[2] >= inputValue
      : true;

  // Check if user has enough balance for withdraw
  const hasEnoughBalanceForWithdraw =
    selectedTab === Actions.Withdraw
      ? inputValue !== undefined &&
        inputValue > 0n &&
        maxes?.[0] !== undefined &&
        (maxes[0] >= inputValue || inputValue - maxes[0] <= tolerance)
      : true;

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
      ? ({
          address: vaultAddress,
          abi: erc4626Abi,
          functionName: "withdraw",
          args: [inputValue, userAddress, userAddress],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border rounded-lg border bg-white py-5 shadow-sm">
        <Tabs
          defaultValue={Actions.Deposit}
          className="w-full gap-3 px-4"
          value={selectedTab}
          onValueChange={(value) => {
            setSelectedTab(value as Actions);
            setTextInputValue("");
          }}
        >
          <TabsList className="grid h-fit w-full grid-cols-2 gap-1 border border-[#F5F5F] bg-[#FAFAFA]">
            <TabsTrigger className={STYLE_TAB} value={Actions.Deposit}>
              {Actions.Deposit}
            </TabsTrigger>
            <TabsTrigger className={STYLE_TAB} value={Actions.Withdraw}>
              {Actions.Withdraw}
            </TabsTrigger>
          </TabsList>
          <TabsContent value={Actions.Deposit}>
            <div className={STYLE_INPUT_WRAPPER}>
              <div className={STYLE_INPUT_HEADER}>
                <span className="mt-1">Your Deposit</span>
                <span className="text-primary-foreground/70 flex items-center gap-2 rounded-lg bg-white p-2 text-[14px] font-bold">
                  <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
                  {asset.symbol ?? ""}
                </span>
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                symbol={asset.symbol ?? ""}
                maxValue={maxes?.[2]}
                onChange={setTextInputValue}
                usdPrice={tokenPriceInUSD}
              />
            </div>
            {approvalTxnConfig ? (
              <TransactionButton
                variables={approvalTxnConfig}
                disabled={inputValue === 0n || !hasEnoughBalanceForDeposit}
                onTxnReceipt={() => {
                  void refetchAllowance();
                  void refetchMaxes();
                  void refetchBalanceOf();
                }}
              >
                {!hasEnoughBalanceForDeposit && inputValue !== undefined && inputValue > 0n
                  ? "Insufficient Balance"
                  : "Approve"}
              </TransactionButton>
            ) : (
              <TransactionButton
                variables={depositTxnConfig}
                disabled={!inputValue || !hasEnoughBalanceForDeposit}
                onTxnReceipt={() => {
                  setTextInputValue("");
                  void refetchMaxes();
                  void refetchBalanceOf();
                }}
              >
                {!hasEnoughBalanceForDeposit && inputValue !== undefined && inputValue > 0n
                  ? "Insufficient Balance"
                  : "Deposit"}
              </TransactionButton>
            )}
          </TabsContent>
          <TabsContent value={Actions.Withdraw}>
            <div className={STYLE_INPUT_WRAPPER}>
              <div className={STYLE_INPUT_HEADER}>
                <span className="mt-1">Your Withdrawal</span>
                <span className="text-primary-foreground/70 flex items-center gap-2 rounded-lg bg-white p-2 text-[14px] font-bold">
                  <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
                  {asset.symbol ?? ""}
                </span>
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                maxValue={maxes?.[0]}
                symbol={asset.symbol ?? ""}
                onChange={setTextInputValue}
                usdPrice={tokenPriceInUSD}
              />
            </div>
            <TransactionButton
              variables={withdrawTxnConfig}
              disabled={!inputValue || !hasEnoughBalanceForWithdraw}
              onTxnReceipt={() => {
                setTextInputValue("");
                void refetchMaxes();
                void refetchBalanceOf();
              }}
            >
              {!hasEnoughBalanceForWithdraw && inputValue !== undefined && inputValue > 0n
                ? "Insufficient Balance"
                : "Withdraw"}
            </TransactionButton>
          </TabsContent>
        </Tabs>
      </div>

      <div className="border-border mb-8 rounded-lg border bg-white shadow-sm">
        <h3 className="bg-primary -mb-1 rounded-t-lg p-5 text-lg">Your Position</h3>

        <div className="border-border w-full rounded-lg border-t bg-white p-4">
          <div>
            <span className="text-muted-foreground text-xs">Your Deposit ({asset.symbol})</span>
            <div className="flex items-center gap-2">
              <span className={inputValue && inputValue > 0n ? "text-muted-foreground" : ""}>
                {formatReadableDecimalNumber({ value: parseFloat(userAssetBalance), maxDecimals: 2 })}
              </span>
              {!!inputValue && inputValue > 0n && (
                <>
                  <span className="text-xl">
                    <ChevronRight />
                  </span>
                  <span className="font-medium">
                    {formatReadableDecimalNumber({ value: parseFloat(projectedAssetBalance), maxDecimals: 2 })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Projected Earnings / Month (USD)</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                ${formatReadableDecimalNumber({ value: monthlyEarningsUSD, maxDecimals: 2 })}
              </span>
              <span className="text-xl">
                <ChevronRight />
              </span>
              <span className="font-medium">
                ${formatReadableDecimalNumber({ value: projectedMonthlyEarningsUSD, maxDecimals: 2 })}
              </span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Projected Earnings / Year (USD)</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                ${formatReadableDecimalNumber({ value: yearlyEarningsUSD, maxDecimals: 2 })}
              </span>
              <span className="text-xl">
                <ChevronRight />
              </span>
              <span className="font-medium">
                ${formatReadableDecimalNumber({ value: projectedYearlyEarningsUSD, maxDecimals: 2 })}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SeededVaultInteractionSection({
  vaultAddress,
  seededVault,
  userSharesValue,
  asset,
  onRefresh,
}: {
  vaultAddress: Address;
  seededVault: SeededVault;
  userSharesValue: bigint;
  asset: Token;
  onRefresh: () => void;
}) {
  const { address: userAddress } = useAccount();
  const [selectedTab, setSelectedTab] = useState(Actions.Deposit);
  const [textInputValue, setTextInputValue] = useState("");
  const [manageInputValue, setManageInputValue] = useState("");

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
      { address: asset.address, abi: erc20Abi, functionName: "balanceOf", args: [userAddress ?? "0x"] },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress, staleTime: 1 * 60 * 1000, placeholderData: keepPreviousData },
  });

  const { data: seededVaultReadData, refetch: refetchSeededVaultReadData } = useReadContracts({
    contracts: [
      { address: vaultAddress, abi: erc20Abi, functionName: "balanceOf", args: [userAddress ?? "0x"] },
      { address: vaultAddress, abi: erc4626Abi, functionName: "previewRedeem", args: [userSharesValue] },
      { address: asset.address, abi: erc20Abi, functionName: "balanceOf", args: [vaultAddress] },
      { address: vaultAddress, abi: vaultV2ManagementAbi, functionName: "isAllocator", args: [userAddress ?? "0x"] },
      { address: vaultAddress, abi: vaultV2ManagementAbi, functionName: "liquidityAdapter" },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress, staleTime: 20_000, gcTime: 20_000, placeholderData: keepPreviousData },
  });

  const marketId = seededVault.supplyingMarkets[0];
  const { data: seededVaultMarketData, refetch: refetchSeededVaultMarketData } = useReadContract({
    address: MORPHO_EDEN_ADDRESS,
    abi: morphoMarketReadAbi,
    functionName: "market",
    args: marketId ? [marketId] : undefined,
    query: {
      enabled: marketId !== undefined,
      staleTime: 20_000,
      gcTime: 20_000,
      placeholderData: keepPreviousData,
    },
  });

  const userShares = (seededVaultReadData?.[0] as bigint | undefined) ?? 0n;
  const previewRedeemForAllShares = userShares > 0n ? ((seededVaultReadData?.[1] as bigint | undefined) ?? 0n) : 0n;
  const idleVaultAssets = (seededVaultReadData?.[2] as bigint | undefined) ?? 0n;
  const isAllocator = (seededVaultReadData?.[3] as boolean | undefined) ?? false;
  const liquidityAdapter = (seededVaultReadData?.[4] as Address | undefined) ?? "0x";
  const adapterAddress = seededVault.adapter;
  const isLiquidityAdapterSet =
    adapterAddress !== undefined && liquidityAdapter.toLowerCase() === adapterAddress.toLowerCase();
  const totalSupplyAssets = (seededVaultMarketData?.[0] as bigint | undefined) ?? 0n;
  const totalBorrowAssets = (seededVaultMarketData?.[2] as bigint | undefined) ?? 0n;
  const marketAvailableLiquidity = totalSupplyAssets > totalBorrowAssets ? totalSupplyAssets - totalBorrowAssets : 0n;
  const adapterDeallocationCapacity = idleVaultAssets + marketAvailableLiquidity;
  const onChainMaxWithdraw = (maxes?.[0] as bigint | undefined) ?? 0n;
  // When a liquidity adapter is configured, withdraw/redeem can trigger deallocation internally,
  // so idle assets alone are not representative of the true withdrawable amount.
  const fallbackMaxWithdraw = isLiquidityAdapterSet
    ? previewRedeemForAllShares < adapterDeallocationCapacity
      ? previewRedeemForAllShares
      : adapterDeallocationCapacity
    : previewRedeemForAllShares < idleVaultAssets
      ? previewRedeemForAllShares
      : idleVaultAssets;
  const effectiveMaxWithdraw = onChainMaxWithdraw > 0n ? onChainMaxWithdraw : fallbackMaxWithdraw;
  const effectiveMaxDeallocate =
    previewRedeemForAllShares < marketAvailableLiquidity ? previewRedeemForAllShares : marketAvailableLiquidity;

  const inputValue = asset.decimals !== undefined ? parseUnits(textInputValue, asset.decimals) : undefined;
  const manageInput = asset.decimals !== undefined ? parseUnits(manageInputValue, asset.decimals) : undefined;
  const hasEnoughBalanceForDeposit =
    selectedTab === Actions.Deposit
      ? inputValue !== undefined && inputValue > 0n && maxes?.[1] !== undefined && maxes[1] >= inputValue
      : true;
  const hasEnoughBalanceForWithdraw =
    selectedTab === Actions.Withdraw
      ? inputValue !== undefined && inputValue > 0n && effectiveMaxWithdraw >= inputValue
      : true;

  const marketParamsData =
    seededVault.marketParams === undefined
      ? undefined
      : encodeAbiParameters(
          parseAbiParameters("(address loanToken,address collateralToken,address oracle,address irm,uint256 lltv)"),
          [seededVault.marketParams],
        );

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
      ? ({
          address: vaultAddress,
          abi: erc4626Abi,
          functionName: "withdraw",
          args: [inputValue, userAddress, userAddress],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const setLiquidityAdapterTxnConfig =
    adapterAddress !== undefined && marketParamsData !== undefined && isAllocator && !isLiquidityAdapterSet
      ? ({
          address: vaultAddress,
          abi: vaultV2ManagementAbi,
          functionName: "setLiquidityAdapterAndData",
          args: [adapterAddress, marketParamsData],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const allocateTxnConfig =
    adapterAddress !== undefined && marketParamsData !== undefined && isAllocator && manageInput !== undefined
      ? ({
          address: vaultAddress,
          abi: vaultV2ManagementAbi,
          functionName: "allocate",
          args: [adapterAddress, marketParamsData, manageInput],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const deallocateTxnConfig =
    adapterAddress !== undefined && marketParamsData !== undefined && isAllocator && manageInput !== undefined
      ? ({
          address: vaultAddress,
          abi: vaultV2ManagementAbi,
          functionName: "deallocate",
          args: [adapterAddress, marketParamsData, manageInput],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  return (
    <div className="border-border rounded-lg border bg-white py-5 shadow-sm">
      <Tabs
        defaultValue={Actions.Deposit}
        className="w-full gap-3 px-4"
        value={selectedTab}
        onValueChange={(value) => {
          setSelectedTab(value as Actions);
          setTextInputValue("");
        }}
      >
        <TabsList className="grid h-fit w-full grid-cols-2 gap-1 border border-[#F5F5F] bg-[#FAFAFA]">
          <TabsTrigger className={STYLE_TAB} value={Actions.Deposit}>
            {Actions.Deposit}
          </TabsTrigger>
          <TabsTrigger className={STYLE_TAB} value={Actions.Withdraw}>
            {Actions.Withdraw}
          </TabsTrigger>
        </TabsList>
        <TabsContent value={Actions.Deposit}>
          <div className={STYLE_INPUT_WRAPPER}>
            <div className={STYLE_INPUT_HEADER}>
              <span className="mt-1">Your Deposit</span>
              <span className="text-primary-foreground/70 flex items-center gap-2 rounded-lg bg-white p-2 text-[14px] font-bold">
                <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
                {asset.symbol ?? ""}
              </span>
            </div>
            <TokenAmountInput
              decimals={asset.decimals}
              value={textInputValue}
              symbol={asset.symbol ?? ""}
              maxValue={maxes?.[1]}
              onChange={setTextInputValue}
            />
          </div>
          {approvalTxnConfig ? (
            <TransactionButton
              variables={approvalTxnConfig}
              disabled={inputValue === 0n || !hasEnoughBalanceForDeposit}
              onTxnReceipt={() => {
                void refetchAllowance();
                void refetchMaxes();
                onRefresh();
              }}
            >
              {!hasEnoughBalanceForDeposit && inputValue !== undefined && inputValue > 0n
                ? "Insufficient Balance"
                : "Approve"}
            </TransactionButton>
          ) : (
            <TransactionButton
              variables={depositTxnConfig}
              disabled={!inputValue || !hasEnoughBalanceForDeposit}
              onTxnReceipt={() => {
                setTextInputValue("");
                void refetchMaxes();
                onRefresh();
              }}
            >
              {!hasEnoughBalanceForDeposit && inputValue !== undefined && inputValue > 0n
                ? "Insufficient Balance"
                : "Deposit"}
            </TransactionButton>
          )}
        </TabsContent>
        <TabsContent value={Actions.Withdraw}>
          <div className={STYLE_INPUT_WRAPPER}>
            <div className={STYLE_INPUT_HEADER}>
              <span className="mt-1">Your Withdrawal</span>
              <span className="text-primary-foreground/70 flex items-center gap-2 rounded-lg bg-white p-2 text-[14px] font-bold">
                <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
                {asset.symbol ?? ""}
              </span>
            </div>
            <TokenAmountInput
              decimals={asset.decimals}
              value={textInputValue}
              maxValue={effectiveMaxWithdraw}
              symbol={asset.symbol ?? ""}
              onChange={setTextInputValue}
            />
          </div>
          <TransactionButton
            variables={withdrawTxnConfig}
            disabled={!inputValue || !hasEnoughBalanceForWithdraw}
            onTxnReceipt={() => {
              setTextInputValue("");
              void refetchMaxes();
              onRefresh();
            }}
          >
            {!hasEnoughBalanceForWithdraw && inputValue !== undefined && inputValue > 0n
              ? "Insufficient Balance"
              : "Withdraw"}
          </TransactionButton>
          {onChainMaxWithdraw === 0n && (
            <p className="text-muted-foreground mt-2 text-xs">
              VaultV2 returns `maxWithdraw = 0` by design. Current withdrawable amount is estimated from user shares and
              idle vault liquidity.
            </p>
          )}
        </TabsContent>
      </Tabs>
      {(adapterAddress !== undefined || isAllocator) && (
        <div className="mt-4 rounded-lg border bg-white p-4">
          <p className="text-sm font-semibold">Vault V2 Management</p>
          <p className="text-muted-foreground mt-1 text-xs">
            Idle liquidity in vault:{" "}
            {formatBalanceWithSymbol(idleVaultAssets, asset.decimals ?? 18, asset.symbol ?? "", 5, true)}
          </p>
          <p className="text-muted-foreground text-xs">Allocator role: {isAllocator ? "yes" : "no"}</p>
          <p className="text-muted-foreground text-xs">
            Liquidity adapter:{" "}
            {liquidityAdapter === "0x0000000000000000000000000000000000000000" ? "not set" : liquidityAdapter}
          </p>

          {setLiquidityAdapterTxnConfig && (
            <div className="mt-3">
              <TransactionButton
                variables={setLiquidityAdapterTxnConfig}
                disabled={false}
                onTxnReceipt={() => {
                  void refetchSeededVaultReadData();
                  void refetchMaxes();
                  onRefresh();
                }}
              >
                Set Liquidity Adapter
              </TransactionButton>
            </div>
          )}

          {adapterAddress !== undefined && marketParamsData !== undefined && isAllocator && (
            <div className="mt-3">
              <TokenAmountInput
                decimals={asset.decimals}
                value={manageInputValue}
                symbol={asset.symbol ?? ""}
                maxValue={effectiveMaxDeallocate}
                onChange={setManageInputValue}
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <TransactionButton
                  variables={deallocateTxnConfig}
                  disabled={!manageInput || manageInput === 0n}
                  onTxnReceipt={() => {
                    setManageInputValue("");
                    void refetchSeededVaultReadData();
                    void refetchSeededVaultMarketData();
                    void refetchMaxes();
                    onRefresh();
                  }}
                >
                  Deallocate
                </TransactionButton>
                <TransactionButton
                  variables={allocateTxnConfig}
                  disabled={!manageInput || manageInput === 0n}
                  onTxnReceipt={() => {
                    setManageInputValue("");
                    void refetchSeededVaultReadData();
                    void refetchSeededVaultMarketData();
                    void refetchMaxes();
                    onRefresh();
                  }}
                >
                  Allocate
                </TransactionButton>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Main Vault SubPage Component
export function VaultSubPage() {
  const { address: userAddress } = useAccount();
  const { address: vaultAddress } = useParams();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id ?? 1;
  const { vaultsData, vaults, topCurators, userShares, refetchBalanceOf } = useVaults({
    chainId,
    staleTime: STALE_TIME,
    userAddress,
  });
  const currentVaultData = vaultsData?.find((vault) => vault.vault.vault === vaultAddress);
  const currentVault = vaults?.find((vault) => vault.address === vaultAddress);
  const seededVault = useMemo(
    () =>
      getSeededVaults(chainId).find(
        (vault) => vaultAddress !== undefined && vault.address.toLowerCase() === vaultAddress.toLowerCase(),
      ),
    [chainId, vaultAddress],
  );
  const tokenAddress = currentVaultData?.vault.asset;
  const seededAsset = useToken(seededVault?.asset, chainId);
  const userShare = userShares[vaultAddress as Address] ?? 0n;
  const curators = currentVault ? getDisplayableCurators(currentVault, topCurators) : {};
  const lendingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.EARN, userAddress });
  const rewards = lendingRewards.get(currentVaultData?.vault.vault as Address) ?? [];
  const allocations = currentVault?.allocations;
  const asset = useToken(tokenAddress as Address, chainId);
  const { data: seededVaultSnapshot, refetch: refetchSeededVaultSnapshot } = useReadContracts({
    contracts:
      seededVault === undefined
        ? []
        : ([
            { address: seededVault.address, abi: erc20Abi, functionName: "name" },
            { address: seededVault.address, abi: erc4626Abi, functionName: "totalAssets" },
            { address: seededVault.address, abi: erc20Abi, functionName: "totalSupply" },
            { address: seededVault.address, abi: erc20Abi, functionName: "balanceOf", args: [userAddress ?? "0x"] },
          ] as const),
    allowFailure: false,
    query: { enabled: seededVault !== undefined, staleTime: STALE_TIME, gcTime: STALE_TIME },
  });

  const [tokenPriceInUSD, setTokenPriceInUSD] = useState<number | undefined>(undefined);
  const { data: usdPrices } = useTokenPrices(chainId, asset?.address ? [asset.address] : []);

  useEffect(() => {
    if (!usdPrices || !asset?.address) return;
    setTokenPriceInUSD(usdPrices[asset.address.toLowerCase() as Address]?.price_usd);
  }, [usdPrices, asset?.address]);

  if (!currentVault || !currentVaultData || !asset) {
    if (!seededVault || !seededAsset) return null;

    const seededVaultName = (seededVaultSnapshot?.[0] as string | undefined) ?? seededVault.name;
    const seededVaultTotalAssets = (seededVaultSnapshot?.[1] as bigint | undefined) ?? 0n;
    const seededVaultTotalSupply = (seededVaultSnapshot?.[2] as bigint | undefined) ?? 0n;
    const seededVaultUserShares = (seededVaultSnapshot?.[3] as bigint | undefined) ?? 0n;

    return (
      <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
        <div className="flex h-full grow justify-center pb-16">
          <div className="flex w-full max-w-7xl flex-col gap-6 py-3 lg:px-5">
            <VaultHeader />
            <VaultTitleSection title={seededVaultName} imageSrc={seededAsset.imageSrc ?? ""} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-muted-foreground text-sm">Vault Asset</p>
                <p className="text-lg font-semibold">{seededAsset.symbol}</p>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-muted-foreground text-sm">Total Assets</p>
                <p className="text-lg font-semibold">
                  {formatBalanceWithSymbol(
                    seededVaultTotalAssets,
                    seededAsset.decimals ?? 18,
                    seededAsset.symbol ?? "",
                    5,
                    true,
                  )}
                </p>
              </div>
              <div className="rounded-lg border bg-white p-4 shadow-sm">
                <p className="text-muted-foreground text-sm">Your Shares</p>
                <p className="text-lg font-semibold">
                  {formatBalanceWithSymbol(
                    seededVaultUserShares,
                    seededAsset.decimals ?? 18,
                    seededAsset.symbol ?? "",
                    5,
                    true,
                  )}
                </p>
              </div>
            </div>
            <div className="text-muted-foreground rounded-lg border bg-white p-4 text-xs shadow-sm">
              Fallback mode: this VaultV2 is shown directly via ERC4626 reads (not MetaMorpho indexing).
              <br />
              Total Supply:{" "}
              {formatBalanceWithSymbol(
                seededVaultTotalSupply,
                seededAsset.decimals ?? 18,
                seededAsset.symbol ?? "",
                5,
                true,
              )}
            </div>
            <SeededVaultInteractionSection
              vaultAddress={seededVault.address}
              seededVault={seededVault}
              userSharesValue={seededVaultUserShares}
              asset={seededAsset}
              onRefresh={() => {
                void refetchSeededVaultSnapshot();
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      <div className="flex h-full grow justify-center pb-16">
        <div className="flex w-full max-w-7xl flex-col gap-10 py-3 lg:flex-row lg:px-5">
          <div className="w-full lg:w-8/12">
            <VaultHeader />
            <VaultTitleSection title={currentVaultData.vault.name} imageSrc={asset.imageSrc ?? ""} />
            <StatsGrid
              vault={currentVault as AccrualVault}
              userShare={userShare}
              tokenPriceInUSD={tokenPriceInUSD ?? 0}
              rewards={rewards}
            />
            {/* <AboutSection /> */}
            <VaultDetailsGrid vault={currentVault as AccrualVault} asset={asset} curators={curators} />
            <div className="block lg:hidden">
              <InteractionSection
                vaultAddress={vaultAddress as Address}
                asset={asset}
                userShare={userShare}
                vault={currentVault as AccrualVault}
                tokenPriceInUSD={tokenPriceInUSD ?? 0}
                rewards={rewards}
                refetchBalanceOf={refetchBalanceOf}
              />
            </div>
            <MarketAllocationSection
              allocations={allocations}
              chainId={chainId}
              asset={asset}
              tokenPriceInUSD={tokenPriceInUSD ?? 0}
              chain={chain}
            />
          </div>

          <div className="hidden w-4/12 lg:block">
            <InteractionSection
              vaultAddress={vaultAddress as Address}
              asset={asset}
              tokenPriceInUSD={tokenPriceInUSD ?? 0}
              userShare={userShare}
              rewards={rewards}
              vault={currentVault as AccrualVault}
              refetchBalanceOf={refetchBalanceOf}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
