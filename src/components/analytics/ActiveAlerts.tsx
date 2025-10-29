import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function ActiveAlerts() {
  const queryClient = useQueryClient();

  const { data: alerts, isLoading } = useQuery({
    queryKey: ['admin-alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('admin_alerts')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
  });

  const resolveAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('admin_alerts')
        .update({ 
          resolved: true, 
          resolved_at: new Date().toISOString(),
          resolved_by: user?.id 
        })
        .eq('id', alertId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-alerts'] });
      toast.success('Alerta resolvido com sucesso');
    },
    onError: () => {
      toast.error('Erro ao resolver alerta');
    },
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical': return <XCircle className="h-5 w-5" />;
      case 'high': return <AlertCircle className="h-5 w-5" />;
      case 'medium': return <AlertTriangle className="h-5 w-5" />;
      default: return <AlertCircle className="h-5 w-5" />;
    }
  };

  const getSeverityVariant = (severity: string): "default" | "destructive" => {
    return severity === 'critical' || severity === 'high' ? 'destructive' : 'default';
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Carregando alertas...</div>;
  }

  if (!alerts || alerts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Sistema Operacional
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhum alerta ativo no momento. Todos os sistemas estão funcionando normalmente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          🚨 Alertas Ativos ({alerts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {alerts.map((alert) => (
          <Alert key={alert.id} variant={getSeverityVariant(alert.severity)}>
            <div className="flex items-start gap-3">
              {getSeverityIcon(alert.severity)}
              <div className="flex-1">
                <AlertTitle>{alert.message}</AlertTitle>
                <AlertDescription className="mt-2">
                  <div className="space-y-1 text-xs">
                    <div>Criado há {format(new Date(alert.created_at!), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</div>
                    {alert.details && typeof alert.details === 'object' && (
                      <details className="mt-2">
                        <summary className="cursor-pointer font-medium">Ver Detalhes</summary>
                        <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                          {JSON.stringify(alert.details, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </AlertDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => resolveAlert.mutate(alert.id)}
                disabled={resolveAlert.isPending}
              >
                Resolver
              </Button>
            </div>
          </Alert>
        ))}
      </CardContent>
    </Card>
  );
}
