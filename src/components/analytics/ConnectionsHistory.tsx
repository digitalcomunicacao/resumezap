import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Loader2, Search } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ConnectionDetailsModal } from "./ConnectionDetailsModal";
import { ConnectionHealthMetrics } from "./ConnectionHealthMetrics";

interface Connection {
  id: string;
  user_id: string;
  instance_id: string;
  instance_name: string;
  status: string;
  connection_type: string;
  created_at: string;
  connected_at: string | null;
  last_connected_at: string | null;
  profile: {
    email: string;
    full_name: string | null;
    subscription_plan: string;
  } | null;
}

export const ConnectionsHistory = () => {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [filteredConnections, setFilteredConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedUser, setSelectedUser] = useState<{ id: string; email: string } | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [connections, searchTerm, statusFilter]);

  const fetchConnections = async () => {
    try {
      const { data, error } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const userIds = [...new Set(data?.map(c => c.user_id) || [])];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, full_name, subscription_plan')
        .in('id', userIds);

      // Merge data
      const connectionsWithProfiles = data?.map(conn => ({
        ...conn,
        profile: profiles?.find(p => p.id === conn.user_id) || null
      })) || [];

      setConnections(connectionsWithProfiles);
      setFilteredConnections(connectionsWithProfiles);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...connections];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(conn => 
        conn.profile?.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        conn.profile?.full_name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter(conn => conn.status === statusFilter);
    }

    setFilteredConnections(filtered);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-100 text-green-800 border-green-200">🟢 Ativa</Badge>;
      case 'expired':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">🟠 Expirada</Badge>;
      case 'disconnected':
        return <Badge className="bg-red-100 text-red-800 border-red-200">🔴 Desconectada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const openDetailsModal = (userId: string, email: string) => {
    setSelectedUser({ id: userId, email });
    setDetailsModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Health Metrics */}
      <ConnectionHealthMetrics />

      {/* Filters */}
      <div className="flex gap-4 items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por usuário ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filtrar por status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="connected">Conectados</SelectItem>
            <SelectItem value="expired">Expirados</SelectItem>
            <SelectItem value="disconnected">Desconectados</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Usuário</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Modo</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Conectado</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredConnections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nenhuma conexão encontrada
                </TableCell>
              </TableRow>
            ) : (
              filteredConnections.map((conn) => (
                <TableRow key={conn.id}>
                  <TableCell className="font-medium">
                    {conn.profile?.full_name || 'Sem nome'}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {conn.profile?.email}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(conn.status)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {conn.connection_type === 'persistent' ? 'Persistente' : 'Temporário'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {conn.profile?.subscription_plan || 'free'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {conn.connected_at ? (
                      formatDistanceToNow(new Date(conn.connected_at), {
                        addSuffix: true,
                        locale: ptBR
                      })
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openDetailsModal(conn.user_id, conn.profile?.email || '')}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Details Modal */}
      {selectedUser && (
        <ConnectionDetailsModal
          userId={selectedUser.id}
          userEmail={selectedUser.email}
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
        />
      )}
    </div>
  );
};
