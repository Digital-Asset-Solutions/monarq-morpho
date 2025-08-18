import { AccrualVault } from "@morpho-org/blue-sdk";
import { AvatarStack } from "@morpho-org/uikit/components/avatar-stack";
import { Avatar, AvatarFallback, AvatarImage } from "@morpho-org/uikit/components/shadcn/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@morpho-org/uikit/components/shadcn/table";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@morpho-org/uikit/components/shadcn/tooltip";
import { formatLtv, abbreviateAddress } from "@morpho-org/uikit/lib/utils";
import { blo } from "blo";
import { ExternalLink } from "lucide-react";
import { Chain, Address, zeroAddress } from "viem";

import { getTokenURI } from "@/lib/tokens";

interface AllocationTableProps {
  vault: AccrualVault;
  chain: Chain | undefined;
  tokens: Map<Address, { symbol?: string; decimals?: number }>;
}

export function AllocationTable({ vault, chain, tokens }: AllocationTableProps) {
  const allocations = [...vault.collateralAllocations.entries()].filter(([collateral]) => collateral !== zeroAddress);
  
  // Sort allocations largest to smallest
  allocations.sort((a, b) => (a[1].proportion > b[1].proportion ? -1 : 1));

  if (allocations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Market Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-secondary-foreground">No allocations found.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Market Allocation</CardTitle>
        <p className="text-sm text-secondary-foreground">
          {allocations.length} Allocation{allocations.length !== 1 ? 's' : ''}
        </p>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vault Name</TableHead>
              <TableHead>APY</TableHead>
              <TableHead>Allocation (%)</TableHead>
              <TableHead>Supply Cap</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allocations.map(([collateral, allocation]) => {
              const token = tokens.get(collateral);
              const logoUrl = [
                getTokenURI({ symbol: token?.symbol, address: collateral, chainId: chain?.id }),
                blo(collateral),
              ];
              const lltvs = [...allocation.lltvs.values()];
              const oracles = [...allocation.oracles];

              // Sort LLTVs smallest to largest
              lltvs.sort((a, b) => (a > b ? 1 : -1));

              // Create a pair name like "wETH / USDp"
              const pairName = `${token?.symbol ?? 'Unknown'} / ${vault.asset?.symbol ?? 'Unknown'}`;

              return (
                <TableRow key={collateral}>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex items-center gap-2 cursor-pointer">
                            <Avatar className="h-6 w-6 rounded-full">
                              <AvatarImage src={logoUrl[0]} alt="Collateral" />
                              <AvatarFallback delayMs={500}>
                                <img src={logoUrl[1]} />
                              </AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{pairName}</span>
                          </div>
                        </TooltipTrigger>
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
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                  <TableCell>
                    <span className="text-green-600 font-medium">
                      {/* We'll need to calculate this based on market data */}
                      {lltvs.length > 0 ? formatLtv(lltvs[0]) : "－"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">
                      {formatLtv(allocation.proportion)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-secondary-foreground">
                      {/* This would need market cap data */}
                      $3.25M
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
