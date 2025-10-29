import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, data?: any) => {
  console.log(`[SCHEDULED-SUMMARIES] ${step}`, data ? JSON.stringify(data) : '');
};

// Helper para garantir que a instância está conectada
async function ensureInstanceConnected(
  instanceName: string, 
  evolutionApiUrl: string, 
  evolutionApiKey: string
): Promise<boolean> {
  try {
    logStep("Checking connection state", { instanceName });
    
    // Verificar estado da conexão
    const stateResponse = await fetch(
      `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
      {
        headers: {
          'apikey': evolutionApiKey,
        },
      }
    );

    const stateData = await stateResponse.json();
    logStep("Connection state response", stateData);

    // Se já está aberto, aplicar configurações de presença e retornar
    if (stateData.state === 'open') {
      logStep("Instance already connected, setting offline presence");
      
      // Configurar para não aparecer online
      await fetch(
        `${evolutionApiUrl}/settings/set/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            markOnlineOnConnect: false,
            alwaysOnline: false,
          }),
        }
      );

      // Definir presença como indisponível
      await fetch(
        `${evolutionApiUrl}/chat/updatePresence/${instanceName}`,
        {
          method: 'POST',
          headers: {
            'apikey': evolutionApiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            presence: 'unavailable',
          }),
        }
      );

      return true;
    }

    // Se não está conectado, tentar conectar
    logStep("Instance not connected, attempting to connect");
    
    const connectResponse = await fetch(
      `${evolutionApiUrl}/instance/connect/${instanceName}`,
      {
        headers: {
          'apikey': evolutionApiKey,
        },
      }
    );

    if (!connectResponse.ok) {
      logStep("Failed to connect instance", { status: connectResponse.status });
      return false;
    }

    // Aguardar até 30 segundos para conexão abrir
    const maxAttempts = 10;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const recheckResponse = await fetch(
        `${evolutionApiUrl}/instance/connectionState/${instanceName}`,
        {
          headers: {
            'apikey': evolutionApiKey,
          },
        }
      );

      const recheckData = await recheckResponse.json();
      
      if (recheckData.state === 'open') {
        logStep("Instance connected successfully");
        
        // Aplicar configurações de presença
        await fetch(
          `${evolutionApiUrl}/settings/set/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              markOnlineOnConnect: false,
              alwaysOnline: false,
            }),
          }
        );

        await fetch(
          `${evolutionApiUrl}/chat/updatePresence/${instanceName}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              presence: 'unavailable',
            }),
          }
        );

        return true;
      }
    }

    logStep("Timeout waiting for connection");
    return false;
  } catch (error) {
    logStep("Error in ensureInstanceConnected", { error: error instanceof Error ? error.message : error });
    return false;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let executionId: string | null = null;

  try {
    logStep("Cron job started");

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!supabaseUrl || !supabaseServiceKey || !evolutionApiUrl || !evolutionApiKey) {
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

    // Registrar início da execução
    const { data: executionLog, error: execLogError } = await supabase
      .from('scheduled_executions')
      .insert({
        status: 'running',
        execution_time: now.toISOString(),
        users_processed: 0,
        summaries_generated: 0,
        errors_count: 0,
        details: { brasiliaHour, utcHour, currentTimeString }
      })
      .select()
      .single();

    if (!execLogError && executionLog) {
      executionId = executionLog.id;
      logStep("Execution logged", { executionId });
    }

    // Buscar usuários com preferred_summary_time configurado
    const { data: profilesData, error: profilesError } = await supabase
      .from('profiles')
      .select('id, preferred_summary_time, connection_mode, send_summary_to_group')
      .not('preferred_summary_time', 'is', null);

    if (profilesError) {
      logStep("Error fetching profiles", { error: profilesError });
      throw profilesError;
    }

    if (!profilesData || profilesData.length === 0) {
      logStep("No profiles with preferred_summary_time found");
      
      if (executionId) {
        await supabase
          .from('scheduled_executions')
          .update({
            status: 'completed',
            details: { brasiliaHour, utcHour, message: 'No profiles configured' }
          })
          .eq('id', executionId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No profiles with summary time configured',
          processed: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar conexões WhatsApp para esses usuários
    const userIds = profilesData.map(p => p.id);
    const { data: connections } = await supabase
      .from('whatsapp_connections')
      .select('user_id, id, instance_name, status, connection_type')
      .in('user_id', userIds);

    logStep("Connections found", { count: connections?.length || 0 });

    // Combinar profiles com suas conexões
    const profilesWithConnections = profilesData
      .map(profile => ({
        ...profile,
        whatsapp_connection: connections?.find(c => c.user_id === profile.id)
      }))
      .filter(p => p.whatsapp_connection); // Apenas usuários com conexão

    logStep("Profiles with connections", { count: profilesWithConnections.length });

    // Filtrar usuários cujo horário preferido é a hora atual (Brasília)
    const usersToProcess = profilesWithConnections.filter(p => {
      const [hour] = p.preferred_summary_time.split(':');
      return parseInt(hour) === brasiliaHour;
    });

    logStep("Users to process this hour", { count: usersToProcess.length, brasiliaHour });

    if (usersToProcess.length === 0) {
      logStep("No users scheduled for this hour");
      
      // Atualizar log de execução
      if (executionId) {
        await supabase
          .from('scheduled_executions')
          .update({
            status: 'completed',
            details: { brasiliaHour, utcHour, message: 'No users scheduled' }
          })
          .eq('id', executionId);
      }

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

    // Função para processar um usuário individual
    const processUser = async (profile: any) => {
      logStep("Processing user", { userId: profile.id });

      // Buscar conexão WhatsApp
      const { data: connection, error: connectionError } = await supabase
        .from('whatsapp_connections')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();

      if (connectionError || !connection) {
        logStep("No WhatsApp connection found", { userId: profile.id });
        return {
          userId: profile.id,
          success: false,
          error: 'No WhatsApp connection configured'
        };
      }

      // Se modo for 'temporary', garantir que está conectado
      if (profile.connection_mode === 'temporary') {
        logStep("User in temporary mode, ensuring connection", { userId: profile.id });
        
        const connected = await ensureInstanceConnected(
          connection.instance_name,
          evolutionApiUrl,
          evolutionApiKey
        );

        if (!connected) {
          logStep("Failed to establish temporary connection", { userId: profile.id });
          return {
            userId: profile.id,
            success: false,
            error: 'Failed to establish temporary connection. User may need to reconnect via QR Code.'
          };
        }

        // Atualizar registro de última conexão
        await supabase
          .from('whatsapp_connections')
          .update({ 
            status: 'connected',
            last_connected_at: new Date().toISOString()
          })
          .eq('id', connection.id);
      } else {
        // Modo persistent - verificar se está conectado
        if (connection.status !== 'connected') {
          logStep("Persistent connection not active", { userId: profile.id });
          return {
            userId: profile.id,
            success: false,
            error: 'WhatsApp not connected in persistent mode'
          };
        }
      }

      // Gerar resumos
      const response = await fetch(
        `${supabaseUrl}/functions/v1/generate-summaries`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'x-user-id': profile.id
          }
        }
      );

      const summaryData = await response.json();

      if (!response.ok || summaryData.error) {
        logStep("Error generating summaries", { 
          userId: profile.id, 
          error: summaryData.error || `HTTP ${response.status}` 
        });
        
        // Restaurar presença offline mesmo em caso de erro
        if (profile.connection_mode === 'temporary') {
          await fetch(
            `${evolutionApiUrl}/chat/updatePresence/${connection.instance_name}`,
            {
              method: 'POST',
              headers: {
                'apikey': evolutionApiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                presence: 'unavailable',
              }),
            }
          );
        }
        
        return {
          userId: profile.id,
          success: false,
          error: summaryData.error || 'Failed to generate summaries'
        };
      }

      logStep("Summaries generated successfully", { userId: profile.id, data: summaryData });
      
      // Verificar se deve enviar resumos para os grupos
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('send_summary_to_group')
        .eq('id', profile.id)
        .single();

      if (userProfile?.send_summary_to_group) {
        logStep("Sending summaries to groups", { userId: profile.id });
        
        const { data: summaries } = await supabase
          .from('summaries')
          .select('*')
          .eq('user_id', profile.id)
          .eq('summary_date', new Date().toISOString().split('T')[0])
          .order('created_at', { ascending: false });

        for (const summary of summaries || []) {
          try {
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

      // Se modo temporário, restaurar presença offline
      if (profile.connection_mode === 'temporary') {
        logStep("Restoring offline presence for temporary mode", { userId: profile.id });
        
        await fetch(
          `${evolutionApiUrl}/chat/updatePresence/${connection.instance_name}`,
          {
            method: 'POST',
            headers: {
              'apikey': evolutionApiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              presence: 'unavailable',
            }),
          }
        );
      }

      return {
        userId: profile.id,
        success: true,
        summariesCount: summaryData?.summaries?.length || 0,
        sentToGroups: userProfile?.send_summary_to_group || false,
        connectionMode: profile.connection_mode
      };
    };

    // Processar todos os usuários em paralelo
    logStep("Starting parallel processing", { userCount: usersToProcess.length });
    
    const results = await Promise.allSettled(
      usersToProcess.map(profile => processUser(profile))
    );

    // Contar sucessos e erros
    const successCount = results.filter(r => 
      r.status === 'fulfilled' && r.value.success
    ).length;
    
    const errorCount = results.filter(r => 
      r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
    ).length;

    const totalSummaries = results
      .filter(r => r.status === 'fulfilled')
      .reduce((sum, r) => sum + (r.value.summariesCount || 0), 0);

    const processedResults = results.map(r => {
      if (r.status === 'fulfilled') {
        return r.value;
      } else {
        return {
          success: false,
          error: r.reason instanceof Error ? r.reason.message : 'Unknown error'
        };
      }
    });

    // Atualizar log de execução com resultados finais
    if (executionId) {
      await supabase
        .from('scheduled_executions')
        .update({
          status: errorCount > 0 ? 'completed_with_errors' : 'completed',
          users_processed: usersToProcess.length,
          summaries_generated: totalSummaries,
          errors_count: errorCount,
          details: { 
            results: processedResults, 
            brasiliaHour, 
            utcHour, 
            successCount, 
            errorCount,
            totalSummaries 
          }
        })
        .eq('id', executionId);
    }

    logStep("Cron job completed", { 
      total: usersToProcess.length, 
      success: successCount, 
      errors: errorCount,
      summaries: totalSummaries,
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
        totalSummaries,
        results: processedResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    logStep("Fatal error", { error: error instanceof Error ? error.message : error });
    
    // Atualizar log de execução em caso de erro fatal
    if (executionId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase
        .from('scheduled_executions')
        .update({
          status: 'failed',
          errors_count: 1,
          details: { 
            error: error instanceof Error ? error.message : 'Unknown error',
            fatalError: true
          }
        })
        .eq('id', executionId);
    }

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
