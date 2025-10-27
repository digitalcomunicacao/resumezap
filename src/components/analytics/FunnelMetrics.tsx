import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { TrendingDown } from "lucide-react";

interface FunnelStage {
  label: string;
  count: number;
  percentage: number;
  conversionRate?: number;
}

export function FunnelMetrics() {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunnelData = async () => {
    try {
      const [visitorsRes, profilesRes, whatsappRes, subscribersRes] = await Promise.all([
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('whatsapp_connected', true),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).not('stripe_customer_id', 'is', null),
      ]);

      const visitors = visitorsRes.count || 0;
      const signups = profilesRes.count || 0;
      const whatsappConnected = whatsappRes.count || 0;
      const subscribers = subscribersRes.count || 0;

      const funnelStages: FunnelStage[] = [
        {
          label: "Visitantes do Site",
          count: visitors,
          percentage: 100,
        },
        {
          label: "Cadastros",
          count: signups,
          percentage: visitors > 0 ? (signups / visitors) * 100 : 0,
          conversionRate: visitors > 0 ? (signups / visitors) * 100 : 0,
        },
        {
          label: "WhatsApp Conectado",
          count: whatsappConnected,
          percentage: visitors > 0 ? (whatsappConnected / visitors) * 100 : 0,
          conversionRate: signups > 0 ? (whatsappConnected / signups) * 100 : 0,
        },
        {
          label: "Assinantes",
          count: subscribers,
          percentage: visitors > 0 ? (subscribers / visitors) * 100 : 0,
          conversionRate: whatsappConnected > 0 ? (subscribers / whatsappConnected) * 100 : 0,
        },
      ];

      setStages(funnelStages);
    } catch (error) {
      console.error('Error fetching funnel data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnelData();

    // Realtime updates
    const channel = supabase
      .channel('funnel-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        fetchFunnelData();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'analytics_events' }, () => {
        fetchFunnelData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (loading) {
    return (
      <Card className="shadow-soft">
        <CardHeader>
          <CardTitle>Funil de Conversão</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-96 animate-pulse bg-muted rounded" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-primary" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {stages.map((stage, index) => {
            const width = stage.percentage;
            const isFirst = index === 0;
            
            return (
              <div key={stage.label} className="relative">
                {/* Stage container */}
                <div 
                  className="relative mx-auto transition-all duration-500 ease-out"
                  style={{ 
                    width: `${Math.max(width, 20)}%`,
                  }}
                >
                  {/* Funnel stage */}
                  <div 
                    className={`
                      relative overflow-hidden rounded-lg
                      ${isFirst ? 'bg-gradient-to-r from-primary/90 to-primary' : ''}
                      ${index === 1 ? 'bg-gradient-to-r from-green-500/90 to-green-600' : ''}
                      ${index === 2 ? 'bg-gradient-to-r from-yellow-500/90 to-yellow-600' : ''}
                      ${index === 3 ? 'bg-gradient-to-r from-blue-500/90 to-blue-600' : ''}
                      shadow-lg hover:shadow-xl transition-shadow duration-300
                    `}
                  >
                    <div className="px-6 py-4 text-white">
                      <div className="flex justify-between items-start mb-2">
                        <div className="flex-1">
                          <p className="text-sm font-medium opacity-90">{stage.label}</p>
                          <p className="text-2xl font-bold mt-1">{stage.count.toLocaleString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs opacity-75">do total</p>
                          <p className="text-lg font-semibold">{stage.percentage.toFixed(1)}%</p>
                        </div>
                      </div>
                      
                      {stage.conversionRate !== undefined && (
                        <div className="mt-2 pt-2 border-t border-white/20">
                          <div className="flex justify-between items-center text-xs">
                            <span className="opacity-90">Taxa de conversão</span>
                            <span className="font-semibold">{stage.conversionRate.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Animated gradient overlay */}
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
                  </div>
                </div>

                {/* Conversion arrow */}
                {index < stages.length - 1 && (
                  <div className="flex justify-center my-3">
                    <div className="text-muted-foreground">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M19 12l-7 7-7-7"/>
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Summary */}
        <div className="mt-8 pt-6 border-t">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Conversão Geral</p>
              <p className="text-xl font-bold text-primary">
                {stages[3]?.percentage.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Cadastro → WhatsApp</p>
              <p className="text-xl font-bold text-green-600">
                {stages[2]?.conversionRate?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">WhatsApp → Assinante</p>
              <p className="text-xl font-bold text-yellow-600">
                {stages[3]?.conversionRate?.toFixed(1)}%
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-1">Total de Visitantes</p>
              <p className="text-xl font-bold text-blue-600">
                {stages[0]?.count.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
