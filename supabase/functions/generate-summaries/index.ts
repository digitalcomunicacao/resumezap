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
    let requestBody: any = {};
    
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
      
      // Get request body to check for selected groups
      try {
        requestBody = await req.json();
      } catch {
        // No body or invalid JSON, proceed with all groups
      }
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
    let groupsQuery = supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', userId);
    
    // If specific group IDs are provided from the UI, ignore is_selected and use the explicit list
    if (requestBody.selectedGroupIds && Array.isArray(requestBody.selectedGroupIds) && requestBody.selectedGroupIds.length > 0) {
      groupsQuery = groupsQuery.in('group_id', requestBody.selectedGroupIds);
      console.log(`Filtering to ${requestBody.selectedGroupIds.length} specific groups (explicit selection)`);
    } else {
      // Fallback to user's saved selections
      groupsQuery = groupsQuery.eq('is_selected', true);
    }
    
    const { data: groups, error: groupsError } = await groupsQuery;

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
      .select('*, timezone')
      .eq('user_id', userId)
      .maybeSingle();

    const userTimezone = preferences?.timezone || 'America/Sao_Paulo';

    const summariesGenerated = [];
    const groupDetails = [];
    
    // Ajustar janela de busca para 48h atrás para cobrir variações de fuso
    const searchWindowStart = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const timestampFromSeconds = Math.floor(searchWindowStart.getTime() / 1000);
    const timestampFromMs = searchWindowStart.getTime();
    
    // Janela móvel: últimas 24h no fuso do usuário (com fallbacks)
    const last24hStart = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const last7dStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last30dStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const last24hStartMs = last24hStart.getTime();
    const last7dStartMs = last7dStart.getTime();
    const last30dStartMs = last30dStart.getTime();
    const nowMs = Date.now();
    
    console.log(`[TIMES] timezone=${userTimezone}, searchWindow=${searchWindowStart.toISOString()}, last24hStart=${new Date(last24hStartMs).toISOString()}`);

    // Helper robusto para extrair timestamp em milissegundos
    const getTimestampMs = (msg: any): number | null => {
      const parseVal = (val: any): number | null => {
        if (val == null) return null;
        
        if (typeof val === 'number') {
          // 10 dígitos = seconds
          if (val < 1e11) return val * 1000;
          // 13 dígitos = ms
          if (val < 1e14) return val;
          // 16 dígitos = microseconds
          if (val < 1e17) return Math.floor(val / 1e3);
          // 19+ dígitos = nanoseconds
          return Math.floor(val / 1e6);
        }
        
        if (typeof val === 'string') {
          // Remover não-dígitos e tentar normalizar
          const digits = val.replace(/\D/g, '');
          if (digits.length >= 10) {
            const n = Number(digits);
            if (digits.length === 10) return n * 1000;
            if (digits.length === 13) return n;
            if (digits.length === 16) return Math.floor(n / 1e3);
            if (digits.length >= 19) return Math.floor(n / 1e6);
          }
          
          // Tentar parse ISO
          const iso = Date.parse(val);
          if (!Number.isNaN(iso)) return iso;
          
          // Último recurso: converter string para número
          const n = Number(val);
          if (!Number.isNaN(n)) return parseVal(n);
        }
        
        return null;
      };

      // Tentar extrair timestamp de múltiplas fontes possíveis
      const candidates = [
        msg?.messageTimestampMs,
        msg?.messageTimestamp,
        msg?.timestamp,
        msg?.message?.messageTimestamp,
        msg?.message?.extendedTextMessage?.contextInfo?.messageTimestamp,
        msg?.message?.contextInfo?.messageTimestamp,
        msg?.key?.messageTimestamp,
      ];
      
      for (const c of candidates) {
        const ms = parseVal(c);
        if (ms) return ms;
      }
      
      return null;
    };

    // Helper function to extract messages from various API response formats
    const extractMessages = (data: any): any[] => {
      if (Array.isArray(data)) return data;
      
      // Common keys to check
      const possibleKeys = ['data', 'messages', 'result', 'items', 'records', 'response'];
      for (const key of possibleKeys) {
        if (data?.[key] && Array.isArray(data[key])) {
          return data[key];
        }
        // Check nested structures (e.g., result.messages, result.data)
        if (data?.[key] && typeof data[key] === 'object') {
          const nestedObj = data[key];
          for (const nestedKey of possibleKeys) {
            if (Array.isArray(nestedObj?.[nestedKey])) {
              return nestedObj[nestedKey];
            }
            if (nestedObj?.[nestedKey] && typeof nestedObj[nestedKey] === 'object') {
              for (const deepKey of possibleKeys) {
                if (Array.isArray(nestedObj[nestedKey]?.[deepKey])) {
                  return nestedObj[nestedKey][deepKey];
                }
              }
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

    // Light phone formatter to produce readable identifiers from JIDs/phone numbers
    function formatPhoneNumber(digits: string): string {
      const only = (digits || '').replace(/\D/g, '');
      if (only.length >= 12) {
        const cc = only.slice(0, 2);
        const area = only.slice(2, 4);
        const rest = only.slice(4);
        if (rest.length >= 9) {
          return `+${cc} (${area}) ${rest.slice(0,5)}-${rest.slice(5,9)}`;
        }
        return `+${cc} (${area}) ${rest}`;
      }
      if (only.length >= 10) {
        const area = only.slice(0, 2);
        const rest = only.slice(2);
        if (rest.length >= 9) {
          return `(${area}) ${rest.slice(0,5)}-${rest.slice(5,9)}`;
        }
        return `(${area}) ${rest}`;
      }
      if (only.length >= 4) return `***${only.slice(-4)}`;
      return 'Desconhecido';
    }

    // Helper to extract the best-possible sender name
    const extractSenderName = (msg: any, youLabel: string = 'Você'): string => {
      try {
        // If the message is sent by the authenticated user
        if (msg?.key?.fromMe) return youLabel;

        const candidates: any[] = [
          msg?.pushName,
          msg?.sender?.name,
          msg?.senderName,
          msg?.notifyName,
          msg?.message?.extendedTextMessage?.contextInfo?.participant,
          msg?.key?.participant,
          msg?.participant,
          msg?.author,
          msg?.participant?.id,
        ].filter(Boolean);

        let name = candidates[0];
        if (typeof name === 'string') {
          // If it's a JID, prettify it
          if (name.includes('@')) {
            const digits = name.split('@')[0];
            if (digits) name = formatPhoneNumber(digits);
          }
          return name;
        }

        const jid: string | undefined = msg?.key?.participant || msg?.participant || msg?.key?.remoteJid;
        if (jid && typeof jid === 'string') {
          const digits = jid.split('@')[0];
          if (digits) return formatPhoneNumber(digits);
        }

        return 'Anônimo';
      } catch {
        return 'Anônimo';
      }
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
          
          // If no messages with seconds, retry with milliseconds; if still none, retry without timestamp filter
          if (messages.length === 0) {
            console.log(`Retrying with milliseconds for ${group.group_name}`);
            messages = await fetchMessages(timestampFromMs, 'milliseconds');
            fetchMethod = 'milliseconds';
            if (messages.length === 0) {
              console.log(`Retrying without timestamp filter for ${group.group_name}`);
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
                  },
                  limit: 500,
                }),
              });
              if (response.ok) {
                const data = await response.json();
                const extracted = extractMessages(data);
                console.log(`Fetched with no_filter: ${extracted.length} messages for ${group.group_name}`);
                messages = extracted;
                fetchMethod = 'no_filter';
              } else {
                console.error(`no_filter fetch failed: HTTP ${response.status}`);
              }

              // Final fallback: fetch all recent messages globally and filter by remoteJid locally
              if (messages.length === 0) {
                try {
                  const globalResp = await fetch(`${evolutionApiUrl}/messages/fetch/${connection.instance_name}`, {
                    method: 'GET',
                    headers: { 'apikey': evolutionApiKey },
                  });
                  if (globalResp.ok) {
                    const globalData = await globalResp.json();
                    const globalMessages = Array.isArray(globalData) ? globalData : extractMessages(globalData);
                    const filtered = (globalMessages || []).filter((m: any) => m?.key?.remoteJid === group.group_id);
                    console.log(`Fetched global and filtered: ${filtered.length} messages for ${group.group_name}`);
                    messages = filtered;
                    fetchMethod = 'global_fetch_filter';
                  } else {
                    console.error(`global_fetch failed: HTTP ${globalResp.status}`);
                  }
                } catch (gerr) {
                  console.error(`global_fetch error`, gerr);
                }
              }
            }
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

        // Processar mensagens: extrair timestamp, ordenar e filtrar por "ontem"
        const processedMessages = messages
          .map((msg: any) => {
            const text = extractTextContent(msg);
            if (!text) return null;
            
            const timestampMs = getTimestampMs(msg);
            if (!timestampMs) {
              console.log(`[TIMES] Skipping message with invalid timestamp in ${group.group_name}`);
              return null;
            }
            
            const sender = extractSenderName(msg);
            return { text, sender, timestampMs };
          })
          .filter(Boolean);

        const fetchedCount = processedMessages.length;
        console.log(`[TIMES] ${group.group_name}: fetched ${messages.length}, valid timestamps ${fetchedCount}`);

        // Ordenar por timestamp (ascendente)
        processedMessages.sort((a, b) => (a?.timestampMs || 0) - (b?.timestampMs || 0));

        // Filtrar mensagens da janela móvel com fallbacks progressivos
        const applyWindow = (msgs: any[], fromMs: number, toMs: number) =>
          msgs.filter((m) => m && (m.timestampMs as number) >= fromMs && (m.timestampMs as number) <= toMs);

        let windowLabel = 'last24h';
        let windowMessages = applyWindow(processedMessages as any[], last24hStartMs, nowMs);
        if (windowMessages.length === 0) {
          windowLabel = 'last7d';
          windowMessages = applyWindow(processedMessages as any[], last7dStartMs, nowMs);
        }
        if (windowMessages.length === 0) {
          windowLabel = 'last30d';
          windowMessages = applyWindow(processedMessages as any[], last30dStartMs, nowMs);
        }

        console.log(`[TIMES] ${group.group_name}: filtered to ${windowMessages.length} messages in ${windowLabel}`);

        // Log exemplos de timestamps (até 3)
        windowMessages.slice(0, 3).forEach((msg, idx) => {
          if (!msg) return;
          const formatted = new Date(msg.timestampMs).toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
            timeZone: userTimezone
          });
          console.log(`[TIMES] Example ${idx + 1}: ${msg.timestampMs} -> ${formatted}`);
        });

        // Considerar interações sem texto (mídia, sticker, áudio) para detectar atividade
        const allWindowMessages = messages
          .map((raw: any) => {
            const ts = getTimestampMs(raw);
            if (!ts) return null;
            const sender = extractSenderName(raw);
            const hasText = !!extractTextContent(raw);
            return { sender, timestampMs: ts, hasText };
          })
          .filter(Boolean)
          .filter((m: any) => {
            const from = windowLabel === 'last24h' ? last24hStartMs : windowLabel === 'last7d' ? last7dStartMs : last30dStartMs;
            return m.timestampMs >= from && m.timestampMs <= nowMs;
          }) as Array<{sender: string; timestampMs: number; hasText: boolean}>;

        // Formatar mensagens para o AI
        let formattedMessages = windowMessages
          .map((msg) => {
            if (!msg) return null;
            const formattedDate = new Date(msg.timestampMs).toLocaleString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              hourCycle: 'h23',
              timeZone: userTimezone
            });
            return `[${formattedDate}] ${msg.sender}: ${msg.text}`;
          })
          .filter(Boolean)
          .join('\n');

        // Se não houver mensagens de texto, mas houve atividade, criar linhas sintéticas
        if (!formattedMessages || formattedMessages.length === 0) {
          if (allWindowMessages.length > 0) {
            const synthetic = allWindowMessages
              .map((m) => {
                const formattedDate = new Date(m.timestampMs).toLocaleString('pt-BR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  hourCycle: 'h23',
                  timeZone: userTimezone
                });
                return `[${formattedDate}] ${m.sender}: (interação sem texto)`;
              })
              .join('\n');
            formattedMessages = synthetic;
            console.log(`No text messages, but found ${allWindowMessages.length} interactions for ${group.group_name}; generating activity summary (${windowLabel}).`);
          }
        }

        const textMessageCount = formattedMessages ? formattedMessages.split('\n').filter(Boolean).length : 0;

        if (!formattedMessages || formattedMessages.length === 0) {
          const reason = messages.length === 0 ? 'no_messages' : 'no_text_messages';
          console.log(`No content available for ${group.group_name} (reason=${reason})`);
          groupDetails.push({
            group_name: group.group_name,
            fetched_count: messages.length,
            text_count: 0,
            reason
          });
          continue;
        }

        console.log(`Found ${textMessageCount} text messages from ${messages.length} total messages`);

        // Determine AI model based on plan
        const aiModel = (userPlan === 'enterprise' || userPlan === 'pro' || userPlan === 'premium') 
          ? 'google/gemini-2.5-pro' 
          : 'google/gemini-2.5-flash';

        // Build system prompt based on preferences
        let systemPrompt = '';
        let userPrompt = '';
        
        const tone = preferences?.tone || 'professional';
        const size = preferences?.size || 'medium';
        const thematicFocus = preferences?.thematic_focus;
        const includeSentiment = preferences?.include_sentiment_analysis || false;

        // Sistema prompt específico para Enterprise
        if (userPlan === 'enterprise') {
          systemPrompt = `Você é um assistente especializado em análise detalhada de conversas do WhatsApp para empresas.
  
INSTRUÇÕES ESPECÍFICAS ENTERPRISE:
- Identifique TODOS os participantes que falaram
- Mantenha referências temporais precisas (use os timestamps fornecidos)
- Destaque mensagens-chave com data/hora
- Identifique padrões de horário (ex: "Discussão principal às 14h30")
- Liste decisões tomadas com timestamps
- Identifique perguntas não respondidas
- Analise a sequência temporal das conversas
- Inclua estatísticas de participação por usuário

FORMATO DO RESUMO:
📊 Estatísticas:
- Total de mensagens
- Participantes ativos
- Horário de pico

⏱️ Cronologia Principal:
- [HH:MM] Ponto importante 1
- [HH:MM] Ponto importante 2

👥 Participação:
- Usuário X: principais contribuições
- Usuário Y: principais contribuições

💬 Tópicos Discutidos:
- Tópico 1 (com timestamps relevantes)
- Tópico 2 (com timestamps relevantes)

⚠️ Pendências:
- Itens que requerem atenção`;

          userPrompt = `Analise a conversa abaixo do grupo "${group.group_name}" e forneça um resumo estruturado seguindo o formato especificado:\n\n${formattedMessages}`;
        } else {
          // Manter lógica atual para outros planos
          systemPrompt = 'Você é um assistente especializado em criar resumos de conversas do WhatsApp.';
          
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
          userPrompt = `Resuma as mensagens abaixo do grupo "${group.group_name}":\n\n${formattedMessages}`;
        }

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
                content: userPrompt
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