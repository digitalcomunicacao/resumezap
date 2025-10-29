import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle, Users, FileText, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface ScheduledExecution {
  id: string;
  execution_time: string;
  status: string;
  users_processed: number;
  summaries_generated: number;
  errors_count: number;
  details: any;
  created_at: string;
}

const ExecutionHistory = () => {
  const navigate = useNavigate();
  const [executions, setExecutions] = useState<ScheduledExecution[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchExecutions();
  }, []);

  const fetchExecutions = async () => {
    try {
      const { data, error } = await supabase
        .from('scheduled_executions')
        .select('*')
        .order('execution_time', { ascending: false })
        .limit(20);

      if (error) throw error;
      setExecutions(data || []);
    } catch (error) {
      console.error('Error fetching executions:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500 gap-1">
            <CheckCircle className="w-3 h-3" />
            Concluído
          </Badge>
        );
      case 'completed_with_errors':
        return (
          <Badge variant="default" className="bg-yellow-500 gap-1">
            <AlertCircle className="w-3 h-3" />
            Com Erros
          </Badge>
        );
      case 'failed':
        return (
          <Badge variant="destructive" className="gap-1">
            <XCircle className="w-3 h-3" />
            Falhou
          </Badge>
        );
      case 'running':
        return (
          <Badge variant="default" className="bg-blue-500 gap-1">
            <Activity className="w-3 h-3 animate-pulse" />
            Executando
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatTime = (dateString: string) => {
    const date = parseISO(dateString);
    const brasiliaHour = format(date, "HH:mm", { locale: ptBR });
    const utcDate = new Date(date.getTime() + (3 * 60 * 60 * 1000));
    const utcHour = format(utcDate, "HH:mm");
    return `${brasiliaHour} (Brasília) • ${utcHour} (UTC)`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-xl font-bold">Histórico de Execuções</h1>
            <p className="text-xs text-muted-foreground">
              Acompanhe as execuções automáticas dos resumos
            </p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-4">
          {executions.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhuma execução registrada</h3>
                <p className="text-muted-foreground text-center">
                  As execuções automáticas aparecerão aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            executions.map((execution) => (
              <Card key={execution.id} className="shadow-soft">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5" />
                        {format(parseISO(execution.execution_time), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </CardTitle>
                      <CardDescription>
                        {formatTime(execution.execution_time)}
                      </CardDescription>
                    </div>
                    {getStatusBadge(execution.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Users className="w-4 h-4" />
                        Usuários
                      </div>
                      <div className="text-2xl font-bold">{execution.users_processed}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <FileText className="w-4 h-4" />
                        Resumos
                      </div>
                      <div className="text-2xl font-bold">{execution.summaries_generated}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <XCircle className="w-4 h-4" />
                        Erros
                      </div>
                      <div className="text-2xl font-bold text-destructive">{execution.errors_count}</div>
                    </div>
                  </div>

                  {execution.details && execution.details.results && (
                    <div className="mt-4 space-y-2">
                      <p className="text-sm font-medium">Detalhes:</p>
                      <div className="bg-muted/50 rounded-lg p-3 space-y-1">
                        {execution.details.results.map((result: any, idx: number) => (
                          <div key={idx} className="text-xs">
                            {result.success ? (
                              <span className="text-green-600">
                                ✓ Usuário processado • {result.summariesCount || 0} resumos
                              </span>
                            ) : (
                              <span className="text-destructive">
                                ✗ Falha: {result.error}
                                {result.errorCode && <span className="ml-2 text-xs opacity-70">({result.errorCode})</span>}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </main>
    </div>
  );
};

export default ExecutionHistory;
