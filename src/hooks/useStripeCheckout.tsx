import { useEffect, useRef, useState } from 'react';

interface StripeWindow extends Window {
  Stripe?: any;
}

export const useStripeCheckout = (clientSecret: string | null) => {
  const checkoutRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientSecret || !checkoutRef.current) {
      setLoading(false);
      return;
    }

    const initializeStripe = async () => {
      try {
        setLoading(true);
        setError(null);

        // Wait for Stripe.js to load
        const stripeWindow = window as StripeWindow;
        if (!stripeWindow.Stripe) {
          throw new Error('Stripe.js não foi carregado');
        }

        const stripe = stripeWindow.Stripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);
        
        const checkout = await stripe.initEmbeddedCheckout({
          clientSecret,
        });

        if (checkoutRef.current) {
          checkout.mount(checkoutRef.current);
        }

        setLoading(false);

        return () => {
          checkout.destroy();
        };
      } catch (err) {
        console.error('Error initializing Stripe checkout:', err);
        setError(err instanceof Error ? err.message : 'Erro ao carregar checkout');
        setLoading(false);
      }
    };

    initializeStripe();
  }, [clientSecret]);

  return { checkoutRef, loading, error };
};
