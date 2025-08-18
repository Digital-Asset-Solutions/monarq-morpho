import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@morpho-org/uikit/components/shadcn/tabs";
import { TokenAmountInput } from "@morpho-org/uikit/components/token-amount-input";
import { TransactionButton } from "@morpho-org/uikit/components/transaction-button";
import { formatBalance, Token } from "@morpho-org/uikit/lib/utils";
import { useState } from "react";
import { parseUnits } from "viem";

interface PositionSidebarProps {
  title: string;
  token: Token;
  userPosition?: bigint;
  onTransactionComplete?: () => void;
  children: React.ReactNode;
}

export function PositionSidebar({ 
  title, 
  token, 
  userPosition, 
  onTransactionComplete,
  children 
}: PositionSidebarProps) {
  return (
    <Card className="h-fit">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* User Position Display */}
        <div className="bg-primary/10 rounded-lg p-4">
          <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
            <span>Your Position ({token.symbol})</span>
            <img className="h-4 w-4 rounded-full" src={token.imageSrc} alt={token.symbol} />
          </div>
          <div className="text-lg font-semibold">
            {userPosition !== undefined && token.decimals !== undefined
              ? formatBalance(userPosition, token.decimals, 5)
              : "－"}
          </div>
        </div>

        {/* Transaction Interface */}
        {children}
      </CardContent>
    </Card>
  );
}

interface VaultTransactionInterfaceProps {
  token: Token;
  userPosition?: bigint;
  maxWithdraw?: bigint;
  userBalance?: bigint;
  allowance?: bigint;
  onTransactionComplete?: () => void;
  approvalTxnConfig?: any;
  depositTxnConfig?: any;
  withdrawTxnConfig?: any;
}

