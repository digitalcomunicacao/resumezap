import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId, instanceId, reason = 'expired' } = await req.json();

    if (!userId || !instanceId) {
      return new Response(
        JSON.stringify({ error: 'userId and instanceId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Archiving connection:', { userId, instanceId, reason });

    // 1. Buscar dados atuais do perfil
    const { data: profile } = await supabase
      .from('profiles')
      .select('selected_groups_count, total_summaries_generated')
      .eq('id', userId)
      .single();

    // 2. Marcar conexão como expirada (não deletar)
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({ status: 'expired' })
      .eq('instance_id', instanceId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Error updating connection status:', updateError);
    }

    // 3. Inserir registro no histórico
    const { error: historyError } = await supabase
      .from('connection_history')
      .insert({
        user_id: userId,
        instance_id: instanceId,
        disconnected_at: new Date().toISOString(),
        reason,
        groups_count: profile?.selected_groups_count || 0,
        summaries_count: profile?.total_summaries_generated || 0,
      });

    if (historyError) {
      console.error('Error saving connection history:', historyError);
      return new Response(
        JSON.stringify({ error: 'Failed to save connection history' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Atualizar profile
    await supabase
      .from('profiles')
      .update({
        whatsapp_connected: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId);

    console.log('Connection archived successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        archivedGroups: profile?.selected_groups_count || 0,
        archivedSummaries: profile?.total_summaries_generated || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in archive-connection:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
