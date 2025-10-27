import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, data?: any) => {
  console.log(`[MANUAL-SEND-SUMMARY] ${step}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      logStep("Authentication failed", { error: authError });
      throw new Error('Unauthorized');
    }

    logStep("User authenticated", { userId: user.id });

    const { summaryId } = await req.json();

    if (!summaryId) {
      throw new Error('summaryId is required');
    }

    logStep("Fetching summary", { summaryId });

    // Fetch summary data
    const { data: summary, error: summaryError } = await supabase
      .from('summaries')
      .select('*')
      .eq('id', summaryId)
      .eq('user_id', user.id)
      .single();

    if (summaryError || !summary) {
      logStep("Summary not found", { error: summaryError });
      throw new Error('Summary not found');
    }

    logStep("Summary fetched", { groupId: summary.group_id, groupName: summary.group_name });

    // Check if already sent
    const { data: existingDelivery } = await supabase
      .from('summary_deliveries')
      .select('id, status')
      .eq('summary_id', summaryId)
      .eq('group_id', summary.group_id)
      .maybeSingle();

    if (existingDelivery) {
      logStep("Summary already sent", { deliveryId: existingDelivery.id, status: existingDelivery.status });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Summary already sent to this group',
          status: existingDelivery.status
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    // Fetch WhatsApp connection
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('instance_name, status')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError || !connection) {
      logStep("No active WhatsApp connection", { error: connectionError });
      throw new Error('No active WhatsApp connection found');
    }

    logStep("WhatsApp connection found", { instanceName: connection.instance_name });

    // Call send-group-summary
    const sendResponse = await supabase.functions.invoke('send-group-summary', {
      body: {
        summaryId: summary.id,
        userId: user.id,
        groupId: summary.group_id,
        groupName: summary.group_name,
        summaryText: summary.summary_text,
        instanceName: connection.instance_name,
      }
    });

    if (sendResponse.error) {
      logStep("Error sending summary", { error: sendResponse.error });
      throw new Error(`Failed to send summary: ${sendResponse.error.message}`);
    }

    logStep("Summary sent successfully", sendResponse.data);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Summary sent successfully',
        data: sendResponse.data
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    logStep("Fatal error", { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
