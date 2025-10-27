import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SummarySettingsProps {
  userId: string;
  currentTime?: string;
  sendToGroup?: boolean;
}

export function SummarySettings({ userId, currentTime, sendToGroup = true }: SummarySettingsProps) {
  const [selectedTime, setSelectedTime] = useState(currentTime || "09:00:00");
  const [enableGroupSend, setEnableGroupSend] = useState(sendToGroup);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ 
        preferred_summary_time: selectedTime,
        send_summary_to_group: enableGroupSend,
      })
      .eq('id', userId);

    if (error) {
      toast.error("Erro ao salvar configuração");
      console.error("Error saving settings:", error);
    } else {
      toast.success("Configurações atualizadas!");
    }
    setSaving(false);
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="w-5 h-5" />
          Configurações de Resumos
        </CardTitle>
        <CardDescription>
          Personalize como e quando receber seus resumos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Horário dos Resumos</Label>
          <Select value={selectedTime} onValueChange={setSelectedTime}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-h-[200px]">
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

        <div className="flex items-center justify-between space-x-2 rounded-lg border p-4">
          <div className="flex-1 space-y-1">
            <Label htmlFor="send-to-group" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Enviar no Grupo
            </Label>
            <p className="text-sm text-muted-foreground">
              Receber o resumo diretamente no grupo do WhatsApp
            </p>
          </div>
          <Switch
            id="send-to-group"
            checked={enableGroupSend}
            onCheckedChange={setEnableGroupSend}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Salvando..." : "Salvar Configurações"}
        </Button>
      </CardContent>
    </Card>
  );
}
