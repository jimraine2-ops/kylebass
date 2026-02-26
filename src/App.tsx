import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import Dashboard from "@/pages/Dashboard";
import StockDetail from "@/pages/StockDetail";
import NewsPage from "@/pages/NewsPage";
import SectorsPage from "@/pages/SectorsPage";
import AlertsPage from "@/pages/AlertsPage";
import PennyStocksPage from "@/pages/PennyStocksPage";
import AITradingPage from "@/pages/AITradingPage";
import RecommendationPage from "@/pages/RecommendationPage";
import LearningReportPage from "@/pages/LearningReportPage";
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
              <Route path="/news" element={<NewsPage />} />
              <Route path="/sectors" element={<SectorsPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              
              <Route path="/penny-stocks" element={<PennyStocksPage />} />
              <Route path="/ai-trading" element={<AITradingPage />} />
              <Route path="/recommendations" element={<RecommendationPage />} />
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
