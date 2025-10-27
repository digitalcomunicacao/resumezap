import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      throw new Error('Invalid user token');
    }

    console.log(`Generating summaries for user: ${user.id}`);

    // Get user's WhatsApp connection
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError || !connection) {
      throw new Error('No active WhatsApp connection found');
    }

    // Get selected groups
    const { data: groups, error: groupsError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_selected', true);

    if (groupsError || !groups || groups.length === 0) {
      throw new Error('No groups selected for summarization');
    }

    console.log(`Found ${groups.length} selected groups`);

    const summariesGenerated = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const timestampFrom = Math.floor(yesterday.getTime() / 1000);

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.group_name}`);

        // Fetch messages from Evolution API
        const messagesUrl = `${evolutionApiUrl}/chat/findMessages/${connection.instance_name}`;
        const messagesResponse = await fetch(messagesUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': evolutionApiKey,
          },
          body: JSON.stringify({
            where: {
              key: {
                remoteJid: group.group_id,
              },
              messageTimestamp: {
                $gte: timestampFrom,
              },
            },
            limit: 500,
          }),
        });

        if (!messagesResponse.ok) {
          console.error(`Failed to fetch messages for group ${group.group_name}`);
          continue;
        }

        const messagesData = await messagesResponse.json();
        
        // Extract messages array from response (handle different API response formats)
        let messages = [];
        if (Array.isArray(messagesData)) {
          messages = messagesData;
        } else if (messagesData?.data && Array.isArray(messagesData.data)) {
          messages = messagesData.data;
        } else if (messagesData?.messages && Array.isArray(messagesData.messages)) {
          messages = messagesData.messages;
        }

        console.log(`Found ${typeof messages} messages for ${group.group_name}`, messages.length);

        if (!Array.isArray(messages) || messages.length === 0) {
          console.log(`No messages found for group ${group.group_name}`);
          continue;
        }

        console.log(`Processing ${messages.length} messages for ${group.group_name}`);

        // Format messages for AI
        const formattedMessages = messages
          .filter((msg: any) => msg.message?.conversation || msg.message?.extendedTextMessage?.text)
          .map((msg: any) => {
            const text = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
            const sender = msg.pushName || 'Anônimo';
            return `${sender}: ${text}`;
          })
          .join('\n');

        if (formattedMessages.length === 0) {
          console.log(`No text messages found for group ${group.group_name}`);
          continue;
        }

        // Generate summary using Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Você é um assistente especializado em criar resumos claros e objetivos de conversas do WhatsApp. Crie um resumo em português brasileiro com os principais tópicos discutidos, mantendo um tom amigável e organizado em bullet points.'
              },
              {
                role: 'user',
                content: `Resuma as mensagens abaixo do grupo "${group.group_name}":\n\n${formattedMessages}`
              }
            ],
          }),
        });

        if (!aiResponse.ok) {
          const errorText = await aiResponse.text();
          console.error(`AI API error for ${group.group_name}:`, aiResponse.status, errorText);
          continue;
        }

        const aiData = await aiResponse.json();
        const summaryText = aiData.choices?.[0]?.message?.content;

        if (!summaryText) {
          console.error(`No summary generated for ${group.group_name}`);
          continue;
        }

        // Save summary to database
        const { error: insertError } = await supabase
          .from('summaries')
          .insert({
            user_id: user.id,
            group_id: group.group_id,
            group_name: group.group_name,
            summary_text: summaryText,
            message_count: messages.length,
            summary_date: new Date().toISOString().split('T')[0],
          });

        if (insertError) {
          console.error(`Error saving summary for ${group.group_name}:`, insertError);
          continue;
        }

        summariesGenerated.push({
          group_name: group.group_name,
          message_count: messages.length,
        });

        console.log(`Summary generated for ${group.group_name}`);

      } catch (groupError) {
        console.error(`Error processing group ${group.group_name}:`, groupError);
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summaries_count: summariesGenerated.length,
        summaries: summariesGenerated,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Error in generate-summaries function:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});