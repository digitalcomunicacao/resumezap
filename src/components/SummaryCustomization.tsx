import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSubscription } from "@/contexts/SubscriptionContext";

interface SummaryCustomizationProps {
  userId: string;
}

export const SummaryCustomization = ({ userId }: SummaryCustomizationProps) => {
  const { subscriptionPlan } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [tone, setTone] = useState<string>("professional");
  const [size, setSize] = useState<string>("medium");
  const [thematicFocus, setThematicFocus] = useState<string>("");
  const [includeSentiment, setIncludeSentiment] = useState(false);
  const [enableAlerts, setEnableAlerts] = useState(false);
  const [enterpriseDetailLevel, setEnterpriseDetailLevel] = useState<string>("full");
  const [timezone, setTimezone] = useState<string>("America/Sao_Paulo");

  const isBasicOrHigher = ['basic', 'pro', 'premium', 'enterprise'].includes(subscriptionPlan);
  const isProOrHigher = ['pro', 'premium', 'enterprise'].includes(subscriptionPlan);
  const isEnterprise = subscriptionPlan === 'enterprise';

  useEffect(() => {
    const fetchPreferences = async () => {
      const { data } = await supabase
        .from('summary_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (data) {
        setTone(data.tone || 'professional');
        setSize(data.size || 'medium');
        setThematicFocus(data.thematic_focus || '');
        setIncludeSentiment(data.include_sentiment_analysis || false);
        setEnableAlerts(data.enable_smart_alerts || false);
        setEnterpriseDetailLevel(data.enterprise_detail_level || 'full');
        setTimezone(data.timezone || 'America/Sao_Paulo');
      }
    };

    fetchPreferences();
  }, [userId]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('summary_preferences')
        .upsert({
          user_id: userId,
          tone,
          size,
          thematic_focus: thematicFocus,
          include_sentiment_analysis: includeSentiment,
          enable_smart_alerts: enableAlerts,
          enterprise_detail_level: enterpriseDetailLevel,
          timezone: timezone,
        }, { onConflict: 'user_id' });

      if (error) throw error;
      toast.success("Preferências salvas!");
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error("Erro ao salvar preferências");
    } finally {
      setLoading(false);
    }
  };

  if (subscriptionPlan === 'free') {
    return (
      <Card className="shadow-soft border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-muted-foreground" />
            Personalização de Resumos
            <Badge variant="outline" className="ml-auto">
              <Crown className="w-3 h-3 mr-1" />
              Básico+
            </Badge>
          </CardTitle>
          <CardDescription>
            Personalize o tom, tamanho e foco dos seus resumos
          </CardDescription>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground mb-4">
            Faça upgrade para personalizar seus resumos
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Personalização de Resumos
        </CardTitle>
        <CardDescription>
          Ajuste como seus resumos são gerados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="tone">Tom dos Resumos</Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger id="tone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Profissional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="friendly">Amigável</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="size">Tamanho dos Resumos</Label>
          <Select value={size} onValueChange={setSize}>
            <SelectTrigger id="size">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="short">Curto</SelectItem>
              <SelectItem value="medium">Médio</SelectItem>
              <SelectItem value="long">Longo</SelectItem>
              <SelectItem value="detailed">Detalhado</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="focus">Foco Temático (opcional)</Label>
          <Input
            id="focus"
            placeholder="Ex: negócios, vendas, suporte..."
            value={thematicFocus}
            onChange={(e) => setThematicFocus(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Deixe em branco para resumir todos os tópicos
          </p>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="sentiment">Análise de Sentimentos</Label>
            <p className="text-xs text-muted-foreground">
              Identifica tom positivo/negativo
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!isProOrHigher && (
              <Badge variant="outline">
                <Crown className="w-3 h-3 mr-1" />
                Pro
              </Badge>
            )}
            <Switch
              id="sentiment"
              checked={includeSentiment}
              onCheckedChange={setIncludeSentiment}
              disabled={!isProOrHigher}
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="alerts">Alertas Inteligentes</Label>
            <p className="text-xs text-muted-foreground">
              Notifica sobre assuntos importantes
            </p>
          </div>
          <div className="flex items-center gap-2">
            {subscriptionPlan !== 'premium' && (
              <Badge variant="outline">
                <Crown className="w-3 h-3 mr-1" />
                Premium
              </Badge>
            )}
            <Switch
              id="alerts"
              checked={enableAlerts}
              onCheckedChange={setEnableAlerts}
              disabled={subscriptionPlan !== 'premium'}
            />
          </div>
        </div>

        {isEnterprise && (
          <div className="space-y-2">
            <Label htmlFor="detail-level">Nível de Detalhamento Enterprise</Label>
            <Select value={enterpriseDetailLevel} onValueChange={setEnterpriseDetailLevel}>
              <SelectTrigger id="detail-level">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Completo (padrão)</SelectItem>
                <SelectItem value="ultra">Ultra-detalhado</SelectItem>
                <SelectItem value="audit">Auditoria (máximo detalhe)</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Controle o nível de detalhamento dos resumos Enterprise
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="timezone">Fuso Horário</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
              <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
              <SelectItem value="America/Rio_Branco">Acre (GMT-5)</SelectItem>
              <SelectItem value="America/Noronha">Fernando de Noronha (GMT-2)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Horário usado para exibir timestamps das mensagens
          </p>
        </div>

        <Button onClick={handleSave} disabled={loading} className="w-full">
          {loading ? "Salvando..." : "Salvar Preferências"}
        </Button>
      </CardContent>
    </Card>
  );
};
