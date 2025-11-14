import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Loader2,
  ArrowLeft,
  Shield,
  Lock,
  CheckCircle2,
  XCircle,
  MessageSquare,
  Smartphone,
  QrCode as QrCodeIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

const ConnectWhatsApp = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 🔥 Rodar APENAS 1x no mount
  useEffect(() => {
    if (user) {
      generateQrCode();
    }
  }, [user]);

  // ===========================
  // 🔍 CHECK DE STATUS SEM LOOP
  // ===========================
  useEffect(() => {
    if (!instanceId) return;

    let stop = false;

    const check = async () => {
      if (stop) return;
      const isConnected = await checkStatus();
      if (!isConnected) {
        setTimeout(check, 3000);
      }
    };

    check();

    return () => {
      stop = true; // cancela polling ao desmontar
    };
  }, [instanceId]);

  // ===========================
  // 📌 FUNÇÃO PRINCIPAL: GERAR QR
  // ===========================
  const generateQrCode = async () => {
    if (instanceId) return; // impede execução dupla

    setLoading(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Você precisa estar logado");

      const { data, error } = await supabase.functions.invoke("generate-qr-code", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      // usuário já conectado
      if (data?.connected) {
        toast.success("WhatsApp já conectado!");
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }

      if (!data?.qrCode || !data?.instanceId) {
        throw new Error("Resposta inesperada do servidor");
      }

      const qrFormatted = data.qrCode.startsWith("data:image/png;base64,")
        ? data.qrCode
        : `data:image/png;base64,${data.qrCode}`;

      setQrCode(qrFormatted);
      setInstanceId(data.instanceId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao gerar QR");
      toast.error(err.message || "Erro ao gerar QR");
    } finally {
      setLoading(false);
    }
  };

  // ===========================
  // 📡 VERIFICAR STATUS
  // ===========================
  const checkStatus = async () => {
    if (!instanceId) return false;
    if (checking) return false;

    setChecking(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return false;

      const { data, error } = await supabase.functions.invoke("check-whatsapp-status", {
        body: { instanceId },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) throw error;

      if (data.status === "connected") {
        toast.success("WhatsApp conectado com sucesso!");

        setTimeout(() => {
          navigate("/dashboard");
        }, 1500);

        return true;
      }

      return false;
    } catch (err) {
      console.error(err);
      return false;
    } finally {
      setChecking(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Voltar ao Dashboard
          </Button>

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Resume Zap</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12 animate-fade-in">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Conecte seu WhatsApp
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escaneie o QR Code para conectar sua conta
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <div className="space-y-6 animate-fade-in">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="w-5 h-5 text-primary" />
                    Como conectar
                  </CardTitle>
                  <CardDescription>Siga os passos abaixo</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p>1. Abra o WhatsApp</p>
                  <p>2. Vá em Aparelhos Conectados</p>
                  <p>3. Escaneie o QR Code ao lado</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-col items-center animate-scale-in">
              <Card className="shadow-lg border-primary/20 w-full max-w-md">
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <QrCodeIcon className="w-5 h-5 text-primary" />
                    QR Code
                  </CardTitle>
                  <CardDescription>Escaneie com o WhatsApp</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-6 pb-8">
                  {loading && (
                    <div className="py-12 flex flex-col items-center gap-4">
                      <Loader2 className="w-16 h-16 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex flex-col items-center gap-4 p-6 bg-destructive/10 rounded-lg w-full">
                      <XCircle className="w-16 h-16 text-destructive" />
                      <p className="text-sm text-destructive text-center">{error}</p>
                      <Button onClick={generateQrCode} variant="outline" size="sm">
                        Tentar novamente
                      </Button>
                    </div>
                  )}

                  {qrCode && !loading && !error && (
                    <>
                      <div className="relative p-6 bg-white rounded-2xl border-4 border-primary shadow-xl">
                        <img src={qrCode} alt="QR" className="w-72 h-72" />

                        {checking && (
                          <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex items-center justify-center rounded-2xl gap-3">
                            <Loader2 className="w-12 h-12 animate-spin text-primary" />
                            <p>Verificando...</p>
                          </div>
                        )}
                      </div>

                      <p className="text-sm text-muted-foreground">Aguardando escaneamento...</p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ConnectWhatsApp;
