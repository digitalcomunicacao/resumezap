import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { UpgradeModal } from "./UpgradeModal";
import { GroupCard } from "./GroupCard";

interface Group {
  id: string;
  group_id: string;
  group_name: string;
  group_image: string | null;
  participant_count: number;
  is_selected: boolean;
  last_activity?: number | null;
  unread_count?: number;
  pinned?: boolean;
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
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [planLimit, setPlanLimit] = useState(PLAN_LIMITS[userPlan] || 1);
  const { toast } = useToast();

  const selectedCount = groups.filter(g => g.is_selected).length;
  const limitReached = selectedCount >= planLimit;

  useEffect(() => {
    if (open) {
      fetchUserProfile();
      fetchGroups();
    }
  }, [open]);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from('profiles')
        .select('manual_groups_limit, subscription_plan')
        .eq('id', user.id)
        .single();

      if (profile) {
        // Prioriza o limite manual se existir
        if (profile.manual_groups_limit !== null) {
          setPlanLimit(profile.manual_groups_limit);
        } else {
          setPlanLimit(PLAN_LIMITS[profile.subscription_plan] || 1);
        }
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchGroups = async () => {
    setLoading(true);
    setError(null);

    try {
      // Buscar o usuário autenticado
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      // First, try to get existing groups from database (apenas do usuário logado)
      const { data: existingGroups, error: dbError } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('is_selected', { ascending: false })
        .order('participant_count', { ascending: false })
        .order('group_name', { ascending: true });

      if (dbError) throw dbError;

      // If we have groups in DB, show them (já ordenados pela query)
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
        // Backend já retorna ordenado: is_selected > pinned > last_activity > participant_count > nome
        setGroups(data.groups);
        
        // Show if loaded from cache
        const isCache = data.message?.includes('cache');
        toast({
          title: isCache ? "Grupos do cache" : "Grupos sincronizados",
          description: `${data.groups.length} grupos ${isCache ? 'carregados' : 'encontrados'}`,
          duration: isCache ? 3000 : 2000,
        });
      }

    } catch (err: any) {
      console.error('Error fetching groups:', err);
      
      // Parse detailed error message from backend
      let errorMessage = "Erro ao buscar grupos do WhatsApp";
      
      if (err.message?.includes('Timeout') || err.message?.includes('timeout')) {
        errorMessage = "A busca está demorando muito. Isso pode acontecer se você tem muitos grupos. Tente novamente em alguns minutos.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
      toast({
        title: "Erro ao sincronizar",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleGroupSelection = async (groupId: string, currentlySelected: boolean) => {
    // If trying to select and limit is reached, prevent
    if (!currentlySelected && limitReached) {
      setShowUpgradeModal(true);
      return;
    }

    // Optimistic update e reordenar
    const updatedGroups = groups.map(g => 
      g.id === groupId ? { ...g, is_selected: !currentlySelected } : g
    );
    
    // Re-sort maintaining same priority as backend
    const sortedGroups = [...updatedGroups].sort((a, b) => {
      // 1. Selected groups first
      if (a.is_selected !== b.is_selected) {
        return a.is_selected ? -1 : 1;
      }
      
      // 2. Pinned groups
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      
      // 3. Most recent activity
      if (a.last_activity && b.last_activity) {
        return b.last_activity - a.last_activity;
      }
      if (a.last_activity && !b.last_activity) return -1;
      if (!a.last_activity && b.last_activity) return 1;
      
      // 4. More participants
      if (a.participant_count !== b.participant_count) {
        return b.participant_count - a.participant_count;
      }
      
      // 5. Alphabetical
      return a.group_name.localeCompare(b.group_name, 'pt-BR');
    });
    setGroups(sortedGroups);

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
          <div className="flex-1 overflow-y-auto space-y-4 pr-2">
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
              <>
                {/* Sugestões Section */}
                {(groups.filter(g => g.is_selected).length > 0 || groups.some(g => g.last_activity)) && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-muted-foreground px-1">
                      ✨ Sugestões
                    </h3>
                    
                    {/* Top suggestions: selected + most active */}
                    {[
                      ...groups.filter(g => g.is_selected).slice(0, 3),
                      ...groups
                        .filter(g => !g.is_selected && g.last_activity)
                        .slice(0, Math.max(0, 3 - groups.filter(g => g.is_selected).length))
                    ].map((group) => (
                      <GroupCard 
                        key={group.id} 
                        group={group}
                        onToggle={toggleGroupSelection}
                        disabled={!group.is_selected && limitReached}
                      />
                    ))}
                  </div>
                )}

                {/* All Groups Section */}
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-muted-foreground px-1">
                    Todos os grupos
                  </h3>
                  
                  {groups.map((group) => (
                    <GroupCard 
                      key={group.id} 
                      group={group}
                      onToggle={toggleGroupSelection}
                      disabled={!group.is_selected && limitReached}
                    />
                  ))}
                </div>
              </>
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
      
      <UpgradeModal 
        open={showUpgradeModal}
        onOpenChange={setShowUpgradeModal}
        currentLimit={planLimit}
      />
    </Dialog>
  );
}
