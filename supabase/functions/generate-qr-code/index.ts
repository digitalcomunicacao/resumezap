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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL')!;
    const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: req.headers.get('Authorization')! },
      },
    });

    // Get authenticated user (JWT already verified by Supabase)
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating QR code for user:', user.id);

    // TTL cleanup: disconnect stale "connecting" attempts older than 2 minutes
    const ttlThreshold = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('user_id', user.id)
      .eq('status', 'connecting')
      .lte('qr_code_expires_at', ttlThreshold);

    // Check if user already has an active or connecting connection
    const { data: existingConnection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['connected', 'connecting'])
      .maybeSingle();

    if (existingConnection) {
      console.log('Existing connection found:', existingConnection.instance_id, existingConnection.status);
      
      if (existingConnection.status === 'connected') {
        return new Response(
          JSON.stringify({
            success: true,
            connected: true,
            reason: 'already_connected',
            instanceId: existingConnection.instance_id,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // status === 'connecting': try reuse or refresh QR
      const now = new Date();
      const expiresAtExisting = existingConnection.qr_code_expires_at ? new Date(existingConnection.qr_code_expires_at) : null;

      if (existingConnection.qr_code && expiresAtExisting && expiresAtExisting > now) {
        console.log('[REUSED_QR] Returning still-valid QR for existing instance');
        const formattedQr = existingConnection.qr_code.startsWith('data:')
          ? existingConnection.qr_code
          : `data:image/png;base64,${existingConnection.qr_code}`;

        return new Response(
          JSON.stringify({
            success: true,
            qrCode: formattedQr,
            instanceId: existingConnection.instance_id,
            expiresAt: expiresAtExisting.toISOString(),
            reason: 'reused_qr',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[REFRESH_QR] Existing QR expired or missing, requesting new QR for same instance');
      const refreshResp = await fetch(`${evolutionApiUrl}/instance/connect/${existingConnection.instance_id}`, {
        method: 'GET',
        headers: { 'apikey': evolutionApiKey },
      });

      if (refreshResp.ok) {
        const refreshData = await refreshResp.json();
        const refreshedRaw = refreshData.base64 || refreshData.code || refreshData.qrcode?.base64;
        if (!refreshedRaw) {
          console.error('No QR in refresh response:', refreshData);
        } else {
          const refreshedQr = typeof refreshedRaw === 'string' && refreshedRaw.startsWith('data:')
            ? refreshedRaw
            : `data:image/png;base64,${refreshedRaw}`;
          const refreshedExpiresAt = new Date(Date.now() + 60000).toISOString();

          const { error: updateErr } = await supabase
            .from('whatsapp_connections')
            .update({ qr_code: refreshedQr, qr_code_expires_at: refreshedExpiresAt })
            .eq('id', existingConnection.id);

          if (updateErr) {
            console.error('Error updating refreshed QR in DB:', updateErr);
          }

          return new Response(
            JSON.stringify({
              success: true,
              qrCode: refreshedQr,
              instanceId: existingConnection.instance_id,
              expiresAt: refreshedExpiresAt,
              reason: 'refreshed_qr',
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } else if (refreshResp.status === 404) {
        console.warn('[REFRESH_QR] Instance not found on provider (404). Will disconnect record and create new one.');
      } else {
        const errText = await refreshResp.text();
        console.error('[REFRESH_QR] Provider error:', refreshResp.status, errText);
      }

      // If we reach here, mark old record as disconnected and continue to create a new instance
      await supabase
        .from('whatsapp_connections')
        .update({ status: 'disconnected' })
        .eq('id', existingConnection.id);
    }

    // Mark any previous connections as disconnected before creating new one
    await supabase
      .from('whatsapp_connections')
      .update({ status: 'disconnected' })
      .eq('user_id', user.id)
      .neq('status', 'disconnected');

    // Generate unique instance name
    const instanceName = `resumezap_${user.id.substring(0, 8)}_${Date.now()}`;

    console.log('Creating Evolution API instance:', instanceName);

    // Create instance in Evolution API
    console.log('Evolution API URL:', evolutionApiUrl);
    console.log('Creating instance with payload:', {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true
    });

    const createInstanceResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': evolutionApiKey,
      },
      body: JSON.stringify({
        instanceName: instanceName,
        integration: 'WHATSAPP-BAILEYS',
        qrcode: true,
      }),
    });

    if (!createInstanceResponse.ok) {
      const errorText = await createInstanceResponse.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText };
      }

      console.error('Evolution API Error Details:', {
        status: createInstanceResponse.status,
        statusText: createInstanceResponse.statusText,
        body: errorData,
        url: `${evolutionApiUrl}/instance/create`,
      });

      let userMessage = 'Erro ao criar instância WhatsApp';
      
      if (errorData.response?.message?.includes('Invalid integration')) {
        userMessage = 'Erro de configuração da API Evolution. Verifique as credenciais.';
      } else if (createInstanceResponse.status === 401) {
        userMessage = 'API Key da Evolution API inválida';
      } else if (createInstanceResponse.status === 404) {
        userMessage = 'Endpoint da Evolution API não encontrado. Verifique a URL.';
      }

      return new Response(
        JSON.stringify({ 
          error: userMessage,
          details: errorData
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const instanceData = await createInstanceResponse.json();
    console.log('Instance created:', instanceData);

    // Connect to get QR code
    const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: 'GET',
      headers: {
        'apikey': evolutionApiKey,
      },
    });

    if (!connectResponse.ok) {
      const errorText = await connectResponse.text();
      console.error('Evolution API connect error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Erro ao gerar QR Code' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const connectData = await connectResponse.json();
    console.log('QR code generated');

    const qrRaw = connectData.base64 || connectData.code || connectData.qrcode?.base64;

    if (!qrRaw) {
      console.error('No QR code in response:', connectData);
      return new Response(
        JSON.stringify({ error: 'QR Code não encontrado na resposta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const qrCode = typeof qrRaw === 'string' && qrRaw.startsWith('data:')
      ? qrRaw
      : `data:image/png;base64,${qrRaw}`;

    // Save connection to database
    const expiresAt = new Date(Date.now() + 60000); // 60 seconds from now

    const { data: connection, error: dbError } = await supabase
      .from('whatsapp_connections')
      .insert({
        user_id: user.id,
        instance_id: instanceName,
        instance_name: instanceName,
        status: 'connecting',
        qr_code: qrCode,
        qr_code_expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(
        JSON.stringify({ error: 'Erro ao salvar conexão' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Connection saved to database:', connection.id);

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: qrCode,
        instanceId: instanceName,
        expiresAt: expiresAt.toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-qr-code:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro interno do servidor';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
