import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SummarySettingsProps {
  userId: string;
  currentTime: string;
}

export function SummarySettings({ userId, currentTime }: SummarySettingsProps) {
  const [selectedTime, setSelectedTime] = useState(currentTime || "09:00:00");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_summary_time: selectedTime })
      .eq('id', userId);

    if (error) {
      toast.error("Erro ao salvar configuração");
    } else {
      toast.success("Horário atualizado com sucesso!");
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Horário dos Resumos
        </CardTitle>
        <CardDescription>
          Escolha o horário em que deseja receber seus resumos diários
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="summary-time">Horário Preferido</Label>
          <Select value={selectedTime} onValueChange={setSelectedTime}>
            <SelectTrigger id="summary-time">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card">
              {Array.from({ length: 24 }, (_, i) => {
                const hour = i.toString().padStart(2, '0');
                return (
                  <SelectItem key={hour} value={`${hour}:00:00`}>
                    {hour}:00
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Horário de Brasília (GMT-3)
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar Horário"}
        </Button>
      </CardContent>
    </Card>
  );
}
