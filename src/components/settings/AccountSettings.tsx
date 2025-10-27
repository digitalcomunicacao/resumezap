import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Shield, Download, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AccountSettingsProps {
  userId: string;
}

export function AccountSettings({ userId }: AccountSettingsProps) {
  const navigate = useNavigate();
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleExportData = async () => {
    setExporting(true);
    try {
      // Buscar todos os dados do usuário
      const [profileRes, summariesRes, groupsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('summaries').select('*').eq('user_id', userId),
        supabase.from('whatsapp_groups').select('*').eq('user_id', userId),
      ]);

      const userData = {
        profile: profileRes.data,
        summaries: summariesRes.data || [],
        groups: groupsRes.data || [],
        exportDate: new Date().toISOString(),
      };

      // Criar arquivo JSON para download
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `resume-zap-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('Dados exportados com sucesso!');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Erro ao exportar dados');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      // Deletar conexões do WhatsApp
      await supabase
        .from('whatsapp_connections')
        .delete()
        .eq('user_id', userId);

      // Deletar grupos
      await supabase
        .from('whatsapp_groups')
        .delete()
        .eq('user_id', userId);

      // Deletar resumos
      await supabase
        .from('summaries')
        .delete()
        .eq('user_id', userId);

      // Deletar perfil
      await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);

      // Deletar usuário
      const { error } = await supabase.auth.admin.deleteUser(userId);

      if (error) throw error;

      toast.success('Conta excluída com sucesso');
      navigate('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      toast.error('Erro ao excluir conta');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-5 h-5" />
          Gerenciar Conta
        </CardTitle>
        <CardDescription>
          Configurações de segurança e privacidade
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-4">
          <div className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Download className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Exportar Dados</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Baixe todos os seus dados em formato JSON (LGPD)
                </p>
                <Button
                  onClick={handleExportData}
                  disabled={exporting}
                  variant="outline"
                  size="sm"
                >
                  {exporting ? 'Exportando...' : 'Exportar Meus Dados'}
                </Button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-destructive/20 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Trash2 className="w-5 h-5 text-destructive mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-destructive mb-1">Zona de Perigo</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Excluir sua conta permanentemente. Esta ação não pode ser desfeita.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      Excluir Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá permanentemente excluir
                        sua conta e remover todos os seus dados de nossos servidores.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccount}
                        disabled={deleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleting ? 'Excluindo...' : 'Sim, Excluir Conta'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </>
  );
}
