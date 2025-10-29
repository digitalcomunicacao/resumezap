import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper to extract timestamp in milliseconds
const getTimestampMs = (msg: any): number | null => {
  const parseVal = (val: any): number | null => {
    if (val == null) return null;
    
    if (typeof val === 'number') {
      if (val < 1e11) return val * 1000;
      if (val < 1e14) return val;
      if (val < 1e17) return Math.floor(val / 1e3);
      return Math.floor(val / 1e6);
    }
    
    if (typeof val === 'string') {
      const digits = val.replace(/\D/g, '');
      if (digits.length >= 10) {
        const n = Number(digits);
        if (digits.length === 10) return n * 1000;
        if (digits.length === 13) return n;
        if (digits.length === 16) return Math.floor(n / 1e3);
        if (digits.length >= 19) return Math.floor(n / 1e6);
      }
      
      const iso = Date.parse(val);
      if (!Number.isNaN(iso)) return iso;
      
      const n = Number(val);
      if (!Number.isNaN(n)) return parseVal(n);
    }
    
    return null;
  };

  const candidates = [
    msg?.messageTimestampMs,
    msg?.messageTimestamp,
    msg?.timestamp,
    msg?.message?.messageTimestamp,
    msg?.key?.messageTimestamp,
  ];
  
  for (const c of candidates) {
    const ms = parseVal(c);
    if (ms) return ms;
  }
  
  return null;
};

// Helper to extract messages array
const extractMessages = (data: any): any[] => {
  if (Array.isArray(data)) return data;
  
  const possibleKeys = ['data', 'messages', 'result', 'items'];
  for (const key of possibleKeys) {
    if (data?.[key] && Array.isArray(data[key])) {
      return data[key];
    }
  }
  return [];
};

// Helper to extract text content
const extractTextContent = (msg: any): string | null => {
  const message = msg.message;
  if (!message) return null;

  if (message.conversation) return message.conversation;
  if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
  if (message.imageMessage?.caption) return message.imageMessage.caption;
  if (message.videoMessage?.caption) return message.videoMessage.caption;
  
  return null;
};

