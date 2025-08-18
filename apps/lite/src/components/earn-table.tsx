import { AccrualVault } from "@morpho-org/blue-sdk";
import { AvatarStack } from "@morpho-org/uikit/components/avatar-stack";
import { AvatarImage, AvatarFallback, Avatar } from "@morpho-org/uikit/components/shadcn/avatar";
import {
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Table,
} from "@morpho-org/uikit/components/shadcn/table";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@morpho-org/uikit/components/shadcn/tooltip";
import { useModifierKey } from "@morpho-org/uikit/hooks/use-modifier-key";
import { formatBalanceWithSymbol, Token, formatLtv, abbreviateAddress, getChainSlug } from "@morpho-org/uikit/lib/utils";
import { blo } from "blo";
// @ts-expect-error: this package lacks types
import humanizeDuration from "humanize-duration";
import { ClockAlert, ExternalLink } from "lucide-react";
import { Chain, hashMessage, Address, zeroAddress, formatUnits } from "viem";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router";

import { ApyTableCell } from "@/components/table-cells/apy-table-cell";
import { EarnTableHeader, type EarnTableFilters } from "@/components/filters/earn-table-header";
import { SortableTableHead, type SortDirection, useSorting, createSortHandler } from "@/components/sortable-table-head";
import { type useMerklOpportunities } from "@/hooks/use-merkl-opportunities";
import { useEarnFilters } from "@/hooks/use-earn-filters";
import { MIN_TIMELOCK } from "@/lib/constants";
import { type DisplayableCurators } from "@/lib/curators";
import { getTokenURI } from "@/lib/tokens";

export type Row = {
  vault: AccrualVault;
  asset: Token;
  curators: DisplayableCurators;
  userShares: bigint | undefined;
  imageSrc?: string;
};

