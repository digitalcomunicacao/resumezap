import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, LogOut, CheckCircle2, Crown, CreditCard, Settings as SettingsIcon, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useQualificationCheck } from "@/hooks/useQualificationCheck";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConnectionModal } from "@/components/WhatsAppConnectionModal";
import GroupsListModal from "@/components/GroupsListModal";
import { SummariesList } from "@/components/SummariesList";
import { useSubscription, STRIPE_PLANS } from "@/contexts/SubscriptionContext";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PricingModal } from "@/components/PricingModal";
import { SummarySettings } from "@/components/SummarySettings";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const { trackEvent } = useAnalytics();
  const navigate = useNavigate();
  const { isQualified, loading: qualificationLoading } = useQualificationCheck();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [whatsappConnection, setWhatsappConnection] = useState<any>(null);
  const [generatingSummaries, setGeneratingSummaries] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
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
  }, [user]);

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
    setShowConnectionModal(true);
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
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={openCustomerPortal}
                  >
                    Gerenciar Assinatura
                  </Button>
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

            <SummarySettings 
              userId={user?.id || ''} 
              currentTime={profile?.preferred_summary_time || "09:00:00"}
              sendToGroup={profile?.send_summary_to_group ?? true}
            />
          </div>

          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-4">Meus Resumos</h2>
            <SummariesList userId={user?.id} />
          </div>
        </div>
      </main>

      <WhatsAppConnectionModal
        open={showConnectionModal}
        onOpenChange={setShowConnectionModal}
        onSuccess={handleConnectionSuccess}
      />

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
