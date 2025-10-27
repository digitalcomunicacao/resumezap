import { useEffect, useState } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FileText, Clock, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface SummaryPreferencesProps {
  userId: string;
}

export function SummaryPreferences({ userId }: SummaryPreferencesProps) {
  const [summaryTone, setSummaryTone] = useState("casual");
  const [summaryLength, setSummaryLength] = useState("medio");
  const [preferredTime, setPreferredTime] = useState("09:00:00");
  const [sendToGroup, setSendToGroup] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('summary_tone, summary_length, preferred_summary_time, send_summary_to_group')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching preferences:', error);
        toast.error('Erro ao carregar preferências');
      } else if (data) {
        setSummaryTone(data.summary_tone || 'casual');
        setSummaryLength(data.summary_length || 'medio');
        setPreferredTime(data.preferred_summary_time || '09:00:00');
        setSendToGroup(data.send_summary_to_group ?? true);
      }
      setLoading(false);
    };

    if (userId) fetchPreferences();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        summary_tone: summaryTone,
        summary_length: summaryLength,
        preferred_summary_time: preferredTime,
        send_summary_to_group: sendToGroup,
      })
      .eq('id', userId);

    if (error) {
      toast.error('Erro ao salvar preferências');
      console.error('Error saving preferences:', error);
    } else {
      toast.success('Preferências atualizadas!');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Preferências de Resumos
        </CardTitle>
        <CardDescription>
          Personalize como seus resumos são gerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label>Tom do Resumo</Label>
          <Select value={summaryTone} onValueChange={setSummaryTone}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="tecnico">Técnico</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Define o estilo de linguagem usado no resumo
          </p>
        </div>

        <div className="space-y-2">
          <Label>Tamanho do Resumo</Label>
          <Select value={summaryLength} onValueChange={setSummaryLength}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="curto">Curto</SelectItem>
              <SelectItem value="medio">Médio</SelectItem>
              <SelectItem value="longo">Longo</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Controla o nível de detalhe do resumo
          </p>
        </div>

        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Horário dos Resumos
          </Label>
          <Select value={preferredTime} onValueChange={setPreferredTime}>
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
            checked={sendToGroup}
            onCheckedChange={setSendToGroup}
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Salvando...' : 'Salvar Preferências'}
        </Button>
      </CardContent>
    </>
  );
}
