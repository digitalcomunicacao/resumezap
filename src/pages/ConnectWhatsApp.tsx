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

  // ⛔ Remove loop gerando QR sem parar
  useEffect(() => {
    if (!user) return;
    if (qrCode) return; // evita re-render loop
    generateQrCode();
  }, [user, qrCode]);

  // ⛔ Remove interval que piscava e cria polling seguro
  useEffect(() => {
    if (!instanceId) return;

    let active = true;

    const poll = async () => {
      if (!active) return;

      const connected = await checkStatus();
      if (!connected) {
        setTimeout(poll, 3000);
      }
    };

    poll();

    return () => {
      active = false;
    };
  }, [instanceId]);

  // ❌ Timeout de expiração removido (causava loop)
  // Backend já lida com QR expirado

  const generateQrCode = async () => {
    if (instanceId) return;

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

      if (data?.connected) {
        toast.success("WhatsApp já conectado! Redirecionando...");
        setTimeout(() => navigate("/dashboard"), 1500);
        return;
      }

      if (!data?.qrCode || !data?.instanceId) {
        throw new Error("Resposta inesperada do servidor");
      }

      const formatted = data.qrCode.startsWith("data:image/png;base64,")
        ? data.qrCode
        : `data:image/png;base64,${data.qrCode}`;

      setQrCode(formatted);
      setInstanceId(data.instanceId);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Erro ao gerar QR Code");
      toast.error(err.message || "Erro ao gerar QR Code");
    } finally {
      setLoading(false);
    }
  };

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
      console.error("Error:", err);
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
              Conecte seu WhatsApp com Segurança
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Escaneie o QR Code abaixo para começar a receber resumos inteligentes dos seus grupos
            </p>
          </div>

          <Card className="mb-8 border-primary/20 bg-primary/5 shadow-soft animate-fade-in">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Shield className="w-6 h-6 text-primary" />
                Sua Privacidade em Primeiro Lugar
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <InfoItem
                  icon={<CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />}
                  title="Criptografia ponta a ponta mantida"
                  desc="Suas mensagens continuam seguras como sempre"
                />
                <InfoItem
                  icon={<CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />}
                  title="Nunca lemos suas conversas privadas"
                  desc="Apenas processamos para gerar resumos"
                />
                <InfoItem
                  icon={<CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />}
                  title="Conexão apenas para gerar resumos"
                  desc="Desconectamos automaticamente após processar"
                />
                <InfoItem
                  icon={<CheckCircle2 className="w-5 h-5 text-primary mt-0.5" />}
                  title="Você tem controle total"
                  desc="Desconecte quando quiser no Dashboard"
                />
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-8 items-start">
            <Instructions />

            <div className="flex flex-col items-center animate-scale-in">
              <Card className="shadow-lg border-primary/20 w-full max-w-md">
                <CardHeader className="text-center">
                  <CardTitle className="flex items-center justify-center gap-2">
                    <QrCodeIcon className="w-5 h-5 text-primary" />
                    QR Code
                  </CardTitle>
                  <CardDescription>Escaneie com seu WhatsApp</CardDescription>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-6 pb-8">
                  {loading && <LoadingQR />}

                  {error && <ErrorQR error={error} onRetry={generateQrCode} />}

                  {qrCode && !loading && !error && (
                    <>
                      <QRDisplay qrCode={qrCode} checking={checking} />

                      <div className="bg-primary/10 px-4 py-3 rounded-lg w-full text-center">
                        <p className="text-sm text-muted-foreground">
                          {checking ? (
                            <span className="flex items-center justify-center gap-2 text-primary font-medium">
                              <Loader2 className="w-4 h-4 animate-spin" />
                              Aguardando escaneamento...
                            </span>
                          ) : (
                            "Aproxime sua câmera para escanear"
                          )}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <FooterNote />
        </div>
      </main>
    </div>
  );
};

export default ConnectWhatsApp;

const InfoItem = ({ icon, title, desc }) => (
  <div className="flex items-start gap-3">
    {icon}
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  </div>
);

const Instructions = () => (
  <div className="space-y-6 animate-fade-in">
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-primary" />
          Como Conectar
        </CardTitle>
        <CardDescription>Siga os passos abaixo para conectar</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Step number="1" title="Abra o WhatsApp no seu celular" desc="Use o aplicativo WhatsApp oficial" />
        <Step number="2" title="Acesse Aparelhos Conectados" desc="Toque em Mais opções (⋮) → Aparelhos conectados" />
        <Step number="3" title="Escaneie o QR Code" desc="Aponte a câmera para o código ao lado" />
      </CardContent>
    </Card>

    <Card className="bg-muted/30 border-dashed shadow-soft">
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <Lock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium text-sm mb-1">💡 Como Funciona?</p>
            <p className="text-sm text-muted-foreground">
              Conectamos temporariamente apenas na hora de gerar seus resumos diários.
              <strong className="text-foreground"> Suas notificações normais continuam funcionando!</strong>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  </div>
);

const Step = ({ number, title, desc }) => (
  <div className="flex items-start gap-3">
    <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">
      {number}
    </div>
    <div>
      <p className="font-medium">{title}</p>
      <p className="text-sm text-muted-foreground">{desc}</p>
    </div>
  </div>
);

const LoadingQR = () => (
  <div className="flex flex-col items-center gap-4 py-12">
    <Loader2 className="w-16 h-16 animate-spin text-primary" />
    <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
  </div>
);

const ErrorQR = ({ error, onRetry }) => (
  <div className="flex flex-col items-center gap-4 p-6 bg-destructive/10 rounded-lg w-full">
    <XCircle className="w-16 h-16 text-destructive" />
    <p className="text-sm text-destructive text-center">{error}</p>
    <Button onClick={onRetry} variant="outline" size="sm">
      Tentar Novamente
    </Button>
  </div>
);

const QRDisplay = ({ qrCode, checking }) => (
  <div className="relative p-6 bg-white rounded-2xl border-4 border-primary shadow-xl">
    <img src={qrCode} alt="QR Code WhatsApp" className="w-72 h-72" />

    {checking && (
      <div className="absolute inset-0 bg-background/90 backdrop-blur-sm flex flex-col items-center justify-center rounded-2xl gap-3">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-sm font-medium text-primary">Verificando conexão...</p>
      </div>
    )}
  </div>
);

const FooterNote = () => (
  <div className="mt-12 text-center animate-fade-in">
    <p className="text-sm text-muted-foreground">
      Ao conectar, você concorda que seguimos os{" "}
      <strong className="text-foreground">padrões oficiais do WhatsApp</strong> para autenticação segura
    </p>
  </div>
);
