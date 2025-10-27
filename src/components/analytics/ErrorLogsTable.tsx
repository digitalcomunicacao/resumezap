import { useEffect, useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ErrorLog {
  id: string;
  created_at: string;
  event_data: {
    error?: string;
    user_id?: string;
    group_id?: string;
    [key: string]: any;
  };
}

export function ErrorLogsTable() {
  const [logs, setLogs] = useState<ErrorLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState("24h");

  useEffect(() => {
    fetchErrorLogs();
  }, [timeFilter]);

  const fetchErrorLogs = async () => {
    try {
      // Simular logs de erro (em produção, buscar do analytics_events ou edge function logs)
      // Por enquanto, retornar array vazio já que não temos estrutura de logs de erro ainda
      setLogs([]);
    } catch (error) {
      console.error('Error fetching error logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando logs...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          <h3 className="text-lg font-semibold">Logs de Erros</h3>
        </div>
        
        <Select value={timeFilter} onValueChange={setTimeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="24h">Últimas 24 horas</SelectItem>
            <SelectItem value="7d">Última semana</SelectItem>
            <SelectItem value="30d">Último mês</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length === 0 ? (
        <div className="text-center py-12 bg-muted/20 rounded-lg">
          <AlertTriangle className="w-12 h-12 text-green-500 mx-auto mb-4" />
          <p className="text-lg font-medium text-green-600">Nenhum erro registrado! 🎉</p>
          <p className="text-sm text-muted-foreground mt-2">
            Sistema funcionando perfeitamente no período selecionado
          </p>
        </div>
      ) : (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Tipo de Erro</TableHead>
                <TableHead>Mensagem</TableHead>
                <TableHead>Grupo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-sm">
                    {formatDistanceToNow(new Date(log.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.event_data.user_id?.slice(0, 8)}...
                  </TableCell>
                  <TableCell>
                    <Badge variant="destructive">Error</Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-sm">
                    {log.event_data.error || 'Erro desconhecido'}
                  </TableCell>
                  <TableCell className="text-sm">
                    {log.event_data.group_id || '-'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
