import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Sparkles } from "lucide-react";
import { useSubscription, STRIPE_PLANS, SubscriptionPlan } from "@/contexts/SubscriptionContext";
import { useState } from "react";

interface PricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const paidPlans = Object.entries(STRIPE_PLANS).filter(([key]) => key !== 'free') as [SubscriptionPlan, typeof STRIPE_PLANS[SubscriptionPlan]][];

export const PricingModal = ({ open, onOpenChange }: PricingModalProps) => {
  const { createCheckout, subscriptionPlan } = useSubscription();
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const handleSelectPlan = async (planKey: SubscriptionPlan) => {
    setLoadingPlan(planKey);
    try {
      await createCheckout(planKey);
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating checkout:', error);
    } finally {
      setLoadingPlan(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center flex items-center justify-center gap-2">
            <Sparkles className="w-6 h-6 text-primary" />
            Escolha seu Plano
          </DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-6 md:grid-cols-3 mt-6">
          {paidPlans.map(([key, plan]) => {
            const isCurrentPlan = subscriptionPlan === key;
            const isLoading = loadingPlan === key;
            
            return (
              <Card 
                key={key}
                className={`relative ${isCurrentPlan ? 'border-primary shadow-lg' : ''}`}
              >
                {isCurrentPlan && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      Plano Atual
                    </span>
                  </div>
                )}
                
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>
                    <span className="text-3xl font-bold text-foreground">R$ {plan.price}</span>
                    <span className="text-muted-foreground">/mês</span>
                  </CardDescription>
                </CardHeader>
                
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-sm">Até {plan.groups_limit} grupos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-sm">Resumos diários automáticos</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-primary" />
                      <span className="text-sm">IA avançada</span>
                    </div>
                  </div>
                  
                  <Button 
                    className="w-full"
                    onClick={() => handleSelectPlan(key)}
                    disabled={isCurrentPlan || isLoading}
                    variant={isCurrentPlan ? "outline" : "default"}
                  >
                    {isLoading ? "Carregando..." : isCurrentPlan ? "Plano Atual" : "Assinar"}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
