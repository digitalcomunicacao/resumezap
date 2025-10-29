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
  const [preferredTime, setPreferredTime] = useState("09:00:00");
  const [sendToGroup, setSendToGroup] = useState(true);
  const [connectionMode, setConnectionMode] = useState("temporary");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchPreferences = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('preferred_summary_time, send_summary_to_group, connection_mode')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching preferences:', error);
        toast.error('Erro ao carregar preferências');
      } else if (data) {
        setPreferredTime(data.preferred_summary_time || '09:00:00');
        setSendToGroup(data.send_summary_to_group ?? true);
        setConnectionMode(data.connection_mode || 'temporary');
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
        preferred_summary_time: preferredTime,
        send_summary_to_group: sendToGroup,
        connection_mode: connectionMode,
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
          <Clock className="w-5 h-5" />
          Agendamento de Resumos
        </CardTitle>
        <CardDescription>
          Configure quando e como receber seus resumos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
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
          <div className="bg-primary/10 border border-primary/20 rounded-md p-3 space-y-1">
            <p className="text-sm font-medium text-primary">
              ⏰ Horário de Brasília (BRT / GMT-3)
            </p>
            <p className="text-xs text-muted-foreground">
              O resumo será gerado quando chegar <strong>{preferredTime.substring(0, 5)}</strong> no horário de Brasília.
              Este é o horário que aparecerá no seu relógio no Brasil.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Modo de Conexão WhatsApp</Label>
          <Select value={connectionMode} onValueChange={setConnectionMode}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="temporary">
                <div className="space-y-0.5">
                  <div className="font-medium">🔔 Temporária (Recomendado)</div>
                  <div className="text-xs text-muted-foreground">Conecta apenas na hora do resumo</div>
                </div>
              </SelectItem>
              <SelectItem value="persistent">
                <div className="space-y-0.5">
                  <div className="font-medium">🔗 Sempre Conectada</div>
                  <div className="text-xs text-muted-foreground">Mantém conexão ativa</div>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <div className={`text-xs p-3 rounded-md ${connectionMode === 'temporary' ? 'bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800' : 'bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800'}`}>
            {connectionMode === 'temporary' ? (
              <>
                <p className="font-medium text-green-700 dark:text-green-300 mb-1">✅ Modo Recomendado</p>
                <p className="text-green-600 dark:text-green-400">
                  Suas notificações do WhatsApp funcionam normalmente. 
                  Conectamos automaticamente apenas no horário do resumo e depois desconectamos.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium text-orange-700 dark:text-orange-300 mb-1">⚠️ Atenção</p>
                <p className="text-orange-600 dark:text-orange-400">
                  Neste modo você pode receber menos notificações no celular, similar ao WhatsApp Web. 
                  Se a conexão cair, você precisará reconectar manualmente via QR Code.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <Label htmlFor="send-to-group" className="flex items-center gap-2">
              <Send className="w-4 h-4" />
              Enviar Resumo no Grupo
            </Label>
            <Switch
              id="send-to-group"
              checked={sendToGroup}
              onCheckedChange={setSendToGroup}
            />
          </div>
          
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              {sendToGroup 
                ? "✅ O resumo será postado automaticamente no grupo do WhatsApp no horário configurado."
                : "📊 O resumo ficará disponível apenas no seu Dashboard (privado)."
              }
            </p>
            <p className="text-xs bg-primary/5 p-2 rounded">
              💡 <strong>Como funciona:</strong> {sendToGroup 
                ? "Todos os membros do grupo verão o resumo. Ideal para grupos de trabalho ou comunidades."
                : "Apenas você verá o resumo aqui no Dashboard. Ideal para grupos pessoais ou sigilosos."
              }
            </p>
          </div>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? 'Salvando...' : 'Salvar Preferências'}
        </Button>
      </CardContent>
    </>
  );
}
