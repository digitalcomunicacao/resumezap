import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Wifi, WifiOff, Clock, AlertCircle, Archive } from "lucide-react";

interface ConnectionDetailsModalProps {
  userId: string | null;
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ConnectionEvent {
  id: string;
  type: 'connection' | 'disconnection';
  status: string;
  timestamp: string;
  reason?: string;
  connection_type?: string;
}

export const ConnectionDetailsModal = ({ 
  userId, 
  userEmail, 
  open, 
  onOpenChange 
}: ConnectionDetailsModalProps) => {
  const [loading, setLoading] = useState(true);
  const [timeline, setTimeline] = useState<ConnectionEvent[]>([]);
  const [stats, setStats] = useState({
    totalConnections: 0,
    successRate: 0,
    avgDuration: 0,
    groupsCount: 0,
    archivedGroups: 0,
    summariesCount: 0
  });

  useEffect(() => {
    if (open && userId) {
      fetchUserConnectionData();
    }
  }, [open, userId]);

  const fetchUserConnectionData = async () => {
    if (!userId) return;
    
    setLoading(true);
    try {
      // Fetch connections
      const { data: connections } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Fetch connection history
      const { data: history } = await supabase
        .from('connection_history')
        .select('*')
        .eq('user_id', userId)
        .order('disconnected_at', { ascending: false });

      // Fetch profile stats
      const { data: profile } = await supabase
        .from('profiles')
        .select('selected_groups_count, total_summaries_generated')
        .eq('id', userId)
        .single();

      // Fetch archived groups count
      const { data: archivedGroups, count: archivedCount } = await supabase
        .from('whatsapp_groups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('archived', true);

      // Build timeline
      const timelineEvents: ConnectionEvent[] = [];
      
      connections?.forEach(conn => {
        timelineEvents.push({
          id: conn.id,
          type: 'connection',
          status: conn.status,
          timestamp: conn.created_at,
          connection_type: conn.connection_type
        });
      });

      history?.forEach(h => {
        timelineEvents.push({
          id: h.id,
          type: 'disconnection',
          status: h.reason || 'unknown',
          timestamp: h.disconnected_at || h.created_at,
          reason: h.reason
        });
      });

      // Sort by timestamp descending
      timelineEvents.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setTimeline(timelineEvents);

      // Calculate stats
      const totalConnections = connections?.length || 0;
      const successfulConnections = connections?.filter(c => c.status === 'connected').length || 0;
      const successRate = totalConnections > 0 
        ? Math.round((successfulConnections / totalConnections) * 100) 
        : 0;

      setStats({
        totalConnections,
        successRate,
        avgDuration: 0, // Could calculate from timestamps
        groupsCount: profile?.selected_groups_count || 0,
        archivedGroups: archivedCount || 0,
        summariesCount: profile?.total_summaries_generated || 0
      });

    } catch (error) {
      console.error('Error fetching connection details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getEventIcon = (event: ConnectionEvent) => {
    if (event.type === 'connection') {
      return <Wifi className="h-4 w-4 text-green-600" />;
    }
    if (event.reason === 'manual') {
      return <WifiOff className="h-4 w-4 text-red-600" />;
    }
    if (event.reason === 'expired') {
      return <Clock className="h-4 w-4 text-orange-600" />;
    }
    return <AlertCircle className="h-4 w-4 text-muted-foreground" />;
  };

  const getEventLabel = (event: ConnectionEvent) => {
    if (event.type === 'connection') {
      return `Conectou (${event.connection_type === 'persistent' ? 'Persistente' : 'Temporário'})`;
    }
    if (event.reason === 'manual') return 'Desconectou manualmente';
    if (event.reason === 'expired') return 'Sessão expirou';
    if (event.reason === 'error') return 'Erro de conexão';
    return 'Evento desconhecido';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Histórico de Conexão - {userEmail}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <ScrollArea className="max-h-[60vh]">
            <div className="space-y-6">
              {/* Statistics */}
              <div>
                <h3 className="font-semibold mb-3">📊 Estatísticas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total de conexões:</span>
                    <span className="ml-2 font-medium">{stats.totalConnections}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Taxa de sucesso:</span>
                    <span className="ml-2 font-medium">{stats.successRate}%</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Grupos configurados:</span>
                    <span className="ml-2 font-medium">{stats.groupsCount}</span>
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Grupos arquivados:</span>
                    <span className="ml-2 font-medium text-orange-600">
                      {stats.archivedGroups}
                    </span>
                  </div>
                  <div className="text-sm col-span-2">
                    <span className="text-muted-foreground">Resumos gerados:</span>
                    <span className="ml-2 font-medium">{stats.summariesCount}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Timeline */}
              <div>
                <h3 className="font-semibold mb-3">📜 Linha do Tempo</h3>
                <div className="space-y-3">
                  {timeline.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      Nenhum evento de conexão registrado.
                    </p>
                  ) : (
                    timeline.map((event) => (
                      <div 
                        key={event.id} 
                        className="flex items-start gap-3 p-3 rounded-lg border bg-card"
                      >
                        <div className="mt-0.5">
                          {getEventIcon(event)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">
                              {getEventLabel(event)}
                            </span>
                            {event.status === 'connected' && (
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDistanceToNow(new Date(event.timestamp), {
                              addSuffix: true,
                              locale: ptBR
                            })}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recommendations */}
              {stats.archivedGroups > 0 && (
                <>
                  <Separator />
                  <div className="bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
                    <div className="flex gap-2 items-start">
                      <Archive className="h-4 w-4 text-orange-600 mt-0.5" />
                      <div className="flex-1">
                        <h4 className="font-medium text-sm text-orange-900 dark:text-orange-100">
                          Grupos Arquivados Detectados
                        </h4>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                          {stats.archivedGroups} grupo(s) foram removidos do WhatsApp após desconexão.
                        </p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};
