import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Edit, FileText, Search } from "lucide-react";
import { toast } from "sonner";
import { EditGroupsLimitModal } from "./EditGroupsLimitModal";

interface Lead {
  id: string;
  user_id: string;
  whatsapp: string;
  city: string;
  profession: string;
  company_revenue: string | null;
  company_employees: string | null;
  lead_score: number;
  notes: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    email: string;
    subscription_plan: string;
    selected_groups_count: number;
    manual_groups_limit: number | null;
  };
}

export const LeadsManagement = () => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [professionFilter, setProfessionFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [editingLead, setEditingLead] = useState<Lead | null>(null);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    try {
      const { data: leadsData, error } = await supabase
        .from("lead_qualification")
        .select("*")
        .order("lead_score", { ascending: false });

      if (error) throw error;

      // Fetch profiles separately
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, email, subscription_plan, selected_groups_count, manual_groups_limit");

      if (profilesError) throw profilesError;

      // Merge data
      const mergedData = (leadsData || []).map((lead) => {
        const profile = profilesData?.find((p) => p.id === lead.user_id);
        
        if (!profile) {
          console.warn(`⚠️ Profile não encontrado para user_id: ${lead.user_id}`);
        }
        
        return {
          ...lead,
          profiles: profile || {
            full_name: "Nome não encontrado",
            email: "Email não encontrado",
            subscription_plan: "free",
            selected_groups_count: 0,
            manual_groups_limit: null,
          },
        };
      });

      setLeads(mergedData as any);
    } catch (error: any) {
      console.error("Error fetching leads:", error);
      toast.error("Erro ao carregar leads");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copiado para área de transferência!");
  };

  const getScoreBadge = (score: number) => {
    if (score >= 90) return <Badge variant="destructive">🔥 {score}</Badge>;
    if (score >= 60) return <Badge className="bg-yellow-500">⭐ {score}</Badge>;
    if (score >= 30) return <Badge variant="secondary">📊 {score}</Badge>;
    return <Badge variant="outline">💤 {score}</Badge>;
  };

  const getProfessionLabel = (profession: string) => {
    const labels: Record<string, string> = {
      empresario: "Empresário",
      diretor_gestor: "Diretor/Gestor",
      marketing_operacoes: "Marketing/Operações",
      outros: "Outros",
    };
    return labels[profession] || profession;
  };

  const getRevenueLabel = (revenue: string | null) => {
    if (!revenue) return "-";
    const labels: Record<string, string> = {
      ate_100k: "Até R$ 100k",
      "100k_500k": "R$ 100k - R$ 500k",
      "500k_1m": "R$ 500k - R$ 1M",
      "1m_5m": "R$ 1M - R$ 5M",
      acima_5m: "Acima de R$ 5M",
    };
    return labels[revenue] || revenue;
  };

  const getEmployeesLabel = (employees: string | null) => {
    if (!employees) return "-";
    const labels: Record<string, string> = {
      ate_10: "Até 10",
      "11_50": "11 - 50",
      "51_200": "51 - 200",
      "201_500": "201 - 500",
      acima_500: "Acima de 500",
    };
    return labels[employees] || employees;
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.profiles.full_name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.profiles.email?.toLowerCase().includes(search.toLowerCase()) ||
      lead.whatsapp.includes(search);

    const matchesProfession = professionFilter === "all" || lead.profession === professionFilter;

    const matchesScore =
      scoreFilter === "all" ||
      (scoreFilter === "hot" && lead.lead_score >= 90) ||
      (scoreFilter === "warm" && lead.lead_score >= 60 && lead.lead_score < 90) ||
      (scoreFilter === "cold" && lead.lead_score >= 30 && lead.lead_score < 60) ||
      (scoreFilter === "inactive" && lead.lead_score < 30);

    return matchesSearch && matchesProfession && matchesScore;
  });

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, email ou WhatsApp..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        <Select value={professionFilter} onValueChange={setProfessionFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por profissão" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as profissões</SelectItem>
            <SelectItem value="empresario">Empresário</SelectItem>
            <SelectItem value="diretor_gestor">Diretor/Gestor</SelectItem>
            <SelectItem value="marketing_operacoes">Marketing/Operações</SelectItem>
            <SelectItem value="outros">Outros</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scoreFilter} onValueChange={setScoreFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filtrar por score" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os scores</SelectItem>
            <SelectItem value="hot">🔥 Quente (90+)</SelectItem>
            <SelectItem value="warm">⭐ Morno (60-89)</SelectItem>
            <SelectItem value="cold">📊 Frio (30-59)</SelectItem>
            <SelectItem value="inactive">💤 Inativo (0-29)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Score</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>WhatsApp</TableHead>
              <TableHead>Cidade</TableHead>
              <TableHead>Profissão</TableHead>
              <TableHead>Faturamento</TableHead>
              <TableHead>Funcionários</TableHead>
              <TableHead>Plano</TableHead>
              <TableHead>Grupos</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLeads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground">
                  Nenhum lead encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>{getScoreBadge(lead.lead_score)}</TableCell>
                  <TableCell className="font-medium">{lead.profiles.full_name}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="truncate max-w-[150px]">{lead.profiles.email}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(lead.profiles.email)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {lead.whatsapp}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(lead.whatsapp)}
                      >
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>{lead.city}</TableCell>
                  <TableCell>{getProfessionLabel(lead.profession)}</TableCell>
                  <TableCell>{getRevenueLabel(lead.company_revenue)}</TableCell>
                  <TableCell>{getEmployeesLabel(lead.company_employees)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{lead.profiles.subscription_plan}</Badge>
                  </TableCell>
                  <TableCell>
                    {lead.profiles.manual_groups_limit !== null ? (
                      <Badge variant="secondary">{lead.profiles.manual_groups_limit} (manual)</Badge>
                    ) : (
                      <span>{lead.profiles.selected_groups_count}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingLead(lead)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {editingLead && (
        <EditGroupsLimitModal
          user={{
            id: editingLead.user_id,
            full_name: editingLead.profiles.full_name,
            email: editingLead.profiles.email,
            subscription_plan: editingLead.profiles.subscription_plan,
            manual_groups_limit: editingLead.profiles.manual_groups_limit,
            selected_groups_count: editingLead.profiles.selected_groups_count,
          }}
          onClose={() => {
            setEditingLead(null);
            fetchLeads();
          }}
        />
      )}
    </div>
  );
};
