import { getChainSlug } from "@morpho-org/uikit/lib/utils";
import { useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router";
import { useAccount, useChains } from "wagmi";

import { useUserPositions } from "@/hooks/use-user-positions";

export function ConditionalRedirect() {
  const navigate = useNavigate();
  const { chain: chainSlug } = useParams();
  const { isConnected } = useAccount();

  // Get the chain object from the slug
  const chains = useChains();
  const chain = useMemo(() => chains.find((chain) => getChainSlug(chain) === chainSlug), [chains, chainSlug]);

  const { hasPositions } = useUserPositions(chain?.id);

  useEffect(() => {
    if (!chainSlug) {
      console.log("No chainSlug, returning early");
      return;
    }

    // If user is connected and has positions, redirect to dashboard
    // Otherwise, redirect to earn
    const targetPage = isConnected && hasPositions ? "dashboard" : "earn";
    void navigate(`/${chainSlug}/${targetPage}`, { replace: true });
  }, [chainSlug, isConnected, hasPositions, navigate]);

  return null;
}
