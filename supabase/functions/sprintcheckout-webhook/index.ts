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

    // Extract event type and data
    // Sprintcheckout sends: { event: "payment.completed", data: { orderId, amount, ... } }
    const { event, data } = body;

    if (!event || !data) {
      console.error("Invalid webhook payload");
      return new Response("Invalid payload", { status: 400 });
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    switch (event) {
      case "payment.completed": {
        const userId = data.orderId;

        if (!userId) {
          console.error("Missing orderId (user ID) in webhook data");
          break;
        }

        // Update user to Pro tier
        const { error } = await supabaseAdmin
          .from("user_subscriptions")
          .upsert({
            user_id: userId,
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

        console.log(`User ${userId} upgraded to Pro via crypto payment`);
        break;
      }

      case "payment.failed": {
        const userId = data.orderId;

        if (userId) {
          await supabaseAdmin
            .from("user_subscriptions")
            .update({
              payment_status: "failed",
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", userId);

          console.log(`Crypto payment failed for user ${userId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event}`);
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
