import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";

interface Group {
  id: string;
  group_id: string;
  group_name: string;
  group_image: string | null;
  participant_count: number;
  is_selected: boolean;
}

interface GroupsListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userPlan: string;
  onGroupsUpdated?: () => void;
}

const PLAN_LIMITS: Record<string, number> = {
  free: 1,
  basic: 5,
  pro: 10,
  premium: 20,
};

export default function GroupsListModal({ 
  open, 
  onOpenChange, 
  userPlan,
  onGroupsUpdated 
}: GroupsListModalProps) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const planLimit = PLAN_LIMITS[userPlan] || 1;
  const selectedCount = groups.filter(g => g.is_selected).length;
  const limitReached = selectedCount >= planLimit;

  useEffect(() => {
    if (open) {
      fetchGroups();
    }
  }, [open]);

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      // First, try to get existing groups from database
      const { data: existingGroups, error: dbError } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('group_name');

      if (dbError) throw dbError;

      // If we have groups in DB, show them
      if (existingGroups && existingGroups.length > 0) {
        setGroups(existingGroups);
      }

      // Then fetch fresh groups from WhatsApp in background
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Não autenticado');
      }

      const { data, error } = await supabase.functions.invoke('fetch-groups', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data?.groups) {
        setGroups(data.groups);
        toast({
          title: "Grupos sincronizados",
          description: `${data.groups.length} grupos encontrados`,
        });
      }

    } catch (err: any) {
      console.error('Error fetching groups:', err);
      setError(err.message || 'Erro ao buscar grupos');
      toast({
        title: "Erro",
        description: err.message || "Erro ao buscar grupos do WhatsApp",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupSelection = async (groupId: string, currentlySelected: boolean) => {
    // If trying to select and limit is reached, prevent
    if (!currentlySelected && limitReached) {
      toast({
        title: "Limite atingido",
        description: `Seu plano permite selecionar até ${planLimit} grupo(s). Faça upgrade para selecionar mais.`,
        variant: "destructive",
      });
      return;
    }

    // Optimistic update
    setGroups(groups.map(g => 
      g.id === groupId ? { ...g, is_selected: !currentlySelected } : g
    ));

    try {
      const { error } = await supabase
        .from('whatsapp_groups')
        .update({ is_selected: !currentlySelected })
        .eq('id', groupId);

      if (error) throw error;

    } catch (err: any) {
      console.error('Error toggling group:', err);
      // Revert optimistic update
      setGroups(groups.map(g => 
        g.id === groupId ? { ...g, is_selected: currentlySelected } : g
      ));
      toast({
        title: "Erro",
        description: "Erro ao atualizar seleção",
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error('Não autenticado');

      // Update selected_groups_count in profiles
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ selected_groups_count: selectedCount })
        .eq('id', user.id);

      if (updateError) throw updateError;

      toast({
        title: "Sucesso!",
        description: `${selectedCount} grupo(s) selecionado(s)`,
      });

      onGroupsUpdated?.();
      onOpenChange(false);

    } catch (err: any) {
      console.error('Error saving selection:', err);
      toast({
        title: "Erro",
        description: "Erro ao salvar seleção",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const progressPercentage = (selectedCount / planLimit) * 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Meus Grupos do WhatsApp
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
          {/* Plan limit indicator */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {selectedCount} de {planLimit} grupos selecionados
              </span>
              <span className="text-xs text-muted-foreground">
                Plano: {userPlan === 'free' ? 'Gratuito' : userPlan}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            
            {limitReached && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Limite atingido! Faça upgrade para selecionar mais grupos.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Groups list */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-2">
            {loading && groups.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : error && groups.length === 0 ? (
              <div className="text-center py-12">
                <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
                <p className="text-muted-foreground">{error}</p>
                <Button 
                  onClick={fetchGroups} 
                  variant="outline" 
                  className="mt-4"
                >
                  Tentar novamente
                </Button>
              </div>
            ) : groups.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Nenhum grupo encontrado</p>
              </div>
            ) : (
              groups.map((group) => {
                const isDisabled = !group.is_selected && limitReached;
                
                return (
                  <div
                    key={group.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                      group.is_selected 
                        ? 'border-primary bg-primary/5' 
                        : isDisabled
                        ? 'border-muted bg-muted/30 opacity-60'
                        : 'border-border hover:border-primary/50 hover:bg-accent'
                    }`}
                  >
                    <Checkbox
                      id={group.id}
                      checked={group.is_selected}
                      onCheckedChange={() => toggleGroupSelection(group.id, group.is_selected)}
                      disabled={isDisabled}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    
                    <div className="flex items-center gap-3 flex-1">
                      {group.group_image ? (
                        <img
                          src={group.group_image}
                          alt={group.group_name}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{group.group_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {group.participant_count} membro{group.participant_count !== 1 ? 's' : ''}
                        </p>
                      </div>

                      {isDisabled && (
                        <span className="text-xs text-muted-foreground">
                          Limite atingido
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button
              onClick={fetchGroups}
              variant="outline"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sincronizando...
                </>
              ) : (
                'Sincronizar Grupos'
              )}
            </Button>

            <div className="flex gap-2">
              <Button
                onClick={() => onOpenChange(false)}
                variant="outline"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSave}
                disabled={saving || selectedCount === 0}
              >
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  'Salvar Seleção'
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
