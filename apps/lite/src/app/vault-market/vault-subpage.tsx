import { AccrualVault, VaultMarketAllocation } from "@morpho-org/blue-sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import {
  computeNetApy,
  formatApy,
  formatReadableDecimalNumber,
  getChainSlug,
  Token,
} from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import { Address, Chain, erc20Abi, erc4626Abi, formatUnits, parseUnits } from "viem";
import { useReadContracts, useAccount, useReadContract } from "wagmi";

import { SortableTableHead, type SortDirection, useSorting, createSortHandler } from "@/components/sortable-table-head";
import * as Merkl from "@/hooks/use-merkl-campaigns";
import { MerklOpportunities, useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useToken } from "@/hooks/use-token";
import { useTokens } from "@/hooks/use-tokens";
import { useVaults } from "@/hooks/use-vaults";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { DisplayableCurators, getDisplayableCurators } from "@/lib/curators";
import { useTokenPrices } from "@/lib/prices";

enum Actions {
  Deposit = "Deposit",
  Withdraw = "Withdraw",
}

const STALE_TIME = 5 * 60 * 1000;

const STYLE_TAB = "hover:bg-secondary/10 rounded-sm x-5 duration-200 ease-in-out cursor-pointer";
const STYLE_INPUT_WRAPPER = "bg-primary flex flex-col gap-4 rounded-2xl p-4 transition-colors duration-200 ease-in-out";
const STYLE_INPUT_HEADER = "flex items-center justify-between text-xs font-light";

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
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
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
}: {
  vaultAddress: Address;
  asset: Token;
  userShare: bigint;
  vault: AccrualVault;
  tokenPriceInUSD: number;
  rewards: MerklOpportunities;
}) {
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
  const userBalance = formatUnits(userShare, asset.decimals ?? 18);
  const projectedBalance = formatUnits(
    selectedTab === Actions.Deposit ? userShare + (inputValue ?? 0n) : userShare - (inputValue ?? 0n),
    asset.decimals ?? 18,
  );
  const rewardsApy = parseUnits(rewards.reduce((acc, x) => acc + x.apr, 0).toString(), 16);
  const { netApy } = computeNetApy(vault.apy, vault.fee, rewardsApy, "earn");
  const apyToComputeEarnings = formatUnits(netApy, 18);
  const yearlyEarnings = parseFloat(userBalance) * parseFloat(apyToComputeEarnings);
  const monthlyEarnings = yearlyEarnings / 12;
  const projectedYearlyEarningsUSD =
    parseFloat(projectedBalance) * parseFloat(apyToComputeEarnings) * (tokenPriceInUSD ?? 0);
  const projectedMonthlyEarningsUSD = projectedYearlyEarningsUSD / 12;
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
          <TabsList className="grid h-fit w-full grid-cols-2 gap-1">
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
                Deposit {asset.symbol ?? ""}
                <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                maxValue={maxes?.[2]}
                onChange={setTextInputValue}
                usdPrice={tokenPriceInUSD}
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
                }}
              >
                Deposit
              </TransactionButton>
            )}
          </TabsContent>
          <TabsContent value={Actions.Withdraw}>
            <div className={STYLE_INPUT_WRAPPER}>
              <div className={STYLE_INPUT_HEADER}>
                Withdraw {asset.symbol ?? ""}
                <img className="h-6 rounded-full" height={24} width={24} src={asset.imageSrc} />
              </div>
              <TokenAmountInput
                decimals={asset.decimals}
                value={textInputValue}
                maxValue={maxes?.[0]}
                onChange={setTextInputValue}
                usdPrice={tokenPriceInUSD}
              />
            </div>
            <TransactionButton
              variables={withdrawTxnConfig}
              disabled={!inputValue}
              onTxnReceipt={() => {
                setTextInputValue("");
                void refetchMaxes();
              }}
            >
              Withdraw
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
                {formatReadableDecimalNumber({ value: parseFloat(userBalance), maxDecimals: 2 })}
              </span>
              {!!inputValue && inputValue > 0n && (
                <>
                  <span className="text-xl">
                    <ChevronRight />
                  </span>
                  <span className="font-medium">
                    {formatReadableDecimalNumber({ value: parseFloat(projectedBalance), maxDecimals: 2 })}
                  </span>
                </>
              )}
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Projected Earnings / Month (USD)</span>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">
                ${formatReadableDecimalNumber({ value: monthlyEarnings, maxDecimals: 2 })}
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
                ${formatReadableDecimalNumber({ value: yearlyEarnings, maxDecimals: 2 })}
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

// Main Vault SubPage Component
export function VaultSubPage() {
  const { address: userAddress } = useAccount();
  const { address: vaultAddress } = useParams();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id ?? 1;
  const { vaultsData, vaults, topCurators, userShares } = useVaults({ chainId, staleTime: STALE_TIME });
  const currentVaultData = vaultsData?.find((vault) => vault.vault.vault === vaultAddress);
  const currentVault = vaults?.find((vault) => vault.address === vaultAddress);
  const tokenAddress = currentVaultData?.vault.asset;
  const userShare = userShares[vaultAddress as Address] ?? 0n;
  const curators = currentVault ? getDisplayableCurators(currentVault, topCurators) : {};
  const lendingRewards = useMerklOpportunities({ chainId, side: Merkl.CampaignSide.EARN, userAddress });
  const rewards = lendingRewards.get(currentVaultData?.vault.vault as Address) ?? [];
  const allocations = currentVault?.allocations;
  const asset = useToken(tokenAddress as Address, chainId);

  const [tokenPriceInUSD, setTokenPriceInUSD] = useState<number | undefined>(undefined);
  const { data: usdPrices } = useTokenPrices(chainId, asset?.address ? [asset.address] : []);

  useEffect(() => {
    if (!usdPrices || !asset?.address) return;
    setTokenPriceInUSD(usdPrices[asset.address.toLowerCase() as Address]?.price_usd);
  }, [usdPrices, asset?.address]);

  if (!currentVault || !currentVaultData || !asset) return null;

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
            />
          </div>
        </div>
      </div>
    </div>
  );
}
