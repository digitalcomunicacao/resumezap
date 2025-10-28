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

    console.log('Cleaning up data for user:', user.id);

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

    // 7. Deletar conexões WhatsApp
    const { error: connectionError } = await supabase
      .from('whatsapp_connections')
      .delete()
      .eq('user_id', user.id);

    if (connectionError) {
      console.error('Error deleting whatsapp connections:', connectionError);
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

    console.log('User data cleaned successfully');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Histórico limpo com sucesso' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in cleanup-user-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
