import { useState, FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2 } from "lucide-react";

interface StripePaymentFormProps {
  planKey: string;
}

export const StripePaymentForm = ({ planKey }: StripePaymentFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { error: submitError } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/success?plan=${planKey}`,
        },
      });

      if (submitError) {
        setError(submitError.message || 'Erro ao processar pagamento');
        setLoading(false);
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Erro ao processar pagamento');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <PaymentElement 
          options={{
            layout: {
              type: 'accordion',
              defaultCollapsed: false,
              radios: false,
              spacedAccordionItems: false
            },
            fields: {
              billingDetails: {
                address: {
                  country: 'auto'
                }
              }
            },
            paymentMethodOrder: ['card'],
          }}
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="pt-2">
        <Button 
          type="submit" 
          disabled={!stripe || loading}
          className="w-full h-12 text-base font-semibold"
          size="lg"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Processando...
            </>
          ) : (
            'Confirmar Assinatura'
          )}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground text-center pt-1">
        Ao confirmar, você concorda com nossos termos de serviço e política de privacidade
      </p>
    </form>
  );
};
