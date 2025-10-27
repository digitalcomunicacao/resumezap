import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");
    logStep("Authorization header found");

    const token = authHeader.replace("Bearer ", "");
    logStep("Authenticating user with token");
    
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Check for manual subscription override
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('subscription_plan, subscription_end_date, manual_subscription')
      .eq('id', user.id)
      .maybeSingle();
    
    logStep("Profile data retrieved", { profile });

    // If manual subscription is active and not expired, use it
    if (profile?.manual_subscription && profile.subscription_plan !== 'free') {
      const endDate = profile.subscription_end_date ? new Date(profile.subscription_end_date) : null;
      const isExpired = endDate && endDate < new Date();
      
      logStep("Manual subscription check", { 
        hasEndDate: !!endDate, 
        isExpired, 
        plan: profile.subscription_plan 
      });

      // If expired, revert to free plan
      if (isExpired) {
        logStep("Manual subscription expired, reverting to free");
        await supabaseClient
          .from('profiles')
          .update({
            subscription_plan: 'free',
            manual_subscription: false,
            subscription_end_date: null
          })
          .eq('id', user.id);
        
        return new Response(JSON.stringify({ 
          subscribed: false,
          product_id: null,
          subscription_end: null,
          subscription_plan: 'free'
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      // Manual subscription is active, return it
      if (!isExpired || !endDate) {
        logStep("Using manual subscription", { plan: profile.subscription_plan });
        return new Response(JSON.stringify({
          subscribed: profile.subscription_plan !== 'free',
          product_id: null,
          subscription_end: profile.subscription_end_date,
          subscription_plan: profile.subscription_plan,
          manual_override: true
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }
    }

    // If no manual override, check Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep("No customer found, returning unsubscribed state");
      
      // Only update if not a manual subscription
      if (profile?.manual_subscription) {
        logStep("Preserving manual subscription", { 
          plan: profile.subscription_plan,
          userId: user.id 
        });
      } else {
        logStep("Updating to free plan (no manual override)");
        await supabaseClient
          .from('profiles')
          .update({ 
            subscription_status: 'inactive',
            stripe_product_id: null,
            subscription_plan: 'free',
            subscription_end_date: null
          })
          .eq('id', user.id);
      }
      
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        subscription_plan: profile?.manual_subscription ? profile.subscription_plan : 'free'
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep("Found Stripe customer", { customerId });

    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "active",
      limit: 1,
    });
    
    const hasActiveSub = subscriptions.data.length > 0;
    let productId = null;
    let subscriptionEnd = null;
    let subscriptionPlan = 'free';

    if (hasActiveSub) {
      const subscription = subscriptions.data[0];
      subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
      productId = subscription.items.data[0].price.product as string;
      
      // Determine plan based on product_id
      if (productId === 'prod_TJKjQFeYkduCi3') subscriptionPlan = 'basic';
      else if (productId === 'prod_TJKjqTGj6zixKB') subscriptionPlan = 'pro';
      else if (productId === 'prod_TJKjwMx7K1HN1D') subscriptionPlan = 'premium';
      
      logStep("Active subscription found", { 
        subscriptionId: subscription.id, 
        endDate: subscriptionEnd,
        productId,
        subscriptionPlan 
      });

      // Update profile with subscription info
      await supabaseClient
        .from('profiles')
        .update({ 
          subscription_status: 'active',
          stripe_customer_id: customerId,
          stripe_subscription_id: subscription.id,
          stripe_product_id: productId,
          subscription_plan: subscriptionPlan,
          subscription_end_date: subscriptionEnd
        })
        .eq('id', user.id);
    } else {
      logStep("No active subscription found");
      
      // Only update if not a manual subscription
      if (profile?.manual_subscription) {
        logStep("Preserving manual subscription (no Stripe subscription)", { 
          plan: profile.subscription_plan,
          userId: user.id 
        });
      } else {
        logStep("Updating to free plan (no active subscription, no manual override)");
        await supabaseClient
          .from('profiles')
          .update({ 
            subscription_status: 'inactive',
            stripe_product_id: null,
            subscription_plan: 'free',
            subscription_end_date: null
          })
          .eq('id', user.id);
      }
    }

    return new Response(JSON.stringify({
      subscribed: hasActiveSub,
      product_id: productId,
      subscription_end: subscriptionEnd,
      subscription_plan: subscriptionPlan
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in check-subscription", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
