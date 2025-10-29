import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, simulatedHour } = await req.json();

    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[TEST] Iniciando teste para userId: ${userId}, hora simulada: ${simulatedHour || 'atual'}`);

    const diagnosis = {
      connection: { status: 'unknown', type: 'unknown' },
      groups: { total: 0, selected: 0 },
      summaries: { generated: 0, failed: 0 },
      errors: [] as string[],
    };

    // 1. Verificar conexão WhatsApp
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      diagnosis.errors.push('Usuário não possui conexão WhatsApp');
      diagnosis.connection.status = 'disconnected';
    } else {
      diagnosis.connection.status = connection.status;
      diagnosis.connection.type = connection.connection_type;

      if (connection.status !== 'connected') {
        diagnosis.errors.push(`Conexão WhatsApp está ${connection.status}, não conectada`);
      }
    }

    // 2. Verificar grupos
    const { data: groups, error: groupsError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false);

    if (groupsError) {
      diagnosis.errors.push(`Erro ao buscar grupos: ${groupsError.message}`);
    } else {
      diagnosis.groups.total = groups?.length || 0;
      diagnosis.groups.selected = groups?.filter(g => g.is_selected).length || 0;

      if (diagnosis.groups.selected === 0) {
        diagnosis.errors.push('Usuário não possui grupos selecionados');
      }
    }

    // 3. Verificar preferências de horário
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_summary_time, subscription_plan')
      .eq('id', userId)
      .single();

    const preferredHour = profile?.preferred_summary_time 
      ? parseInt(profile.preferred_summary_time.split(':')[0]) 
      : 9;

    const testHour = simulatedHour !== undefined ? simulatedHour : new Date().getHours();

    console.log(`[TEST] Horário preferido: ${preferredHour}, horário do teste: ${testHour}`);

    // 4. Tentar gerar resumos (se tudo estiver OK)
    if (diagnosis.connection.status === 'connected' && diagnosis.groups.selected > 0) {
      try {
        const { data: summaryResult, error: summaryError } = await supabase.functions.invoke(
          'generate-summaries',
          {
            body: { 
              userId,
              forceGeneration: true,
              simulatedHour: testHour 
            }
          }
        );

        if (summaryError) {
          diagnosis.errors.push(`Erro ao gerar resumos: ${summaryError.message}`);
          diagnosis.summaries.failed = diagnosis.groups.selected;
        } else if (summaryResult) {
          diagnosis.summaries.generated = summaryResult.summariesGenerated || 0;
          diagnosis.summaries.failed = summaryResult.errors || 0;
          
          if (summaryResult.errors && summaryResult.errors > 0) {
            diagnosis.errors.push(`${summaryResult.errors} resumos falharam na geração`);
          }
        }
      } catch (error: any) {
        diagnosis.errors.push(`Exceção ao gerar resumos: ${error.message}`);
        diagnosis.summaries.failed = diagnosis.groups.selected;
      }
    }

    const success = diagnosis.errors.length === 0 && diagnosis.summaries.generated > 0;

    console.log(`[TEST] Resultado: ${success ? 'SUCESSO' : 'FALHA'}`, diagnosis);

    return new Response(
      JSON.stringify({
        success,
        diagnosis,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TEST] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
