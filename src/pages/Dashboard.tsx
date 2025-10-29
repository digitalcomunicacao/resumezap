import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, LogOut, CheckCircle2, Crown, CreditCard, Settings as SettingsIcon, Shield, AlertCircle, Clock, XCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useQualificationCheck } from "@/hooks/useQualificationCheck";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

import GroupsListModal from "@/components/GroupsListModal";
import { SummariesList } from "@/components/SummariesList";
import { ConnectionHistoryBanner } from "@/components/ConnectionHistoryBanner";
import { useSubscription, STRIPE_PLANS } from "@/contexts/SubscriptionContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PricingModal } from "@/components/PricingModal";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const { isQualified, loading: qualificationLoading } = useQualificationCheck();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [whatsappConnection, setWhatsappConnection] = useState<any>(null);
  const [generatingSummaries, setGeneratingSummaries] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [lastExecution, setLastExecution] = useState<any>(null);
  const [summariesCount, setSummariesCount] = useState(0);
  const [groupsCount, setGroupsCount] = useState(0);
  const { subscriptionPlan, subscriptionEnd, groupsLimit, openCustomerPortal } = useSubscription();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Redirecionar usuários FREE sem qualificação
  useEffect(() => {
    if (!loading && !qualificationLoading && user) {
      if (subscriptionPlan === 'free' && !isQualified) {
        toast.info("Complete seu cadastro para acessar a plataforma");
        navigate("/qualify");
      }
    }
  }, [subscriptionPlan, isQualified, loading, qualificationLoading, user, navigate]);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      
      if (error) {
        console.error("Error fetching profile:", error);
      } else {
        setProfile(data);
      }

      // Fetch counts for history banner
      const { count: summariesTotal } = await supabase
        .from('summaries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      const { count: groupsTotal } = await supabase
        .from('whatsapp_groups')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('archived', false);

      setSummariesCount(summariesTotal || 0);
      setGroupsCount(groupsTotal || 0);
      
      setLoadingProfile(false);
    };

    fetchProfile();

    const checkAdmin = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();
      setIsAdmin(!!data);
    };

    checkAdmin();
  }, [user]);

  useEffect(() => {
    const fetchWhatsAppConnection = async () => {
      if (!user) return;

      const { data, error } = await supabase
        .from("whatsapp_connections")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "connected")
        .maybeSingle();

      if (error) {
        console.error("Error fetching WhatsApp connection:", error);
      } else {
        setWhatsappConnection(data);
      }
    };

    fetchWhatsAppConnection();
    fetchLastExecution();
  }, [user]);

  const fetchLastExecution = async () => {
    if (!user) return;

    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('scheduled_executions')
      .select('*')
      .gte('execution_time', `${today}T00:00:00`)
      .order('execution_time', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setLastExecution(data);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error("Erro ao sair");
    } else {
      toast.success("Até logo!");
      navigate("/");
    }
  };

  const handleWhatsAppConnect = () => {
    navigate("/connect-whatsapp");
  };

  const handleGenerateSummaries = async () => {
    if (!whatsappConnection || profile?.selected_groups_count === 0) {
      toast.error("Configure seus grupos primeiro");
      return;
    }

    setGeneratingSummaries(true);
    trackEvent('manual_summary_generation');
    try {
      const { data, error } = await supabase.functions.invoke('trigger-summaries');
      
      if (error) throw error;

      toast.success(data.message || "Resumos sendo gerados!");
    } catch (error: any) {
      console.error('Error generating summaries:', error);
      toast.error(error.message || "Erro ao gerar resumos");
    } finally {
      setGeneratingSummaries(false);
    }
  };

  const handleConnectionSuccess = async () => {
    const { data } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", user?.id)
      .eq("status", "connected")
      .maybeSingle();

    setWhatsappConnection(data);

    const { data: profileData } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user?.id)
      .single();

    setProfile(profileData);
  };

  const handleWhatsAppDisconnect = async () => {
    if (!whatsappConnection) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { error } = await supabase.functions.invoke('disconnect-whatsapp', {
        body: { instanceId: whatsappConnection.instance_id },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast.success("WhatsApp desconectado");
      setWhatsappConnection(null);

      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();

      setProfile(profileData);
    } catch (err: any) {
      console.error('Error disconnecting WhatsApp:', err);
      toast.error("Erro ao desconectar WhatsApp");
    }
  };

  if (loading || loadingProfile || qualificationLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
          
          <div className="flex items-center gap-4">
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/admin")}
              >
                <Shield className="w-4 h-4 mr-2" />
                Admin
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/settings")}
            >
              <SettingsIcon className="w-4 h-4 mr-2" />
              Configurações
            </Button>
            <span className="text-sm text-muted-foreground">
              Olá, {profile?.full_name || user?.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
            <p className="text-muted-foreground">
              Bem-vindo ao Resume Zap! Aqui você gerenciará seus resumos do WhatsApp.
            </p>
          </div>

          {/* Banner de histórico preservado */}
          <ConnectionHistoryBanner
            summariesCount={summariesCount}
            groupsCount={groupsCount}
            whatsappConnected={profile?.whatsapp_connected || false}
          />

          {/* Banner de alerta para TEMP_CONN_FAILED */}
          {lastExecution?.status === 'completed_with_errors' && 
           lastExecution?.details?.results?.some((r: any) => r.errorCode === 'TEMP_CONN_FAILED') && (
            <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium mb-1">Conexão WhatsApp Expirada</p>
                  <p className="text-sm">
                    Sua última execução automática falhou porque a conexão temporária do WhatsApp expirou. 
                    Reescaneie o QR Code para reativar.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleWhatsAppConnect}
                  className="shrink-0"
                >
                  Reescanear QR
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Indicador de status da conexão WhatsApp */}
          {whatsappConnection && (
            <Card className="border-primary/20">
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                    <span className="font-medium">WhatsApp Conectado</span>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {profile?.connection_mode === 'temporary' ? '🔔 Modo Temporário' : '🔗 Sempre Conectada'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate('/execution-history')}
                      className="gap-2"
                    >
                      <Clock className="w-4 h-4" />
                      Ver Histórico
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {whatsappConnection ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      WhatsApp Conectado
                    </>
                  ) : (
                    "Conectar WhatsApp"
                  )}
                </CardTitle>
                <CardDescription>
                  {whatsappConnection
                    ? whatsappConnection.phone_number || "Número oculto"
                    : "Conecte sua conta do WhatsApp para começar a receber resumos"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {whatsappConnection ? (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={handleWhatsAppDisconnect}
                  >
                    Desconectar
                  </Button>
                ) : (
                  <Button className="w-full" onClick={handleWhatsAppConnect}>
                    Conectar WhatsApp
                  </Button>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Meus Grupos</CardTitle>
                <CardDescription>
                  {profile?.selected_groups_count > 0 
                    ? `${profile.selected_groups_count} grupo(s) selecionado(s)`
                    : "Selecione os grupos que deseja resumir"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  className="w-full" 
                  onClick={() => setShowGroupsModal(true)}
                  disabled={!whatsappConnection}
                >
                  {profile?.selected_groups_count > 0 ? "Gerenciar Grupos" : "Buscar Grupos"}
                </Button>
                {!whatsappConnection && (
                  <p className="text-xs text-muted-foreground mt-2 text-center">
                    Conecte o WhatsApp primeiro
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="shadow-soft border-primary/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {subscriptionPlan !== 'free' ? (
                    <>
                      <Crown className="w-5 h-5 text-primary" />
                      Plano {STRIPE_PLANS[subscriptionPlan].name}
                    </>
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5 text-muted-foreground" />
                      Plano Free
                    </>
                  )}
                </CardTitle>
                <CardDescription>
                  {subscriptionPlan !== 'free' ? (
                    <>
                      {groupsLimit} grupos • 
                      {subscriptionEnd && ` Renova em ${format(new Date(subscriptionEnd), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}`}
                    </>
                  ) : (
                    `${groupsLimit} grupo disponível`
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {subscriptionPlan !== 'free' ? (
                  profile?.manual_subscription ? (
                    <Button 
                      className="w-full" 
                      onClick={() => setShowPricingModal(true)}
                    >
                      Assinar Agora
                    </Button>
                  ) : (
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={openCustomerPortal}
                    >
                      Gerenciar Assinatura
                    </Button>
                  )
                ) : (
                  <Button 
                    className="w-full" 
                    onClick={() => setShowPricingModal(true)}
                  >
                    Fazer Upgrade
                  </Button>
                )}
              </CardContent>
            </Card>

          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Meus Resumos</h2>
            <SummariesList userId={user?.id} />
          </div>
        </div>
      </main>

      <GroupsListModal
        open={showGroupsModal}
        onOpenChange={setShowGroupsModal}
        userPlan={subscriptionPlan}
        onGroupsUpdated={async () => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user?.id)
            .single();
          setProfile(profileData);
        }}
      />

      <PricingModal open={showPricingModal} onOpenChange={setShowPricingModal} />
    </div>
  );
};

export default Dashboard;
