import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, data?: any) => {
  console.log(`[SEND-GROUP-SUMMARY] ${step}`, data ? JSON.stringify(data) : '');
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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { summaryId, userId, groupId, groupName, summaryText, instanceName } = await req.json();

    logStep("Sending summary to group", { summaryId, groupId, groupName });

    const formattedMessage = `
🤖 *Resumo Diário - ${groupName}*
📅 ${new Date().toLocaleDateString('pt-BR')}

${summaryText}

---
_Resumo gerado automaticamente por Resume Zap_
`.trim();

    const sendResponse = await fetch(
      `${evolutionApiUrl}/message/sendText/${instanceName}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({
          number: groupId,
          text: formattedMessage,
        }),
      }
    );

    const sendData = await sendResponse.json();

    if (!sendResponse.ok) {
      logStep("Error sending message", { status: sendResponse.status, data: sendData });
      
      await supabase.from('summary_deliveries').insert({
        summary_id: summaryId,
        user_id: userId,
        group_id: groupId,
        status: 'failed',
        error_message: JSON.stringify(sendData),
      });

      throw new Error(`Failed to send message: ${JSON.stringify(sendData)}`);
    }

    logStep("Message sent successfully", sendData);

    await supabase.from('summary_deliveries').insert({
      summary_id: summaryId,
      user_id: userId,
      group_id: groupId,
      status: 'sent',
      evolution_message_id: sendData.key?.id || null,
      sent_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Summary sent to group',
        messageId: sendData.key?.id,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    logStep("Fatal error", { error: error instanceof Error ? error.message : error });
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
