import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Users, TrendingUp, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export function UsageMetrics() {
  const [metrics, setMetrics] = useState({
    summariesToday: 0,
    summariesWeek: 0,
    groupsMonitored: 0,
    avgPerActiveUser: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

        const [todayRes, weekRes, groupsRes, activeUsersRes] = await Promise.all([
          supabase.from('summaries').select('id', { count: 'exact', head: true }).gte('created_at', today),
          supabase.from('summaries').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
          supabase.from('whatsapp_groups').select('id', { count: 'exact', head: true }).eq('is_selected', true),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('whatsapp_connected', true),
        ]);

        const summariesToday = todayRes.count || 0;
        const summariesWeek = weekRes.count || 0;
        const groupsMonitored = groupsRes.count || 0;
        const activeUsers = activeUsersRes.count || 0;
        const avgPerActiveUser = activeUsers > 0 ? summariesWeek / activeUsers : 0;

        setMetrics({
          summariesToday,
          summariesWeek,
          groupsMonitored,
          avgPerActiveUser,
        });
      } catch (error) {
        console.error('Error fetching usage metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  const cards = [
    {
      title: "Resumos Hoje",
      value: metrics.summariesToday,
      subtitle: `${metrics.summariesWeek} esta semana`,
      icon: FileText,
      color: "text-green-500",
    },
    {
      title: "Grupos Monitorados",
      value: metrics.groupsMonitored,
      subtitle: "grupos ativos no sistema",
      icon: FolderOpen,
      color: "text-blue-500",
    },
    {
      title: "Média por Usuário",
      value: metrics.avgPerActiveUser.toFixed(1),
      subtitle: "resumos/semana por usuário ativo",
      icon: TrendingUp,
      color: "text-purple-500",
    },
    {
      title: "Usuários Ativos",
      value: Math.round(metrics.summariesWeek / (metrics.avgPerActiveUser || 1)),
      subtitle: "com WhatsApp conectado",
      icon: Users,
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
