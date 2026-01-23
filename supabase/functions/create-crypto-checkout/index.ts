import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Get auth token from request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Initialize Supabase client with user's auth
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: { headers: { Authorization: authHeader } },
      }
    );

    // Get the user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    // Get request body
    const { origin } = await req.json();
    if (!origin) {
      throw new Error("Missing origin in request body");
    }

    // Check if user is already Pro
    const { data: subscription } = await supabaseClient
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", user.id)
      .single();

    if (subscription?.tier === "pro") {
      throw new Error("Already subscribed to Pro");
    }

    // Get Sprintcheckout API key
    const apiKey = Deno.env.get("SPRINTCHECKOUT_API_KEY");
    if (!apiKey) {
      throw new Error("Sprintcheckout API key not configured");
    }

    // Create Sprintcheckout payment session
    const response = await fetch("https://api.sprintcheckout.com/api/checkout/v2/payment_session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-SC-ApiKey": apiKey,
      },
      body: JSON.stringify({
        orderType: "STATIC",
        amount: 5,
        currency: "USD",
        orderId: user.id,
        successUrl: `${origin}?payment=success`,
        cancelUrl: `${origin}?payment=cancelled`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sprintcheckout API error:", errorText);
      throw new Error("Failed to create payment session");
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({ url: data.paymentUrl }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Crypto checkout error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
