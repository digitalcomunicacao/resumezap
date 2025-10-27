import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscription, STRIPE_PLANS } from "@/contexts/SubscriptionContext";

const Success = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkSubscription } = useSubscription();
  
  const sessionId = searchParams.get('session_id');
  const planKey = searchParams.get('plan');
  const plan = planKey ? STRIPE_PLANS[planKey as keyof typeof STRIPE_PLANS] : null;

  useEffect(() => {
    // Refresh subscription status after successful checkout
    const timer = setTimeout(() => {
      checkSubscription();
    }, 2000);

    return () => clearTimeout(timer);
  }, [checkSubscription]);

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <Card className="max-w-lg w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="w-16 h-16 text-primary" />
          </div>
          <CardTitle className="text-2xl">Assinatura Confirmada!</CardTitle>
          <CardDescription className="text-base">
            Sua assinatura foi processada com sucesso. Bem-vindo ao Resume Zap!
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {plan && (
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-semibold text-primary">{plan.name}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Você agora tem acesso a até {plan.groups_limit} grupos monitorados
              </p>
            </div>
          )}
          
          {sessionId && (
            <p className="text-xs text-muted-foreground text-center">
              ID da Sessão: {sessionId.substring(0, 20)}...
            </p>
          )}
          
          <p className="text-sm text-muted-foreground text-center">
            Estamos atualizando suas informações. Você já pode começar a usar todos os recursos do seu plano!
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
