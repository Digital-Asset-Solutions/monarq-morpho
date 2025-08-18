import { SidebarInset, SidebarTrigger } from "@morpho-org/uikit/components/shadcn/sidebar";
import { WalletMenu } from "@morpho-org/uikit/components/wallet-menu";
import { CORE_DEPLOYMENTS } from "@morpho-org/uikit/lib/deployments";
import { getChainSlug } from "@morpho-org/uikit/lib/utils";
import { ConnectKitButton } from "connectkit";
import { useCallback, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate, useParams } from "react-router";
import { useChains } from "wagmi";

import { Footer } from "@/components/footer";
import { AppSidebar, AppSidebarLayout } from "@/components/header";
import { RewardsButton } from "@/components/rewards-button";
import { WelcomeModal } from "@/components/welcome-modal";
import { APP_DETAILS } from "@/lib/constants";
import { Button } from "@morpho-org/uikit/components/shadcn/button";

enum SubPage {
  Earn = "earn",
  Borrow = "borrow",
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
  const selectedSubPage = locationSegments.at(1) === SubPage.Borrow ? SubPage.Borrow : SubPage.Earn;

  const chains = useChains();
  const chain = useMemo(
    () => chains.find((chain) => getChainSlug(chain) === selectedChainSlug),
    [chains, selectedChainSlug],
  );

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

  useEffect(() => {
    document.title = `${APP_DETAILS.name} | ${selectedSubPage.charAt(0).toUpperCase()}${selectedSubPage.slice(1)}`;
  }, [selectedSubPage]);

  return (
    <AppSidebarLayout>
      <AppSidebar chainId={chain?.id} />
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex h-16 shrink-0 items-center justify-between px-4 border-b border-sidebar-border">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2">
            <RewardsButton chainId={chain?.id} />
            <WalletMenu
              selectedChainSlug={selectedChainSlug!}
              setSelectedChainSlug={setSelectedChainSlug}
              connectWalletButton={<ConnectWalletButton />}
              coreDeployments={CORE_DEPLOYMENTS}
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
