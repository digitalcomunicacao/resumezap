import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wifi, WifiOff, Clock, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ConnectionStats {
  total: number;
  active: number;
  expired: number;
  disconnected: number;
  successRate: number;
}

export const ConnectionHealthMetrics = () => {
  const [stats, setStats] = useState<ConnectionStats>({
    total: 0,
    active: 0,
    expired: 0,
    disconnected: 0,
    successRate: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const { data: connections, error } = await supabase
        .from('whatsapp_connections')
        .select('status, created_at');

      if (error) throw error;

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Filter connections from last 7 days
      const recentConnections = connections?.filter(c => 
        new Date(c.created_at) >= sevenDaysAgo
      ) || [];

      const total = recentConnections.length;
      const active = recentConnections.filter(c => c.status === 'connected').length;
      const expired = recentConnections.filter(c => c.status === 'expired').length;
      const disconnected = recentConnections.filter(c => c.status === 'disconnected').length;
      const successRate = total > 0 ? Math.round((active / total) * 100) : 0;

      setStats({ total, active, expired, disconnected, successRate });
    } catch (error) {
      console.error('Error fetching connection stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const metrics = [
    {
      title: "Conexões Ativas",
      value: stats.active,
      icon: Wifi,
      description: "Conectadas agora",
      color: "text-green-600"
    },
    {
      title: "Expiradas",
      value: stats.expired,
      icon: Clock,
      description: "Sessões expiradas",
      color: "text-orange-600"
    },
    {
      title: "Desconectadas",
      value: stats.disconnected,
      icon: WifiOff,
      description: "Desconexões manuais",
      color: "text-red-600"
    },
    {
      title: "Taxa de Sucesso",
      value: `${stats.successRate}%`,
      icon: TrendingUp,
      description: "Últimos 7 dias",
      color: "text-primary"
    }
  ];

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-8 w-16 bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {metrics.map((metric) => {
        const Icon = metric.icon;
        return (
          <Card key={metric.title} className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {metric.title}
              </CardTitle>
              <Icon className={`h-4 w-4 ${metric.color}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${metric.color}`}>
                {metric.value}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {metric.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
