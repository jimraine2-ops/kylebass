import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppLayout } from "@/components/layout/AppLayout";
import AITradingPage from "@/pages/AITradingPage";
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
              <Route path="/" element={<AITradingPage />} />
              <Route path="/ai-trading" element={<AITradingPage />} />
              {/* Legacy redirects */}
              <Route path="/recommendations" element={<AITradingPage />} />
              <Route path="/penny-stocks" element={<AITradingPage />} />
              <Route path="/search" element={<AITradingPage />} />
              <Route path="/stock/:symbol" element={<AITradingPage />} />
              <Route path="/unified-scan" element={<AITradingPage />} />
              <Route path="/earnings-watch" element={<AITradingPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppLayout>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
