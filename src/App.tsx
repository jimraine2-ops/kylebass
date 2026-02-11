import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import StockDetail from "@/pages/StockDetail";
import NewsPage from "@/pages/NewsPage";
import SectorsPage from "@/pages/SectorsPage";
import AlertsPage from "@/pages/AlertsPage";
import WatchlistPage from "@/pages/WatchlistPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppLayout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/stock/:symbol" element={<StockDetail />} />
            <Route path="/news" element={<NewsPage />} />
            <Route path="/sectors" element={<SectorsPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/watchlist" element={<WatchlistPage />} />
            <Route path="/search" element={<WatchlistPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AppLayout>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
