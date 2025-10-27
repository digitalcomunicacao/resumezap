import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check, Crown, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { STRIPE_PLANS, type SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { supabase } from "@/integrations/supabase/client";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { StripePaymentForm } from "@/components/StripePaymentForm";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const plans = {
  basic: {
    key: 'basic' as SubscriptionPlan,
    name: "Básico",
    price: "R$ 29",
    description: "Perfeito para uso pessoal",
    features: [
      "Até 5 grupos monitorados",
      "Resumos diários automáticos",
      "IA avançada para análise",
      "Suporte prioritário",
      "Exportação de resumos",
    ],
  },
  pro: {
    key: 'pro' as SubscriptionPlan,
    name: "Pro",
    price: "R$ 49",
    description: "Para profissionais exigentes",
    features: [
      "Até 10 grupos monitorados",
      "Resumos personalizados",
      "IA premium com análise profunda",
      "Suporte 24/7",
      "Webhooks e integrações",
      "Analytics avançado",
    ],
  },
  premium: {
    key: 'premium' as SubscriptionPlan,
    name: "Premium",
    price: "R$ 97",
    description: "Para equipes e empresas",
    features: [
      "Até 20 grupos monitorados",
      "Resumos customizados",
      "IA enterprise com máxima precisão",
      "Gerente de conta dedicado",
      "API completa",
      "Relatórios personalizados",
      "SLA garantido",
    ],
  },
};

const Checkout = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const planKey = searchParams.get('plan') as SubscriptionPlan;
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const plan = planKey ? plans[planKey as keyof typeof plans] : null;

  useEffect(() => {
    // Validate plan
    if (!planKey || planKey === 'free' || !plan) {
      navigate('/#pricing');
      return;
    }

    // Check authentication
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }
      
      initCheckout();
    };

    const initCheckout = async () => {
      try {
        setLoading(true);
        setError(null);

        const stripePlan = STRIPE_PLANS[planKey];
        if (!stripePlan.price_id) {
          throw new Error('Price ID não encontrado para este plano');
        }

        const { data, error: invokeError } = await supabase.functions.invoke('create-checkout', {
          body: { price_id: stripePlan.price_id },
        });

        if (invokeError) throw invokeError;

        if (data?.clientSecret) {
          setClientSecret(data.clientSecret);
          setLoading(false);
        } else {
          throw new Error('Não foi possível obter o checkout');
        }
      } catch (err) {
        console.error('Error initializing checkout:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar checkout');
        setLoading(false);
      }
    };

    checkAuth();
  }, [planKey, navigate, plan]);

  if (!plan) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/#pricing')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Planos
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-5 gap-6 max-w-7xl mx-auto">
          {/* Left Side - Plan Benefits */}
          <div className="lg:col-span-2 order-2 lg:order-1">
            <div className="lg:sticky lg:top-24 space-y-5">
              {/* Plan Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-semibold text-primary">{plan.name}</span>
              </div>

              {/* Price */}
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-foreground">{plan.price}</span>
                  <span className="text-xl text-muted-foreground">/mês</span>
                </div>
                <p className="text-muted-foreground mt-2">{plan.description}</p>
              </div>

              {/* Features */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-foreground">O que está incluído:</h3>
                <ul className="space-y-3">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <Check className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                      <span className="text-base text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Security Badge */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted/50 rounded-lg">
                <Shield className="w-5 h-5" />
                <span>Pagamento 100% seguro processado pelo Stripe</span>
              </div>

              {/* Testimonial */}
              <Card className="bg-muted/50 border-primary/20">
                <CardContent className="p-4">
                  <p className="text-sm italic text-foreground mb-2">
                    "Resume Zap economizou mais de 5 horas por semana da minha equipe. Agora conseguimos acompanhar todos os grupos importantes sem perder tempo lendo tudo."
                  </p>
                  <p className="text-xs text-muted-foreground font-semibold">
                    — João Silva, Gerente de Projetos
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Side - Checkout Form */}
          <div className="lg:col-span-3 order-1 lg:order-2">
            <Card className="shadow-sm">
              <CardHeader className="pb-4">
                <CardTitle className="text-xl">Finalizar Assinatura</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-6 pb-6">
                {loading && (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Carregando checkout seguro...</p>
                  </div>
                )}

                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Stripe Payment Element */}
                {clientSecret && (
                  <Elements 
                    stripe={stripePromise} 
                    options={{ 
                      clientSecret,
                      appearance: {
                        theme: 'stripe',
                        variables: {
                          colorPrimary: '#22c55e',
                          colorBackground: '#ffffff',
                          colorText: '#0a0a0a',
                          colorDanger: '#ef4444',
                          fontFamily: 'Inter, system-ui, sans-serif',
                          fontSizeBase: '15px',
                          spacingUnit: '4px',
                          borderRadius: '8px',
                          fontWeightNormal: '400',
                          fontWeightMedium: '500',
                          fontWeightBold: '600',
                        },
                        rules: {
                          '.Input': {
                            padding: '12px',
                            fontSize: '15px',
                            lineHeight: '1.5',
                          },
                          '.Label': {
                            fontSize: '14px',
                            fontWeight: '500',
                            marginBottom: '6px',
                          },
                          '.Tab': {
                            padding: '12px 16px',
                            fontSize: '15px',
                          },
                        },
                      },
                    }}
                  >
                    <StripePaymentForm planKey={planKey} />
                  </Elements>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
