import { useEffect, useState } from "react";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GeneralSettingsProps {
  userId: string;
}

export function GeneralSettings({ userId }: GeneralSettingsProps) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Erro ao carregar perfil');
      } else if (data) {
        setFullName(data.full_name || '');
        setEmail(data.email || '');
      }
      setLoading(false);
    };

    if (userId) fetchProfile();
  }, [userId]);

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName })
      .eq('id', userId);

    if (error) {
      toast.error('Erro ao salvar alterações');
      console.error('Error saving profile:', error);
    } else {
      toast.success('Perfil atualizado com sucesso!');
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
          <User className="w-5 h-5" />
          Informações Gerais
        </CardTitle>
        <CardDescription>
          Atualize suas informações pessoais
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">Nome Completo</Label>
          <Input
            id="fullName"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Seu nome completo"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">E-mail</Label>
          <Input
            id="email"
            type="email"
            value={email}
            disabled
            className="bg-muted"
          />
          <p className="text-xs text-muted-foreground">
            O e-mail não pode ser alterado no momento
          </p>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar Alterações'}
        </Button>
      </CardContent>
    </>
  );
}
