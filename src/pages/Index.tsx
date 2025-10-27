import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { Features } from "@/components/Features";
import { Pricing } from "@/components/Pricing";
import { Footer } from "@/components/Footer";

const Index = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view for analytics
    const trackPageView = async () => {
      const hasTracked = sessionStorage.getItem('page_view_tracked');
      if (hasTracked) return;

      try {
        await supabase.from('analytics_events').insert({
          event_type: 'page_view',
          event_data: { 
            page: 'landing',
            path: location.pathname,
            timestamp: new Date().toISOString()
          },
          user_id: null
        });
        sessionStorage.setItem('page_view_tracked', 'true');
      } catch (error) {
        console.error('Error tracking page view:', error);
      }
    };

    trackPageView();

    // Scroll to pricing section if hash is present
    if (location.hash === '#pricing') {
      const pricingSection = document.getElementById('pricing');
      if (pricingSection) {
        pricingSection.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Hero />
        <Features />
        <div id="pricing">
          <Pricing />
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Index;