function VaultTableCell({
  address,
  symbol,
  imageSrc,
  chain,
  timelock,
}: Token & { chain: Chain | undefined; timelock: bigint }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="hover:bg-secondary hover:text-secondary-foreground flex w-min items-center gap-2 rounded-sm p-2">
            <Avatar className="h-4 w-4 rounded-full">
              <AvatarImage src={imageSrc} alt="Avatar" />
              <AvatarFallback delayMs={1000}>
                <img src={blo(address)} />
              </AvatarFallback>
            </Avatar>
            {symbol ?? "－"}
            {timelock < MIN_TIMELOCK && (
              <ClockAlert height={16} width={16} className="text-morpho-error duration-750 animate-pulse" />
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="text-primary-foreground rounded-3xl p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="underline">Properties</p>
          <p>Timelock: {humanizeDuration(Number(timelock) * 1000)}</p>
          {timelock < MIN_TIMELOCK && (
            <p className="text-morpho-error italic">
              This timelock seems low. Please exercise caution and ask the curator about it if you have questions.
            </p>
          )}
          <br />
          <div className="flex items-center gap-1">
            <p>
              Vault: <code>{abbreviateAddress(address)}</code>
            </p>
            {chain?.blockExplorers?.default.url && (
              <a
                href={`${chain.blockExplorers.default.url}/address/${address}`}
                rel="noopener noreferrer"
                target="_blank"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CuratorTableCell({
  name,
  roles,
  url,
  imageSrc,
  chain,
}: Row["curators"][string] & { chain: Chain | undefined }) {
  return (
    <TooltipProvider>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <div className="hover:bg-secondary hover:text-secondary-foreground ml-[-8px] flex w-min items-center gap-2 rounded-sm p-2">
            <Avatar className="h-4 w-4 rounded-full">
              <AvatarImage src={imageSrc ?? ""} alt="Avatar" />
              <AvatarFallback delayMs={500}>
                <img src={blo(hashMessage(name).padEnd(42, "0").slice(0, 42) as Address)} />
              </AvatarFallback>
            </Avatar>
            {name}
          </div>
        </TooltipTrigger>
        <TooltipContent
          className="text-primary-foreground rounded-3xl p-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* It's possible for a curator to have no onchain roles. In that case, just show their URL. */}
          {roles.length > 0 && (
            <>
              <p className="underline">Roles</p>
              {roles.map((role) => (
                <div className="flex items-center gap-1" key={role.name}>
                  <p>
                    {role.name}: <code>{abbreviateAddress(role.address)}</code>
                  </p>
                  {chain?.blockExplorers?.default.url && (
                    <a
                      href={`${chain.blockExplorers.default.url}/address/${role.address}`}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
              ))}
              <br />
            </>
          )}
          {url != null && (
            <a className="text-blue-500 underline" href={url} rel="noopener noreferrer" target="_blank">
              {url}
            </a>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function CollateralsTableCell({
  vault,
  chain,
  tokens,
}: Pick<Row, "vault"> & { chain: Chain | undefined; tokens: Map<Address, { symbol?: string }> }) {
  const allocations = [...vault.collateralAllocations.entries()].filter(([collateral]) => collateral !== zeroAddress);
  // Sort allocations largest to smallest
  allocations.sort((a, b) => (a[1].proportion > b[1].proportion ? -1 : 1));
  return (
    <AvatarStack
      items={allocations.map(([collateral, allocation]) => {
        const token = tokens.get(collateral);
        const logoUrl = [
          getTokenURI({ symbol: token?.symbol, address: collateral, chainId: chain?.id }),
          blo(collateral),
        ];
        const lltvs = [...allocation.lltvs.values()];
        const oracles = [...allocation.oracles];

        // Sort LLTVs smallest to largest
        lltvs.sort((a, b) => (a > b ? 1 : -1));

        const hoverCardContent = (
          <TooltipContent
            className="text-primary-foreground rounded-3xl p-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex w-[240px] flex-col gap-3">
              <div className="flex items-center justify-between font-light">
                Collateral
                <div className="flex items-end gap-1">
                  <Avatar className="h-4 w-4 rounded-full">
                    <AvatarImage src={logoUrl[0]} alt="Avatar" />
                    <AvatarFallback delayMs={500}>
                      <img src={logoUrl[1]} />
                    </AvatarFallback>
                  </Avatar>
                  {token?.symbol ?? ""}
                </div>
              </div>
              <div className="flex items-center justify-between font-light">
                <span>LLTV</span>
                {lltvs.map((lltv) => formatLtv(lltv)).join(", ")}
              </div>
              <div className="flex items-center justify-between font-light">
                <span>Allocation</span>
                {formatLtv(allocation.proportion)}
              </div>
              <div className="flex items-center justify-between font-light">
                <span>Oracle</span>
                <div className="flex flex-col font-mono">
                  {oracles.map((oracle) => (
                    <a
                      key={oracle}
                      className="flex gap-1"
                      href={chain?.blockExplorers?.default.url.concat(`/address/${oracle}`)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      {abbreviateAddress(oracle)}
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ))}
                </div>
              </div>
            </div>
          </TooltipContent>
        );

        return { logoUrl, hoverCardContent };
      })}
      align="left"
      maxItems={5}
    />
  );
}

export function EarnTable({
  chain,
  rows,
  depositsMode,
  tokens,
  lendingRewards,
}: {
  chain: Chain | undefined;
  rows: Row[];
  depositsMode: "totalAssets" | "userAssets";
  tokens: Map<Address, { decimals?: number; symbol?: string }>;
  lendingRewards: ReturnType<typeof useMerklOpportunities>;
}) {
  const isShiftHeld = useModifierKey("Shift");
  const navigate = useNavigate();

  // Filter state
  const [filters, setFilters] = useState<EarnTableFilters>({
    search: "",
    inWallet: false,
    depositAsset: "all",
    curator: "all",
  });

  // Sort state
  const [sort, setSort] = useState<{ column: string | null; direction: SortDirection }>({
    column: null,
    direction: null,
  });

  // Extract curators from rows for filter options
  const allCurators = useMemo(() => rows.map(row => row.curators), [rows]);

  // Create proper tokens map from rows for filtering
  const assetTokens = useMemo(() => {
    const assetMap = new Map<Address, Token>();
    rows.forEach(row => {
      assetMap.set(row.asset.address.toLowerCase() as Address, row.asset);
    });
    return assetMap;
  }, [rows]);

  // Apply filters
  const filteredRows = useEarnFilters(rows, filters, tokens, chain?.id);

  // Sort handler
  const handleSort = createSortHandler(sort, setSort);

  // Get sort value for a row
  const getSortValue = (row: Row, column: string): number => {
    switch (column) {
      case "deposits":
        const deposits = depositsMode === "userAssets"
          ? row.userShares !== undefined ? row.vault.toAssets(row.userShares) : 0n
          : row.vault.totalAssets;
        return Number(deposits);
      case "apy":
        return Number(row.vault.apy);
      default:
        return 0;
    }
  };

  // Apply sorting
  const sortedRows = useSorting(filteredRows, sort, getSortValue);

  return (
    <div className="md:w-full w-[calc(100vw-50px)]">
      <EarnTableHeader
        filters={filters}
        onFiltersChange={setFilters}
        tokens={assetTokens}
        curators={allCurators}
      />
      <Table className="overflow-x-auto">
        <TableHeader className="bg-primary border-b border-border">
          <TableRow>
            <TableHead className="text-primary-foreground pl-4 text-xs font-light">Vault</TableHead>
            <SortableTableHead 
              sortKey="deposits"
              currentSort={sort}
              onSort={handleSort}
              className="text-primary-foreground text-xs font-light"
            >
              Deposits
            </SortableTableHead>
            <TableHead className="text-primary-foreground text-xs font-light">Curator</TableHead>
            <TableHead className="text-primary-foreground text-xs font-light">Collateral</TableHead>
            <SortableTableHead 
              sortKey="apy"
              currentSort={sort}
              onSort={handleSort}
              className="text-primary-foreground text-xs font-light"
            >
              APY
            </SortableTableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedRows.map((row) => {
            const ownerText = abbreviateAddress(row.vault.owner);
            const deposits =
              depositsMode === "userAssets"
                ? row.userShares !== undefined
                  ? row.vault.toAssets(row.userShares)
                  : undefined
                : row.vault.totalAssets;

            const rewardsVault = lendingRewards.get(row.vault.address) ?? [];
            const rewardsMarkets = [...row.vault.allocations.keys()].flatMap((marketId) =>
              (lendingRewards.get(marketId) ?? []).map((opportunity) => {
                const proportion = parseFloat(formatUnits(row.vault.getAllocationProportion(marketId), 18));
                return {
                  ...opportunity,
                  apr: opportunity.apr * proportion,
                  dailyRewards: opportunity.dailyRewards * proportion,
                };
              }),
            );
            const rewards = rewardsVault.concat(rewardsMarkets);

            return (
              <TableRow 
                key={row.vault.address}
                className="hover:bg-primary border-b border-border cursor-pointer"
                onClick={() => {
                  const chainSlug = chain ? getChainSlug(chain) : 'ethereum';
                  navigate(`/${chainSlug}/vault/${row.vault.address}`);
                }}
              >
                <TableCell className="py-3">
                  <VaultTableCell
                    address={row.vault.address}
                    symbol={row.vault.name}
                    imageSrc={row.imageSrc}
                    chain={chain}
                    timelock={row.vault.timelock}
                  />
                </TableCell>
                <TableCell>
                  {deposits !== undefined && row.asset.decimals !== undefined
                    ? formatBalanceWithSymbol(deposits, row.asset.decimals, row.asset.symbol, 5, true)
                    : "－"}
                </TableCell>
                <TableCell>
                  <div className="flex w-min gap-2">
                    {Object.keys(row.curators).length > 0
                      ? Object.values(row.curators)
                          // By default, only show roles with `shouldAlwaysShow == true`.
                          // When shift key is held, remove filter and show all roles.
                          .filter((curator) => isShiftHeld || curator.shouldAlwaysShow)
                          .map((curator) => <CuratorTableCell key={curator.name} {...curator} chain={chain} />)
                      : ownerText}
                  </div>
                </TableCell>
                <TableCell className="min-w-[120px]">
                  <CollateralsTableCell vault={row.vault} chain={chain} tokens={tokens} />
                </TableCell>
                <TableCell>
                  <ApyTableCell nativeApy={row.vault.apy} fee={row.vault.fee} rewards={rewards} mode="earn" />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
