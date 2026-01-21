import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2025-12-15.clover",
});

const cryptoProvider = Stripe.createSubtleCryptoProvider();

serve(async (req) => {
  const signature = req.headers.get("Stripe-Signature");
  if (!signature) {
    return new Response("Missing Stripe signature", { status: 400 });
  }

  const body = await req.text();
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!webhookSecret) {
    console.error("Missing STRIPE_WEBHOOK_SECRET");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(
      body,
      signature,
      webhookSecret,
      undefined,
      cryptoProvider
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  // Initialize Supabase admin client
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;

        if (!userId) {
          console.error("Missing supabase_user_id in session metadata");
          break;
        }

        // Update user to Pro tier
        const { error } = await supabaseAdmin
          .from("user_subscriptions")
          .upsert({
            user_id: userId,
            tier: "pro",
            stripe_customer_id: session.customer as string,
            stripe_payment_intent_id: session.payment_intent as string,
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

        console.log(`User ${userId} upgraded to Pro`);
        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const customerId = paymentIntent.customer as string;

        if (customerId) {
          // Find user by Stripe customer ID and update status
          const { data: sub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (sub) {
            await supabaseAdmin
              .from("user_subscriptions")
              .update({
                payment_status: "failed",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", sub.user_id);

            console.log(`Payment failed for user ${sub.user_id}`);
          }
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const customerId = charge.customer as string;

        if (customerId) {
          // Find user and downgrade to free
          const { data: sub } = await supabaseAdmin
            .from("user_subscriptions")
            .select("user_id")
            .eq("stripe_customer_id", customerId)
            .single();

          if (sub) {
            await supabaseAdmin
              .from("user_subscriptions")
              .update({
                tier: "free",
                payment_status: "refunded",
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", sub.user_id);

            console.log(`Refund processed for user ${sub.user_id}, downgraded to free`);
          }
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
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
