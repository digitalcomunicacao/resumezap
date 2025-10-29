import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, TestTube } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function UserTest() {
  const [email, setEmail] = useState("");
  const [hour, setHour] = useState("09");
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleUserTest = async () => {
    if (!email) {
      toast.error('Digite um email');
      return;
    }

    setIsRunning(true);
    setResult(null);

    try {
      // Buscar usuário pelo email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (profileError || !profile) {
        toast.error('Usuário não encontrado');
        setIsRunning(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('test-user-summary', {
        body: { 
          userId: profile.id, 
          simulatedHour: parseInt(hour)
        }
      });

      if (error) throw error;

      setResult(data);
      
      if (data?.success) {
        toast.success('Teste concluído com sucesso!');
      } else {
        toast.error('Teste concluído com problemas');
      }
    } catch (error: any) {
      console.error('Erro no teste:', error);
      toast.error('Erro ao executar teste');
      setResult({ error: error.message });
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-4 border-t pt-6">
      <div>
        <h3 className="text-sm font-medium mb-2">Teste Individual por Usuário</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Simula a geração de resumos para um usuário específico
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2 space-y-2">
          <Label htmlFor="test-email">Email do Usuário</Label>
          <Input
            id="test-email"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isRunning}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-hour">Horário Simulado</Label>
          <Select value={hour} onValueChange={setHour} disabled={isRunning}>
            <SelectTrigger id="test-hour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 24 }, (_, i) => (
                <SelectItem key={i} value={i.toString().padStart(2, '0')}>
                  {i.toString().padStart(2, '0')}:00
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button 
        onClick={handleUserTest} 
        disabled={isRunning || !email}
        className="w-full"
      >
        {isRunning ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Testando...
          </>
        ) : (
          <>
            <TestTube className="mr-2 h-4 w-4" />
            Executar Teste
          </>
        )}
      </Button>

      {result && (
        <Alert variant={result.success ? "default" : "destructive"}>
          <AlertTitle>
            {result.success ? '✅ Diagnóstico Completo' : '❌ Teste Falhou'}
          </AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2 text-xs">
              {result.diagnosis ? (
                <>
                  <div>
                    <strong>Conexão:</strong> {result.diagnosis.connection?.status || 'N/A'}
                    {result.diagnosis.connection?.type && ` (${result.diagnosis.connection.type})`}
                  </div>
                  <div>
                    <strong>Grupos:</strong> {result.diagnosis.groups?.selected || 0} selecionados 
                    de {result.diagnosis.groups?.total || 0} totais
                  </div>
                  <div>
                    <strong>Resumos:</strong> {result.diagnosis.summaries?.generated || 0} gerados,
                    {result.diagnosis.summaries?.failed || 0} falharam
                  </div>
                  {result.diagnosis.errors && result.diagnosis.errors.length > 0 && (
                    <div className="mt-2 p-2 bg-muted rounded">
                      <strong>Erros:</strong>
                      <ul className="list-disc list-inside mt-1">
                        {result.diagnosis.errors.map((err: string, idx: number) => (
                          <li key={idx}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : result.error ? (
                <div className="text-red-500">Erro: {result.error}</div>
              ) : (
                <div>Teste concluído sem detalhes disponíveis</div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
