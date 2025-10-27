import React, { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Admin from "./pages/Admin";
import Checkout from "./pages/Checkout";
import Success from "./pages/Success";
import Qualify from "./pages/Qualify";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppContent = () => {
  useEffect(() => {
    const trackVisitor = async () => {
      try {
        // Get or create anonymous visitor ID
        let anonId = localStorage.getItem('rz_anon_id');
        if (!anonId) {
          anonId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          localStorage.setItem('rz_anon_id', anonId);
        }

        // Check if visitor was already tracked in the last 24h
        const lastVisit = localStorage.getItem('rz_visitor_last');
        const now = Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;

        if (lastVisit && (now - parseInt(lastVisit)) < oneDayMs) {
          return; // Already tracked in last 24h
        }

        // Track page view
        await supabase.from('analytics_events').insert({
          event_type: 'page_view',
          event_data: { 
            path: window.location.pathname,
            anon_id: anonId,
            timestamp: new Date().toISOString()
          },
          user_id: null
        });

        localStorage.setItem('rz_visitor_last', now.toString());
      } catch (error) {
        console.error('Error tracking visitor:', error);
      }
    };

    trackVisitor();
  }, []);

  return (
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/qualify" element={<Qualify />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/success" element={<Success />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <SubscriptionProvider>
      <AppContent />
    </SubscriptionProvider>
  </QueryClientProvider>
);

export default App;
