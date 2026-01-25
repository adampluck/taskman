import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Only accept POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    // Verify webhook API key using X-Webhook-Api-Key header
    const webhookKey = Deno.env.get("SPRINTCHECKOUT_WEBHOOK_KEY");
    if (webhookKey) {
      const providedKey = req.headers.get("X-Webhook-Api-Key");

      if (providedKey !== webhookKey) {
        console.error("Invalid webhook key");
        return new Response("Unauthorized", { status: 401 });
      }
    }

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

    // Idempotency check: see if we already processed this successfully
    const { data: existing } = await supabaseAdmin
      .from("user_subscriptions")
      .select("tier, payment_status")
      .eq("user_id", orderId)
      .single();

    if (existing?.tier === "pro" && existing?.payment_status === "completed") {
      console.log(`User ${orderId} already upgraded to Pro, skipping`);
      return new Response(JSON.stringify({ received: true, skipped: true }), {
        headers: { "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Handle payment status
    // Possible values: PENDING, SUCCESS, FAILED, EXPIRED
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
    } else if (status === "PENDING") {
      // Payment initiated but not yet settled - update status but don't upgrade
      await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id: orderId,
          payment_status: "pending",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

      console.log(`Crypto payment pending for user ${orderId}`);
    } else if (status === "FAILED" || status === "EXPIRED") {
      // Payment failed or expired
      await supabaseAdmin
        .from("user_subscriptions")
        .upsert({
          user_id: orderId,
          payment_status: "failed",
          updated_at: new Date().toISOString(),
        }, {
          onConflict: "user_id",
        });

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
