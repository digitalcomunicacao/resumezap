import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

export function CronStatus() {
  const navigate = useNavigate();

  const { data: lastExecution, isLoading } = useQuery({
    queryKey: ['last-execution'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_executions')
        .select('*')
        .order('execution_time', { ascending: false })
        .limit(1)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const getNextExecutionTime = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    return nextHour;
  };

  const nextExecution = getNextExecutionTime();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Status do Agendamento
        </CardTitle>
        <CardDescription>
          Sistema de geração automática de resumos de hora em hora
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-sm font-medium">Cron Job</div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="mr-1 h-3 w-3" />
                Ativo
              </Badge>
              <span className="text-xs text-muted-foreground">
                Executa a cada hora cheia
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <div className="text-sm font-medium">Próxima Execução</div>
            <div className="text-lg font-semibold">
              {format(nextExecution, "dd/MM 'às' HH:mm", { locale: ptBR })}
            </div>
            <div className="text-xs text-muted-foreground">
              Em {Math.ceil((nextExecution.getTime() - Date.now()) / 60000)} minutos
            </div>
          </div>

          {lastExecution && (
            <div className="space-y-1">
              <div className="text-sm font-medium">Última Execução</div>
              <div className="text-lg font-semibold">
                {format(new Date(lastExecution.execution_time), "dd/MM 'às' HH:mm", { locale: ptBR })}
              </div>
              <div className="flex items-center gap-2">
                {lastExecution.status === 'completed' ? (
                  <Badge variant="default" className="bg-green-500">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Sucesso
                  </Badge>
                ) : lastExecution.status === 'failed' ? (
                  <Badge variant="destructive">
                    <XCircle className="mr-1 h-3 w-3" />
                    Falhou
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    {lastExecution.errors_count} erros
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  {lastExecution.summaries_generated} resumos gerados
                </span>
              </div>
            </div>
          )}
        </div>

        <Button variant="outline" onClick={() => navigate('/execution-history')} className="w-full">
          Ver Histórico Completo
        </Button>
      </CardContent>
    </Card>
  );
}
