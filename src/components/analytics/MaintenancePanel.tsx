import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ActiveAlerts } from "./ActiveAlerts";
import { CronStatus } from "./CronStatus";
import { HealthMetrics } from "./HealthMetrics";
import { ManualTest } from "./ManualTest";
import { UserTest } from "./UserTest";

export function MaintenancePanel() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Manutenção do Sistema</h2>
        <p className="text-muted-foreground">
          Monitore a saúde da plataforma e execute testes de diagnóstico
        </p>
      </div>

      <ActiveAlerts />
      
      <HealthMetrics />
      
      <CronStatus />
      
      <Card>
        <CardHeader>
          <CardTitle>🧪 Ferramentas de Teste</CardTitle>
          <CardDescription>
            Execute testes para diagnosticar problemas e verificar o funcionamento do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ManualTest />
          <UserTest />
        </CardContent>
      </Card>
    </div>
  );
}
