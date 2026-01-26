import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { ethers } from "https://esm.sh/ethers@5.7.2";

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
    const { message, signature, address } = await req.json();

    if (!message || !signature || !address) {
      throw new Error("Missing required fields");
    }

    // Normalize address
    const normalizedAddress = address.toLowerCase();

    // Recover the address from the signature
    const recoveredAddress = ethers.utils.verifyMessage(message, signature).toLowerCase();

    if (recoveredAddress !== normalizedAddress) {
      throw new Error("Signature verification failed");
    }

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Extract nonce from message
    const nonceMatch = message.match(/Nonce: ([a-f0-9]+)/i);
    if (!nonceMatch) {
      throw new Error("Invalid message format - no nonce found");
    }
    const messageNonce = nonceMatch[1];

    // Verify nonce exists and hasn't expired
    const { data: nonceData, error: nonceError } = await supabaseAdmin
      .from("siwe_nonces")
      .select("nonce, expires_at")
      .eq("address", normalizedAddress)
      .single();

    if (nonceError || !nonceData) {
      throw new Error("Invalid nonce - please try again");
    }

    if (nonceData.nonce !== messageNonce) {
      throw new Error("Nonce mismatch");
    }

    if (new Date(nonceData.expires_at) < new Date()) {
      throw new Error("Nonce expired - please try again");
    }

    // Delete the used nonce
    await supabaseAdmin
      .from("siwe_nonces")
      .delete()
      .eq("address", normalizedAddress);

    // Check if user exists with this wallet address
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    let user = existingUsers?.users.find(
      (u) => u.user_metadata?.wallet_address?.toLowerCase() === normalizedAddress
    );

    if (!user) {
      // Create new user with wallet address
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: `${normalizedAddress}@wallet.local`,
        email_confirm: true,
        user_metadata: {
          wallet_address: normalizedAddress,
          provider: "siwe",
        },
      });

      if (createError) {
        throw new Error("Failed to create user: " + createError.message);
      }

      user = newUser.user;
    }

    // Generate a magic link - this returns the token hash we can use
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: user.email!,
    });

    if (linkError || !linkData) {
      throw new Error("Failed to generate authentication link");
    }

    const tokenHash = linkData.properties?.hashed_token;

    if (!tokenHash) {
      throw new Error("Failed to generate authentication token");
    }

    // Return the token hash for the client to verify
    return new Response(
      JSON.stringify({
        email: user.email,
        token_hash: tokenHash,
        user: {
          id: user.id,
          email: user.email,
          user_metadata: user.user_metadata,
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("SIWE verify error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
