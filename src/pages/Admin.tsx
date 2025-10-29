import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MessageSquare, Loader2, Shield } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { OverviewMetrics } from "@/components/analytics/OverviewMetrics";
import { FunnelMetrics } from "@/components/analytics/FunnelMetrics";
import { UsageMetrics } from "@/components/analytics/UsageMetrics";
import { SummariesAnalytics } from "@/components/analytics/SummariesAnalytics";
import { GroupsAnalytics } from "@/components/analytics/GroupsAnalytics";
import { ErrorLogsTable } from "@/components/analytics/ErrorLogsTable";
import { LeadsManagement } from "@/components/analytics/LeadsManagement";
import { AdminLogsTable } from "@/components/analytics/AdminLogsTable";
import { UsersManagement } from "@/components/analytics/UsersManagement";
import { ConnectionsHistory } from "@/components/analytics/ConnectionsHistory";
import { MaintenancePanel } from "@/components/analytics/MaintenancePanel";

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

          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="overview">Visão Geral</TabsTrigger>
              <TabsTrigger value="usage">Uso</TabsTrigger>
              <TabsTrigger value="users">Usuários</TabsTrigger>
              <TabsTrigger value="connections">Conexões</TabsTrigger>
              <TabsTrigger value="maintenance">Manutenção</TabsTrigger>
              <TabsTrigger value="leads">Leads</TabsTrigger>
              <TabsTrigger value="logs">Logs</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              <OverviewMetrics />
              <FunnelMetrics />
            </TabsContent>

            <TabsContent value="usage" className="space-y-6 mt-6">
              <UsageMetrics />

              <div className="grid gap-6 md:grid-cols-2">
                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle>Resumos Diários</CardTitle>
                    <CardDescription>Estatísticas de geração nos últimos 7 dias</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <SummariesAnalytics />
                  </CardContent>
                </Card>

                <Card className="shadow-soft">
                  <CardHeader>
                    <CardTitle>Top Grupos</CardTitle>
                    <CardDescription>Grupos com mais resumos na última semana</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <GroupsAnalytics />
                  </CardContent>
                </Card>
              </div>

              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Logs de Erros</CardTitle>
                  <CardDescription>Monitoramento de erros do sistema</CardDescription>
                </CardHeader>
                <CardContent>
                  <ErrorLogsTable />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="users" className="mt-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Gestão de Usuários</CardTitle>
                  <CardDescription>
                    Visualize e gerencie todos os usuários da plataforma
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <UsersManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="connections" className="mt-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Histórico de Conexões WhatsApp</CardTitle>
                  <CardDescription>
                    Monitore e diagnostique problemas de conexão dos usuários
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ConnectionsHistory />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-6">
              <MaintenancePanel />
            </TabsContent>

            <TabsContent value="leads" className="mt-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Gestão de Leads</CardTitle>
                  <CardDescription>
                    Visualize e gerencie todos os leads qualificados
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <LeadsManagement />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="logs" className="mt-6">
              <Card className="shadow-soft">
                <CardHeader>
                  <CardTitle>Logs de Ações Admin</CardTitle>
                  <CardDescription>
                    Histórico de todas as ações realizadas por administradores
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <AdminLogsTable />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  );
};

export default Admin;
