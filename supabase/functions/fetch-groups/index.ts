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

    // Helper to safely extract arrays from different API response shapes
    const extractArray = (payload: any): any[] => {
      if (Array.isArray(payload)) return payload;
      const candidateKeys = ['data', 'result', 'results', 'response', 'value', 'items', 'groups', 'chats'];
      for (const key of candidateKeys) {
        const val = payload?.[key];
        if (Array.isArray(val)) return val;
      }
      // Some providers wrap in { data: { groups: [] } }
      const nested = payload?.data || payload?.result || payload?.response || {};
      for (const key of candidateKeys) {
        const val = nested?.[key];
        if (Array.isArray(val)) return val;
      }
      return [];
    };

    // Fetch groups from Evolution API with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout

    let fetchGroupsResponse;
    let chatsResponse;
    
    try {
      console.log('Starting Evolution API request...');
      // First try WITH explicit getParticipants=false (required by provider)
      const groupsUrl = `${evolutionApiUrl}/group/fetchAllGroups/${connection.instance_name}?getParticipants=false`;
      console.log('URL:', groupsUrl);
      
      fetchGroupsResponse = await fetch(
        groupsUrl,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          signal: controller.signal,
        }
      );
      
      console.log('Evolution API response status:', fetchGroupsResponse.status);
      console.log('Evolution API response ok:', fetchGroupsResponse.ok);
      
      if (!fetchGroupsResponse.ok) {
        const errorText = await fetchGroupsResponse.text();
        console.error('Evolution API error:', {
          status: fetchGroupsResponse.status,
          error: errorText
        });

        // If API complains about getParticipants, retry with true
        if (errorText?.includes('getParticipants')) {
          try {
            const retryUrl = `${evolutionApiUrl}/group/fetchAllGroups/${connection.instance_name}?getParticipants=true`;
            console.log('Retrying fetchAllGroups with getParticipants=true:', retryUrl);
            const retryResp = await fetch(retryUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'apikey': evolutionApiKey,
              },
              signal: controller.signal,
            });

            if (retryResp.ok) {
              console.log('Retry with getParticipants=true succeeded');
              fetchGroupsResponse = retryResp; // proceed normally below
            }
          } catch (retryErr) {
            console.warn('Retry with getParticipants=true failed:', retryErr);
          }
        }

        // If still not OK after retry, fallback to chats/cache
        if (!fetchGroupsResponse.ok) {
          // Try to derive groups from chats as fallback
          try {
            if (!chatsResponse) {
              chatsResponse = await fetch(
                `${evolutionApiUrl}/chat/findChats/${connection.instance_name}`,
                {
                  method: 'GET',
                  headers: {
                    'Content-Type': 'application/json',
                    'apikey': evolutionApiKey,
                  }
                }
              );
            }

            if (chatsResponse?.ok) {
              const chatsData = await chatsResponse.json();
              const chats = extractArray(chatsData);

              const activityMapLocal = new Map<string, { last_activity: number; unread_count: number; pinned: boolean }>();
              const derivedGroups = chats
                .filter((chat: any) => (chat.id || chat.jid)?.endsWith('@g.us'))
                .map((chat: any) => {
                  const jid = chat.id || chat.jid;
                  const lastActivity = chat.conversationTimestamp || chat.lastMessage?.timestamp || chat.t || chat.lastMsg?.t || 0;
                  activityMapLocal.set(jid, {
                    last_activity: lastActivity,
                    unread_count: chat.unreadCount || chat.unread || 0,
                    pinned: chat.pinned || false,
                  });
                  return {
                    id: jid,
                    subject: chat.name || chat.formattedTitle || chat.subject || chat.pushname || 'Sem nome',
                    pictureUrl: chat.profilePicUrl || chat.pic || chat.profilePicThumbObj?.eurl || null,
                    size: chat.size || chat.participantsCount || 0,
                  };
                });

              for (const group of derivedGroups) {
                const groupData = {
                  user_id: user.id,
                  whatsapp_connection_id: connection.id,
                  group_id: group.id,
                  group_name: group.subject,
                  group_image: group.pictureUrl,
                  participant_count: group.size || 0,
                };

                const { data: existingGroup } = await supabaseClient
                  .from('whatsapp_groups')
                  .select('id, is_selected')
                  .eq('user_id', user.id)
                  .eq('group_id', group.id)
                  .maybeSingle();

                if (existingGroup) {
                  await supabaseClient
                    .from('whatsapp_groups')
                    .update({
                      group_name: groupData.group_name,
                      group_image: groupData.group_image,
                      participant_count: groupData.participant_count,
                    })
                    .eq('id', existingGroup.id);
                } else {
                  await supabaseClient
                    .from('whatsapp_groups')
                    .insert(groupData);
                }
              }

              const { data: savedFromChats } = await supabaseClient
                .from('whatsapp_groups')
                .select('*')
                .eq('user_id', user.id)
                .eq('whatsapp_connection_id', connection.id);

              const enriched = (savedFromChats || []).map((g: any) => {
                const a = activityMapLocal.get(g.group_id);
                return { ...g, last_activity: a?.last_activity || null, unread_count: a?.unread_count || 0, pinned: a?.pinned || false };
              });

              enriched.sort((a: any, b: any) => {
                if (a.is_selected !== b.is_selected) return a.is_selected ? -1 : 1;
                if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
                if (a.last_activity && b.last_activity) return b.last_activity - a.last_activity;
                if (a.last_activity && !b.last_activity) return -1;
                if (!a.last_activity && b.last_activity) return 1;
                if (a.participant_count !== b.participant_count) return b.participant_count - a.participant_count;
                return a.group_name.localeCompare(b.group_name, 'pt-BR');
              });

              return new Response(
                JSON.stringify({ groups: enriched, message: 'Grupos derivados das conversas (fallback)' }),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            }
          } catch (fallbackErr) {
            console.warn('Fallback via chats failed:', fallbackErr);
          }

          // Final fallback: DB cache only
          const { data: savedGroups } = await supabaseClient
            .from('whatsapp_groups')
            .select('*')
            .eq('user_id', user.id)
            .order('is_selected', { ascending: false })
            .order('participant_count', { ascending: false })
            .order('group_name', { ascending: true });

          return new Response(
            JSON.stringify({ 
              groups: savedGroups || [],
              warning: 'API retornou erro. Exibindo dados em cache.',
              message: 'Grupos carregados do cache (API retornou erro)'
            }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
      
      // Also fetch chats to get activity data
      console.log('Fetching chats for activity ordering...');
      try {
        chatsResponse = await fetch(
          `${evolutionApiUrl}/chat/findChats/${connection.instance_name}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            signal: controller.signal,
          }
        );
        console.log('Chats API response status:', chatsResponse.status);
      } catch (chatError) {
        console.warn('Failed to fetch chats (non-critical):', chatError);
        chatsResponse = null;
      }
      
      clearTimeout(timeoutId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        console.error('Evolution API timeout after 25 seconds');
        // Try chats fallback after timeout (new short request)
        try {
          const controllerChats = new AbortController();
          const chatsTimeout = setTimeout(() => controllerChats.abort(), 10000);
          const chatsResp = await fetch(
            `${evolutionApiUrl}/chat/findChats/${connection.instance_name}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
              signal: controllerChats.signal,
            }
          );
          clearTimeout(chatsTimeout);

          if (chatsResp.ok) {
            const chatsData = await chatsResp.json();
            const chats = extractArray(chatsData);

            const activityMapLocal = new Map<string, { last_activity: number; unread_count: number; pinned: boolean }>();
            const derivedGroups = chats
              .filter((chat: any) => (chat.id || chat.jid)?.endsWith('@g.us'))
              .map((chat: any) => {
                const jid = chat.id || chat.jid;
                const lastActivity = chat.conversationTimestamp || chat.lastMessage?.timestamp || chat.t || chat.lastMsg?.t || 0;
                activityMapLocal.set(jid, {
                  last_activity: lastActivity,
                  unread_count: chat.unreadCount || chat.unread || 0,
                  pinned: chat.pinned || false,
                });
                return {
                  id: jid,
                  subject: chat.name || chat.formattedTitle || chat.subject || chat.pushname || 'Sem nome',
                  pictureUrl: chat.profilePicUrl || chat.pic || chat.profilePicThumbObj?.eurl || null,
                  size: chat.size || chat.participantsCount || 0,
                };
              });

            for (const group of derivedGroups) {
              const groupData = {
                user_id: user.id,
                whatsapp_connection_id: connection.id,
                group_id: group.id,
                group_name: group.subject,
                group_image: group.pictureUrl,
                participant_count: group.size || 0,
              };
              const { data: existingGroup } = await supabaseClient
                .from('whatsapp_groups')
                .select('id, is_selected')
                .eq('user_id', user.id)
                .eq('group_id', group.id)
                .maybeSingle();
              if (existingGroup) {
                await supabaseClient.from('whatsapp_groups').update({
                  group_name: groupData.group_name,
                  group_image: groupData.group_image,
                  participant_count: groupData.participant_count,
                }).eq('id', existingGroup.id);
              } else {
                await supabaseClient.from('whatsapp_groups').insert(groupData);
              }
            }

            const { data: savedFromChats } = await supabaseClient
              .from('whatsapp_groups')
              .select('*')
              .eq('user_id', user.id)
              .eq('whatsapp_connection_id', connection.id);

            const enriched = (savedFromChats || []).map((g: any) => {
              const a = activityMapLocal.get(g.group_id);
              return { ...g, last_activity: a?.last_activity || null, unread_count: a?.unread_count || 0, pinned: a?.pinned || false };
            });

            enriched.sort((a: any, b: any) => {
              if (a.is_selected !== b.is_selected) return a.is_selected ? -1 : 1;
              if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
              if (a.last_activity && b.last_activity) return b.last_activity - a.last_activity;
              if (a.last_activity && !b.last_activity) return -1;
              if (!a.last_activity && b.last_activity) return 1;
              if (a.participant_count !== b.participant_count) return b.participant_count - a.participant_count;
              return a.group_name.localeCompare(b.group_name, 'pt-BR');
            });

            return new Response(
              JSON.stringify({ groups: enriched, message: 'Grupos derivados das conversas (timeout fallback)' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (chatTimeoutErr) {
          console.warn('Chats fallback after timeout failed:', chatTimeoutErr);
        }

        // Final timeout fallback: DB cache
        const { data: savedGroups } = await supabaseClient
          .from('whatsapp_groups')
          .select('*')
          .eq('user_id', user.id)
          .order('is_selected', { ascending: false })
          .order('participant_count', { ascending: false })
          .order('group_name', { ascending: true });

        return new Response(
          JSON.stringify({ 
            groups: savedGroups || [],
            warning: 'Timeout ao buscar grupos. Retornando dados em cache.',
            message: 'Grupos carregados do cache (timeout)'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      console.error('Evolution API fetch error:', error);
      throw error;
    }

    // Parse groups with robust extractor
    const groupsJson = await fetchGroupsResponse.json();
    let groupsDataArr = extractArray(groupsJson);
    console.log('Groups fetched from Evolution API:', Array.isArray(groupsDataArr) ? groupsDataArr.length : 0, 'groups');

    // If empty, try a second attempt with getParticipants=true (some providers require it)
    if (!Array.isArray(groupsDataArr) || groupsDataArr.length === 0) {
      try {
        console.log('Primary groups response empty. Retrying with getParticipants=true ...');
        const retryResp = await fetch(
          `${evolutionApiUrl}/group/fetchAllGroups/${connection.instance_name}?getParticipants=true`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json', 'apikey': evolutionApiKey },
            signal: controller.signal,
          }
        );
        if (retryResp.ok) {
          const retryJson = await retryResp.json();
          const retryArr = extractArray(retryJson);
          if (Array.isArray(retryArr) && retryArr.length > 0) {
            groupsDataArr = retryArr;
            console.log('Retry succeeded with', retryArr.length, 'groups');
          }
        } else {
          console.warn('Retry with getParticipants=true returned status', retryResp.status);
        }
      } catch (retryErr) {
        console.warn('Retry with getParticipants=true failed:', retryErr);
      }
    }
    
    // Build activity map from chats
    const activityMap = new Map<string, { last_activity: number; unread_count: number; pinned: boolean }>();
    if (chatsResponse?.ok) {
      try {
        const chatsData = await chatsResponse.json();
        const chats = extractArray(chatsData);
        console.log('Chats fetched:', Array.isArray(chats) ? chats.length : 0);
        
        for (const chat of chats) {
          const chatId = chat.id || chat.jid;
          // Only process group chats
          if (chatId && chatId.endsWith('@g.us')) {
            const lastActivity = 
              chat.conversationTimestamp || 
              chat.lastMessage?.timestamp || 
              chat.t || 
              chat.lastMsg?.t || 
              0;
            
            activityMap.set(chatId, {
              last_activity: lastActivity,
              unread_count: chat.unreadCount || chat.unread || 0,
              pinned: chat.pinned || false
            });
          }
        }
        console.log('Activity map built with', activityMap.size, 'group chats');
      } catch (chatError) {
        console.warn('Error parsing chats data:', chatError);
      }
    }

    // Process and save groups
    const groups = Array.isArray(groupsDataArr) ? groupsDataArr : []; 
    
    if (groups.length === 0) {
      console.log('Evolution API returned empty groups list');
      
      // Check for saved groups in database
      const { data: savedGroups } = await supabaseClient
        .from('whatsapp_groups')
        .select('*')
        .eq('user_id', user.id)
        .order('is_selected', { ascending: false })
        .order('participant_count', { ascending: false })
        .order('group_name', { ascending: true });
        
      if (savedGroups && savedGroups.length > 0) {
        console.log('Returning', savedGroups.length, 'saved groups from database cache');
        return new Response(
          JSON.stringify({ 
            groups: savedGroups,
            message: 'Grupos carregados do cache (Evolution API não retornou grupos novos)'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('No groups found in Evolution API or database');
      return new Response(
        JSON.stringify({ groups: [], message: 'Nenhum grupo encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Upsert groups to database
    for (const group of groups) {
      const groupId = group.id || group.jid || group.remoteJid;
      const groupData = {
        user_id: user.id,
        whatsapp_connection_id: connection.id,
        group_id: groupId,
        group_name: group.subject || group.name || 'Sem nome',
        group_image: group.pictureUrl || group.profilePicUrl || group.picture || null,
        participant_count: group.participants?.length || group.size || group.participantsCount || 0,
      };

      // Check if group already exists
      const { data: existingGroup } = await supabaseClient
        .from('whatsapp_groups')
        .select('id, is_selected')
        .eq('user_id', user.id)
        .eq('group_id', groupId)
        .maybeSingle();

      if (existingGroup) {
        // Update existing group (keep is_selected value)
        await supabaseClient
          .from('whatsapp_groups')
          .update({
            group_name: groupData.group_name,
            group_image: groupData.group_image,
            participant_count: groupData.participant_count,
          })
          .eq('id', existingGroup.id);
      } else {
        // Insert new group
        await supabaseClient
          .from('whatsapp_groups')
          .insert(groupData);
      }
    }

    // Fetch all groups from database to return
    const { data: savedGroups, error: fetchError } = await supabaseClient
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('whatsapp_connection_id', connection.id);

    if (fetchError) {
      console.error('Error fetching saved groups:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar grupos salvos' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enrich groups with activity data and sort intelligently
    const enrichedGroups = (savedGroups || []).map(group => {
      const activity = activityMap.get(group.group_id);
      return {
        ...group,
        last_activity: activity?.last_activity || null,
        unread_count: activity?.unread_count || 0,
        pinned: activity?.pinned || false
      };
    });

    // Sort by: is_selected > pinned > last_activity > participant_count > group_name
    enrichedGroups.sort((a, b) => {
      // 1. Selected groups first
      if (a.is_selected !== b.is_selected) {
        return a.is_selected ? -1 : 1;
      }
      
      // 2. Pinned groups
      if (a.pinned !== b.pinned) {
        return a.pinned ? -1 : 1;
      }
      
      // 3. Most recent activity (WhatsApp order)
      if (a.last_activity && b.last_activity) {
        return b.last_activity - a.last_activity;
      }
      if (a.last_activity && !b.last_activity) return -1;
      if (!a.last_activity && b.last_activity) return 1;
      
      // 4. More participants
      if (a.participant_count !== b.participant_count) {
        return b.participant_count - a.participant_count;
      }
      
      // 5. Alphabetical
      return a.group_name.localeCompare(b.group_name, 'pt-BR');
    });

    console.log('Successfully fetched and sorted', enrichedGroups.length, 'groups');

    return new Response(
      JSON.stringify({ groups: enrichedGroups }),
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
