import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, MessageSquare, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OverviewMetrics } from "@/components/analytics/OverviewMetrics";
import { UsersAnalytics } from "@/components/analytics/UsersAnalytics";
import { SummariesAnalytics } from "@/components/analytics/SummariesAnalytics";
import { GroupsAnalytics } from "@/components/analytics/GroupsAnalytics";

const Admin = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    const checkAdminRole = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        if (error) {
          console.error('Error checking admin role:', error);
          toast.error('Erro ao verificar permissões');
          navigate("/dashboard");
          return;
        }

        if (!data) {
          toast.error('Você não tem permissão para acessar esta página');
          navigate("/dashboard");
          return;
        }

        setIsAdmin(true);
      } catch (error) {
        console.error('Error:', error);
        navigate("/dashboard");
      } finally {
        setCheckingAdmin(false);
      }
    };

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading, navigate]);

  if (authLoading || checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="text-xl font-bold">Resume Zap</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">Admin</span>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6">
          <div>
            <h1 className="text-3xl font-bold mb-2">Dashboard Administrativo</h1>
            <p className="text-muted-foreground">
              Monitoramento e análise da plataforma Resume Zap
            </p>
          </div>

          <OverviewMetrics />

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Resumos</CardTitle>
                <CardDescription>Estatísticas de geração de resumos</CardDescription>
              </CardHeader>
              <CardContent>
                <SummariesAnalytics />
              </CardContent>
            </Card>

            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle>Grupos</CardTitle>
                <CardDescription>Grupos mais ativos</CardDescription>
              </CardHeader>
              <CardContent>
                <GroupsAnalytics />
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Usuários</CardTitle>
              <CardDescription>Análise de usuários da plataforma</CardDescription>
            </CardHeader>
            <CardContent>
              <UsersAnalytics />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Admin;
