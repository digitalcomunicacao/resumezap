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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check for user ID in custom header (for scheduled tasks)
    const scheduledUserId = req.headers.get('x-user-id');
    
    let userId: string;
    
    if (scheduledUserId) {
      // Scheduled task - validate service role key
      const authHeader = req.headers.get('Authorization');
      const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      
      if (!authHeader || !authHeader.includes(serviceKey || '')) {
        throw new Error('Unauthorized scheduled task');
      }
      
      userId = scheduledUserId;
      console.log(`[GENERATE-SUMMARIES] Processing scheduled task for user: ${userId}`);
    } else {
      // Regular request - use JWT
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        throw new Error('Missing authorization header');
      }
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      
      if (userError || !user) {
        throw new Error('Invalid user token');
      }
      
      userId = user.id;
      console.log(`Generating summaries for user: ${userId}`);
    }

    // Get user's WhatsApp connection
    const { data: connection, error: connectionError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'connected')
      .maybeSingle();

    if (connectionError || !connection) {
      throw new Error('No active WhatsApp connection found');
    }

    // Get selected groups
    const { data: groups, error: groupsError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', userId)
      .eq('is_selected', true);

    if (groupsError || !groups || groups.length === 0) {
      throw new Error('No groups selected for summarization');
    }

    console.log(`Found ${groups.length} selected groups`);

    // Get user's profile for subscription plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan')
      .eq('id', userId)
      .single();

    const userPlan = profile?.subscription_plan || 'free';

    // Get user's summary preferences
    const { data: preferences } = await supabase
      .from('summary_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    const summariesGenerated = [];
    const groupDetails = [];
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const timestampFromSeconds = Math.floor(yesterday.getTime() / 1000);
    const timestampFromMs = yesterday.getTime();

    // Helper function to extract messages from various API response formats
    const extractMessages = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      
      // Common keys to check
      const possibleKeys = ['data', 'messages', 'result', 'items', 'records'];
      for (const key of possibleKeys) {
        if (data?.[key] && Array.isArray(data[key])) {
          return data[key];
        }
        // Check nested structures (e.g., result.messages)
        if (data?.[key] && typeof data[key] === 'object') {
          for (const nestedKey of possibleKeys) {
            if (Array.isArray(data[key][nestedKey])) {
              return data[key][nestedKey];
            }
          }
        }
      }
      return [];
    };

    // Helper function to extract text content from message
    const extractTextContent = (msg: any): string | null => {
      const message = msg.message;
      if (!message) return null;

      // Text messages
      if (message.conversation) return message.conversation;
      if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
      
      // Media captions
      if (message.imageMessage?.caption) return message.imageMessage.caption;
      if (message.videoMessage?.caption) return message.videoMessage.caption;
      if (message.documentMessage?.caption) return message.documentMessage.caption;
      
      // Interactive messages
      if (message.buttonsResponseMessage?.selectedDisplayText) {
        return message.buttonsResponseMessage.selectedDisplayText;
      }
      if (message.listResponseMessage?.title) {
        return message.listResponseMessage.title;
      }
      
      return null;
    };

    for (const group of groups) {
      try {
        console.log(`Processing group: ${group.group_name}`);
        let messages: any[] = [];
        let fetchMethod = 'seconds';

        // Fetch messages from Evolution API - First try with seconds
        const messagesUrl = `${evolutionApiUrl}/chat/findMessages/${connection.instance_name}`;
        
        const fetchMessages = async (timestamp: number, method: string) => {
          const response = await fetch(messagesUrl, {
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
                  $gte: timestamp,
                },
              },
              limit: 500,
            }),
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          const data = await response.json();
          const extracted = extractMessages(data);
          console.log(`Fetched with ${method}: ${extracted.length} messages for ${group.group_name}`);
          return extracted;
        };

        try {
          messages = await fetchMessages(timestampFromSeconds, 'seconds');
          fetchMethod = 'seconds';
          
          // If no messages with seconds, retry with milliseconds
          if (messages.length === 0) {
            console.log(`Retrying with milliseconds for ${group.group_name}`);
            messages = await fetchMessages(timestampFromMs, 'milliseconds');
            fetchMethod = 'milliseconds';
          }
        } catch (fetchError) {
          console.error(`Failed to fetch messages for group ${group.group_name}:`, fetchError);
          groupDetails.push({
            group_name: group.group_name,
            fetched_count: 0,
            text_count: 0,
            reason: 'fetch_error'
          });
          continue;
        }

        if (messages.length === 0) {
          console.log(`No messages found for group ${group.group_name}`);
          groupDetails.push({
            group_name: group.group_name,
            fetched_count: 0,
            text_count: 0,
            reason: 'no_messages'
          });
          continue;
        }

        console.log(`Processing ${messages.length} messages (via ${fetchMethod}) for ${group.group_name}`);

        // Format messages for AI - extract text from various message types
        const formattedMessages = messages
          .map((msg: any) => {
            const text = extractTextContent(msg);
            if (!text) return null;
            const sender = msg.pushName || 'Anônimo';
            return `${sender}: ${text}`;
          })
          .filter(Boolean)
          .join('\n');

        const textMessageCount = formattedMessages.split('\n').length;

        if (formattedMessages.length === 0) {
          console.log(`No text content found in ${messages.length} messages for group ${group.group_name}`);
          groupDetails.push({
            group_name: group.group_name,
            fetched_count: messages.length,
            text_count: 0,
            reason: 'no_text_messages'
          });
          continue;
        }

        console.log(`Found ${textMessageCount} text messages from ${messages.length} total messages`);

        // Determine AI model based on plan
        const aiModel = (userPlan === 'pro' || userPlan === 'premium') 
          ? 'google/gemini-2.5-pro' 
          : 'google/gemini-2.5-flash';

        // Build system prompt based on preferences
        let systemPrompt = 'Você é um assistente especializado em criar resumos de conversas do WhatsApp.';
        
        const tone = preferences?.tone || 'professional';
        const size = preferences?.size || 'medium';
        const thematicFocus = preferences?.thematic_focus;
        const includeSentiment = preferences?.include_sentiment_analysis || false;

        // Tone customization
        const toneInstructions = {
          professional: 'Mantenha um tom profissional e objetivo.',
          casual: 'Use um tom casual e descontraído.',
          formal: 'Mantenha um tom formal e elegante.',
          friendly: 'Use um tom amigável e acolhedor.',
        };
        systemPrompt += ` ${toneInstructions[tone as keyof typeof toneInstructions] || toneInstructions.professional}`;

        // Size customization
        const sizeInstructions = {
          short: 'Crie um resumo bem curto, com no máximo 3 pontos principais.',
          medium: 'Crie um resumo médio, com 4-6 pontos principais.',
          long: 'Crie um resumo detalhado, com 7-10 pontos principais.',
          detailed: 'Crie um resumo muito detalhado, cobrindo todos os aspectos importantes.',
        };
        systemPrompt += ` ${sizeInstructions[size as keyof typeof sizeInstructions] || sizeInstructions.medium}`;

        // Thematic focus
        if (thematicFocus) {
          systemPrompt += ` Foque principalmente em tópicos relacionados a: ${thematicFocus}.`;
        }

        // Sentiment analysis
        if (includeSentiment) {
          systemPrompt += ' Inclua uma breve análise do sentimento geral da conversa (positivo, neutro ou negativo).';
        }

        systemPrompt += ' Organize em bullet points em português brasileiro.';

        // Generate summary using Lovable AI
        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: aiModel,
            messages: [
              {
                role: 'system',
                content: systemPrompt
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
            user_id: userId,
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

        groupDetails.push({
          group_name: group.group_name,
          fetched_count: messages.length,
          text_count: textMessageCount,
          reason: 'success',
          fetch_method: fetchMethod
        });

        console.log(`Summary generated for ${group.group_name} (${textMessageCount} text messages from ${messages.length} total)`);

      } catch (groupError) {
        console.error(`Error processing group ${group.group_name}:`, groupError);
        groupDetails.push({
          group_name: group.group_name,
          fetched_count: 0,
          text_count: 0,
          reason: 'processing_error'
        });
        continue;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        summaries_count: summariesGenerated.length,
        summaries: summariesGenerated,
        details: groupDetails,
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