import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, data?: any) => {
  console.log(`[SCHEDULED-SUMMARIES] ${step}`, data ? JSON.stringify(data) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Cron job started");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Buscar todos os usuários que têm conexões ativas do WhatsApp
    const { data: connections, error: connectionsError } = await supabase
      .from('whatsapp_connections')
      .select('user_id, instance_name')
      .eq('status', 'connected');

    if (connectionsError) {
      logStep("Error fetching connections", { error: connectionsError });
      throw connectionsError;
    }

    logStep("Active connections found", { count: connections?.length || 0 });

    if (!connections || connections.length === 0) {
      logStep("No active connections to process");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No active connections to process',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Processar cada usuário
    for (const connection of connections) {
      try {
        logStep("Processing user", { userId: connection.user_id });

        // Buscar o usuário
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
          connection.user_id
        );

        if (userError || !user) {
          logStep("Error fetching user", { userId: connection.user_id, error: userError });
          errorCount++;
          results.push({
            userId: connection.user_id,
            success: false,
            error: 'User not found'
          });
          continue;
        }

        // Usar service role key para chamar a função com permissões de admin
        // A função generate-summaries precisa autenticar o usuário internamente
        const response = await fetch(
          `${supabaseUrl}/functions/v1/generate-summaries`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'x-user-id': connection.user_id // Pass user ID via custom header
            }
          }
        );

        const summaryData = await response.json();

        if (!response.ok || summaryData.error) {
          logStep("Error generating summaries", { 
            userId: connection.user_id, 
            error: summaryData.error || `HTTP ${response.status}` 
          });
          errorCount++;
          results.push({
            userId: connection.user_id,
            success: false,
            error: summaryData.error || 'Failed to generate summaries'
          });
        } else {
          logStep("Summaries generated successfully", { userId: connection.user_id, data: summaryData });
          successCount++;
          results.push({
            userId: connection.user_id,
            success: true,
            summariesCount: summaryData?.summaries?.length || 0
          });
        }
      } catch (userError) {
        logStep("Unexpected error processing user", { userId: connection.user_id, error: userError });
        errorCount++;
        results.push({
          userId: connection.user_id,
          success: false,
          error: userError instanceof Error ? userError.message : 'Unknown error'
        });
      }
    }

    logStep("Cron job completed", { 
      total: connections.length, 
      success: successCount, 
      errors: errorCount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${connections.length} users`,
        successCount,
        errorCount,
        results
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    logStep("Fatal error", { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
