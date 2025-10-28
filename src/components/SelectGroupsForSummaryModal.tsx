import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Loader2, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppGroup {
  id: string;
  group_id: string;
  group_name: string;
  group_image: string | null;
  participant_count: number;
  is_selected: boolean;
}

interface SelectGroupsForSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | undefined;
  onSuccess: () => void;
}

export const SelectGroupsForSummaryModal = ({
  isOpen,
  onClose,
  userId,
  onSuccess,
}: SelectGroupsForSummaryModalProps) => {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  useEffect(() => {
    if (isOpen && userId) {
      fetchGroups();
    }
  }, [isOpen, userId]);

  const fetchGroups = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_groups")
        .select("*")
        .eq("user_id", userId)
        .eq("is_selected", true)
        .order("group_name");

      if (error) throw error;

      setGroups(data || []);
      
      // Selecionar todos por padrão
      const allIds = new Set((data || []).map((g) => g.group_id));
      setSelectedGroups(allIds);
      setSelectAll(true);
    } catch (error) {
      console.error("Error fetching groups:", error);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  const toggleGroup = (groupId: string) => {
    setSelectedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupId)) {
        newSet.delete(groupId);
      } else {
        newSet.add(groupId);
      }
      setSelectAll(newSet.size === groups.length);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectAll) {
      setSelectedGroups(new Set());
      setSelectAll(false);
    } else {
      setSelectedGroups(new Set(groups.map((g) => g.group_id)));
      setSelectAll(true);
    }
  };

  const handleGenerateSummaries = async () => {
    if (selectedGroups.size === 0) {
      toast.error("Selecione pelo menos um grupo");
      return;
    }

    setGenerating(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      // Log manual generation
      await supabase.from('manual_summary_logs').insert({
        user_id: userId,
        subscription_plan: 'enterprise', // Will be updated by trigger
      });

      const { data, error } = await supabase.functions.invoke('generate-summaries', {
        body: {
          selectedGroupIds: Array.from(selectedGroups)
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.summaries_count === 0) {
        const details = data.details || [];
        const noMessages = details.filter((d: any) => d.reason === 'no_messages').length;
        const noText = details.filter((d: any) => d.reason === 'no_text_messages').length;
        
        let description = "Nenhuma mensagem de texto encontrada no período (últimas 24h).";
        if (noMessages > 0) {
          description += ` ${noMessages} grupo(s) sem mensagens.`;
        }
        if (noText > 0) {
          description += ` ${noText} grupo(s) sem mensagens de texto.`;
        }
        description += " Dica: envie mensagens no grupo e tente novamente.";
        
        toast.info(description);
      } else {
        toast.success(`✅ ${data.summaries_count} resumo(s) gerado(s) com sucesso!`);
      }

      onSuccess();
      onClose();
    } catch (error: any) {
      console.error("Error generating summaries:", error);
      toast.error("Erro ao gerar resumos: " + (error.message || "Tente novamente"));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Selecionar Grupos para Resumir</DialogTitle>
          <DialogDescription>
            Escolha quais grupos você deseja gerar resumos
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <div className="border-b pb-3">
              <div className="flex items-center space-x-2 p-3 hover:bg-accent rounded-lg cursor-pointer" onClick={toggleSelectAll}>
                <Checkbox
                  checked={selectAll}
                  onCheckedChange={toggleSelectAll}
                />
                <label className="text-sm font-medium cursor-pointer">
                  Selecionar Todos ({groups.length} grupos)
                </label>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 py-2">
              {groups.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum grupo configurado para resumos
                </div>
              ) : (
                groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center space-x-3 p-3 hover:bg-accent rounded-lg cursor-pointer"
                    onClick={() => toggleGroup(group.group_id)}
                  >
                    <Checkbox
                      checked={selectedGroups.has(group.group_id)}
                      onCheckedChange={() => toggleGroup(group.group_id)}
                    />
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {group.group_name.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{group.group_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.participant_count} participantes
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleGenerateSummaries}
                disabled={generating || selectedGroups.size === 0}
                className="flex-1 gap-2"
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Gerar {selectedGroups.size > 0 && `(${selectedGroups.size})`}
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
