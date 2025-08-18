import { MarketId } from "@morpho-org/blue-sdk";
import { metaMorphoFactoryAbi } from "@morpho-org/uikit/assets/abis/meta-morpho-factory";
import { CORE_DEPLOYMENTS, getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { tac } from "@morpho-org/uikit/lib/chains/tac";
import { useOutletContext, useParams, useNavigate } from "react-router";
import { Chain, Hex, Address, erc20Abi } from "viem";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { MarketDetailPage } from "@/components/market-detail-page";
import { useMarkets } from "@/hooks/use-markets";
import { useTopNCurators } from "@/hooks/use-top-n-curators";
import { getDisplayableCurators, type DisplayableCurators } from "@/lib/curators";
import { getTokenURI } from "@/lib/tokens";
import useContractEvents from "@morpho-org/uikit/hooks/use-contract-events/use-contract-events";

interface MarketPageContext {
  chain: Chain;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export default function MarketPage() {
  const { id } = useParams<{ id: MarketId }>();
  const navigate = useNavigate();
  const { chain } = useOutletContext<MarketPageContext>();
  const chainId = chain?.id;
  const { address: userAddress } = useAccount(); // Not currently used but may be needed for user-specific data
  
  const [morpho, factory, factoryV1_1] = useMemo(
    () => [
      getContractDeploymentInfo(chainId, "Morpho"),
      getContractDeploymentInfo(chainId, "MetaMorphoFactory"),
      getContractDeploymentInfo(chainId, "MetaMorphoV1_1Factory"),
    ],
    [chainId],
  );

  // MARK: Index `MetaMorphoFactory.CreateMetaMorpho` on all factory versions to get a list of all vault addresses
  const {
    logs: { all: createMetaMorphoEvents },
    fractionFetched,
  } = useContractEvents({
    chainId,
    abi: metaMorphoFactoryAbi,
    address: factoryV1_1 ? [factoryV1_1.address].concat(factory ? [factory.address] : []) : [],
    fromBlock: factory?.fromBlock ?? factoryV1_1?.fromBlock,
    reverseChronologicalOrder: true,
    eventName: "CreateMetaMorpho",
    strict: true,
    query: { enabled: chainId !== undefined },
  });
  
  const topCurators = useTopNCurators({ n: "all", verifiedOnly: true, chainIds: [...CORE_DEPLOYMENTS] });
  const { data: vaultsData } = useReadContract({
    chainId,
    ...readAccrualVaults(
      morpho?.address ?? "0x",
      createMetaMorphoEvents.map((ev) => ev.args.metaMorpho),
      topCurators.flatMap((curator) => curator.addresses?.map((entry) => entry.address as Address) ?? []),
      // @ts-expect-error function signature overloading was meant for hard-coded `true` or `false`
      chainId === tac.id,
    ),
    stateOverride: chainId === tac.id ? undefined : [readAccrualVaultsStateOverride()],
    query: {
      enabled: chainId !== undefined && fractionFetched > 0.99 && !!morpho?.address,
      staleTime: STALE_TIME,
      gcTime: Infinity,
      notifyOnChangeProps: ["data"],
    },
  });

  // For now, if we have a specific market ID, create a minimal marketIds array
  const marketIds = useMemo(() => {
    if (id) return [id];
    return [];
  }, [id]);

  const markets = useMarkets({ chainId, marketIds, staleTime: STALE_TIME, fetchPrices: true });
  
  // Find the specific market
  const market = markets[id as Hex];
  
  // Build tokens map for this specific market
  const { data: erc20Data } = useReadContracts({
    contracts: market ? [
      { chainId, address: market.params.collateralToken, abi: erc20Abi, functionName: "symbol" } as const,
      { chainId, address: market.params.loanToken, abi: erc20Abi, functionName: "symbol" } as const,
      { chainId, address: market.params.collateralToken, abi: erc20Abi, functionName: "decimals" } as const,
      { chainId, address: market.params.loanToken, abi: erc20Abi, functionName: "decimals" } as const,
    ] : [],
    allowFailure: true,
    query: { staleTime: Infinity, gcTime: Infinity, enabled: !!market },
  });

  const tokens = useMemo(() => {
    const map = new Map<Address, { address: Address; symbol?: string; decimals?: number; imageSrc?: string }>();
    if (market && erc20Data) {
      const collateralSymbol = erc20Data[0]?.result;
      const loanSymbol = erc20Data[1]?.result;
      const collateralDecimals = erc20Data[2]?.result;
      const loanDecimals = erc20Data[3]?.result;
      
      map.set(market.params.collateralToken, {
        address: market.params.collateralToken,
        symbol: collateralSymbol,
        decimals: collateralDecimals,
        imageSrc: getTokenURI({ symbol: collateralSymbol, address: market.params.collateralToken, chainId }),
      });
      map.set(market.params.loanToken, {
        address: market.params.loanToken,
        symbol: loanSymbol,
        decimals: loanDecimals,
        imageSrc: getTokenURI({ symbol: loanSymbol, address: market.params.loanToken, chainId }),
      });
    }
    return map;
  }, [market, erc20Data, chainId]);

  // Build marketVaults mapping
  const marketVaults = useMemo(() => {
    if (!vaultsData || !market) return [];
    
    const vaults: { name: string; address: Address; totalAssets: bigint; curators: DisplayableCurators }[] = [];
    
    vaultsData.forEach((vaultData) => {
      vaultData.allocations.forEach((allocation) => {
        if (allocation.id === market.id && allocation.config.enabled && allocation.position.supplyShares > 0n) {
          vaults.push({
            name: vaultData.vault.name,
            address: vaultData.vault.vault,
            totalAssets: vaultData.vault.totalAssets,
            curators: getDisplayableCurators({ ...vaultData.vault, address: vaultData.vault.vault }, topCurators),
          });
        }
      });
    });
    
    return vaults;
  }, [vaultsData, market, topCurators]);

  // Find the market data
  const marketData = useMemo(() => {
    if (!id || !market) return null;
    
    const collateralToken = tokens.get(market.params.collateralToken);
    const loanToken = tokens.get(market.params.loanToken);
    
    if (!collateralToken || !loanToken) return null;
    
    return {
      market,
      collateralToken,
      loanToken,
      marketVaults,
    };
  }, [id, market, tokens, marketVaults]);

  const handleBack = () => {
    navigate(-1);
  };

  if (!marketData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Market not found</h1>
          <p className="text-secondary-foreground mb-4">
            The market with ID {id} was not found.
          </p>
          <button 
            onClick={handleBack}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <MarketDetailPage
      market={marketData.market}
      collateralToken={marketData.collateralToken}
      loanToken={marketData.loanToken}
      chain={chain}
      marketVaults={marketData.marketVaults}
      onBack={handleBack}
      refetchPositions={() => {
        // Refetch can be implemented here if needed
      }}
    />
  );
}
