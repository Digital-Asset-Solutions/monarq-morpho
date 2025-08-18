import { Card, CardContent } from "@morpho-org/uikit/components/shadcn/card";
import { formatBalanceWithSymbol, formatLtv } from "@morpho-org/uikit/lib/utils";

interface MetricCardProps {
  title: string;
  value: string;
  className?: string;
}

function MetricCard({ title, value, className }: MetricCardProps) {
  return (
    <Card className={className}>
      <CardContent className="p-6">
        <div className="text-sm text-secondary-foreground mb-2">{title}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

interface VaultMetricsProps {
  totalDeposits: bigint;
  liquidity: bigint;
  apy: bigint;
  userDeposit?: bigint;
  assetDecimals?: number;
  assetSymbol?: string;
}

export function VaultMetrics({ 
  totalDeposits, 
  liquidity, 
  apy, 
  userDeposit,
  assetDecimals,
  assetSymbol 
}: VaultMetricsProps) {
  const formatValue = (value: bigint) =>
    assetDecimals !== undefined 
      ? formatBalanceWithSymbol(value, assetDecimals, assetSymbol, 2, true)
      : "－";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <MetricCard
        title="Total Deposits"
        value={formatValue(totalDeposits)}
      />
      <MetricCard
        title="Liquidity"
        value={formatValue(liquidity)}
      />
      <MetricCard
        title="APY"
        value={formatLtv(apy)}
      />
      <MetricCard
        title="Your Deposit"
        value={userDeposit !== undefined ? formatValue(userDeposit) : "－"}
      />
    </div>
  );
}

interface MarketMetricsProps {
  lltv: bigint;
  liquidity: bigint;
  borrowRate: bigint;
  userCollateral?: bigint;
  userBorrowed?: bigint;
  collateralDecimals?: number;
  collateralSymbol?: string;
  loanDecimals?: number;
  loanSymbol?: string;
}

export function MarketMetrics({
  lltv,
  liquidity,
  borrowRate,
  userCollateral,
  userBorrowed,
  collateralDecimals,
  collateralSymbol,
  loanDecimals,
  loanSymbol
}: MarketMetricsProps) {
  const formatCollateral = (value: bigint) =>
    collateralDecimals !== undefined
      ? formatBalanceWithSymbol(value, collateralDecimals, collateralSymbol, 2, true)
      : "－";

  const formatLoan = (value: bigint) =>
    loanDecimals !== undefined
      ? formatBalanceWithSymbol(value, loanDecimals, loanSymbol, 2, true)
      : "－";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <MetricCard
        title="LLTV"
        value={formatLtv(lltv)}
      />
      <MetricCard
        title="Liquidity"
        value={formatLoan(liquidity)}
      />
      <MetricCard
        title="Borrow Rate"
        value={formatLtv(borrowRate)}
      />
      <MetricCard
        title="Your Collateral"
        value={userCollateral !== undefined ? formatCollateral(userCollateral) : "－"}
      />
      <MetricCard
        title="Your Borrowed"
        value={userBorrowed !== undefined ? formatLoan(userBorrowed) : "－"}
      />
    </div>
  );
}
