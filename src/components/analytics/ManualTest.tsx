import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ManualTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleManualExecution = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('scheduled-summaries', {
        body: { manual: true, time: new Date().toISOString() }
      });

      if (error) throw error;

      setResult(data);
      toast.success('Execução manual concluída com sucesso!');
    } catch (error: any) {
      console.error('Erro na execução manual:', error);
      toast.error('Erro ao executar teste manual');
      setResult({ error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-medium mb-2">Execução Manual do Cron</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Força a execução imediata do sistema de geração de resumos para todos os usuários
        </p>
        <Button 
          onClick={handleManualExecution} 
          disabled={isRunning}
          className="w-full"
        >
          {isRunning ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Executando...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              Executar Agora
            </>
          )}
        </Button>
      </div>

      {result && (
        <Alert>
          <AlertDescription>
            <div className="space-y-1 text-xs">
              {result.error ? (
                <div className="text-red-500">Erro: {result.error}</div>
              ) : (
                <>
                  <div><strong>Status:</strong> {result.status || 'Concluído'}</div>
                  {result.usersProcessed !== undefined && (
                    <div><strong>Usuários processados:</strong> {result.usersProcessed}</div>
                  )}
                  {result.summariesGenerated !== undefined && (
                    <div><strong>Resumos gerados:</strong> {result.summariesGenerated}</div>
                  )}
                  {result.errors !== undefined && result.errors > 0 && (
                    <div className="text-yellow-600"><strong>Erros:</strong> {result.errors}</div>
                  )}
                </>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
