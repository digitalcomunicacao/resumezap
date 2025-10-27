import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Product and price mapping
export const STRIPE_PLANS = {
  free: {
    name: 'Free',
    price_id: null,
    product_id: null,
    groups_limit: 1,
    price: 0,
  },
  basic: {
    name: 'Plano Básico',
    price_id: 'price_1SMi3vISNZSgfXWpjUn9L61g',
    product_id: 'prod_TJKjQFeYkduCi3',
    groups_limit: 5,
    price: 29,
  },
  pro: {
    name: 'Plano Pro',
    price_id: 'price_1SMi44ISNZSgfXWphBJLPYSt',
    product_id: 'prod_TJKjqTGj6zixKB',
    groups_limit: 10,
    price: 49,
  },
  premium: {
    name: 'Plano Premium',
    price_id: 'price_1SMi4CISNZSgfXWpMhKTeAXh',
    product_id: 'prod_TJKjwMx7K1HN1D',
    groups_limit: 20,
    price: 97,
  },
  enterprise: {
    name: 'Enterprise',
    price_id: null,
    product_id: null,
    groups_limit: 999,
    price: 0,
  },
} as const;

export type SubscriptionPlan = keyof typeof STRIPE_PLANS;

interface SubscriptionContextType {
  subscriptionPlan: SubscriptionPlan;
  subscriptionEnd: string | null;
  isSubscribed: boolean;
  loading: boolean;
  groupsLimit: number;
  checkSubscription: () => Promise<void>;
  openCustomerPortal: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

export const SubscriptionProvider = ({ children }: { children: ReactNode }) => {
  const [subscriptionPlan, setSubscriptionPlan] = useState<SubscriptionPlan>('free');
  const [subscriptionEnd, setSubscriptionEnd] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const checkSubscription = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setSubscriptionPlan('free');
        setIsSubscribed(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.functions.invoke('check-subscription');
      
      if (error) {
        console.error('Error checking subscription:', error);
        setSubscriptionPlan('free');
        setIsSubscribed(false);
      } else {
        setIsSubscribed(data.subscribed);
        setSubscriptionPlan(data.subscription_plan || 'free');
        setSubscriptionEnd(data.subscription_end);
      }
    } catch (error) {
      console.error('Error in checkSubscription:', error);
      setSubscriptionPlan('free');
      setIsSubscribed(false);
    } finally {
      setLoading(false);
    }
  };


  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal');

      if (error) throw error;

      if (data?.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error opening customer portal:', error);
      toast({
        title: 'Erro',
        description: 'Não foi possível abrir o portal de gerenciamento.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    checkSubscription();

    // Auto-refresh every minute
    const interval = setInterval(checkSubscription, 60000);

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      checkSubscription();
    });

    return () => {
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, []);

  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data } = await supabase
        .from("profiles")
        .select("manual_groups_limit")
        .eq("id", session.user.id)
        .maybeSingle();

      setProfile(data);
    };

    fetchProfile();
  }, [subscriptionPlan]);

  const groupsLimit = React.useMemo(() => {
    if (profile?.manual_groups_limit !== null && profile?.manual_groups_limit !== undefined) {
      return profile.manual_groups_limit;
    }
    
    // Garantir que o plano existe no STRIPE_PLANS
    const plan = STRIPE_PLANS[subscriptionPlan as keyof typeof STRIPE_PLANS];
    return plan?.groups_limit ?? 1; // Default para 1 se não encontrar
  }, [profile, subscriptionPlan]);

  return (
    <SubscriptionContext.Provider
      value={{
        subscriptionPlan,
        subscriptionEnd,
        isSubscribed,
        loading,
        groupsLimit,
        checkSubscription,
        openCustomerPortal,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
