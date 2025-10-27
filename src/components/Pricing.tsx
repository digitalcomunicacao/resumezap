import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Check, Crown } from "lucide-react";
import { useSubscription, STRIPE_PLANS, type SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const plans = [
  {
    key: 'free' as SubscriptionPlan,
    name: "Free",
    price: "R$ 0",
    description: "Ideal para testar o serviço",
    features: [
      "1 grupo monitorado",
      "Resumos diários automáticos",
      "IA básica para resumos",
      "1 resumo manual por dia",
      "Suporte por email",
    ],
    cta: "Plano Atual",
    popular: false,
  },
  {
    key: 'basic' as SubscriptionPlan,
    name: "Básico",
    price: "R$ 29",
    description: "Perfeito para uso pessoal",
    features: [
      "Até 5 grupos monitorados",
      "Resumos diários automáticos",
      "IA avançada para resumos",
      "5 resumos manuais por dia",
      "Personalização de tom e tamanho",
      "Exportação em PDF/TXT",
      "Suporte prioritário",
    ],
    cta: "Assinar Agora",
    popular: true,
  },
  {
    key: 'pro' as SubscriptionPlan,
    name: "Pro",
    price: "R$ 49",
    description: "Para profissionais exigentes",
    features: [
      "Até 10 grupos monitorados",
      "Resumos diários automáticos",
      "IA premium (melhor qualidade)",
      "Resumos manuais ilimitados",
      "Personalização avançada",
      "Análise de sentimentos",
      "Analytics de mensagens",
      "Exportação em PDF/Word/TXT",
      "Suporte 24/7",
    ],
    cta: "Assinar Pro",
    popular: false,
  },
  {
    key: 'premium' as SubscriptionPlan,
    name: "Premium",
    price: "R$ 97",
    description: "Para equipes e empresas",
    features: [
      "Até 20 grupos monitorados",
      "Resumos diários automáticos",
      "IA enterprise (máxima qualidade)",
      "Resumos manuais ilimitados",
      "Personalização total",
      "Análise de sentimentos avançada",
      "Analytics completo",
      "Alertas inteligentes",
      "Exportação em todos os formatos",
      "Gerente de conta dedicado",
      "Suporte prioritário 24/7",
    ],
    cta: "Assinar Premium",
    popular: false,
  },
];

export const Pricing = () => {
  const { subscriptionPlan, loading } = useSubscription();
  const navigate = useNavigate();

  const handlePlanClick = async (planKey: SubscriptionPlan) => {
    // Check if user is logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate('/auth');
      return;
    }

    if (planKey === 'free') {
      navigate('/dashboard');
      return;
    }

    if (planKey === subscriptionPlan) {
      navigate('/dashboard');
      return;
    }

    // Navigate to checkout page
    navigate(`/checkout?plan=${planKey}`);
  };

  const isCurrentPlan = (planKey: SubscriptionPlan) => planKey === subscriptionPlan;

  return (
    <section className="py-24 bg-gradient-hero">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
          <h2 className="text-4xl font-bold text-foreground">
            Planos para todos os tamanhos
          </h2>
          <p className="text-xl text-muted-foreground">
            Escolha o plano ideal para suas necessidades. Upgrade ou downgrade quando quiser.
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {plans.map((plan, index) => {
            const isCurrent = isCurrentPlan(plan.key);
            
            return (
              <Card 
                key={index}
                className={`relative ${
                  isCurrent 
                    ? 'border-primary shadow-xl scale-105 bg-primary/5' 
                    : plan.popular 
                    ? 'border-primary shadow-hover scale-105' 
                    : 'border-primary/10'
                }`}
              >
                {isCurrent && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full flex items-center gap-1">
                    <Crown className="w-4 h-4" />
                    Seu Plano
                  </div>
                )}
                
                {!isCurrent && plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-primary text-primary-foreground text-sm font-semibold rounded-full">
                    Mais Popular
                  </div>
                )}
                
                <CardHeader className="space-y-2 pb-8">
                  <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-primary">{plan.price}</span>
                    {plan.price !== "R$ 0" && (
                      <span className="text-muted-foreground">/mês</span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    {plan.features.map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-sm text-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                
                <CardFooter>
                  <Button 
                    variant={isCurrent ? "default" : plan.popular ? "hero" : "outline"} 
                    className="w-full"
                    size="lg"
                    onClick={() => handlePlanClick(plan.key)}
                    disabled={loading || isCurrent}
                  >
                    {isCurrent ? "Plano Atual" : plan.cta}
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};
