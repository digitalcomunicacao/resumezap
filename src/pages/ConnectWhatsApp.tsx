import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, XCircle, Shield, Lock, Eye, MessageSquare, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export default function ConnectWhatsApp() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && !qrCode) {
      generateQrCode();
    }
  }, [user]);

  useEffect(() => {
    if (!instanceId) return;

    const interval = setInterval(async () => {
      await checkStatus();
    }, 3000);

    return () => clearInterval(interval);
  }, [instanceId]);

  useEffect(() => {
    if (!expiresAt) return;

    const timeout = setTimeout(() => {
      if (qrCode && !checking) {
        toast.error("QR Code expirado");
        generateQrCode();
      }
    }, 60000);

    return () => clearTimeout(timeout);
  }, [expiresAt]);

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

      if (data?.connected) {
        toast.success("WhatsApp já conectado!");
        navigate("/dashboard");
        return;
      }

      const qr: string | undefined = data?.qrCode;
      const instance: string | undefined = data?.instanceId;
      const expires: string | undefined = data?.expiresAt;

      if (qr && instance) {
        const formattedQr = qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`;
        setQrCode(formattedQr);
        setInstanceId(instance);
        setExpiresAt(expires ? new Date(expires) : new Date(Date.now() + 60000));
        return;
      }

      const message = data?.message || data?.error || 'Não foi possível gerar o QR Code';
      throw new Error(message);
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
        navigate("/dashboard");
      }
    } catch (err: any) {
      console.error('Error checking status:', err);
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
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Resume Zap</span>
          </div>
          
          <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")}>
            Voltar ao Dashboard
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold mb-2">Conectar WhatsApp</h1>
            <p className="text-muted-foreground">
              Conecte sua conta do WhatsApp de forma segura para começar a receber resumos
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* QR Code Section */}
            <Card className="shadow-soft">
              <CardContent className="p-8">
                <div className="flex flex-col items-center gap-6">
                  {loading && (
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-12 h-12 animate-spin text-primary" />
                      <p className="text-sm text-muted-foreground">Gerando QR Code...</p>
                    </div>
                  )}

                  {error && (
                    <div className="flex flex-col items-center gap-4 p-4 bg-destructive/10 rounded-lg w-full">
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

                      <div className="space-y-3 text-sm text-muted-foreground w-full">
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                            1
                          </div>
                          <p>Abra o WhatsApp no seu celular</p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
                            2
                          </div>
                          <p>Toque em <strong>Mais opções</strong> → <strong>Aparelhos conectados</strong></p>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mt-0.5">
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

                      <div className="text-xs text-muted-foreground bg-primary/5 p-3 rounded-md w-full text-center">
                        💡 <strong>Suas notificações continuam funcionando!</strong> Conectamos apenas na hora de gerar o resumo.
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Security & Privacy Section */}
            <div className="space-y-6">
              <Card className="shadow-soft border-primary/20 bg-primary/5">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Shield className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-2">Sua privacidade é nossa prioridade</h3>
                      <p className="text-sm text-muted-foreground">
                        Seguimos os mais altos padrões de segurança para proteger seus dados
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border/40">
                  <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Criptografia de Ponta a Ponta</h4>
                    <p className="text-sm text-muted-foreground">
                      As mensagens são criptografadas de ponta a ponta e <strong>não são lidas pelo ResumeZap</strong>. Apenas processamos os resumos de forma segura.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border/40">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-blue-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Autenticação Segura</h4>
                    <p className="text-sm text-muted-foreground">
                      A conexão é segura e <strong>segue os padrões de autenticação do WhatsApp</strong>. Você tem controle total sobre sua conta.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-card rounded-lg border border-border/40">
                  <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                    <Eye className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <h4 className="font-semibold mb-1">Transparência Total</h4>
                    <p className="text-sm text-muted-foreground">
                      Você pode desconectar sua conta a qualquer momento pelo Dashboard. Seus dados são seus.
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/50 rounded-lg border border-border/40">
                <p className="text-xs text-muted-foreground text-center">
                  Ao conectar, você concorda com nossos{" "}
                  <a href="#" className="text-primary hover:underline">Termos de Uso</a>
                  {" "}e{" "}
                  <a href="#" className="text-primary hover:underline">Política de Privacidade</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
