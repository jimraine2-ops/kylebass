import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import StockDetail from "@/pages/StockDetail";
import AITradingPage from "@/pages/AITradingPage";
import UnifiedScanPage from "@/pages/UnifiedScanPage";
import EarningsWatchPage from "@/pages/EarningsWatchPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark" storageKey="stockpulse-theme">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AppLayout>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/stock/:symbol" element={<StockDetail />} />
              <Route path="/unified-scan" element={<UnifiedScanPage />} />
              <Route path="/earnings-watch" element={<EarningsWatchPage />} />
              <Route path="/ai-trading" element={<AITradingPage />} />
              {/* Legacy redirects */}
              <Route path="/recommendations" element={<UnifiedScanPage />} />
              <Route path="/penny-stocks" element={<UnifiedScanPage />} />
              <Route path="/search" element={<StockDetail />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
