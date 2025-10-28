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

    // Buscar usuários com conexão WhatsApp (qualquer status)
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select(`
        id, 
        preferred_summary_time,
        connection_mode,
        whatsapp_connections!inner(
          id,
          instance_name,
          status,
          connection_type
        )
      `);

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

        // Buscar conexão WhatsApp
        const { data: connection, error: connectionError } = await supabase
          .from('whatsapp_connections')
          .select('*')
          .eq('user_id', profile.id)
          .maybeSingle();

        if (connectionError || !connection) {
          logStep("No WhatsApp connection found", { userId: profile.id });
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: 'No WhatsApp connection configured'
          });
          continue;
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
            errorCount++;
            results.push({
              userId: profile.id,
              success: false,
              error: 'Failed to establish temporary connection. User may need to reconnect via QR Code.'
            });
            continue;
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
            errorCount++;
            results.push({
              userId: profile.id,
              success: false,
              error: 'WhatsApp not connected in persistent mode'
            });
            continue;
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
          errorCount++;
          results.push({
            userId: profile.id,
            success: false,
            error: summaryData.error || 'Failed to generate summaries'
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
          continue;
        }

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

        results.push({
          userId: profile.id,
          success: true,
          summariesCount: summaryData?.summaries?.length || 0,
          sentToGroups: userProfile?.send_summary_to_group || false,
          connectionMode: profile.connection_mode
        });
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
