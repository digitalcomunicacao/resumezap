import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface WhatsAppConnectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export const WhatsAppConnectionModal = ({
  open,
  onOpenChange,
  onSuccess,
}: WhatsAppConnectionModalProps) => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    if (open && !qrCode) {
      generateQrCode();
    }
  }, [open]);

  useEffect(() => {
    if (!instanceId || !open) return;

    const interval = setInterval(async () => {
      await checkStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [instanceId, open]);

  useEffect(() => {
    if (!expiresAt || !open) return;

    const timeout = setTimeout(() => {
      if (qrCode && !checking) {
        toast.error("QR Code expirado");
        generateQrCode();
      }
    }, 60000);

    return () => clearTimeout(timeout);
  }, [expiresAt, open]);

  const generateQrCode = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error("Você precisa estar logado");
      }

      const { data, error } = await supabase.functions.invoke('generate-qr-code', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setQrCode(data.qrCode);
      setInstanceId(data.instanceId);
      setExpiresAt(new Date(data.expiresAt));
    } catch (err: any) {
      console.error('Error generating QR code:', err);
      setError(err.message || 'Erro ao gerar QR Code');
      toast.error(err.message || 'Erro ao gerar QR Code');
    } finally {
      setLoading(false);
    }
  };

  const checkStatus = async () => {
    if (!instanceId || checking) return;

    setChecking(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) return;

      const { data, error } = await supabase.functions.invoke('check-whatsapp-status', {
        body: { instanceId },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      if (data.status === 'connected') {
        toast.success("WhatsApp conectado com sucesso!");
        onSuccess();
        onOpenChange(false);
      }
    } catch (err: any) {
      console.error('Error checking status:', err);
    } finally {
      setChecking(false);
    }
  };

  const handleClose = () => {
    setQrCode(null);
    setInstanceId(null);
    setError(null);
    setExpiresAt(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Conectar WhatsApp
          </DialogTitle>
          <DialogDescription className="text-center space-y-2">
            <p>Escaneie o QR Code com seu WhatsApp</p>
            <p className="text-xs text-muted-foreground bg-primary/5 p-2 rounded-md">
              💡 <strong>Suas notificações continuam funcionando!</strong> Conectamos apenas na hora de gerar o resumo para preservar suas notificações normais.
            </p>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {loading && (
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-center gap-4 p-4 bg-destructive/10 rounded-lg">
              <XCircle className="w-12 h-12 text-destructive" />
              <p className="text-sm text-destructive text-center">{error}</p>
              <Button onClick={generateQrCode} variant="outline" size="sm">
                Tentar Novamente
              </Button>
            </div>
          )}

          {qrCode && !loading && !error && (
            <>
              <div className="relative p-4 bg-white rounded-xl border-4 border-primary shadow-lg">
                <img
                  src={qrCode}
                  alt="QR Code WhatsApp"
                  className="w-64 h-64"
                />
                {checking && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center rounded-xl">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                )}
              </div>

              <div className="space-y-2 text-sm text-muted-foreground text-center max-w-xs">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    1
                  </div>
                  <p>Abra o WhatsApp no seu celular</p>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    2
                  </div>
                  <p>Toque em Mais opções → Aparelhos conectados</p>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                    3
                  </div>
                  <p>Aponte a câmera para esta tela</p>
                </div>
              </div>

              {checking && (
                <div className="flex items-center gap-2 text-sm text-primary">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verificando conexão...</span>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex justify-center">
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
