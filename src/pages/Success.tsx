import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription } from "@/contexts/SubscriptionContext";

const Success = () => {
  const navigate = useNavigate();
  const { checkSubscription } = useSubscription();

  useEffect(() => {
    // Refresh subscription status after successful checkout
    const timer = setTimeout(() => {
      checkSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkSubscription]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Assinatura Confirmada!</CardTitle>
          <CardDescription className="text-base">
            Sua assinatura foi processada com sucesso. Bem-vindo ao Resume Zap!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            Agora você pode aproveitar todos os benefícios do seu plano. Estamos atualizando suas informações...
          </p>
          <Button 
            onClick={() => navigate("/dashboard")} 
            className="w-full"
            size="lg"
          >
            Ir para o Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;
