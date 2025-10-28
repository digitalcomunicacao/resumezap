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
    const utcHour = now.getUTCHours();
    const brasiliaOffset = -3; // GMT-3
    const brasiliaHour = (utcHour + brasiliaOffset + 24) % 24;
    const currentTimeString = `${brasiliaHour.toString().padStart(2, '0')}:00:00`;
    
    logStep("Current hour check (Brasília time)", { 
      utcHour, 
      brasiliaHour, 
      currentTimeString 
    });

    // Buscar usuários com conexão WhatsApp ativa
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id, 
        preferred_summary_time,
        whatsapp_connections!inner(status)
      `)
      .eq('whatsapp_connections.status', 'connected');

    if (profilesError) {
      logStep("Error fetching profiles", { error: profilesError });
      throw profilesError;
    }

    logStep("Profiles found", { count: profiles?.length || 0 });

    // Filtrar usuários cujo horário preferido é a hora atual (Brasília)
    const usersToProcess = profiles?.filter(p => {
      if (!p.preferred_summary_time) return false;
      const [hour] = p.preferred_summary_time.split(':');
      return parseInt(hour) === brasiliaHour;
    }) || [];

    logStep("Users to process this hour", { count: usersToProcess.length, brasiliaHour });

    if (usersToProcess.length === 0) {
      logStep("No users scheduled for this hour");
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No users scheduled for ${currentTimeString} (Brasília)`,
          brasiliaHour,
          utcHour,
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let successCount = 0;
    let errorCount = 0;
    const results = [];

    // Processar cada usuário filtrado
    for (const profile of usersToProcess) {
      try {
        logStep("Processing user", { userId: profile.id });

        // Verificar se o usuário tem conexão ativa do WhatsApp
        const { data: connection, error: connectionError } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .eq('user_id', profile.id)
          .eq('status', 'connected')
          .maybeSingle();

        if (connectionError || !connection) {
          logStep("No active WhatsApp connection", { userId: profile.id });
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: 'No active WhatsApp connection'
          });
          continue;
        }

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
          
          // Verificar se deve enviar resumos para os grupos
          const { data: userProfile } = await supabase
            .from('profiles')
            .select('send_summary_to_group')
            .eq('id', profile.id)
            .single();

          if (userProfile?.send_summary_to_group) {
            logStep("Sending summaries to groups", { userId: profile.id });
            
            // Buscar resumos recém-criados
            const { data: summaries } = await supabase
              .from('summaries')
              .select('*')
              .eq('user_id', profile.id)
              .eq('summary_date', new Date().toISOString().split('T')[0])
              .order('created_at', { ascending: false });

            // Enviar cada resumo para seu respectivo grupo
            for (const summary of summaries || []) {
              try {
                // Check if summary was already sent to this group
                const { data: existingDelivery } = await supabase
                  .from('summary_deliveries')
                  .select('id')
                  .eq('summary_id', summary.id)
                  .eq('group_id', summary.group_id)
                  .maybeSingle();

                if (existingDelivery) {
                  logStep("Summary already sent, skipping", { 
                    groupId: summary.group_id,
                    summaryId: summary.id 
                  });
                  continue;
                }

                const sendResponse = await fetch(
                  `${supabaseUrl}/functions/v1/send-group-summary`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${supabaseServiceKey}`,
                    },
                    body: JSON.stringify({
                      summaryId: summary.id,
                      userId: summary.user_id,
                      groupId: summary.group_id,
                      groupName: summary.group_name,
                      summaryText: summary.summary_text,
                      instanceName: connection.instance_name,
                    }),
                  }
                );

                const sendData = await sendResponse.json();
                
                if (!sendResponse.ok) {
                  logStep("Failed to send summary to group", { 
                    groupId: summary.group_id, 
                    error: sendData 
                  });
                } else {
                  logStep("Summary sent to group", { 
                    groupId: summary.group_id, 
                    messageId: sendData.messageId 
                  });
                }
              } catch (sendError) {
                logStep("Error sending summary to group", { 
                  groupId: summary.group_id, 
                  error: sendError 
                });
              }
            }
          }

          results.push({
            userId: profile.id,
            success: true,
            summariesCount: summaryData?.summaries?.length || 0,
            sentToGroups: userProfile?.send_summary_to_group || false,
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
      total: usersToProcess.length, 
      success: successCount, 
      errors: errorCount,
      brasiliaHour 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Processed ${usersToProcess.length} users for hour ${currentTimeString} (Brasília)`,
        brasiliaHour,
        utcHour,
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
