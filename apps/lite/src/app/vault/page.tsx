import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { formatBalance, formatBalanceWithSymbol, Token, formatLtv } from "@morpho-org/uikit/lib/utils";
import { ArrowLeft } from "lucide-react";
import { useMemo } from "react";
import { Address } from "viem";
import { useAccount, useChains } from "wagmi";
import { useNavigate, useParams } from "react-router";

import { useVault } from "@/hooks/use-vault";
import { ApyTableCell } from "@/components/table-cells/apy-table-cell";
import { useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { type DisplayableCurators } from "@/lib/curators";
import { getTokenURI } from "@/lib/tokens";
import { VaultPositionSidebar } from "@/components/vault-position-sidebar";

export function VaultPage() {
  const navigate = useNavigate();
  const { address: vaultAddress } = useParams<{ address: Address }>();
  const { address: userAddress } = useAccount();
  const chains = useChains();
  
  // For now, assume Ethereum mainnet - we'll need to get this from URL params later
  const chainId = 1;
  const chain = chains.find(c => c.id === chainId);

  const { vault, userShares, maxWithdrawAmount, isLoading, refetch } = useVault({
    chainId,
    vaultAddress: vaultAddress!,
    userAddress,
  });

  const lendingRewards = useMerklOpportunities({ chainId });

  // Create asset token object
  const asset = useMemo((): Token | undefined => {
    if (!vault) return undefined;
    
    return {
      address: vault.asset,
      symbol: vault.symbol?.replace(/^s/, ''), // Remove 's' prefix from vault symbol
      decimals: 18, // TODO: Get from token data
      imageSrc: getTokenURI({ symbol: vault.symbol?.replace(/^s/, ''), address: vault.asset, chainId }),
    };
  }, [vault, chainId]);

  // Get rewards data
  const rewards = useMemo(() => {
    if (!vault || !lendingRewards) return [];
    
    const rewardsVault = lendingRewards.get(vault.address) ?? [];
    const rewardsMarkets = [...vault.allocations.keys()].flatMap((marketId) =>
      (lendingRewards.get(marketId) ?? []).map((opportunity) => {
        const proportion = parseFloat(formatLtv(vault.getAllocationProportion(marketId)));
        return {
          ...opportunity,
          apr: opportunity.apr * proportion,
          dailyRewards: opportunity.dailyRewards * proportion,
        };
      }),
    );
    return rewardsVault.concat(rewardsMarkets);
  }, [vault, lendingRewards]);

  if (isLoading || !vault || !asset) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const userDeposit = userShares && asset.decimals !== undefined 
    ? vault.toAssets(userShares)
    : 0n;

  const liquidity = vault.totalAssets - vault.totalBorrowed;

  return (
    <div className="min-h-screen bg-[#F5F5F5] p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate(-1)}
              className="p-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-purple-500 flex items-center justify-center">
                <span className="text-white text-sm font-semibold">$</span>
              </div>
              <h1 className="text-2xl font-semibold">{vault.name}</h1>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="rounded-full">
              Deposit
            </Button>
            <Button variant="outline" className="rounded-full">
              Withdraw
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Total Deposits</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {asset.decimals !== undefined 
                      ? `$${formatBalance(vault.totalAssets, asset.decimals, 2)}M`
                      : "－"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Liquidity</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {asset.decimals !== undefined 
                      ? `$${formatBalance(liquidity, asset.decimals, 2)}M`
                      : "－"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">APY</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-semibold">
                    <ApyTableCell nativeApy={vault.apy} fee={vault.fee} rewards={rewards} mode="earn" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Your Deposit</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold">
                    {asset.decimals !== undefined 
                      ? `$${formatBalance(userDeposit, asset.decimals, 2)}`
                      : "－"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* About the Vault */}
            <Card>
              <CardHeader>
                <CardTitle>About the Vault</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Stake your ${asset.symbol}p and start raking in some chill passive earnings with $s{asset.symbol}P! 
                  Stake your ${asset.symbol}p and start raking in some chill passive earnings with $s{asset.symbol}P! 
                  Stake your ${asset.symbol}p and start raking in some chill passive earnings with $s{asset.symbol}P!
                </p>
              </CardContent>
            </Card>

            {/* Vault Details */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Vault Token</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                      <span className="text-white text-xs">$</span>
                    </div>
                    <span className="font-medium">{asset.symbol}p</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Performance Fee</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-medium">{formatLtv(vault.fee)}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-gray-500">Curator</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full bg-green-600"></div>
                    <span className="font-medium">Steakhouse Financial</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Market Allocation */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Market Allocation</CardTitle>
                <span className="text-sm text-gray-500">1 Allocation</span>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 text-sm text-gray-500">Vault Name</th>
                        <th className="text-left py-2 text-sm text-gray-500">APY</th>
                        <th className="text-left py-2 text-sm text-gray-500">Allocation (%)</th>
                        <th className="text-left py-2 text-sm text-gray-500">Supply Cap</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vault.allocations.map((allocation, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
                              <div className="w-4 h-4 rounded-full bg-purple-500 -ml-2"></div>
                              <span>wETH / {asset.symbol}p</span>
                            </div>
                          </td>
                          <td className="py-3">
                            <span className="text-purple-600">5.53%</span>
                          </td>
                          <td className="py-3">100%</td>
                          <td className="py-3">$3.25M</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Position Sidebar */}
          <div className="lg:col-span-1">
            <VaultPositionSidebar 
              vaultAddress={vaultAddress!}
              asset={asset}
              userDeposit={userDeposit}
              onTransactionComplete={refetch}
            />
          </div>
        </div>
      </div>
    </div>
  );
}