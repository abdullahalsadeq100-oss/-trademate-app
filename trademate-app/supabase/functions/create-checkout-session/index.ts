// Supabase Edge Function — creates a Stripe Checkout session for a job's invoice.
// The amount is looked up server-side from the lead row (never trusted from the client).
//
// Deploy with: supabase functions deploy create-checkout-session
// Set secrets with: supabase secrets set STRIPE_SECRET_KEY=sk_live_or_test_...

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@17?target=deno";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { lead_id, origin } = await req.json();
    if (!lead_id || !origin) {
      return new Response(JSON.stringify({ error: "lead_id and origin are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: lead, error } = await supabaseAdmin
      .from("leads")
      .select("id, job_no, name, invoice, business_id, businesses(name)")
      .eq("id", lead_id)
      .single();

    if (error || !lead) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!lead.invoice || !lead.invoice.total) {
      return new Response(JSON.stringify({ error: "This job has no invoice yet" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (lead.invoice.paid) {
      return new Response(JSON.stringify({ error: "This invoice is already paid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: Math.round(lead.invoice.total * 100), // cents
            product_data: {
              name: `Job ${lead.job_no} — ${lead.businesses?.name ?? "TradeMate"}`,
            },
          },
          quantity: 1,
        },
      ],
      metadata: { lead_id: lead.id, job_no: lead.job_no },
      success_url: `${origin}/?paid=success&job_no=${encodeURIComponent(lead.job_no)}`,
      cancel_url: `${origin}/?paid=cancelled&job_no=${encodeURIComponent(lead.job_no)}`,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
