import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface User {
  id: string;
  full_name: string;
  email: string;
  subscription_plan: string;
  manual_groups_limit: number | null;
  selected_groups_count?: number;
}

interface EditGroupsLimitModalProps {
  user: User;
  onClose: () => void;
}

export const EditGroupsLimitModal = ({ user, onClose }: EditGroupsLimitModalProps) => {
  const [limit, setLimit] = useState<number>(user.manual_groups_limit || 0);
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user: admin } } = await supabase.auth.getUser();
      if (!admin) throw new Error("Admin não autenticado");

      // Atualiza o limite manual
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ manual_groups_limit: limit })
        .eq("id", user.id);

      if (profileError) throw profileError;

      // Registra a ação no log
      const { error: logError } = await supabase
        .from("admin_actions")
        .insert({
          admin_id: admin.id,
          target_user_id: user.id,
          action_type: "groups_limit_changed",
          details: {
            previous_limit: user.manual_groups_limit,
            new_limit: limit,
            note: note,
          },
        });

      if (logError) throw logError;

      toast.success("Limite atualizado com sucesso!");
      onClose();
    } catch (error: any) {
      console.error("Error updating limit:", error);
      toast.error(error.message || "Erro ao atualizar limite");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Limite de Grupos</DialogTitle>
          <DialogDescription>
            Alterar o limite manual de grupos para {user.full_name}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <Label>Plano Atual</Label>
            <Input value={user.subscription_plan} disabled />
          </div>

          <div>
            <Label htmlFor="limit">Limite Manual de Grupos</Label>
            <Input
              id="limit"
              type="number"
              value={limit}
              onChange={(e) => setLimit(parseInt(e.target.value) || 0)}
              min={0}
            />
            <p className="text-sm text-muted-foreground mt-1">
              Deixe 0 para usar o limite do plano
            </p>
          </div>

          <div>
            <Label htmlFor="note">Motivo / Observação</Label>
            <Textarea
              id="note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex: Cliente especial, teste gratuito, etc."
              rows={3}
            />
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
