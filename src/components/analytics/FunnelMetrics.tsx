import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { 
  TrendingDown, 
  Users, 
  UserPlus, 
  MessageCircle, 
  CreditCard,
  ArrowDownRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FunnelStage {
  name: string;
  value: number;
  fill: string;
  percentage: number;
  conversionRate?: number;
  icon: any;
}

const COLORS = {
  visitors: '#25D366',    // WhatsApp green bright
  signups: '#128C7E',     // WhatsApp green medium
  whatsapp: '#075E54',    // WhatsApp green dark
  subscribers: '#34B7F1', // WhatsApp blue
};

export function FunnelMetrics() {
  const [stages, setStages] = useState<FunnelStage[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFunnelData = async () => {
    try {
      const [visitorsRes, profilesRes, whatsappRes, subscribersRes] = await Promise.all([
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('event_type', 'page_view'),
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
          name: "Visitantes do Site",
          value: visitors,
          fill: COLORS.visitors,
          percentage: 100,
          icon: Users,
        },
        {
          name: "Cadastros",
          value: signups,
          fill: COLORS.signups,
          percentage: visitors > 0 ? (signups / visitors) * 100 : 0,
          conversionRate: visitors > 0 ? (signups / visitors) * 100 : 0,
          icon: UserPlus,
        },
        {
          name: "WhatsApp Conectado",
          value: whatsappConnected,
          fill: COLORS.whatsapp,
          percentage: visitors > 0 ? (whatsappConnected / visitors) * 100 : 0,
          conversionRate: signups > 0 ? (whatsappConnected / signups) * 100 : 0,
          icon: MessageCircle,
        },
        {
          name: "Assinantes",
          value: subscribers,
          fill: COLORS.subscribers,
          percentage: visitors > 0 ? (subscribers / visitors) * 100 : 0,
          conversionRate: whatsappConnected > 0 ? (subscribers / whatsappConnected) * 100 : 0,
          icon: CreditCard,
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
          <Skeleton className="h-[400px] w-full mb-6" />
          <Separator className="my-6" />
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const overallConversion = stages[3]?.percentage || 0;
  const signupToWhatsApp = stages[2]?.conversionRate || 0;
  const whatsappToSubscriber = stages[3]?.conversionRate || 0;

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-primary" />
          Funil de Conversão
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Custom Funnel Visualization */}
        <div className="mb-8 px-2 md:px-4">
          <div className="space-y-3">
            {stages.map((stage, index) => {
              const Icon = stage.icon;
              const isLast = index === stages.length - 1;
              const maxValue = stages[0]?.value || 1;
              const widthPercentage = Math.max((stage.value / maxValue) * 100, 25);
              
              return (
                <div key={stage.name} className="space-y-2">
                  {/* Stage Bar Container */}
                  <div className="relative">
                    <div 
                      className={cn(
                        "relative overflow-hidden rounded-xl transition-all duration-700 ease-out",
                        "hover:scale-[1.02] hover:shadow-2xl cursor-pointer group",
                        "border-2 border-white/10",
                        "animate-fade-in"
                      )}
                      style={{
                        width: `${widthPercentage}%`,
                        minWidth: '280px',
                        background: `linear-gradient(135deg, ${stage.fill} 0%, ${stage.fill}dd 100%)`,
                        boxShadow: `0 8px 24px ${stage.fill}40, 0 4px 8px ${stage.fill}20`,
                        animationDelay: `${index * 150}ms`
                      }}
                    >
                      {/* Shine effect on hover */}
                      <div 
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent 
                                   -translate-x-full group-hover:translate-x-full transition-transform duration-1000"
                      />
                      
                      {/* Content */}
                      <div className="relative flex items-center justify-between px-4 md:px-6 py-4 gap-3">
                        {/* Left: Icon + Name */}
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="p-2.5 rounded-xl bg-white/30 backdrop-blur-sm flex-shrink-0 
                                        shadow-lg group-hover:bg-white/40 transition-colors">
                            <Icon className="w-5 h-5 md:w-6 md:h-6 text-white drop-shadow-md" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm md:text-base font-bold text-white drop-shadow-md truncate">
                              {stage.name}
                            </p>
                          </div>
                        </div>

                        {/* Right: Stats */}
                        <div className="flex flex-col items-end flex-shrink-0">
                          <p className="text-2xl md:text-3xl font-black text-white drop-shadow-lg">
                            {stage.value.toLocaleString()}
                          </p>
                          <p className="text-xs md:text-sm font-semibold text-white/90 drop-shadow">
                            {stage.percentage.toFixed(1)}% do total
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Conversion Arrow Between Stages */}
                  {!isLast && stage.conversionRate !== undefined && (
                    <div 
                      className="flex items-center gap-2 pl-6 md:pl-10 py-1 animate-fade-in"
                      style={{ animationDelay: `${index * 150 + 75}ms` }}
                    >
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full 
                                    bg-muted/50 border border-border/50">
                        <ArrowDownRight className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">
                          {stage.conversionRate.toFixed(1)}% convertem
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <Separator className="my-8" />

        {/* Métricas Chave */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Total de Visitantes */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.visitors}20` }}>
                  <Users className="w-6 h-6" style={{ color: COLORS.visitors }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Etapa 1
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Visitantes
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.visitors }}>
                {stages[0]?.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Total absoluto
              </p>
            </CardContent>
          </Card>

          {/* 2. Cadastros */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.signups}20` }}>
                  <UserPlus className="w-6 h-6" style={{ color: COLORS.signups }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Etapa 2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Cadastros
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.signups }}>
                {stages[1]?.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {stages[1]?.conversionRate?.toFixed(1)}% dos visitantes
              </p>
            </CardContent>
          </Card>

          {/* 3. WhatsApp Conectado */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.whatsapp}20` }}>
                  <MessageCircle className="w-6 h-6" style={{ color: COLORS.whatsapp }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Etapa 3
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                WhatsApp Conectado
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.whatsapp }}>
                {stages[2]?.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                {signupToWhatsApp.toFixed(1)}% dos cadastros
              </p>
            </CardContent>
          </Card>

          {/* 4. Conversão Total */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ArrowDownRight className="w-6 h-6 text-primary" />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Geral
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Conversão Total
              </p>
              <p className="text-3xl font-bold text-primary">
                {overallConversion.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Visitantes → Assinantes
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
