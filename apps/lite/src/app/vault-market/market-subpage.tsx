import { AccrualPosition, Market } from "@morpho-org/blue-sdk";
import { morphoAbi } from "@morpho-org/uikit/assets/abis/morpho";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import { getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { formatReadableDecimalNumber, Token, formatBalanceWithSymbol } from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import { Address, Chain, erc20Abi, formatUnits, parseUnits } from "viem";
import { useReadContracts, useAccount, useReadContract } from "wagmi";

import { SortableTableHead, type SortDirection, useSorting, createSortHandler } from "@/components/sortable-table-head";
import { useMarkets } from "@/hooks/use-markets";
import { useToken } from "@/hooks/use-token";
import { useVaults } from "@/hooks/use-vaults";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { DisplayableCurators } from "@/lib/curators";
import { useTokenPrices } from "@/lib/prices";

enum Actions {
  SupplyCollateral = "Supply Collateral",
  WithdrawCollateral = "Withdraw Collateral",
  Borrow = "Borrow",
  Repay = "Repay",
}

const STALE_TIME = 5 * 60 * 1000;

const STYLE_TAB = "hover:bg-secondary/10 rounded-sm px-5 duration-200 ease-in-out cursor-pointer";
const STYLE_INPUT_WRAPPER = "bg-primary flex flex-col gap-4 rounded-2xl p-4 transition-colors duration-200 ease-in-out";
const STYLE_INPUT_HEADER = "flex items-center justify-between text-xs font-light";

// Header Section Component
function MarketHeader() {
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainSlug = chain?.name.toLowerCase() || "ethereum";

  return (
    <div className="flex items-center justify-between pb-5">
      <div className="flex items-center gap-4">
        <Link
          to={`/${chainSlug}/borrow`}
          className="text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Link>
      </div>
    </div>
  );
}

// Market Title Section Component
function MarketTitleSection({ collateralToken, loanToken }: { collateralToken: Token; loanToken: Token }) {
  return (
    <div className="mb-8 flex items-center gap-4">
      <div className="flex items-center gap-2">
        <div className="flex h-12 w-12 items-center justify-center rounded-full">
          <img src={collateralToken.imageSrc} alt={collateralToken.symbol} className="h-12 w-12 rounded-full" />
        </div>
        <div className="-ml-4 flex h-12 w-12 items-center justify-center rounded-full">
          <img src={loanToken.imageSrc} alt={loanToken.symbol} className="h-12 w-12 rounded-full" />
        </div>
      </div>
      <h1 className="text-3xl font-bold">
        {collateralToken.symbol} / {loanToken.symbol}
      </h1>
    </div>
  );
}

// Stats Grid Component
function StatsGrid({
  market,
  position,
  loanTokenPriceInUSD,
  loanToken,
}: {
  market: Market;
  position?: AccrualPosition;
  loanTokenPriceInUSD: number;
  loanToken: Token;
}) {
  const totalLiquidity = Number(formatUnits(market.liquidity, loanToken.decimals ?? 18)) * loanTokenPriceInUSD;
  const borrowRate = Number(formatUnits(market.borrowApy, 18)) * 100;
  const totalMarketSize = Number(formatUnits(market.totalSupplyAssets, loanToken.decimals ?? 18)) * loanTokenPriceInUSD;

  const userBorrow = position
    ? Number(formatUnits(position.borrowAssets, loanToken.decimals ?? 18)) * loanTokenPriceInUSD
    : 0;

  return (
    <div className="mb-8 grid grid-cols-2 gap-6 lg:grid-cols-4">
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Total Market Size</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: totalMarketSize, maxDecimals: 2, letters: true })}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Available Liquidity</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: totalLiquidity, maxDecimals: 2, letters: true })}
        </p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Borrow Rate</p>
        <p className="text-2xl font-semibold">{formatReadableDecimalNumber({ value: borrowRate, maxDecimals: 2 })}%</p>
      </div>
      <div>
        <p className="text-muted-foreground mb-1 text-sm">Your Borrowed</p>
        <p className="text-2xl font-semibold">
          ${formatReadableDecimalNumber({ value: userBorrow, maxDecimals: 2, letters: true })}
        </p>
      </div>
    </div>
  );
}

// About Section Component
// function AboutSection({ collateralToken, loanToken }: { collateralToken: Token; loanToken: Token }) {
//   return (
//     <div className="mb-8">
//       <h2 className="text-lg font-semibold">About this Market</h2>
//       <p className="text-muted-foreground text-sm leading-relaxed">
//         Supply {collateralToken.symbol} as collateral to borrow {loanToken.symbol}. Monitor your health factor to avoid
//         liquidation.
//       </p>
//     </div>
//   );
// }

