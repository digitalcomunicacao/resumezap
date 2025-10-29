import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Play } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function ManualTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [testMode, setTestMode] = useState<'all' | 'me'>('all');

  const handleManualExecution = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('scheduled-summaries', {
        body: { 
          manual: true, 
          time: new Date().toISOString(),
          testMode: testMode 
        }
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
          Força a execução imediata do sistema de geração de resumos
        </p>
        
        <div className="flex gap-2 mb-3">
          <Button
            variant={testMode === 'all' ? 'default' : 'outline'}
            onClick={() => setTestMode('all')}
            size="sm"
            className="flex-1"
          >
            Todos os usuários
          </Button>
          <Button
            variant={testMode === 'me' ? 'default' : 'outline'}
            onClick={() => setTestMode('me')}
            size="sm"
            className="flex-1"
          >
            Somente meu usuário
          </Button>
        </div>
        
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
              Executar Agora ({testMode === 'all' ? 'Todos' : 'Só Eu'})
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
                  {result.totalSummaries !== undefined && (
                    <div><strong>Total de resumos:</strong> {result.totalSummaries}</div>
                  )}
                  {result.skippedNoConnection !== undefined && result.skippedNoConnection > 0 && (
                    <div className="text-orange-600"><strong>Sem conexão:</strong> {result.skippedNoConnection}</div>
                  )}
                  {result.errors !== undefined && result.errors > 0 && (
                    <div className="text-yellow-600"><strong>Erros:</strong> {result.errors}</div>
                  )}
                  {result.errorCount !== undefined && result.errorCount > 0 && (
                    <div className="text-yellow-600"><strong>Com erros:</strong> {result.errorCount}</div>
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
