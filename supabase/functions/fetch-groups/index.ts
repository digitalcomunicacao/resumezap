import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Get authenticated user
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching groups for user:', user.id);

    // Get user's active WhatsApp connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'open')
      .maybeSingle();

    if (connectionError) {
      console.error('Error fetching connection:', connectionError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conexão WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection) {
      return new Response(
        JSON.stringify({ error: 'Nenhuma conexão WhatsApp ativa encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get Evolution API credentials
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Missing Evolution API credentials');
      return new Response(
        JSON.stringify({ error: 'Configuração da API Evolution não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching groups from Evolution API for instance:', connection.instance_name);

    // Fetch groups from Evolution API
    const fetchGroupsResponse = await fetch(
      `${evolutionApiUrl}/group/fetchAllGroups/${connection.instance_name}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
      }
    );

    if (!fetchGroupsResponse.ok) {
      const errorText = await fetchGroupsResponse.text();
      console.error('Evolution API fetch groups error:', {
        status: fetchGroupsResponse.status,
        body: errorText,
      });

      return new Response(
        JSON.stringify({ 
          error: 'Erro ao buscar grupos do WhatsApp',
          details: errorText 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groupsData = await fetchGroupsResponse.json();
    console.log('Fetched groups from Evolution API:', groupsData?.length || 0);

    // Process and save groups to database
    const groups = Array.isArray(groupsData) ? groupsData : [];
    
    if (groups.length === 0) {
      return new Response(
        JSON.stringify({ 
          message: 'Nenhum grupo encontrado no WhatsApp',
          groups: []
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Prepare groups data for upsert
    const groupsToUpsert = groups.map((group: any) => ({
      user_id: user.id,
      whatsapp_connection_id: connection.id,
      group_id: group.id,
      group_name: group.subject || 'Sem nome',
      group_image: group.pictureUrl || null,
      participant_count: group.size || 0,
    }));

    console.log('Upserting groups to database:', groupsToUpsert.length);

    // Upsert groups (insert or update if exists)
    const { error: upsertError } = await supabaseClient
      .from('whatsapp_groups')
      .upsert(groupsToUpsert, {
        onConflict: 'user_id,group_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error upserting groups:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar grupos no banco de dados' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch all groups from database to return
    const { data: savedGroups, error: fetchError } = await supabaseClient
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .order('group_name');

    if (fetchError) {
      console.error('Error fetching saved groups:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar grupos salvos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Successfully fetched and saved groups:', savedGroups?.length || 0);

    return new Response(
      JSON.stringify({ 
        message: 'Grupos sincronizados com sucesso',
        groups: savedGroups 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error in fetch-groups:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
