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
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authenticated user
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { instanceId } = await req.json();

    if (!instanceId) {
      return new Response(
        JSON.stringify({ error: 'Instance ID é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Disconnecting instance:', instanceId);

    // Logout instance in Evolution API
    const logoutResponse = await fetch(`${evolutionApiUrl}/instance/logout/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'apikey': evolutionApiKey,
      },
    });

    if (!logoutResponse.ok) {
      console.error('Evolution API logout error:', await logoutResponse.text());
    }

    // Delete instance in Evolution API
    const deleteResponse = await fetch(`${evolutionApiUrl}/instance/delete/${instanceId}`, {
      method: 'DELETE',
      headers: {
        'apikey': evolutionApiKey,
      },
    });

    if (!deleteResponse.ok) {
      console.error('Evolution API delete error:', await deleteResponse.text());
    }

    // Deletar histórico do usuário antes de desconectar
    console.log('Deleting user history for user:', user.id);

    // 1. Deletar deliveries de resumos
    const { error: deliveriesError } = await supabase
      .from('summary_deliveries')
      .delete()
      .eq('user_id', user.id);

    if (deliveriesError) {
      console.error('Error deleting summary deliveries:', deliveriesError);
    }

    // 2. Deletar resumos
    const { error: summariesError } = await supabase
      .from('summaries')
      .delete()
      .eq('user_id', user.id);

    if (summariesError) {
      console.error('Error deleting summaries:', summariesError);
    }

    // 3. Deletar grupos WhatsApp
    const { error: groupsError } = await supabase
      .from('whatsapp_groups')
      .delete()
      .eq('user_id', user.id);

    if (groupsError) {
      console.error('Error deleting whatsapp groups:', groupsError);
    }

    // 4. Deletar analytics de mensagens
    const { error: analyticsError } = await supabase
      .from('message_analytics')
      .delete()
      .eq('user_id', user.id);

    if (analyticsError) {
      console.error('Error deleting message analytics:', analyticsError);
    }

    // 5. Deletar preferências de resumo
    const { error: preferencesError } = await supabase
      .from('summary_preferences')
      .delete()
      .eq('user_id', user.id);

    if (preferencesError) {
      console.error('Error deleting summary preferences:', preferencesError);
    }

    // 6. Deletar logs de resumos manuais
    const { error: logsError } = await supabase
      .from('manual_summary_logs')
      .delete()
      .eq('user_id', user.id);

    if (logsError) {
      console.error('Error deleting manual summary logs:', logsError);
    }

    // 7. Deletar conexão WhatsApp
    const { error: connectionError } = await supabase
      .from('whatsapp_connections')
      .delete()
      .eq('instance_id', instanceId)
      .eq('user_id', user.id);

    if (connectionError) {
      console.error('Error deleting whatsapp connection:', connectionError);
    }

    // 8. Atualizar profile
    await supabase
      .from('profiles')
      .update({
        whatsapp_connected: false,
        whatsapp_instance_id: null,
        selected_groups_count: 0,
        total_summaries_generated: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    console.log('WhatsApp disconnected and user history cleaned successfully');

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in disconnect-whatsapp:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
