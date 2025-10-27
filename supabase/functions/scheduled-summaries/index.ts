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

    // Obter hora atual em Brasília (GMT-3)
    const now = new Date();
    const currentHour = now.getUTCHours() - 3; // Ajustar para GMT-3
    const adjustedHour = currentHour < 0 ? currentHour + 24 : currentHour;
    const timeToMatch = `${adjustedHour.toString().padStart(2, '0')}:00:00`;

    logStep("Checking for users with preferred time", { currentHour: adjustedHour, timeToMatch });

    // Buscar perfis de usuários cujo horário preferido corresponde à hora atual
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, preferred_summary_time')
      .eq('preferred_summary_time', timeToMatch);

    if (profilesError) {
      logStep("Error fetching profiles", { error: profilesError });
      throw profilesError;
    }

    logStep("Profiles found with matching time", { count: profiles?.length || 0 });

    if (!profiles || profiles.length === 0) {
      logStep("No users with preferred time matching current hour");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No users scheduled for ${timeToMatch}`,
          processed: 0,
          currentHour: adjustedHour
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Processar cada usuário
    for (const profile of profiles) {
      try {
        // Verificar se o usuário tem conexão ativa do WhatsApp
        const { data: connection, error: connectionError } = await supabase
          .from('whatsapp_connections')
          .select('instance_name')
          .eq('user_id', profile.id)
          .eq('status', 'connected')
          .maybeSingle();

        if (connectionError) {
          logStep("Error fetching connection", { userId: profile.id, error: connectionError });
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: 'Error fetching connection'
          });
          continue;
        }

        if (!connection) {
          logStep("User has no active connection", { userId: profile.id });
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: 'No active connection'
          });
          continue;
        }

        logStep("Processing user", { userId: profile.id });

        // Buscar o usuário
        const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(
          profile.id
        );

        if (userError || !user) {
          logStep("Error fetching user", { userId: profile.id, error: userError });
          errorCount++;
          results.push({
            userId: profile.id,
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
              'x-user-id': profile.id // Pass user ID via custom header
            }
          }
        );

        const summaryData = await response.json();

        if (!response.ok || summaryData.error) {
          logStep("Error generating summaries", { 
            userId: profile.id, 
            error: summaryData.error || `HTTP ${response.status}` 
          });
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: summaryData.error || 'Failed to generate summaries'
          });
        } else {
          logStep("Summaries generated successfully", { userId: profile.id, data: summaryData });
          successCount++;
          results.push({
            userId: profile.id,
            success: true,
            summariesCount: summaryData?.summaries?.length || 0
          });
        }
      } catch (userError) {
        logStep("Unexpected error processing user", { userId: profile.id, error: userError });
        errorCount++;
        results.push({
          userId: profile.id,
          success: false,
          error: userError instanceof Error ? userError.message : 'Unknown error'
        });
      }
    }

    logStep("Cron job completed", { 
      total: profiles.length, 
      success: successCount, 
      errors: errorCount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${profiles.length} users at ${timeToMatch}`,
        currentHour: adjustedHour,
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
