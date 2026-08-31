// Supabase Edge Function — Stripe webhook. Verifies the event signature,
// then marks the matching lead's invoice as paid. This is the single
// source of truth for "paid" — never trust a client-side status change.
//
// Deploy with: supabase functions deploy stripe-webhook --no-verify-jwt
// (--no-verify-jwt because Stripe calls this directly, not through your app's auth)
//
// Set secrets with:
//   supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...
//   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
//
// After deploying, copy the function's URL into Stripe Dashboard →
// Developers → Webhooks → Add endpoint, listening for "checkout.session.completed".

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature!, webhookSecret);
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as any;
    const leadId = session.metadata?.lead_id;

    if (leadId) {
      const { data: lead } = await supabaseAdmin.from("leads").select("invoice").eq("id", leadId).single();
      if (lead?.invoice) {
        await supabaseAdmin
          .from("leads")
          .update({
            status: "paid",
            invoice: {
              ...lead.invoice,
              paid: true,
              paidAt: new Date().toISOString(),
              stripeSessionId: session.id,
            },
          })
          .eq("id", leadId);
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { headers: { "Content-Type": "application/json" } });
});
