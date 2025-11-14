import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const evolutionApiUrl = Deno.env.get("EVOLUTION_API_URL")!;
    const evolutionApiKey = Deno.env.get("EVOLUTION_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseKey);

    // =====================================
    // AUTH
    // =====================================
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (!user || userError) {
      console.error("Auth error:", userError);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log("[GENERATE_QR] User:", user.id);

    // =====================================
    // CLEANUP APENAS QR EXPIRADO (NÃO MATA CONEXÕES ATUAIS)
    // =====================================
    const now = new Date();
    const { data: expiredConnections } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "connecting")
      .lt("qr_code_expires_at", now.toISOString());

    if (expiredConnections?.length) {
      await supabase
        .from("whatsapp_connections")
        .update({ status: "disconnected" })
        .in(
          "id",
          expiredConnections.map((c) => c.id),
        );

      console.log("[CLEANUP] Expired QR disconnected:", expiredConnections.length);
    }

    // =====================================
    // VERIFICA SE JÁ TEM CONEXÃO EXISTENTE
    // =====================================
    const { data: existingConnection } = await supabase
      .from("whatsapp_connections")
      .select("*")
      .eq("user_id", user.id)
      .in("status", ["connected", "connecting"])
      .maybeSingle();

    // -------------------------------------
    // CONEXÃO JÁ ATIVA
    // -------------------------------------
    if (existingConnection?.status === "connected") {
      return new Response(
        JSON.stringify({
          success: true,
          connected: true,
          instanceId: existingConnection.instance_id,
          reason: "already_connected",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // -------------------------------------
    // ESTÁ CONECTANDO — REUTILIZA QR SE FOR VÁLIDO
    // -------------------------------------
    if (existingConnection?.status === "connecting") {
      const expiresAt = new Date(existingConnection.qr_code_expires_at);

      if (expiresAt > now && existingConnection.qr_code) {
        console.log("[REUSED_QR] Valid QR reused");

        return new Response(
          JSON.stringify({
            success: true,
            qrCode: ensureBase64(existingConnection.qr_code),
            instanceId: existingConnection.instance_id,
            expiresAt: existingConnection.qr_code_expires_at,
            reason: "reused_qr",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      // -------------------------------------
      // QR EXPIROU — TENTA GERAR NOVO PARA MESMA INSTÂNCIA
      // -------------------------------------
      console.log("[REFRESH_QR] Attempting refresh for:", existingConnection.instance_id);

      const refreshResponse = await fetch(`${evolutionApiUrl}/instance/connect/${existingConnection.instance_id}`, {
        method: "GET",
        headers: { apikey: evolutionApiKey },
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        const newQr = extractQR(refreshData);

        if (newQr) {
          const newExpiresAt = new Date(Date.now() + 60 * 1000);

          await supabase
            .from("whatsapp_connections")
            .update({
              qr_code: newQr,
              qr_code_expires_at: newExpiresAt.toISOString(),
            })
            .eq("id", existingConnection.id);

          console.log("[REFRESH_QR] Success");

          return new Response(
            JSON.stringify({
              success: true,
              qrCode: ensureBase64(newQr),
              instanceId: existingConnection.instance_id,
              expiresAt: newExpiresAt.toISOString(),
              reason: "refreshed_qr",
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }
      }
    }

    // =====================================
    // CRIA NOVA INSTÂNCIA — QD NECESSÁRIO
    // =====================================
    const instanceName = `resumezap_${user.id.substring(0, 8)}_${Date.now()}`;

    console.log("[INSTANCE_CREATE] New instance:", instanceName);

    const createInstanceResponse = await fetch(`${evolutionApiUrl}/instance/create`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: evolutionApiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });

    if (!createInstanceResponse.ok) {
      return new Response(JSON.stringify({ error: "Erro ao criar instância WhatsApp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // =====================================
    // GERA QR
    // =====================================
    const connectResponse = await fetch(`${evolutionApiUrl}/instance/connect/${instanceName}`, {
      method: "GET",
      headers: { apikey: evolutionApiKey },
    });

    if (!connectResponse.ok) {
      return new Response(JSON.stringify({ error: "Erro ao gerar QR Code" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectData = await connectResponse.json();
    const qrCode = extractQR(connectData);

    if (!qrCode) {
      return new Response(JSON.stringify({ error: "QR Code não encontrado" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expiresAt = new Date(Date.now() + 60 * 1000);

    // =====================================
    // SALVA NA TABELA
    // =====================================
    const { error: dbError } = await supabase.from("whatsapp_connections").insert({
      user_id: user.id,
      instance_id: instanceName,
      instance_name: instanceName,
      status: "connecting",
      qr_code: qrCode,
      qr_code_expires_at: expiresAt.toISOString(),
    });

    if (dbError) {
      return new Response(JSON.stringify({ error: "Erro ao salvar conexão" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        qrCode: ensureBase64(qrCode),
        instanceId: instanceName,
        expiresAt: expiresAt.toISOString(),
        reason: "new_instance",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// =====================================
// HELPERS
// =====================================
function extractQR(data: any) {
  return data?.base64 || data?.code || data?.qrcode?.base64;
}

function ensureBase64(qr: string) {
  return qr.startsWith("data:image/png;base64,") ? qr : `data:image/png;base64,${qr}`;
}
