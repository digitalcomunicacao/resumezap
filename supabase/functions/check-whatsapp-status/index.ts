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

    // Get user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
    } = await supabase.auth.getUser(token);

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instanceId } = await req.json();
    if (!instanceId) {
      return new Response(JSON.stringify({ error: "InstanceId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Evolution API
    const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceId}`, {
      method: "GET",
      headers: { apikey: evolutionApiKey },
    });

    const statusData = await statusResponse.json();

    console.log("EVOLUTION RAW:", JSON.stringify(statusData, null, 2));

    const state =
      statusData?.state ||
      statusData?.connectionState ||
      statusData?.instance?.state ||
      statusData?.instance?.connectionState ||
      statusData?.response?.state ||
      statusData?.response?.connectionState;

    console.log("STATE PARSED:", state);

    const isConnected = state === "connected" || state === "open";

    const phoneNumber = statusData?.instance?.owner || statusData?.owner || statusData?.response?.owner || null;

    // UPSERT
    const record = {
      user_id: user.id,
      instance_id: instanceId,
      status: isConnected ? "connected" : "connecting",
      phone_number: phoneNumber,
      updated_at: new Date().toISOString(),
      ...(isConnected && { connected_at: new Date().toISOString() }),
    };

    await supabase.from("whatsapp_connections").upsert(record, { onConflict: "user_id" });

    return new Response(
      JSON.stringify({
        success: true,
        status: isConnected ? "connected" : "connecting",
        phoneNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
