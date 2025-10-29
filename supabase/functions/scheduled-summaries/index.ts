import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, data?: any) => {
  console.log(`[SCHEDULED-SUMMARIES] ${step}`, data ? JSON.stringify(data) : '');
};

// Helper para garantir que a instância está conectada com retry
async function ensureInstanceConnected(
  instanceName: string, 
  evolutionApiUrl: string, 
  evolutionApiKey: string,
  retryAttempts: number = 3
): Promise<{ success: boolean; errorCode?: string }> {
  const backoffDelays = [0, 15000, 45000]; // 0s, 15s, 45s
  
  for (let attempt = 0; attempt < retryAttempts; attempt++) {
    try {
      if (attempt > 0) {
        logStep(`Retry attempt ${attempt}/${retryAttempts}`, { instanceName, delayMs: backoffDelays[attempt - 1] });
        await new Promise(resolve => setTimeout(resolve, backoffDelays[attempt - 1]));
      }
      
      logStep("Checking connection state", { instanceName, attempt: attempt + 1 });
      
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

        return { success: true };
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
        continue; // Tentar próximo retry
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

          return { success: true };
        }
      }

      logStep("Timeout waiting for connection on attempt", { attempt: attempt + 1 });
    } catch (error) {
      logStep("Error in ensureInstanceConnected", { 
        error: error instanceof Error ? error.message : error,
        attempt: attempt + 1
      });
    }
  }
  
  // Todas as tentativas falharam
  return { success: false, errorCode: 'TEMP_CONN_FAILED' };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let executionId: string | null = null;
  let supabase: any = null;

  try {
    logStep("=== CRON JOB STARTED ===");

    // Validar variáveis de ambiente com logs detalhados
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    logStep("Environment variables check", {
      hasSupabaseUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      hasEvolutionUrl: !!evolutionApiUrl,
      hasEvolutionKey: !!evolutionApiKey,
      supabaseUrlPrefix: supabaseUrl?.substring(0, 20),
      evolutionUrlPrefix: evolutionApiUrl?.substring(0, 20)
    });

    if (!supabaseUrl || !supabaseServiceKey || !evolutionApiUrl || !evolutionApiKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('SUPABASE_URL');
      if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
      if (!evolutionApiUrl) missing.push('EVOLUTION_API_URL');
      if (!evolutionApiKey) missing.push('EVOLUTION_API_KEY');
      throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    }

    logStep("Creating Supabase client");
    supabase = createClient(supabaseUrl, supabaseServiceKey);
    logStep("Supabase client created successfully");

    // Obter hora atual em Brasília usando UTC com offset correto
    const now = new Date();
    const brasiliaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
    const brasiliaHour = brasiliaTime.getHours();
    const currentTimeString = `${brasiliaHour.toString().padStart(2, '0')}:00:00`;
    
    logStep("Current hour check (Brasília time)", { 
      utcTime: now.toISOString(),
      brasiliaTime: brasiliaTime.toISOString(),
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
        details: { 
          brasiliaHour, 
          brasiliaTime: brasiliaTime.toISOString(),
          currentTimeString,
          startedAt: now.toISOString()
        }
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
            details: { 
              brasiliaHour, 
              brasiliaTime: brasiliaTime.toISOString(),
              currentTimeString,
              message: 'No profiles configured' 
            }
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
    const userIds = profilesData.map((p: any) => p.id);
    const { data: connections } = await supabase
      .from('whatsapp_connections')
      .select('user_id, id, instance_name, status, connection_type')
      .in('user_id', userIds);

    logStep("Connections found", { count: connections?.length || 0 });

    // Combinar profiles com suas conexões
    const profilesWithConnections = profilesData
      .map((profile: any) => ({
        ...profile,
        whatsapp_connection: connections?.find((c: any) => c.user_id === profile.id)
      }))
      .filter((p: any) => p.whatsapp_connection); // Apenas usuários com conexão

    logStep("Profiles with connections", { count: profilesWithConnections.length });

    // Filtrar usuários cujo horário preferido é a hora atual (Brasília)
    const usersToProcess = profilesWithConnections.filter((p: any) => {
      const [hour] = p.preferred_summary_time.split(':');
      return parseInt(hour) === brasiliaHour;
    });

    // Preparar informações sobre usuários elegíveis
    const eligibleUsersInfo = usersToProcess.map((p: any) => ({
      userId: p.id.substring(0, 8) + '...',
      preferredTime: p.preferred_summary_time,
      connectionMode: p.connection_mode,
      sendToGroup: p.send_summary_to_group
    }));

    logStep("Users to process this hour", { 
      count: usersToProcess.length, 
      brasiliaHour,
      eligibleUsers: eligibleUsersInfo
    });

    if (usersToProcess.length === 0) {
      logStep("No users scheduled for this hour");
      
      // Atualizar log de execução
      if (executionId) {
        await supabase
          .from('scheduled_executions')
          .update({
            status: 'completed',
            details: { 
              brasiliaHour, 
              brasiliaTime: brasiliaTime.toISOString(),
              currentTimeString,
              message: 'No users scheduled for this hour',
              totalProfilesWithTime: profilesWithConnections.length,
              totalProfiles: profilesData.length
            }
          })
          .eq('id', executionId);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `No users scheduled for ${currentTimeString} (Brasília)`,
          brasiliaHour,
          brasiliaTime: brasiliaTime.toISOString(),
          currentTimeString,
          totalProfilesWithTime: profilesWithConnections.length,
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
        
        const connectionResult = await ensureInstanceConnected(
          connection.instance_name,
          evolutionApiUrl,
          evolutionApiKey,
          3 // 3 tentativas com backoff
        );

        if (!connectionResult.success) {
          logStep("Failed to establish temporary connection after retries", { 
            userId: profile.id,
            errorCode: connectionResult.errorCode
          });
          
          // Criar alerta para admin sobre falha de reconexão
          await supabase
            .from('admin_alerts')
            .insert({
              alert_type: 'reconnect_required',
              severity: 'high',
              message: `Usuário precisa reconectar via QR Code`,
              details: {
                userId: profile.id,
                instanceName: connection.instance_name,
                errorCode: connectionResult.errorCode,
                timestamp: new Date().toISOString()
              }
            });
          
          return {
            userId: profile.id,
            success: false,
            error: 'QR Code necessário - reconexão temporária falhou após 3 tentativas',
            errorCode: connectionResult.errorCode || 'TEMP_CONN_FAILED',
            requiresQR: true
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
          
        logStep("Temporary connection established and updated", { userId: profile.id });
      } else {
        // Modo persistent - apenas verificar estado, não tentar reconectar
        logStep("User in persistent mode, checking connection status", { userId: profile.id });
        
        try {
          const stateResponse = await fetch(
            `${evolutionApiUrl}/instance/connectionState/${connection.instance_name}`,
            {
              headers: {
                'apikey': evolutionApiKey,
              },
            }
          );
          
          const stateData = await stateResponse.json();
          
          if (stateData.state !== 'open') {
            logStep("Persistent connection offline", { userId: profile.id, state: stateData.state });
            
            // Criar alerta para admin
            await supabase
              .from('admin_alerts')
              .insert({
                alert_type: 'connection_offline',
                severity: 'medium',
                message: `Conexão persistente offline`,
                details: {
                  userId: profile.id,
                  instanceName: connection.instance_name,
                  connectionState: stateData.state,
                  timestamp: new Date().toISOString()
                }
              });
            
            return {
              userId: profile.id,
              success: false,
              error: 'WhatsApp desconectado (modo persistente - verifique sua conexão)',
              errorCode: 'PERSISTENT_OFFLINE'
            };
          }
          
          logStep("Persistent connection verified as active", { userId: profile.id });
        } catch (error) {
          logStep("Error checking persistent connection", { 
            userId: profile.id, 
            error: error instanceof Error ? error.message : error 
          });
          return {
            userId: profile.id,
            success: false,
            error: 'Erro ao verificar conexão persistente',
            errorCode: 'PERSISTENT_CHECK_FAILED'
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
          error: summaryData.error || 'Failed to generate summaries',
          errorCode: 'SUMMARY_GENERATION_FAILED'
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
      usersToProcess.map((profile: any) => processUser(profile))
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
            brasiliaTime: brasiliaTime.toISOString(),
            currentTimeString,
            successCount, 
            errorCount,
            totalSummaries,
            eligibleUsers: eligibleUsersInfo,
            skippedNoConnection: processedResults.filter(r => r.errorCode === 'TEMP_CONN_FAILED' || r.errorCode === 'PERSISTENT_OFFLINE').length,
            requiresQR: processedResults.filter(r => r.requiresQR).length
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
        brasiliaTime: brasiliaTime.toISOString(),
        currentTimeString,
        successCount,
        errorCount,
        totalSummaries,
        skippedNoConnection: processedResults.filter(r => r.errorCode === 'TEMP_CONN_FAILED' || r.errorCode === 'PERSISTENT_OFFLINE').length,
        results: processedResults
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logStep("=== FATAL ERROR ===", { 
      message: errorMessage,
      stack: errorStack,
      type: error instanceof Error ? error.constructor.name : typeof error,
      fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
    });
    
    // Atualizar log de execução em caso de erro fatal
    if (executionId && supabase) {
      try {
        await supabase
          .from('scheduled_executions')
          .update({
            status: 'failed',
            errors_count: 1,
            details: { 
              error: errorMessage,
              stack: errorStack,
              fatalError: true,
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', executionId);
      } catch (updateError) {
        logStep("Failed to update execution log", { 
          updateError: updateError instanceof Error ? updateError.message : updateError 
        });
      }
    } else if (executionId) {
      // Tentar criar cliente novamente para atualizar o log
      try {
        const tempSupabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );
        
        await tempSupabase
          .from('scheduled_executions')
          .update({
            status: 'failed',
            errors_count: 1,
            details: { 
              error: errorMessage,
              stack: errorStack,
              fatalError: true,
              timestamp: new Date().toISOString()
            }
          })
          .eq('id', executionId);
      } catch (retryError) {
        logStep("Failed to update execution log on retry", { 
          retryError: retryError instanceof Error ? retryError.message : retryError 
        });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        stack: errorStack
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
