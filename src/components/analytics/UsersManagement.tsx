import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EditGroupsLimitModal } from "./EditGroupsLimitModal";
import { EditUserPlanModal } from "./EditUserPlanModal";
import { Search, Edit, Copy, Check, CreditCard } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface User {
  id: string;
  full_name: string;
  email: string;
  subscription_plan: string;
  subscription_end_date: string | null;
  manual_groups_limit: number | null;
  selected_groups_count: number;
  total_summaries_generated: number;
  whatsapp_connected: boolean;
  created_at: string;
  last_seen_at: string;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  basic: 5,
  pro: 10,
  premium: 20,
};

export const UsersManagement = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [whatsappFilter, setWhatsappFilter] = useState<string>("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editingUserPlan, setEditingUserPlan] = useState<User | null>(null);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, planFilter, whatsappFilter]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error("Erro ao carregar usuários");
    } finally {
      setLoading(false);
    }
  };

  const filterUsers = () => {
    let filtered = [...users];

    // Busca por nome ou email
    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro por plano
    if (planFilter !== "all") {
      filtered = filtered.filter((user) => user.subscription_plan === planFilter);
    }

    // Filtro por status WhatsApp
    if (whatsappFilter !== "all") {
      filtered = filtered.filter((user) => 
        whatsappFilter === "connected" ? user.whatsapp_connected : !user.whatsapp_connected
      );
    }

    setFilteredUsers(filtered);
  };

  const copyEmail = (email: string) => {
    navigator.clipboard.writeText(email);
    setCopiedEmail(email);
    toast.success("Email copiado!");
    setTimeout(() => setCopiedEmail(null), 2000);
  };

  const getGroupsLimit = (user: User) => {
    if (user.manual_groups_limit !== null) {
      return user.manual_groups_limit;
    }
    return PLAN_LIMITS[user.subscription_plan] || 1;
  };

  const getPlanBadge = (plan: string) => {
    const variants: Record<string, "default" | "secondary" | "outline"> = {
      free: "outline",
      basic: "secondary",
      pro: "default",
      premium: "default",
    };
    return <Badge variant={variants[plan] || "outline"}>{plan}</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Filtrar por plano" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os planos</SelectItem>
            <SelectItem value="free">Free</SelectItem>
            <SelectItem value="basic">Basic</SelectItem>
            <SelectItem value="pro">Pro</SelectItem>
            <SelectItem value="premium">Premium</SelectItem>
          </SelectContent>
        </Select>

        <Select value={whatsappFilter} onValueChange={setWhatsappFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status WhatsApp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="connected">Conectado</SelectItem>
            <SelectItem value="disconnected">Não conectado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela de Usuários */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Grupos</TableHead>
              <TableHead>Limite</TableHead>
              <TableHead>Resumos</TableHead>
              <TableHead>Cadastro</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => {
              const groupsLimit = getGroupsLimit(user);
              const hasManualLimit = user.manual_groups_limit !== null;

              return (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">
                    {user.full_name || "Sem nome"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {user.email || "Sem email"}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyEmail(user.email)}
                      >
                        {copiedEmail === user.email ? (
                          <Check className="h-3 w-3 text-green-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{getPlanBadge(user.subscription_plan)}</TableCell>
                  <TableCell>
                    {user.whatsapp_connected ? (
                      <Badge variant="default" className="bg-green-500">
                        ✓ Conectado
                      </Badge>
                    ) : (
                      <Badge variant="outline">Não conectado</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{user.selected_groups_count}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span>{groupsLimit}</span>
                      {hasManualLimit && (
                        <Badge variant="secondary" className="text-xs">
                          Manual
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{user.total_summaries_generated}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDistanceToNow(new Date(user.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </TableCell>
                <TableCell>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUserPlan(user)}
                    >
                      <CreditCard className="h-3 w-3 mr-1" />
                      Editar Plano
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingUser(user)}
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Editar Limite
                    </Button>
                  </div>
                </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        {filteredUsers.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário encontrado
          </div>
        )}
      </div>

      {/* Modal de Edição */}
      {editingUser && (
        <EditGroupsLimitModal
          user={editingUser}
          onClose={() => {
            setEditingUser(null);
            fetchUsers();
          }}
        />
      )}

      {editingUserPlan && (
        <EditUserPlanModal
          user={editingUserPlan}
          onClose={() => {
            setEditingUserPlan(null);
            fetchUsers();
          }}
        />
      )}
    </div>
  );
};
