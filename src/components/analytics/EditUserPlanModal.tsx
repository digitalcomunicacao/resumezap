import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface User {
  id: string;
  email: string;
  full_name: string;
  subscription_plan: string;
  subscription_end_date: string | null;
}

interface EditUserPlanModalProps {
  user: User;
  onClose: () => void;
}

const PLANS = [
  { value: "free", label: "Free - 1 grupo" },
  { value: "basic", label: "Basic - 2 a 5 grupos (R$29/mês)" },
  { value: "pro", label: "Pro - 6 a 10 grupos (R$49/mês)" },
  { value: "premium", label: "Premium - 11 a 20 grupos (R$97/mês)" },
];

export function EditUserPlanModal({ user, onClose }: EditUserPlanModalProps) {
  const [newPlan, setNewPlan] = useState<string>(user.subscription_plan);
  const [endDate, setEndDate] = useState<string>(
    user.subscription_end_date ? format(new Date(user.subscription_end_date), "yyyy-MM-dd") : ""
  );
  const [note, setNote] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    try {
      setLoading(true);

      // Get current admin user
      const { data: { user: admin } } = await supabase.auth.getUser();
      if (!admin) throw new Error("Admin não autenticado");

      // Update user profile
      const updateData: any = {
        subscription_plan: newPlan,
        subscription_status: newPlan !== 'free' ? 'active' : 'inactive',
        manual_subscription: true,
      };

      if (newPlan !== "free" && endDate) {
        updateData.subscription_end_date = new Date(endDate).toISOString();
      } else {
        updateData.subscription_end_date = null;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Log admin action
      const { error: logError } = await supabase.from("admin_actions").insert({
        admin_id: admin.id,
        target_user_id: user.id,
        action_type: "subscription_plan_changed",
        details: {
          previous_plan: user.subscription_plan,
          new_plan: newPlan,
          previous_end_date: user.subscription_end_date,
          new_end_date: newPlan !== "free" && endDate ? new Date(endDate).toISOString() : null,
          note: note || null,
        },
      });

      if (logError) console.error("Erro ao registrar log:", logError);

      toast.success("Plano atualizado com sucesso!");
      onClose();
    } catch (error: any) {
      console.error("Erro ao atualizar plano:", error);
      toast.error(error.message || "Erro ao atualizar plano");
    } finally {
      setLoading(false);
    }
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

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Editar Plano de Assinatura</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Usuário</Label>
            <div>
              <p className="font-medium">{user.full_name || "Sem nome"}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground">Plano Atual</Label>
            <div>{getPlanBadge(user.subscription_plan)}</div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="plan">Novo Plano</Label>
            <Select value={newPlan} onValueChange={setNewPlan}>
              <SelectTrigger id="plan">
                <SelectValue placeholder="Selecione o plano" />
              </SelectTrigger>
              <SelectContent>
                {PLANS.map((plan) => (
                  <SelectItem key={plan.value} value={plan.value}>
                    {plan.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {newPlan !== "free" && (
            <div className="space-y-2">
              <Label htmlFor="endDate">Data de Término da Assinatura</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">Motivo/Observação (opcional)</Label>
            <Textarea
              id="note"
              placeholder="Ex: Upgrade manual solicitado pelo usuário"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
