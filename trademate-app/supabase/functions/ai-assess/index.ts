// Supabase Edge Function — proxies the AI job-assessment call.
// The Anthropic API key stays on the server (set via `supabase secrets set`),
// never shipped to the browser.
//
// Deploy with: supabase functions deploy ai-assess
// Set the secret with: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { problem, hasPhotos, conversation } = await req.json();

    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY not set" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const system = `You are an assistant for a plumbing tradesperson in Ireland. Given a customer's job description, respond with ONLY strict JSON, no preamble, no markdown fences, in this exact shape:
{"question":"one short clarifying question to ask the customer","notes":"one sentence of guidance for the tradesperson","quote":{"labour":number,"callout":number,"partsMin":number,"partsMax":number}}
All money values are whole euro. Base estimates on typical Irish plumbing/heating callout pricing. Be realistic and conservative.`;

    const userPrompt = `Job: ${problem}\nPhotos attached: ${hasPhotos ? "yes" : "no"}\n${
      conversation ? "Conversation so far:\n" + conversation : ""
    }`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const text = (data.content || [])
      .filter((b: any) => b.type === "text")
      .map((b: any) => b.text)
      .join("\n");

    const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
