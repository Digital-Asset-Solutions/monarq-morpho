import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
} from "@morpho-org/uikit/components/shadcn/sidebar";
import { useKeyedState } from "@morpho-org/uikit/hooks/use-keyed-state";
import { cn } from "@morpho-org/uikit/lib/utils";
import { ArrowUpRight, CircleDollarSign, Home, LucideHandCoins, XIcon } from "lucide-react";
import { Link, useLocation } from "react-router";

import { MorphoMenu } from "@/components/morpho-menu";
import { BANNERS, WORDMARK } from "@/lib/constants";

function Banner(chainId: number | undefined) {
  const [shouldShowBanner, setShouldShowBanner] = useKeyedState(false, chainId, { persist: true });

  if (chainId === undefined || !BANNERS[chainId] || !shouldShowBanner) {
    return null;
  }
  const banner = BANNERS[chainId];

  return (
    <aside className={cn("flex h-10 min-h-min items-center px-2 text-sm font-light italic", banner.color)}>
      {banner.text}
      <XIcon className="hover:bg-accent mx-2 h-6 w-6 rounded-sm p-1" onClick={() => setShouldShowBanner(false)} />
    </aside>
  );
}

export function AppSidebar({ chainId }: { chainId?: number }) {
  const location = useLocation();
  const currentPath = location.pathname;
  const chainSlug = location.pathname.split("/")[1];

  return (
    <Sidebar>
      <SidebarHeader className="">
        {Banner(chainId)}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-center gap-3">
            {WORDMARK.length > 0 ? <img className="h-12" src={WORDMARK} alt="Monarq" /> : <MorphoMenu />}
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator className="ml-[-0px] mt-[-0.7px]" />

      <SidebarContent className="px-5 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath.includes("/dashboard")}
              className="transition-all duration-200"
            >
              <Link to={`/${chainSlug}/dashboard`} className="px-3 py-5">
                <Home className="text-secondary h-7 w-7" />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath.includes("/earn") || currentPath.includes("/vault/")}
              className="transition-all duration-200"
            >
              <Link to={`/${chainSlug}/earn`} className="px-3 py-5">
                <CircleDollarSign className="text-secondary h-7 w-7" />
                <span>Earn</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={currentPath.includes("/borrow") || currentPath.includes("/market/")}
              className="transition-all duration-200"
            >
              <Link to={`/${chainSlug}/borrow`} className="px-3 py-5">
                <LucideHandCoins className="text-secondary h-7 w-7" />
                <span>Borrow</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-4 px-5">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="https://vote.morpho.org/" rel="noopener noreferrer" target="_blank" className="text-sm">
                <span>Gov</span>
                <ArrowUpRight className="text-secondary h-4 w-4" strokeWidth={3} />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a href="https://docs.morpho.org/" rel="noopener noreferrer" target="_blank" className="text-sm">
                <span>Docs</span>
                <ArrowUpRight className="text-secondary h-4 w-4" strokeWidth={3} />
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

export function AppSidebarLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">{children}</div>
    </SidebarProvider>
  );
}