export function VaultTransactionInterface({
  token,
  userPosition,
  maxWithdraw,
  userBalance,
  allowance,
  onTransactionComplete,
  approvalTxnConfig,
  depositTxnConfig,
  withdrawTxnConfig
}: VaultTransactionInterfaceProps) {
  const [textInputValue, setTextInputValue] = useState("");
  const [selectedTab, setSelectedTab] = useState("Deposit");

  const inputValue = token.decimals !== undefined ? parseUnits(textInputValue, token.decimals) : undefined;

  return (
    <PositionSidebar
      title="Your Position"
      token={token}
      userPosition={userPosition}
      onTransactionComplete={onTransactionComplete}
    >
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="Deposit">Deposit</TabsTrigger>
          <TabsTrigger value="Withdraw">Withdraw</TabsTrigger>
        </TabsList>

        <TabsContent value="Deposit" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Deposit {token.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={token.imageSrc} alt={token.symbol} />
            </div>
            <TokenAmountInput
              decimals={token.decimals}
              value={textInputValue}
              maxValue={userBalance}
              onChange={setTextInputValue}
            />
          </div>
          {approvalTxnConfig && selectedTab === "Deposit" ? (
            <TransactionButton
              variables={approvalTxnConfig}
              disabled={inputValue === 0n}
              onTxnReceipt={onTransactionComplete}
            >
              Approve
            </TransactionButton>
          ) : (
            <TransactionButton
              variables={depositTxnConfig}
              disabled={!inputValue || (userBalance !== undefined && inputValue > userBalance)}
              onTxnReceipt={onTransactionComplete}
            >
              Deposit
            </TransactionButton>
          )}
        </TabsContent>

        <TabsContent value="Withdraw" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Withdraw {token.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={token.imageSrc} alt={token.symbol} />
            </div>
            <TokenAmountInput
              decimals={token.decimals}
              value={textInputValue}
              maxValue={maxWithdraw}
              onChange={setTextInputValue}
            />
          </div>
          <TransactionButton
            variables={withdrawTxnConfig}
            disabled={!inputValue || (maxWithdraw !== undefined && inputValue > maxWithdraw)}
            onTxnReceipt={onTransactionComplete}
          >
            Withdraw
          </TransactionButton>
        </TabsContent>
      </Tabs>
    </PositionSidebar>
  );
}

interface MarketTransactionInterfaceProps {
  collateralToken: Token;
  loanToken: Token;
  userCollateral?: bigint;
  userBorrowed?: bigint;
  maxBorrow?: bigint;
  userCollateralBalance?: bigint;
  userLoanBalance?: bigint;
  allowances?: [bigint, bigint];
  onTransactionComplete?: () => void;
  supplyTxnConfig?: any;
  withdrawTxnConfig?: any;
  borrowTxnConfig?: any;
  repayTxnConfig?: any;
  approvalTxnConfigs?: [any?, any?];
}

export function MarketTransactionInterface({
  collateralToken,
  loanToken,
  userCollateral,
  userBorrowed,
  maxBorrow,
  userCollateralBalance,
  userLoanBalance,
  allowances,
  onTransactionComplete,
  supplyTxnConfig,
  withdrawTxnConfig,
  borrowTxnConfig,
  repayTxnConfig,
  approvalTxnConfigs
}: MarketTransactionInterfaceProps) {
  const [textInputValue, setTextInputValue] = useState("");
  const [selectedTab, setSelectedTab] = useState("Supply");

  const inputValue = 
    selectedTab === "Supply" || selectedTab === "Withdraw" 
      ? (collateralToken.decimals !== undefined ? parseUnits(textInputValue, collateralToken.decimals) : undefined)
      : (loanToken.decimals !== undefined ? parseUnits(textInputValue, loanToken.decimals) : undefined);

  const currentToken = selectedTab === "Supply" || selectedTab === "Withdraw" ? collateralToken : loanToken;
  const currentApprovalConfig = selectedTab === "Supply" ? approvalTxnConfigs?.[0] : approvalTxnConfigs?.[1];

  return (
    <PositionSidebar
      title="Your Position"
      token={collateralToken}
      userPosition={userCollateral}
      onTransactionComplete={onTransactionComplete}
    >
      <Tabs value={selectedTab} onValueChange={setSelectedTab}>
        <TabsList className="grid w-full grid-cols-4 text-xs">
          <TabsTrigger value="Supply">Supply</TabsTrigger>
          <TabsTrigger value="Withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="Borrow">Borrow</TabsTrigger>
          <TabsTrigger value="Repay">Repay</TabsTrigger>
        </TabsList>

        <TabsContent value="Supply" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Supply {collateralToken.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={collateralToken.imageSrc} alt={collateralToken.symbol} />
            </div>
            <TokenAmountInput
              decimals={collateralToken.decimals}
              value={textInputValue}
              maxValue={userCollateralBalance}
              onChange={setTextInputValue}
            />
          </div>
          {currentApprovalConfig ? (
            <TransactionButton
              variables={currentApprovalConfig}
              disabled={inputValue === 0n}
              onTxnReceipt={onTransactionComplete}
            >
              Approve
            </TransactionButton>
          ) : (
            <TransactionButton
              variables={supplyTxnConfig}
              disabled={!inputValue || (userCollateralBalance !== undefined && inputValue > userCollateralBalance)}
              onTxnReceipt={onTransactionComplete}
            >
              Supply Collateral
            </TransactionButton>
          )}
        </TabsContent>

        <TabsContent value="Withdraw" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Withdraw {collateralToken.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={collateralToken.imageSrc} alt={collateralToken.symbol} />
            </div>
            <TokenAmountInput
              decimals={collateralToken.decimals}
              value={textInputValue}
              maxValue={userCollateral}
              onChange={setTextInputValue}
            />
          </div>
          <TransactionButton
            variables={withdrawTxnConfig}
            disabled={!inputValue || (userCollateral !== undefined && inputValue > userCollateral)}
            onTxnReceipt={onTransactionComplete}
          >
            Withdraw Collateral
          </TransactionButton>
        </TabsContent>

        <TabsContent value="Borrow" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Borrow {loanToken.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={loanToken.imageSrc} alt={loanToken.symbol} />
            </div>
            <TokenAmountInput
              decimals={loanToken.decimals}
              value={textInputValue}
              maxValue={maxBorrow}
              onChange={setTextInputValue}
            />
          </div>
          <TransactionButton
            variables={borrowTxnConfig}
            disabled={!inputValue}
            onTxnReceipt={onTransactionComplete}
          >
            Borrow
          </TransactionButton>
        </TabsContent>

        <TabsContent value="Repay" className="space-y-4">
          <div className="bg-primary/5 rounded-lg p-4">
            <div className="flex items-center justify-between text-sm text-secondary-foreground mb-2">
              <span>Repay {loanToken.symbol}</span>
              <img className="h-4 w-4 rounded-full" src={loanToken.imageSrc} alt={loanToken.symbol} />
            </div>
            <TokenAmountInput
              decimals={loanToken.decimals}
              value={textInputValue}
              maxValue={userBorrowed}
              onChange={setTextInputValue}
            />
          </div>
          {currentApprovalConfig ? (
            <TransactionButton
              variables={currentApprovalConfig}
              disabled={inputValue === 0n}
              onTxnReceipt={onTransactionComplete}
            >
              Approve
            </TransactionButton>
          ) : (
            <TransactionButton
              variables={repayTxnConfig}
              disabled={!inputValue || (userLoanBalance !== undefined && inputValue > userLoanBalance)}
              onTxnReceipt={onTransactionComplete}
            >
              Repay
            </TransactionButton>
          )}
        </TabsContent>
      </Tabs>
    </PositionSidebar>
  );
}
