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

    // Update database
    const { error: updateError } = await supabase
      .from('whatsapp_connections')
      .update({
        status: 'disconnected',
        updated_at: new Date().toISOString(),
      })
      .eq('instance_id', instanceId)
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Database update error:', updateError);
    }

    // Update profile
    await supabase
      .from('profiles')
      .update({
        whatsapp_connected: false,
        whatsapp_instance_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    console.log('WhatsApp disconnected successfully');

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
