import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Users, FileText, MessageSquare, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function OverviewMetrics() {
  const [metrics, setMetrics] = useState({
    totalUsers: 0,
    activeUsers: 0,
    summariesToday: 0,
    summariesWeek: 0,
    paidUsers: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [usersRes, activeRes, todayRes, weekRes, paidRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('whatsapp_connected', true),
          supabase.from('summaries').select('id', { count: 'exact', head: true }).gte('created_at', new Date().toISOString().split('T')[0]),
          supabase.from('summaries').select('id', { count: 'exact', head: true }).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).neq('subscription_plan', 'free'),
        ]);

        setMetrics({
          totalUsers: usersRes.count || 0,
          activeUsers: activeRes.count || 0,
          summariesToday: todayRes.count || 0,
          summariesWeek: weekRes.count || 0,
          paidUsers: paidRes.count || 0,
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const conversionRate = metrics.totalUsers > 0 
    ? ((metrics.paidUsers / metrics.totalUsers) * 100).toFixed(1)
    : '0.0';

  const cards = [
    {
      title: "Total de Usuários",
      value: metrics.totalUsers,
      subtitle: `${metrics.activeUsers} ativos`,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Resumos Hoje",
      value: metrics.summariesToday,
      subtitle: `${metrics.summariesWeek} esta semana`,
      icon: FileText,
      color: "text-green-500",
    },
    {
      title: "Taxa de Conversão",
      value: `${conversionRate}%`,
      subtitle: `${metrics.paidUsers} usuários pagos`,
      icon: CreditCard,
      color: "text-purple-500",
    },
    {
      title: "Média/Usuário",
      value: metrics.activeUsers > 0 
        ? (metrics.summariesWeek / metrics.activeUsers).toFixed(1)
        : '0',
      subtitle: "resumos/semana",
      icon: MessageSquare,
      color: "text-orange-500",
    },
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="shadow-soft">
            <CardContent className="p-6">
              <div className="h-20 animate-pulse bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title} className="shadow-soft">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-muted-foreground">
                {card.title}
              </p>
              <card.icon className={`w-4 h-4 ${card.color}`} />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.subtitle}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
