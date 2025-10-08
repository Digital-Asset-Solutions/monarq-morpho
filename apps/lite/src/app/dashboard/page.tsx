import { Button } from "@morpho-org/uikit/components/shadcn/button";
import { SidebarInset } from "@morpho-org/uikit/components/shadcn/sidebar";
import { WalletMenu } from "@morpho-org/uikit/components/wallet-menu";
import { getChainSlug } from "@morpho-org/uikit/lib/utils";
import { ConnectKitButton } from "connectkit";
import { useCallback, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useChains } from "wagmi";

import { AppSidebar, AppSidebarLayout } from "@/components/header";
import { RewardsButton } from "@/components/rewards-button";
import { APP_DETAILS } from "@/lib/constants";

enum SubPage {
  Earn = "earn",
  Borrow = "borrow",
  Dashboard = "dashboard",
  Vault = "vault",
  Market = "market",
}

function ConnectWalletButton() {
  return (
    <ConnectKitButton.Custom>
      {({ show }) => {
        return (
          <Button variant="secondary" size="lg" className="px-4 font-light md:px-6" onClick={show}>
            <span className="inline md:hidden">Connect</span>
            <span className="hidden md:inline">Connect&nbsp;Wallet</span>
          </Button>
        );
      }}
    </ConnectKitButton.Custom>
  );
}

export default function Page() {
  const navigate = useNavigate();
  const { chain: selectedChainSlug } = useParams();

  const location = useLocation();
  const locationSegments = location.pathname.toLowerCase().split("/").slice(1);
  const selectedSubPage = locationSegments.at(1) as SubPage; // Changed back to .at(1) since we have chain segment

  const chains = useChains();
  const chain = useMemo(
    () => chains.find((chain) => getChainSlug(chain) === selectedChainSlug),
    [chains, selectedChainSlug],
  );

  const setSelectedChainSlug = useCallback(
    (value: string) => {
      void navigate(`/${value}/${selectedSubPage}`, { replace: true });
    },
    [navigate, selectedSubPage],
  );

  /* ORIGINAL CHAIN SELECTION LOGIC - commented for rollback
  const selectedChainSlug = "lisk";
  const setSelectedChainSlug = useCallback(
    (value: string) => {
      void navigate(`../${value}/${selectedSubPage}`, { replace: true, relative: "path" });
      // If selected chain is a core deployment, open main app in a new tab (we don't navigate away in
      // case they're using this because the main app is down).
      // if ([...CORE_DEPLOYMENTS].map((id) => getChainSlug(extractChain({ chains, id }))).includes(value)) {
      //   window.open(`https://app.morpho.org/${value}/${selectedSubPage}`, "_blank", "noopener,noreferrer");
      // }
    },
    [navigate, selectedSubPage],
  );
  */

  useEffect(() => {
    const title =
      selectedSubPage === SubPage.Vault
        ? "Vault"
        : selectedSubPage === SubPage.Market
          ? "Market"
          : selectedSubPage.charAt(0).toUpperCase() + selectedSubPage.slice(1);
    document.title = `${APP_DETAILS.name} | ${title}`;
  }, [selectedSubPage]);

  return (
    <AppSidebarLayout>
      <AppSidebar chainId={chain?.id} />
      <SidebarInset className="flex flex-col">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/60 border-sidebar-border sticky top-0 z-10 flex h-16 shrink-0 items-center justify-end border-b px-4 backdrop-blur">
          {/* <SidebarTrigger className="-ml-1" /> */}
          <div className="mr-2 flex items-center gap-2">
            <RewardsButton chainId={chain?.id} />
            <WalletMenu
              selectedChainSlug={selectedChainSlug!}
              setSelectedChainSlug={setSelectedChainSlug}
              connectWalletButton={<ConnectWalletButton />}
              coreDeployments={new Set()}
            />
          </div>
        </header>
        <main className="flex-1 overflow-auto bg-[#F5F5F5]">
          <div className="flex flex-col gap-4 p-4">
            <Outlet context={{ chain }} />
          </div>
        </main>
      </SidebarInset>
    </AppSidebarLayout>
  );
}
