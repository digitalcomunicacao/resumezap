import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, Users, AlertCircle, FileText } from "lucide-react";

export function HealthMetrics() {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ['health-metrics'],
    queryFn: async () => {
      const last24h = new Date();
      last24h.setHours(last24h.getHours() - 24);

      const [executionsResult, usersResult, alertsResult, summariesResult] = await Promise.all([
        supabase
          .from('scheduled_executions')
          .select('status, summaries_generated, errors_count')
          .gte('execution_time', last24h.toISOString()),
        supabase
          .from('profiles')
          .select('id', { count: 'exact' })
          .eq('whatsapp_connected', true),
        supabase
          .from('admin_alerts')
          .select('id', { count: 'exact' })
          .eq('resolved', false)
          .in('severity', ['high', 'critical']),
        supabase
          .from('summaries')
          .select('id', { count: 'exact' })
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ]);

      const executions = executionsResult.data || [];
      const totalExecutions = executions.length;
      const successfulExecutions = executions.filter(e => e.status === 'completed').length;
      const successRate = totalExecutions > 0 
        ? Math.round((successfulExecutions / totalExecutions) * 100) 
        : 100;

      return {
        successRate,
        activeUsers: usersResult.count || 0,
        criticalAlerts: alertsResult.count || 0,
        summariesToday: summariesResult.count || 0,
      };
    },
  });

  if (isLoading || !metrics) {
    return <div className="text-sm text-muted-foreground">Carregando métricas...</div>;
  }

  const metricCards = [
    {
      title: "Taxa de Sucesso",
      value: `${metrics.successRate}%`,
      icon: Activity,
      description: "Últimas 24 horas",
      color: metrics.successRate >= 80 ? "text-green-500" : "text-yellow-500",
    },
    {
      title: "Usuários Ativos",
      value: metrics.activeUsers,
      icon: Users,
      description: "WhatsApp conectado",
      color: "text-blue-500",
    },
    {
      title: "Alertas Críticos",
      value: metrics.criticalAlerts,
      icon: AlertCircle,
      description: "Não resolvidos",
      color: metrics.criticalAlerts > 0 ? "text-red-500" : "text-green-500",
    },
    {
      title: "Resumos Hoje",
      value: metrics.summariesToday,
      icon: FileText,
      description: "Gerados hoje",
      color: "text-purple-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metricCards.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.icon className={`h-4 w-4 ${metric.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
