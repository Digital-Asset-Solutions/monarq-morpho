import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@morpho-org/uikit/components/shadcn/card";
import { Skeleton } from "@morpho-org/uikit/components/shadcn/skeleton";
import { ConnectKitButton } from "connectkit";
import { Clock, Droplet } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { erc20Abi, formatUnits } from "viem";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";

import { FAUCET_ABI, FAUCET_CONTRACT_ADDRESS, FAUCET_TOKENS, FaucetToken } from "@/lib/faucet";
import { getTokenURI } from "@/lib/tokens";

interface TokenCardProps {
  token: FaucetToken;
  chainId?: number;
}

function TokenCard({ token, chainId }: TokenCardProps) {
  const { address: userAddress } = useAccount();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);

  // Read token amount from contract
  const { data: tokenAmount, isLoading: isLoadingAmount } = useReadContract({
    address: FAUCET_CONTRACT_ADDRESS,
    abi: FAUCET_ABI,
    functionName: "tokenAmounts",
    args: [token.address],
  });

  // Read if user can mint
  const { data: canMintData, refetch: refetchCanMint } = useReadContract({
    address: FAUCET_CONTRACT_ADDRESS,
    abi: FAUCET_ABI,
    functionName: "canMint",
    args: userAddress ? [userAddress, token.address] : undefined,
    query: {
      enabled: !!userAddress,
    },
  });

  // Read remaining cooldown
  const { data: remainingCooldown, refetch: refetchCooldown } = useReadContract({
    address: FAUCET_CONTRACT_ADDRESS,
    abi: FAUCET_ABI,
    functionName: "getRemainingCooldown",
    args: userAddress ? [userAddress, token.address] : undefined,
    query: {
      enabled: !!userAddress,
      refetchInterval: 1000, // Refetch every second
    },
  });

  // Read faucet contract balance for this token
  const { data: faucetBalance, refetch: refetchBalance } = useReadContract({
    address: token.address,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [FAUCET_CONTRACT_ADDRESS],
    query: {
      refetchInterval: 5000, // Refetch every 5 seconds
    },
  });

  const { writeContract, data: hash, isPending: isWritePending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  useEffect(() => {
    if (remainingCooldown) {
      setTimeRemaining(Number(remainingCooldown));
    }
  }, [remainingCooldown]);

  useEffect(() => {
    if (isConfirmed) {
      toast.success(`${formatUnits(tokenAmount || 0n, token.decimals)} ${token.symbol} minted successfully!`);
      void refetchCanMint();
      void refetchCooldown();
      void refetchBalance();
    }
  }, [isConfirmed, tokenAmount, token.decimals, token.symbol, refetchCanMint, refetchCooldown, refetchBalance]);

  const handleMint = () => {
    writeContract({
      address: FAUCET_CONTRACT_ADDRESS,
      abi: FAUCET_ABI,
      functionName: "mint",
      args: [token.address],
    });
  };

  const formatTimeRemaining = (seconds: number): string => {
    if (seconds <= 0) return "Ready to mint";
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${minutes}m ${secs}s`;
  };

  const canMint = canMintData === true;
  const isPending = isWritePending || isConfirming;

  const tokenLogoURI = getTokenURI({ symbol: token.symbol, address: token.address, chainId });

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <CardHeader className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950">
        <div className="flex items-center gap-4">
          {tokenLogoURI && (
            <img src={tokenLogoURI} alt={token.symbol} className="h-12 w-12 rounded-full bg-white p-1" />
          )}
          <div>
            <CardTitle className="text-2xl">{token.symbol}</CardTitle>
            <CardDescription className="text-sm">{token.name}</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex h-full flex-col space-y-4">
          <div className="bg-muted flex items-center justify-between rounded-lg p-3">
            <span className="text-muted-foreground text-sm font-medium">MINT</span>
            {isLoadingAmount ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="text-lg font-bold">
                {formatUnits(tokenAmount || 0n, token.decimals)} {token.symbol}
              </span>
            )}
          </div>

          <p className="text-muted-foreground mt-auto text-center text-xs">
            Remaining: {formatUnits(faucetBalance || 0n, token.decimals)} {token.symbol}
          </p>

          {userAddress && (
            <>
              {!canMint && timeRemaining > 0 && (
                <div className="flex items-center justify-evenly gap-2 rounded-lg bg-orange-50 p-2 text-orange-800 dark:bg-orange-950 dark:text-orange-200">
                  <Clock className="h-5 w-5" />
                  <div>
                    <p className="text-xs font-medium">Cooldown active</p>
                    <p className="text-sm font-bold">{formatTimeRemaining(timeRemaining)}</p>
                  </div>
                </div>
              )}

              {canMint && (
                <div className="mt-auto">
                  <Button
                    onClick={handleMint}
                    disabled={!canMint || isPending}
                    className="w-full gap-2"
                    size="lg"
                    variant={canMint ? "default" : "secondary"}
                  >
                    <Droplet className="h-5 w-5" />
                    {isPending ? "Minting..." : "Mint Tokens"}
                  </Button>
                </div>
              )}
            </>
          )}

          {!userAddress && (
            <ConnectKitButton.Custom>
              {({ show }) => (
                <Button onClick={show} className="w-full gap-2" size="lg">
                  Connect Wallet to Mint
                </Button>
              )}
            </ConnectKitButton.Custom>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FaucetSubPage() {
  const { chain } = useAccount();

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight">Token Faucet</h1>
        <p className="text-muted-foreground">
          Get free testnet tokens for development and testing. Each token has a 24-hour cooldown between mints.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FAUCET_TOKENS.map((token) => (
          <TokenCard key={token.address} token={token} chainId={chain?.id} />
        ))}
      </div>

      <Card className="bg-blue-50 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="space-y-2">
            <h3 className="font-semibold">How it works</h3>
            <ul className="text-muted-foreground list-inside list-disc space-y-1 text-sm">
              <li>Connect your wallet to mint testnet tokens</li>
              <li>Each token can be minted once every 24 hours</li>
              <li>The cooldown is tracked per token, so you can mint different tokens independently</li>
              <li>Use these tokens for testing and development on the testnet</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
