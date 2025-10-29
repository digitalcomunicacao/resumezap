import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      console.error('User authentication error:', userError);
      return new Response(
        JSON.stringify({ error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching groups for user:', user.id);

    // Get user's WhatsApp connection
    const { data: connection, error: connectionError } = await supabaseClient
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError) {
      console.error('Error fetching connection:', connectionError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar conexão WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!connection) {
      console.log('No active WhatsApp connection found');
      return new Response(
        JSON.stringify({ error: 'WhatsApp não conectado. Conecte seu WhatsApp primeiro.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

    if (!evolutionApiUrl || !evolutionApiKey) {
      console.error('Evolution API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'API não configurada corretamente' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching groups from Evolution API for instance:', connection.instance_name);

    // Fetch groups from Evolution API
    const fetchGroupsResponse = await fetch(
      `${evolutionApiUrl}/group/fetchAllGroups/${connection.instance_name}?getParticipants=true`,
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
      console.error('Evolution API error:', {
        status: fetchGroupsResponse.status,
        error: errorText
      });
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar grupos do WhatsApp' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const groupsData = await fetchGroupsResponse.json();
    const startTime = Date.now();
    console.log('Groups fetched from Evolution API:', groupsData.length || 0, 'groups');

    // Process and save groups
    const groups = Array.isArray(groupsData) ? groupsData : [];
    
    if (groups.length === 0) {
      console.log('No groups found');
      return new Response(
        JSON.stringify({ groups: [], message: 'Nenhum grupo encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // OPTIMIZED: Fetch all existing groups in ONE query instead of N queries
    const fetchExistingStart = Date.now();
    const { data: existingGroups } = await supabaseClient
      .from('whatsapp_groups')
      .select('group_id, is_selected')
      .eq('user_id', user.id)
      .eq('whatsapp_connection_id', connection.id);
    
    console.log(`Fetched ${existingGroups?.length || 0} existing groups in ${Date.now() - fetchExistingStart}ms`);

    // Create a Map for O(1) lookup of existing groups
    const existingGroupsMap = new Map(
      existingGroups?.map(g => [g.group_id, g.is_selected]) || []
    );

    // Get current group IDs for archiving missing groups
    const currentGroupIds = groups.map(group => group.id);

    // OPTIMIZED: Prepare all groups for batch upsert
    const groupsToUpsert = groups.map(group => ({
      user_id: user.id,
      whatsapp_connection_id: connection.id,
      group_id: group.id,
      group_name: group.subject || 'Sem nome',
      group_image: group.pictureUrl || null,
      participant_count: group.participants?.length || group.size || 0,
      // Preserve is_selected if group already exists, otherwise false
      is_selected: existingGroupsMap.get(group.id) ?? false,
      // Ensure not archived when reconnecting
      archived: false,
      archived_at: null,
    }));

    // OPTIMIZED: Upsert all groups in ONE query (instead of N queries)
    const upsertStart = Date.now();
    const { error: upsertError } = await supabaseClient
      .from('whatsapp_groups')
      .upsert(groupsToUpsert, {
        onConflict: 'user_id,group_id',
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error('Error upserting groups:', upsertError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar grupos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Upserted ${groupsToUpsert.length} groups in ${Date.now() - upsertStart}ms`);

    // Archive groups that no longer exist in WhatsApp
    console.log('Archiving missing groups...');
    const { data: archivedCount, error: archiveError } = await supabaseClient
      .rpc('archive_missing_groups', {
        p_user_id: user.id,
        p_current_group_ids: currentGroupIds,
      });

    if (archiveError) {
      console.error('Error archiving missing groups:', archiveError);
    } else {
      console.log(`Archived ${archivedCount || 0} missing groups`);
    }

    // Fetch all groups from database to return
    const { data: savedGroups, error: fetchError } = await supabaseClient
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('whatsapp_connection_id', connection.id)
      .order('group_name');

    if (fetchError) {
      console.error('Error fetching saved groups:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar grupos salvos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const totalTime = Date.now() - startTime;
    console.log(`Successfully synced ${savedGroups?.length || 0} groups in ${totalTime}ms`);
    console.log(`Performance: ${(totalTime / (savedGroups?.length || 1)).toFixed(2)}ms per group`);

    return new Response(
      JSON.stringify({ 
        groups: savedGroups || [],
        performance: {
          totalGroups: savedGroups?.length || 0,
          totalTimeMs: totalTime,
          avgTimePerGroupMs: totalTime / (savedGroups?.length || 1)
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
