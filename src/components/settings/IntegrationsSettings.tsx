import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug } from "lucide-react";

interface IntegrationsSettingsProps {
  userId: string;
}

export function IntegrationsSettings({ userId }: IntegrationsSettingsProps) {
  return (
    <>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Plug className="w-5 h-5" />
          Integrações
        </CardTitle>
        <CardDescription>
          Conecte o Resume Zap com outras ferramentas
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Plug className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Em Breve</h3>
          <p className="text-sm text-muted-foreground max-w-md">
            Integrações com Slack, Discord, E-mail e muito mais estarão disponíveis em breve!
          </p>
        </div>
      </CardContent>
    </>
  );
}
