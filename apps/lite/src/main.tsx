// LITE APP: getChainSlug and DEFAULT_CHAIN not needed - commented for rollback
// import { getChainSlug } from "@morpho-org/uikit/lib/utils"; // Original import
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
// import { DEFAULT_CHAIN } from "@/lib/constants"; // Original import - commented for rollback

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
          {/* LITE APP: Direct redirect to Lisk dashboard - no chain selection */}
          <Route index element={<Navigate replace to="/dashboard" />} />
          {/* LITE APP: Simplified routing without chain parameter - dedicated to Lisk */}
          <Route element={<Page />}>
            <Route path="dashboard" element={<DashboardSubPage />} />
            <Route path="earn" element={<EarnSubPage />} />
            <Route path="borrow" element={<BorrowSubPage />} />
            <Route path="vault/:address" element={<VaultSubPage />} />
            <Route path="market/:id" element={<MarketSubPage />} />
          </Route>
          {/* ORIGINAL ROUTING: Commented for rollback
          <Route index element={<Navigate replace to={getChainSlug(DEFAULT_CHAIN)} />} />
          <Route path=":chain/">
            <Route index element={<Navigate replace to="dashboard" />} />
            <Route element={<Page />}>
              <Route path="dashboard" element={<DashboardSubPage />} />
              <Route path="earn" element={<EarnSubPage />} />
              <Route path="borrow" element={<BorrowSubPage />} />
              <Route path="vault/:address" element={<VaultSubPage />} />
              <Route path="market/:id" element={<MarketSubPage />} />
            </Route>
          </Route>
          */}
        </Route>
      </Routes>
    </BrowserRouter>
  </StrictMode>,
);