// Helper to extract sender name
const extractSenderName = (msg: any): string => {
  if (msg?.key?.fromMe) return 'Você';
  
  const name = msg?.pushName || msg?.senderName || msg?.notifyName;
  if (name) return name;
  
  const jid = msg?.key?.participant || msg?.participant;
  if (jid && typeof jid === 'string') {
    const digits = jid.split('@')[0];
    if (digits && digits.length >= 4) return `***${digits.slice(-4)}`;
  }
  
  return 'Anônimo';
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, simulatedHour } = await req.json();

    if (!userId) {
      throw new Error('userId é obrigatório');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`[TEST] Iniciando teste para userId: ${userId}, hora simulada: ${simulatedHour || 'atual'}`);

    const diagnosis = {
      connection: { status: 'unknown', type: 'unknown' },
      groups: { total: 0, selected: 0 },
      summaries: { generated: 0, failed: 0 },
      errors: [] as string[],
    };

    // 1. Verificar conexão WhatsApp
    const { data: connection, error: connError } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (connError || !connection) {
      diagnosis.errors.push('Usuário não possui conexão WhatsApp');
      diagnosis.connection.status = 'disconnected';
    } else {
      diagnosis.connection.status = connection.status;
      diagnosis.connection.type = connection.connection_type;

      if (connection.status !== 'connected') {
        diagnosis.errors.push(`Conexão WhatsApp está ${connection.status}, não conectada`);
      }
    }

    // 2. Verificar grupos
    const { data: groups, error: groupsError } = await supabase
      .from('whatsapp_groups')
      .select('*')
      .eq('user_id', userId)
      .eq('archived', false);

    if (groupsError) {
      diagnosis.errors.push(`Erro ao buscar grupos: ${groupsError.message}`);
    } else {
      diagnosis.groups.total = groups?.length || 0;
      diagnosis.groups.selected = groups?.filter(g => g.is_selected).length || 0;

      if (diagnosis.groups.selected === 0) {
        diagnosis.errors.push('Usuário não possui grupos selecionados');
      }
    }

    // 3. Verificar preferências de horário
    const { data: profile } = await supabase
      .from('profiles')
      .select('preferred_summary_time, subscription_plan')
      .eq('id', userId)
      .single();

    const preferredHour = profile?.preferred_summary_time 
      ? parseInt(profile.preferred_summary_time.split(':')[0]) 
      : 9;

    const testHour = simulatedHour !== undefined ? simulatedHour : new Date().getHours();

    console.log(`[TEST] Horário preferido: ${preferredHour}, horário do teste: ${testHour}`);

    // 4. Tentar gerar resumos diretamente (se tudo estiver OK)
    if (diagnosis.connection.status === 'connected' && diagnosis.groups.selected > 0 && connection && groups) {
      const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
      const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;
      const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;

      const selectedGroups = groups.filter(g => g.is_selected);
      const userPlan = profile?.subscription_plan || 'free';
      
      console.log(`[TEST] Gerando resumos para ${selectedGroups.length} grupos`);

      for (const group of selectedGroups) {
        try {
          console.log(`[TEST] Processando grupo: ${group.group_name}`);
          
          // Buscar mensagens via Evolution API
          const messagesUrl = `${evolutionApiUrl}/chat/findMessages/${connection.instance_name}`;
          const last24h = Math.floor((Date.now() - 24 * 60 * 60 * 1000) / 1000);
          
          const response = await fetch(messagesUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              where: {
                key: { remoteJid: group.group_id },
                messageTimestamp: { $gte: last24h },
              },
              limit: 500,
            }),
          });

          if (!response.ok) {
            console.error(`[TEST] Falha ao buscar mensagens: HTTP ${response.status}`);
            diagnosis.summaries.failed++;
            diagnosis.errors.push(`${group.group_name}: Falha ao buscar mensagens`);
            continue;
          }

          const data = await response.json();
          const messages = extractMessages(data);
          
          console.log(`[TEST] ${messages.length} mensagens obtidas de ${group.group_name}`);

          if (messages.length === 0) {
            console.log(`[TEST] Sem mensagens para ${group.group_name}`);
            continue;
          }

          // Processar mensagens
          const processedMessages = messages
            .map((msg: any) => {
              const text = extractTextContent(msg);
              if (!text) return null;
              
              const timestampMs = getTimestampMs(msg);
              if (!timestampMs) return null;
              
              const sender = extractSenderName(msg);
              return { text, sender, timestampMs };
            })
            .filter(Boolean)
            .sort((a, b) => (a?.timestampMs || 0) - (b?.timestampMs || 0));

          const last24hMs = Date.now() - 24 * 60 * 60 * 1000;
          const recentMessages = processedMessages.filter(m => m && m.timestampMs >= last24hMs);

          console.log(`[TEST] ${recentMessages.length} mensagens das últimas 24h`);

          if (recentMessages.length === 0) {
            console.log(`[TEST] Sem mensagens recentes para ${group.group_name}`);
            continue;
          }

          // Formatar mensagens para IA
          const formattedMessages = recentMessages
            .filter((m): m is NonNullable<typeof m> => m !== null)
            .map(m => `[${m.sender}]: ${m.text}`)
            .join('\n');

          // Chamar Lovable AI
          const aiModel = userPlan === 'enterprise' ? 'google/gemini-2.5-pro' : 'google/gemini-2.5-flash-lite';
          
          console.log(`[TEST] Gerando resumo com ${aiModel}...`);

          const aiResponse = await fetch('https://api.lovable.app/v1/ai/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${lovableApiKey}`,
            },
            body: JSON.stringify({
              model: aiModel,
              messages: [
                {
                  role: 'system',
                  content: 'Você é um assistente especializado em resumir conversas de WhatsApp. Crie um resumo claro e objetivo das mensagens fornecidas.',
                },
                {
                  role: 'user',
                  content: `Resuma as seguintes mensagens do grupo "${group.group_name}" (${recentMessages.length} mensagens):\n\n${formattedMessages}`,
                },
              ],
            }),
          });

          if (!aiResponse.ok) {
            console.error(`[TEST] Falha na IA: HTTP ${aiResponse.status}`);
            diagnosis.summaries.failed++;
            diagnosis.errors.push(`${group.group_name}: Falha ao gerar resumo (IA)`);
            continue;
          }

          const aiData = await aiResponse.json();
          const summary = aiData?.choices?.[0]?.message?.content;

          if (!summary) {
            console.error(`[TEST] Resumo vazio retornado pela IA`);
            diagnosis.summaries.failed++;
            diagnosis.errors.push(`${group.group_name}: Resumo vazio`);
            continue;
          }

          console.log(`[TEST] Resumo gerado (${summary.length} chars)`);

          // Salvar resumo
          const { error: saveError } = await supabase
            .from('summaries')
            .insert({
              user_id: userId,
              group_id: group.group_id,
              group_name: group.group_name,
              summary_text: summary,
              message_count: recentMessages.length,
              summary_date: new Date().toISOString().split('T')[0],
            });

          if (saveError) {
            console.error(`[TEST] Erro ao salvar resumo:`, saveError);
            diagnosis.summaries.failed++;
            diagnosis.errors.push(`${group.group_name}: Falha ao salvar`);
          } else {
            console.log(`[TEST] ✓ Resumo salvo com sucesso para ${group.group_name}`);
            diagnosis.summaries.generated++;
          }

        } catch (groupError: any) {
          console.error(`[TEST] Erro ao processar ${group.group_name}:`, groupError);
          diagnosis.summaries.failed++;
          diagnosis.errors.push(`${group.group_name}: ${groupError.message}`);
        }
      }
    }

    const success = diagnosis.errors.length === 0 && diagnosis.summaries.generated > 0;

    console.log(`[TEST] Resultado: ${success ? 'SUCESSO' : 'FALHA'}`, diagnosis);

    return new Response(
      JSON.stringify({
        success,
        diagnosis,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[TEST] Erro:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
