import { getChainSlug } from "@morpho-org/uikit/lib/utils";
import "core-js/stable/array/iterator";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router";

import "@/index.css";
import { DashboardSubPage } from "./app/dashboard/dashboard-subpage";

import { BorrowSubPage } from "@/app/dashboard/borrow-subpage.tsx";
import { EarnSubPage } from "@/app/dashboard/earn-subpage.tsx";
import Page from "@/app/dashboard/page.tsx";
import { MarketSubPage } from "@/app/vault-market/market-subpage";
import { VaultSubPage } from "@/app/vault-market/vault-subpage";
import App from "@/App.tsx";
import { ConditionalRedirect } from "@/components/conditional-redirect";
import { DEFAULT_CHAIN } from "@/lib/constants";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <App>
              <Outlet />
            </App>
          }
        >
          <Route index element={<Navigate replace to={getChainSlug(DEFAULT_CHAIN)} />} />
          <Route path=":chain/">
            <Route index element={<ConditionalRedirect />} />
            <Route element={<Page />}>
              <Route path="dashboard" element={<DashboardSubPage />} />
              <Route path="earn" element={<EarnSubPage />} />
              <Route path="borrow" element={<BorrowSubPage />} />
              <Route path="vault/:address" element={<VaultSubPage />} />
              <Route path="market/:id" element={<MarketSubPage />} />
            </Route>
          </Route>
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
