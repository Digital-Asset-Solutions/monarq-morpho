import { AccrualVault, Vault, VaultMarketAllocation, VaultMarketConfig, VaultMarketPublicAllocatorConfig, AccrualPosition, MarketId } from "@morpho-org/blue-sdk";
import { metaMorphoFactoryAbi } from "@morpho-org/uikit/assets/abis/meta-morpho-factory";
import { CORE_DEPLOYMENTS, getContractDeploymentInfo } from "@morpho-org/uikit/lib/deployments";
import { readAccrualVaults, readAccrualVaultsStateOverride } from "@morpho-org/uikit/lens/read-vaults";
import { tac } from "@morpho-org/uikit/lib/chains/tac";
import { useOutletContext, useParams, useNavigate } from "react-router";
import { Address, Chain, erc20Abi, zeroAddress } from "viem";
import { useMemo } from "react";
import { useAccount, useReadContract, useReadContracts } from "wagmi";

import { VaultDetailPage } from "@/components/vault-detail-page";
import { useMarkets } from "@/hooks/use-markets";
import { useTopNCurators } from "@/hooks/use-top-n-curators";
import { getDisplayableCurators, type DisplayableCurators } from "@/lib/curators";
import useContractEvents from "@morpho-org/uikit/hooks/use-contract-events/use-contract-events";

interface VaultPageContext {
  chain: Chain;
}

const STALE_TIME = 5 * 60 * 1000; // 5 minutes

export default function VaultPage() {
  const { address } = useParams<{ address: Address }>();
  const navigate = useNavigate();
  const { chain } = useOutletContext<VaultPageContext>();
  const chainId = chain?.id;
  const { address: userAddress } = useAccount();
  
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

  // Find the specific vault data
  const specificVaultData = useMemo(() => {
    if (!address || !vaultsData) return null;
    
    return vaultsData.find((vaultData) => 
      vaultData.vault.vault.toLowerCase() === address.toLowerCase()
    );
  }, [address, vaultsData]);

  // Get market IDs for this vault
  const marketIds = useMemo(() => {
    if (!specificVaultData) return [];
    return [...new Set(specificVaultData.vault.withdrawQueue)];
  }, [specificVaultData]);

  const markets = useMarkets({ chainId, marketIds, staleTime: STALE_TIME });

  // Build the vault instance
  const vault = useMemo(() => {
    if (!specificVaultData || !markets) return null;

    const { vault: vaultAddress, supplyQueue, withdrawQueue, ...iVault } = specificVaultData.vault;
    
    const vaultInstance = new Vault({
      ...iVault,
      address: vaultAddress,
      supplyQueue: supplyQueue as MarketId[],
      withdrawQueue: withdrawQueue as MarketId[],
      pendingOwner: zeroAddress,
      pendingGuardian: { value: zeroAddress, validAt: 0n },
      pendingTimelock: { value: 0n, validAt: 0n },
    });

    if (vaultInstance.name === "" || specificVaultData.allocations.some((allocation) => markets[allocation.id] === undefined)) {
      return null;
    }

    const allocations = specificVaultData.allocations.map((allocation) => {
      const market = markets[allocation.id];

      return new VaultMarketAllocation({
        config: new VaultMarketConfig({
          vault: vaultAddress,
          marketId: allocation.id as MarketId,
          cap: allocation.config.cap,
          pendingCap: { value: 0n, validAt: 0n },
          removableAt: allocation.config.removableAt,
          enabled: allocation.config.enabled,
          publicAllocatorConfig: new VaultMarketPublicAllocatorConfig({
            vault: vaultAddress,
            marketId: allocation.id as MarketId,
            maxIn: 0n,
            maxOut: 0n,
          }),
        }),
        position: new AccrualPosition({ user: vaultAddress, ...allocation.position }, market),
      });
    });

    return new AccrualVault(vaultInstance, allocations);
  }, [specificVaultData, markets]);

  // Get token addresses from the vault
  const tokenAddresses = useMemo(() => {
    if (!vault) return [];
    return [vault.asset];
  }, [vault]);

  // Fetch token data
  const { data: tokenData } = useReadContracts({
    contracts: tokenAddresses.flatMap((tokenAddress) => [
      { chainId, address: tokenAddress, abi: erc20Abi, functionName: "symbol" } as const,
      { chainId, address: tokenAddress, abi: erc20Abi, functionName: "decimals" } as const,
    ]),
    allowFailure: true,
    query: { staleTime: Infinity, gcTime: Infinity, enabled: tokenAddresses.length > 0 },
  });

  const tokens = useMemo(() => {
    const map = new Map<Address, { decimals?: number; symbol?: string }>();
    tokenAddresses.forEach((tokenAddress, idx) => {
      const symbol = tokenData?.[idx * 2 + 0]?.result as string | undefined;
      const decimals = tokenData?.[idx * 2 + 1]?.result as number | undefined;
      map.set(tokenAddress, { decimals, symbol });
    });
    return map;
  }, [tokenAddresses, tokenData]);

  // Build the final vault data
  const vaultData = useMemo(() => {
    if (!address || !vault || !specificVaultData) return null;
    
    const asset = tokens.get(vault.asset);
    const vaultCurators = getDisplayableCurators({ ...specificVaultData.vault, address: specificVaultData.vault.vault }, topCurators);
    
    return {
      vault,
      asset: asset ? {
        address: vault.asset,
        symbol: asset.symbol,
        decimals: asset.decimals,
        imageSrc: `https://cdn.morpho.org/assets/images/icons/${asset.symbol?.toLowerCase()}.svg`,
      } : {
        address: vault.asset,
        symbol: undefined,
        decimals: undefined,
        imageSrc: undefined,
      },
      curators: vaultCurators,
    };
  }, [address, vault, specificVaultData, tokens, topCurators]);

  const handleBack = () => {
    navigate(-1);
  };

  if (!vaultData) {
    return (
      <div className="container mx-auto px-4 py-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-4">Vault not found</h1>
          <p className="text-secondary-foreground mb-4">
            The vault with address {address} was not found.
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
    <VaultDetailPage
      vault={vaultData.vault}
      asset={vaultData.asset}
      chain={chain}
      curators={vaultData.curators}
      tokens={tokens}
      onBack={handleBack}
      refetchPositions={() => {
        // Refetch can be implemented here if needed
      }}
    />
  );
}
