import { CuratorTableCell } from "@/components/earn-table";
import { useVaults } from "@/hooks/use-vaults";
import { TRANSACTION_DATA_SUFFIX } from "@/lib/constants";
import { DisplayableCurators } from "@/lib/curators";
import { useTokenPrices } from "@/lib/prices";
import { getTokenURI } from "@/lib/tokens";
import { AccrualVault } from "@morpho-org/blue-sdk";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import { formatBalance, formatReadableDecimalNumber, Token } from "@morpho-org/uikit/lib/utils";
import { keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, ChevronRight } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useOutletContext, useParams } from "react-router";
import { Address, Chain, erc20Abi, erc4626Abi, formatUnits, parseUnits } from "viem";
import { useReadContracts } from "wagmi";
import { useAccount, useReadContract } from "wagmi";

enum Actions {
  Deposit = "Deposit",
  Withdraw = "Withdraw",
}

const STALE_TIME = 5 * 60 * 1000;

const STYLE_LABEL = "flex items-center justify-between text-xs font-light";
const STYLE_TAB = "hover:bg-secondary/10 rounded-sm x-5 duration-200 ease-in-out cursor-pointer";
const STYLE_INPUT_WRAPPER = "bg-primary flex flex-col gap-4 rounded-2xl p-4 transition-colors duration-200 ease-in-out";
const STYLE_INPUT_HEADER = "flex items-center justify-between text-xs font-light";