// Market Details Grid Component
function MarketDetailsGrid({
  market,
  collateralToken,
  loanToken,
}: {
  market: Market;
  collateralToken: Token;
  loanToken: Token;
}) {
  const lltv = Number(formatUnits(market.params.lltv, 18)) * 100;

  return (
    <div className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Collateral Token</p>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full">
            <img src={collateralToken.imageSrc} alt={collateralToken.symbol} className="h-6 w-6 rounded-full" />
          </div>
          <span className="font-semibold">{collateralToken.symbol}</span>
        </div>
      </div>
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Loan Token</p>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full">
            <img src={loanToken.imageSrc} alt={loanToken.symbol} className="h-6 w-6 rounded-full" />
          </div>
          <span className="font-semibold">{loanToken.symbol}</span>
        </div>
      </div>
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Liq. Loan-To-Value (LLTV)</p>
        <p className="font-semibold">{formatReadableDecimalNumber({ value: lltv, maxDecimals: 2 })}%</p>
      </div>
    </div>
  );
}

// Vaults Section Component
function VaultsSection({
  marketVaults,
  loanToken,
  chain,
}: {
  marketVaults: { name: string; address: Address; totalAssets: bigint; curators: DisplayableCurators }[];
  loanToken: Token;
  chain?: Chain;
}) {
  const chainSlug = chain?.name.toLowerCase() || "ethereum";

  // Sort state
  const [sort, setSort] = useState<{ column: string | null; direction: SortDirection }>({
    column: null,
    direction: null,
  });

  // Sort handler
  const handleSort = createSortHandler(sort, setSort);

  // Get sort value for a vault
  const getSortValue = (vault: (typeof marketVaults)[0], column: string): number => {
    switch (column) {
      case "total_supply": {
        return Number(formatUnits(vault.totalAssets, loanToken.decimals ?? 18));
      }
      case "supply_share": {
        const totalSupply = marketVaults.reduce(
          (acc, v) => acc + Number(formatUnits(v.totalAssets, loanToken.decimals ?? 18)),
          0,
        );
        const vaultSupply = Number(formatUnits(vault.totalAssets, loanToken.decimals ?? 18));
        return totalSupply > 0 ? (vaultSupply / totalSupply) * 100 : 0;
      }
      default: {
        return 0;
      }
    }
  };

  // Apply sorting
  const sortedVaults = useSorting(marketVaults, sort, getSortValue);

  return (
    <div className="mb-8 rounded-lg border bg-white py-6 shadow-sm">
      <div className="mb-6 flex items-center justify-start gap-2 px-5">
        <h2 className="text-xl font-semibold">Supplying Vaults</h2>
        <span className="bg-secondary/10 text-secondary mt-1 rounded-full px-2 py-1 text-xs">
          {marketVaults.length} Vault{marketVaults.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div>
        <div className="border-border bg-muted/50 grid grid-cols-4 gap-4 border-b px-4 py-2 text-sm font-medium">
          <div className="flex items-center gap-1">Vault</div>
          <div className="flex items-center gap-1">Curators</div>
          <SortableTableHead
            sortKey="total_supply"
            currentSort={sort}
            onSort={handleSort}
            className="flex items-center gap-1 p-0 text-sm font-medium"
          >
            Total Supply
          </SortableTableHead>
          <SortableTableHead
            sortKey="supply_share"
            currentSort={sort}
            onSort={handleSort}
            className="flex items-center gap-1 p-0 text-sm font-medium"
          >
            Supply Share
          </SortableTableHead>
        </div>

        <div>
          {sortedVaults.length > 0 ? (
            (() => {
              const totalSupply = sortedVaults.reduce(
                (acc, vault) => acc + Number(formatUnits(vault.totalAssets, loanToken.decimals ?? 18)),
                0,
              );

              return sortedVaults.map((vault, index) => {
                const vaultSupply = Number(formatUnits(vault.totalAssets, loanToken.decimals ?? 18));
                const allocationPercentage = totalSupply > 0 ? (vaultSupply / totalSupply) * 100 : 0;

                return (
                  <Link key={index} to={`/${chainSlug}/vault/${vault.address}`} className="contents">
                    <div className="hover:bg-primary grid cursor-pointer grid-cols-4 items-center gap-4 border-b p-4">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full">
                          <img src={loanToken.imageSrc} alt={vault.name} className="h-6 w-6 rounded-full" />
                        </div>
                        <span className="font-medium">{vault.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {Object.values(vault.curators)
                          .filter((curator) => curator.shouldAlwaysShow)
                          .slice(0, 3)
                          .map((curator) => (
                            <div key={curator.name} className="flex items-center gap-1">
                              {curator.imageSrc && (
                                <img src={curator.imageSrc} alt={curator.name} className="h-5 w-5 rounded-full" />
                              )}
                              <span className="text-sm">{curator.name}</span>
                            </div>
                          ))}
                      </div>
                      <div className="text-muted-foreground text-sm">
                        {loanToken.decimals !== undefined
                          ? formatBalanceWithSymbol(vault.totalAssets, loanToken.decimals, loanToken.symbol, 5, true)
                          : "－"}
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground text-sm">
                          {formatReadableDecimalNumber({ value: allocationPercentage, maxDecimals: 1 })}%
                        </span>
                      </div>
                    </div>
                  </Link>
                );
              });
            })()
          ) : (
            <p className="text-muted-foreground p-4 text-center">No vaults found for this market</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Interaction Section Component
function InteractionSection({
  marketParams,
  market,
  collateralToken,
  loanToken,
  position,
  collateralTokenPriceInUSD,
  loanTokenPriceInUSD,
}: {
  marketParams: Market["params"];
  market: Market;
  collateralToken: Token;
  loanToken: Token;
  position?: AccrualPosition;
  collateralTokenPriceInUSD: number;
  loanTokenPriceInUSD: number;
}) {
  const { address: userAddress } = useAccount();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id ?? 1;
  const [selectedTab, setSelectedTab] = useState(Actions.SupplyCollateral);
  const [textInputValue, setTextInputValue] = useState("");

  const morpho = useMemo(() => getContractDeploymentInfo(chainId, "Morpho"), [chainId]);

  // Get the relevant token for current action
  const currentToken = [Actions.SupplyCollateral, Actions.WithdrawCollateral].includes(selectedTab)
    ? collateralToken
    : loanToken;

  const { data: allowances, refetch: refetchAllowances } = useReadContracts({
    contracts: [
      {
        address: collateralToken.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress ?? "0x", morpho?.address ?? "0x"],
      },
      {
        address: loanToken.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [userAddress ?? "0x", morpho?.address ?? "0x"],
      },
    ],
    allowFailure: false,
    query: { enabled: !!userAddress && !!morpho, staleTime: 5_000, gcTime: 5_000 },
  });

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

  const inputValue =
    currentToken.decimals !== undefined ? parseUnits(textInputValue, currentToken.decimals) : undefined;

  // Calculate max values based on action
  const getMaxValue = () => {
    switch (selectedTab) {
      case Actions.SupplyCollateral:
        return balances?.[0];
      case Actions.WithdrawCollateral:
        return position?.withdrawableCollateral;
      case Actions.Borrow:
        return position?.maxBorrowableAssets;
      case Actions.Repay:
        return position?.borrowAssets;
      default:
        return undefined;
    }
  };

  const maxValue = getMaxValue();
  const isMaxed = inputValue === maxValue;

  // Transaction configs
  const tokenIndex = [Actions.SupplyCollateral, Actions.WithdrawCollateral].includes(selectedTab) ? 0 : 1;
  const allowance = allowances?.[tokenIndex];

  const approvalTxnConfig =
    userAddress !== undefined && inputValue !== undefined && allowance !== undefined && allowance < inputValue
      ? ({
          address: currentToken.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [morpho?.address ?? "0x", inputValue],
        } as const)
      : undefined;

  const supplyCollateralTxnConfig =
    selectedTab === Actions.SupplyCollateral && userAddress !== undefined && inputValue !== undefined
      ? ({
          address: morpho?.address ?? "0x",
          abi: morphoAbi,
          functionName: "supplyCollateral",
          args: [marketParams, inputValue, userAddress, "0x"],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const withdrawCollateralTxnConfig =
    selectedTab === Actions.WithdrawCollateral && userAddress !== undefined && inputValue !== undefined
      ? ({
          address: morpho?.address ?? "0x",
          abi: morphoAbi,
          functionName: "withdrawCollateral",
          args: [marketParams, inputValue, userAddress, userAddress],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const borrowTxnConfig =
    selectedTab === Actions.Borrow && userAddress !== undefined && inputValue !== undefined
      ? ({
          address: morpho?.address ?? "0x",
          abi: morphoAbi,
          functionName: "borrow",
          args: [marketParams, inputValue, 0n, userAddress, userAddress],
          dataSuffix: TRANSACTION_DATA_SUFFIX,
        } as const)
      : undefined;

  const repayTxnConfig =
    selectedTab === Actions.Repay && userAddress !== undefined && inputValue !== undefined
      ? isMaxed
        ? ({
            address: morpho?.address ?? "0x",
            abi: morphoAbi,
            functionName: "repay",
            args: [marketParams, 0n, inputValue, userAddress, "0x"],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
        : ({
            address: morpho?.address ?? "0x",
            abi: morphoAbi,
            functionName: "repay",
            args: [marketParams, inputValue, 0n, userAddress, "0x"],
            dataSuffix: TRANSACTION_DATA_SUFFIX,
          } as const)
      : undefined;

  const getTxnConfig = () => {
    switch (selectedTab) {
      case Actions.SupplyCollateral:
        return supplyCollateralTxnConfig;
      case Actions.WithdrawCollateral:
        return withdrawCollateralTxnConfig;
      case Actions.Borrow:
        return borrowTxnConfig;
      case Actions.Repay:
        return repayTxnConfig;
      default:
        return undefined;
    }
  };

  const userCollateralBalance = position ? formatUnits(position.collateral, collateralToken.decimals ?? 18) : "0";
  const userBorrowBalance = position ? formatUnits(position.borrowAssets, loanToken.decimals ?? 18) : "0";

  // Calculate projected values based on current input
  const getProjectedCollateral = () => {
    if (!inputValue) return userCollateralBalance;

    const currentCollateral = position?.collateral ?? 0n;

    switch (selectedTab) {
      case Actions.SupplyCollateral:
        return formatUnits(currentCollateral + inputValue, collateralToken.decimals ?? 18);
      case Actions.WithdrawCollateral:
        return formatUnits(currentCollateral - inputValue, collateralToken.decimals ?? 18);
      default:
        return userCollateralBalance;
    }
  };

  const getProjectedBorrow = () => {
    if (!inputValue) return userBorrowBalance;

    const currentBorrow = position?.borrowAssets ?? 0n;

    switch (selectedTab) {
      case Actions.Borrow:
        return formatUnits(currentBorrow + inputValue, loanToken.decimals ?? 18);
      case Actions.Repay:
        return formatUnits(currentBorrow - inputValue, loanToken.decimals ?? 18);
      default:
        return userBorrowBalance;
    }
  };

  const projectedCollateralBalance = getProjectedCollateral();
  const projectedBorrowBalance = getProjectedBorrow();

  // Check if we should show projections
  const shouldShowCollateralProjection =
    !!inputValue && inputValue > 0n && [Actions.SupplyCollateral, Actions.WithdrawCollateral].includes(selectedTab);
  const shouldShowBorrowProjection =
    !!inputValue && inputValue > 0n && [Actions.Borrow, Actions.Repay].includes(selectedTab);

  const healthFactor =
    position?.ltv !== undefined && position.ltv !== null && market.params.lltv > 0n
      ? Number(formatUnits(market.params.lltv - position.ltv, 18)) * 100
      : 100;

  return (
    <div className="flex flex-col gap-6">
      <div className="border-border rounded-lg border bg-white py-5 shadow-sm">
        <Tabs
          defaultValue={Actions.SupplyCollateral}
          className="w-full gap-3 px-4"
          value={selectedTab}
          onValueChange={(value) => {
            setSelectedTab(value as Actions);
            setTextInputValue("");
          }}
        >
          <TabsList className="grid h-fit w-full grid-cols-4 gap-1">
            <TabsTrigger className={STYLE_TAB} value={Actions.SupplyCollateral}>
              Supply
            </TabsTrigger>
            <TabsTrigger className={STYLE_TAB} value={Actions.WithdrawCollateral}>
              Withdraw
            </TabsTrigger>
            <TabsTrigger className={STYLE_TAB} value={Actions.Borrow}>
              Borrow
            </TabsTrigger>
            <TabsTrigger className={STYLE_TAB} value={Actions.Repay}>
              Repay
            </TabsTrigger>
          </TabsList>

          {Object.values(Actions).map((action) => (
            <TabsContent key={action} value={action}>
              <div className={STYLE_INPUT_WRAPPER}>
                <div className={STYLE_INPUT_HEADER}>
                  {action} {currentToken.symbol ?? ""}
                  <img className="rounded-full" height={16} width={16} src={currentToken.imageSrc} />
                </div>
                <TokenAmountInput
                  decimals={currentToken.decimals ?? 18}
                  value={textInputValue}
                  maxValue={maxValue}
                  onChange={setTextInputValue}
                  usdPrice={
                    [Actions.SupplyCollateral, Actions.WithdrawCollateral].includes(selectedTab)
                      ? collateralTokenPriceInUSD
                      : loanTokenPriceInUSD
                  }
                />
              </div>
              {approvalTxnConfig ? (
                <TransactionButton
                  variables={approvalTxnConfig}
                  disabled={inputValue === 0n}
                  onTxnReceipt={() => refetchAllowances()}
                >
                  Approve
                </TransactionButton>
              ) : (
                <TransactionButton
                  // @ts-expect-error - Ignore
                  variables={getTxnConfig()}
                  disabled={!inputValue}
                  onTxnReceipt={() => {
                    setTextInputValue("");
                    void refetchBalances();
                  }}
                >
                  {action}
                </TransactionButton>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <div className="border-border mb-8 rounded-lg border bg-white shadow-sm">
        <h3 className="bg-primary -mb-1 rounded-t-lg p-5 text-lg">Your Position</h3>

        <div className="border-border w-full space-y-4 rounded-lg border-t bg-white p-4">
          <div>
            <span className="text-muted-foreground text-xs">Collateral ({collateralToken.symbol})</span>
            <div className="flex items-center gap-2">
              <span className={shouldShowCollateralProjection ? "text-muted-foreground" : "font-medium"}>
                {formatReadableDecimalNumber({ value: parseFloat(userCollateralBalance), maxDecimals: 4 })}
              </span>
              {shouldShowCollateralProjection && (
                <>
                  <span className="text-xl">
                    <ChevronRight />
                  </span>
                  <span className="font-medium">
                    {formatReadableDecimalNumber({ value: parseFloat(projectedCollateralBalance), maxDecimals: 4 })}
                  </span>
                </>
              )}
              <span className="text-muted-foreground text-sm">
                ($
                {formatReadableDecimalNumber({
                  value:
                    (shouldShowCollateralProjection
                      ? parseFloat(projectedCollateralBalance)
                      : parseFloat(userCollateralBalance)) * collateralTokenPriceInUSD,
                  maxDecimals: 2,
                })}
                )
              </span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Borrowed ({loanToken.symbol})</span>
            <div className="flex items-center gap-2">
              <span className={shouldShowBorrowProjection ? "text-muted-foreground" : "font-medium"}>
                {formatReadableDecimalNumber({ value: parseFloat(userBorrowBalance), maxDecimals: 4 })}
              </span>
              {shouldShowBorrowProjection && (
                <>
                  <span className="text-xl">
                    <ChevronRight />
                  </span>
                  <span className="font-medium">
                    {formatReadableDecimalNumber({ value: parseFloat(projectedBorrowBalance), maxDecimals: 4 })}
                  </span>
                </>
              )}
              <span className="text-muted-foreground text-sm">
                ($
                {formatReadableDecimalNumber({
                  value:
                    (shouldShowBorrowProjection ? parseFloat(projectedBorrowBalance) : parseFloat(userBorrowBalance)) *
                    loanTokenPriceInUSD,
                  maxDecimals: 2,
                })}
                )
              </span>
            </div>
          </div>

          <div>
            <span className="text-muted-foreground text-xs">Health Factor</span>
            <div className="flex items-center gap-2">
              <span
                className={`font-medium ${healthFactor < 20 ? "text-red-500" : healthFactor < 50 ? "text-yellow-500" : "text-green-500"}`}
              >
                {formatReadableDecimalNumber({ value: healthFactor, maxDecimals: 1 })}%
              </span>
            </div>
          </div>

          {position?.liquidationPrice !== undefined && position.liquidationPrice !== null && (
            <div>
              <span className="text-muted-foreground text-xs">
                Liquidation Price ({collateralToken.symbol}/{loanToken.symbol})
              </span>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {collateralToken.decimals !== undefined && loanToken.decimals !== undefined
                    ? formatBalanceWithSymbol(
                        position.liquidationPrice,
                        36 + loanToken.decimals - collateralToken.decimals,
                        "",
                        5,
                      )
                    : "－"}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Main Market SubPage Component
export function MarketSubPage() {
  const { address: userAddress } = useAccount();
  const { id: marketId } = useParams();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id ?? 1;

  const {
    borrowMarketsArray: markets,
    marketVaults,
    vaultsData,
  } = useVaults({
    chainId,
    staleTime: STALE_TIME,
    fetchPrices: true,
    userAddress,
  });

  // Get all market IDs from vault allocations (not just borrow markets)
  const allMarketIds = useMemo(() => {
    const ids = new Set<string>();
    vaultsData?.forEach((vaultData) => {
      vaultData.allocations.forEach((allocation) => {
        ids.add(allocation.id);
      });
    });
    return Array.from(ids);
  }, [vaultsData]);

  // Fetch markets for all allocation IDs
  const allMarkets = useMarkets({
    chainId,
    marketIds: allMarketIds as Address[],
    staleTime: STALE_TIME,
    fetchPrices: true,
  });

  const currentMarket =
    markets.find((market) => market.id === marketId) ||
    Object.values(allMarkets).find((market) => market.id === marketId);
  const currentMarketVaults = marketVaults.get(marketId as Address) ?? [];

  // Get user position for this market
  const morpho = useMemo(() => getContractDeploymentInfo(chainId, "Morpho"), [chainId]);
  const { data: positionRaw } = useReadContract({
    address: morpho?.address,
    abi: morphoAbi,
    functionName: "position",
    args: userAddress && marketId ? [marketId as `0x${string}`, userAddress] : undefined,
    query: { enabled: !!userAddress && !!marketId && !!morpho, staleTime: 1 * 60 * 1000 },
  });

  const position = useMemo(() => {
    if (!positionRaw || !currentMarket) return undefined;
    const [supplyShares, borrowShares, collateral] = positionRaw;
    if (supplyShares === 0n && borrowShares === 0n && collateral === 0n) return undefined;

    return new AccrualPosition({ user: userAddress!, supplyShares, borrowShares, collateral }, currentMarket);
  }, [positionRaw, currentMarket, userAddress]);

  const collateralToken = useToken(currentMarket?.params.collateralToken as Address, chainId);
  const loanToken = useToken(currentMarket?.params.loanToken as Address, chainId);

  const [collateralTokenPriceInUSD, setCollateralTokenPriceInUSD] = useState<number | undefined>(undefined);
  const [loanTokenPriceInUSD, setLoanTokenPriceInUSD] = useState<number | undefined>(undefined);

  const { data: usdPrices } = useTokenPrices(
    chainId,
    [collateralToken?.address, loanToken?.address].filter(Boolean) as Address[],
  );

  useEffect(() => {
    if (!usdPrices) return;
    if (collateralToken?.address) {
      setCollateralTokenPriceInUSD(usdPrices[collateralToken.address.toLowerCase() as Address]?.price_usd);
    }
    if (loanToken?.address) {
      setLoanTokenPriceInUSD(usdPrices[loanToken.address.toLowerCase() as Address]?.price_usd);
    }
  }, [usdPrices, collateralToken?.address, loanToken?.address]);

  if (!currentMarket || !collateralToken || !loanToken) return null;

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      <div className="flex h-full grow justify-center pb-16">
        <div className="flex w-full max-w-7xl flex-col gap-10 py-3 lg:flex-row lg:px-5">
          <div className="w-full lg:w-8/12">
            <MarketHeader />
            <MarketTitleSection collateralToken={collateralToken} loanToken={loanToken} />
            <StatsGrid
              market={currentMarket}
              position={position}
              loanTokenPriceInUSD={loanTokenPriceInUSD ?? 0}
              loanToken={loanToken}
            />
            {/* <AboutSection collateralToken={collateralToken} loanToken={loanToken} /> */}
            <MarketDetailsGrid market={currentMarket} collateralToken={collateralToken} loanToken={loanToken} />
            <div className="block lg:hidden">
              <InteractionSection
                marketParams={currentMarket.params}
                market={currentMarket}
                collateralToken={collateralToken}
                loanToken={loanToken}
                position={position}
                collateralTokenPriceInUSD={collateralTokenPriceInUSD ?? 0}
                loanTokenPriceInUSD={loanTokenPriceInUSD ?? 0}
              />
            </div>
            <VaultsSection marketVaults={currentMarketVaults} loanToken={loanToken} chain={chain} />
          </div>

          <div className="hidden w-4/12 lg:block">
            <InteractionSection
              marketParams={currentMarket.params}
              market={currentMarket}
              collateralToken={collateralToken}
              loanToken={loanToken}
              position={position}
              collateralTokenPriceInUSD={collateralTokenPriceInUSD ?? 0}
              loanTokenPriceInUSD={loanTokenPriceInUSD ?? 0}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
