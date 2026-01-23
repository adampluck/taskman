import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const body = await req.json();

    // Log the webhook payload for debugging
    console.log("Sprintcheckout webhook received:", JSON.stringify(body));

    // Sprintcheckout sends: { orderId, amount, currency, status, ... }
    const { orderId, status } = body;

    if (!orderId) {
      console.error("Missing orderId in webhook payload");
      return new Response("Missing orderId", { status: 400 });
    }

    console.log(`Payment webhook: orderId=${orderId}, status=${status}`);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    if (status === "SUCCESS") {
      // Update user to Pro tier
      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id: orderId,
          tier: "pro",
          payment_status: "completed",
          paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      if (error) {
        console.error("Failed to update subscription:", error);
        throw error;
      }

      console.log(`User ${orderId} upgraded to Pro via crypto payment`);
    } else if (status === "FAILED" || status === "CANCELLED") {
      await supabaseAdmin
        .from("user_subscriptions")
        .update({
          payment_status: status.toLowerCase(),
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", orderId);

      console.log(`Crypto payment ${status} for user ${orderId}`);
    } else {
      console.log(`Unhandled payment status: ${status}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Webhook processing error:", error);
    return new Response(
      JSON.stringify({ error: "Webhook processing failed" }),
      {
        headers: { "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
