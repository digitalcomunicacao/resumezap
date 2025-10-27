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
import {
  FunnelChart,
  Funnel,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList
} from 'recharts';

interface FunnelStage {
  name: string;
  value: number;
  fill: string;
  percentage: number;
  conversionRate?: number;
  icon: any;
}

const COLORS = {
  visitors: 'hsl(142 76% 56%)',
  signups: 'hsl(142 70% 45%)',
  whatsapp: 'hsl(174 84% 35%)',
  subscribers: 'hsl(142 76% 30%)',
};

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

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const Icon = data.icon;
      
      return (
        <Card className="shadow-lg border-2">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon className="w-4 h-4" style={{ color: data.fill }} />
              <p className="font-semibold text-sm">{data.name}</p>
            </div>
            <p className="text-3xl font-bold mb-2" style={{ color: data.fill }}>
              {data.value.toLocaleString()}
            </p>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Do total</span>
                <span className="font-semibold">{data.percentage.toFixed(1)}%</span>
              </div>
              {data.conversionRate !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Taxa de conversão</span>
                  <span className="font-semibold">{data.conversionRate.toFixed(1)}%</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      );
    }
    return null;
  };

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
        {/* Recharts Funnel Visualization */}
        <div className="mb-6">
          <ResponsiveContainer width="100%" height={400}>
            <FunnelChart>
              <Tooltip content={<CustomTooltip />} />
              <Funnel
                dataKey="value"
                data={stages}
                isAnimationActive
              >
                <LabelList 
                  position="inside" 
                  fill="#fff" 
                  stroke="none" 
                  dataKey="name" 
                  style={{ fontSize: '14px', fontWeight: 600 }}
                />
                {stages.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Funnel>
            </FunnelChart>
          </ResponsiveContainer>
        </div>

        <Separator className="my-6" />

        {/* Métricas Chave */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Conversão Geral */}
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

          {/* Cadastro → WhatsApp */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.whatsapp}20` }}>
                  <MessageCircle className="w-6 h-6" style={{ color: COLORS.whatsapp }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Etapa 2
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Taxa de Conexão
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.whatsapp }}>
                {signupToWhatsApp.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Cadastro → WhatsApp
              </p>
            </CardContent>
          </Card>

          {/* WhatsApp → Assinante */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.subscribers}20` }}>
                  <CreditCard className="w-6 h-6" style={{ color: COLORS.subscribers }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Etapa 3
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Taxa de Conversão
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.subscribers }}>
                {whatsappToSubscriber.toFixed(1)}%
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                WhatsApp → Assinante
              </p>
            </CardContent>
          </Card>

          {/* Total de Visitantes */}
          <Card className="shadow-soft hover:shadow-hover transition-all duration-300 border-2">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 rounded-lg" style={{ backgroundColor: `${COLORS.visitors}20` }}>
                  <Users className="w-6 h-6" style={{ color: COLORS.visitors }} />
                </div>
                <Badge variant="secondary" className="text-xs">
                  Total
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mb-1">
                Total de Visitantes
              </p>
              <p className="text-3xl font-bold" style={{ color: COLORS.visitors }}>
                {stages[0]?.value.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Base do funil
              </p>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}