// Header Section Component
function VaultHeader() {
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainSlug = chain?.name.toLowerCase() || "ethereum";

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
          <img src={imageSrc} alt={title} />
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
}: {
  vault: AccrualVault;
  userShare: bigint;
  tokenPriceInUSD: number;
}) {
  const apy = Number(formatUnits(vault.netApy, 18)) * 100;
  const totalDeposits = Number(formatUnits(vault.totalSupply, 18)) * tokenPriceInUSD;
  const liquidity = Number(formatUnits(vault.totalSupply - vault.totalAssets, 18)) * tokenPriceInUSD;
  const yourDeposit = Number(formatUnits(userShare, 18)) * tokenPriceInUSD;

  return (
    <div className="mb-8 grid grid-cols-4 gap-6">
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
        <p className="text-muted-foreground mb-1 text-sm">APY</p>
        <p className="text-2xl font-semibold">{formatReadableDecimalNumber({ value: apy, maxDecimals: 2 })} %</p>
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
function AboutSection() {
  return (
    <div className="mb-8">
      <h2 className="text-lg font-semibold">About the Vault</h2>
      <p className="text-muted-foreground text-sm leading-relaxed">
        Stake your $USDp and start raking in some chill passive earnings with $sUSDp!Stake your $USDp and start raking
        in some chill passive earnings with $sUSDp!Stake your $USDp and start raking in some chill passive earnings with
        $sUSDp!
      </p>
    </div>
  );
}

// Vault Details Grid Component
function VaultDetailsGrid({
  vault,
  asset,
  curators,
  chain,
}: {
  vault: AccrualVault;
  asset: Token;
  curators: DisplayableCurators[];
  chain: Chain;
}) {
  const fee = Number(formatUnits(vault.fee, 18)) * 100;

  return (
    <div className="mb-8 grid grid-cols-3 gap-6">
      <div className="border-border rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-muted-foreground mb-2 text-sm">Vault Token</p>
        <div className="flex items-center gap-2">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
            <span className="text-xs text-white">
              <img src={asset.imageSrc} alt={asset.symbol} className="h-6 w-6" />
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
          {curators && curators.length > 0 ? (
            curators.map((curator) => <span>{curator.name.name}</span>)
          ) : (
            <p>No curators</p>
          )}
        </div>
      </div>
    </div>
  );
}

// Market Allocation Section Component
function MarketAllocationSection() {
  return (
    <div className="mb-8 rounded-lg border bg-white py-6 shadow-sm">
      <div className="mb-6 flex items-center justify-start gap-2 px-5">
        <h2 className="text-xl font-semibold">Market Allocation</h2>
        <span className="bg-secondary/10 text-secondary mt-1 rounded-full px-2 py-1 text-xs">99 Allocation</span>
      </div>

      <div>
        <div className="border-border bg-muted/50 grid grid-cols-4 gap-4 border-b p-4 text-sm font-medium">
          <div className="flex items-center gap-1">
            Vault Name <ChevronDown className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            APY <ChevronDown className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            Allocation (%) <ChevronDown className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1">
            Supply Cap <ChevronDown className="h-4 w-4" />
          </div>
        </div>

        <div className="p-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600">
                <span className="text-xs font-bold text-white">W</span>
              </div>
              <div className="-ml-2 flex h-6 w-6 items-center justify-center rounded-full bg-purple-600">
                <span className="text-xs font-bold text-white">$</span>
              </div>
              <span className="font-medium">wETH / USDp</span>
            </div>
            <div className="bg-secondary/10 text-secondary mt-1 w-fit rounded-full px-2 py-1 text-xs">99.99%</div>
            <div className="text-muted-foreground text-sm">99%</div>
            <div className="text-muted-foreground text-sm">$99.99M</div>
          </div>
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
}: {
  vaultAddress: Address;
  asset: Token;
  userShare: bigint;
  vault: AccrualVault;
  tokenPriceInUSD: number;
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
  const apy = formatUnits(vault.netApy, 18);
  const monthlyEarnings = parseFloat(userBalance) * parseFloat(apy);
  const yearlyEarnings = monthlyEarnings * 12;
  const projectedMonthlyEarningsUSD = parseFloat(projectedBalance) * parseFloat(apy) * (tokenPriceInUSD ?? 0);
  const projectedYearlyEarningsUSD = projectedMonthlyEarningsUSD * 12;
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
                <img className="rounded-full" height={16} width={16} src={asset.imageSrc} />
              </div>
              <TokenAmountInput
                decimals={0}
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
                <img className="rounded-full" height={16} width={16} src={asset.imageSrc} />
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

      <div className="border-border rounded-lg border bg-white shadow-sm">
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
  const { address: vaultAddress } = useParams();
  const { chain } = useOutletContext() as { chain?: Chain };
  const chainId = chain?.id ?? 1;
  const { vaultsData, vaults, markets, userShares, marketVaults } = useVaults({ chainId, staleTime: STALE_TIME });
  const currentVaultData = vaultsData?.find((vault) => vault.vault.vault === vaultAddress);
  const currentVault = vaults?.find((vault) => vault.address === vaultAddress);
  const tokenAddress = currentVaultData?.vault.asset;
  const userShare = userShares[vaultAddress as Address] ?? 0n;
  const currentMarket = markets[currentVaultData?.vault.withdrawQueue[0] as Address];
  const curators = marketVaults.get(currentVaultData?.vault.vault as Address)?.map((vault) => vault.curators);

  const { data: symbol } = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "symbol",
  });
  const { data: tokenDecimals } = useReadContract({
    address: tokenAddress as Address,
    abi: erc20Abi,
    functionName: "decimals",
  });
  const asset = {
    address: tokenAddress as Address,
    symbol: symbol as string,
    decimals: tokenDecimals as number,
    imageSrc: getTokenURI({ symbol: symbol as string, address: tokenAddress as Address, chainId }),
  };

  const [tokenPriceInUSD, setTokenPriceInUSD] = useState<number | undefined>(undefined);
  const { data: usdPrices } = useTokenPrices(chainId, [asset.address]);

  useEffect(() => {
    if (!usdPrices || !asset.address) return;
    setTokenPriceInUSD(usdPrices[asset.address.toLowerCase() as Address]?.price_usd);
  }, [usdPrices, asset.address]);

  if (!currentVault || !currentVaultData) return null;

  return (
    <div className="flex min-h-full w-[calc(100vw-35px)] flex-col px-2.5 md:w-full">
      <div className="flex h-full grow justify-center pb-16">
        <div className="mx-auto flex max-w-7xl gap-10 px-5 py-3">
          <div className="w-8/12">
            <VaultHeader />
            <VaultTitleSection title={currentVaultData.vault.name} imageSrc={asset.imageSrc ?? ""} />
            <StatsGrid
              vault={currentVault as AccrualVault}
              userShare={userShare}
              tokenPriceInUSD={tokenPriceInUSD ?? 0}
            />
            <AboutSection />
            <VaultDetailsGrid
              vault={currentVault as AccrualVault}
              asset={asset}
              curators={curators as DisplayableCurators[]}
              chain={chain as Chain}
            />
            <MarketAllocationSection />
          </div>

          <div className="w-4/12">
            <InteractionSection
              vaultAddress={vaultAddress as Address}
              asset={asset}
              tokenPriceInUSD={tokenPriceInUSD ?? 0}
              userShare={userShare}
              vault={currentVault as AccrualVault}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
