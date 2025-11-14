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

    // Get authenticated user
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instanceId } = await req.json();

    if (!instanceId) {
      return new Response(JSON.stringify({ error: "Instance ID é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Checking status for instance:", instanceId);

    // Check connection state in Evolution API
    // Check connection state in Evolution API
    const statusResponse = await fetch(`${evolutionApiUrl}/instance/connectionState/${instanceId}`, {
      method: "GET",
      headers: {
        apikey: evolutionApiKey,
      },
    });

    if (!statusResponse.ok) {
      const errorText = await statusResponse.text();
      console.error("Evolution API status error:", errorText);
      return new Response(JSON.stringify({ error: "Erro ao verificar status" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const statusData = await statusResponse.json();
    console.log("Status received:", statusData);

    // Normalize all possible status formats
    const state =
      statusData?.state ||
      statusData?.connectionState ||
      statusData?.instance?.state ||
      statusData?.instance?.connectionState ||
      statusData?.response?.state ||
      statusData?.response?.connectionState;

    console.log("Parsed state:", state);

    // Final truth of connection
    const isConnected = state === "connected" || state === "open";

    // Normalize phone number
    const phoneNumber = statusData?.instance?.owner || statusData?.owner || statusData?.response?.owner || null;

    // Build DB update
    const updateData: any = {
      status: isConnected ? "connected" : "connecting",
      updated_at: new Date().toISOString(),
    };

    if (isConnected) {
      updateData.connected_at = new Date().toISOString();
      if (phoneNumber) updateData.phone_number = phoneNumber;
    }

    // Save state inside DB
    await supabase.from("whatsapp_connections").update(updateData).eq("instance_id", instanceId).eq("user_id", user.id);

    // Update profile
    if (isConnected) {
      await supabase
        .from("profiles")
        .update({
          whatsapp_connected: true,
          whatsapp_instance_id: instanceId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: isConnected ? "connected" : "connecting",
        phoneNumber,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in check-whatsapp-status:", error);
    const errorMessage = error instanceof Error ? error.message : "Erro interno do servidor";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
