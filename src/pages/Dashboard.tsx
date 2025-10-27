import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Loader2, LogOut, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { WhatsAppConnectionModal } from "@/components/WhatsAppConnectionModal";
import GroupsListModal from "@/components/GroupsListModal";

const Dashboard = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<any>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [showConnectionModal, setShowConnectionModal] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [whatsappConnection, setWhatsappConnection] = useState<any>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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

  if (loading || loadingProfile) {
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

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Plano Atual</CardTitle>
                <CardDescription>
                  Plano: {profile?.subscription_plan || "Free"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" variant="outline" disabled>
                  Gerenciar Plano
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Resumos</CardTitle>
                <CardDescription>
                  Visualize seus resumos diários
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full" disabled>
                  Em Breve
                </Button>
              </CardContent>
            </Card>
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
        userPlan={profile?.subscription_plan || 'free'}
        onGroupsUpdated={async () => {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user?.id)
            .single();
          setProfile(profileData);
        }}
      />
    </div>
  );
};

export default Dashboard;
