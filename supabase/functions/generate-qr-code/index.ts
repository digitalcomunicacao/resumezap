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
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Generating QR code for user:', user.id);

    // Check if user already has an active or connecting connection
    const { data: existingConnection } = await supabase
      .from('whatsapp_connections')
      .select('*')
      .eq('user_id', user.id)
      .in('status', ['connected', 'connecting'])
      .maybeSingle();

    if (existingConnection) {
      console.log('User already has active/connecting connection:', existingConnection.instance_id);
      return new Response(
        JSON.stringify({ error: 'Você já tem uma conexão WhatsApp ativa ou em andamento' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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

    const qrCode = connectData.base64 || connectData.code || connectData.qrcode?.base64;

    if (!qrCode) {
      console.error('No QR code in response:', connectData);
      return new Response(
        JSON.stringify({ error: 'QR Code não encontrado na resposta' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
