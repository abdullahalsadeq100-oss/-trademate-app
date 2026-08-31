# TradeMate Ireland

A real, deployable version of the TradeMate prototype: a directory + booking
tool for Irish tradespeople, with AI-assisted job assessment.

This project is a normal Vite + React app. The prototype's `window.storage`
calls have been replaced with a real Postgres database (via Supabase), the
PIN login has been replaced with real email/password auth, and the AI call
now goes through a server-side Edge Function so your Anthropic API key is
never exposed in the browser.

## Status: already deployed to your Supabase project

Your Supabase project **"Galway"** (`dwupxmllqegbwttdszia`) already has:

- ✅ Database schema applied (`businesses`, `leads` tables, RLS policies, helper functions)
- ✅ `ai-assess` Edge Function deployed
- ✅ `create-checkout-session` Edge Function deployed
- ✅ `stripe-webhook` Edge Function deployed
- ✅ `.env.example` pre-filled with this project's URL and key

The only things left are things that involve secret keys, which I
deliberately don't ask you to paste into a chat — you'll set those
yourself in two places.

## 1. Configure the app

```bash
cp .env.example .env
```

Already filled in with your real Supabase project details — nothing to edit
unless you later create a different project.

## 2. Set the Anthropic API key secret

In your [Supabase dashboard](https://supabase.com/dashboard/project/dwupxmllqegbwttdszia) →
Edge Functions → Secrets, add:

```
ANTHROPIC_API_KEY = sk-ant-your-key-here
```

Get a key at [console.anthropic.com](https://console.anthropic.com) if you
don't have one (separate from your Claude.ai account). The `ai-assess`
function will start working as soon as this is set — no redeploy needed.

## 3. Set up Stripe payments

The functions are already deployed — this is just secrets + telling Stripe
where to send events.

1. Create a [Stripe account](https://dashboard.stripe.com/register) if you
   don't have one. Use **test mode** while trying this out (toggle top-right
   in the Stripe dashboard).
2. Get your **Secret key**: Developers → API keys. Add it in Supabase
   dashboard → Edge Functions → Secrets:
   ```
   STRIPE_SECRET_KEY = sk_test_your_key_here
   ```
3. Your webhook endpoint is already live at:
   ```
   https://dwupxmllqegbwttdszia.supabase.co/functions/v1/stripe-webhook
   ```
   In Stripe: Developers → Webhooks → **Add endpoint**, paste that URL,
   and select the `checkout.session.completed` event.
4. Stripe will show you a **Signing secret** for that endpoint (starts
   `whsec_...`). Add it as another secret in Supabase:
   ```
   STRIPE_WEBHOOK_SECRET = whsec_your_secret_here
   ```

**Test it:** use Stripe's test card `4242 4242 4242 4242`, any future
expiry date, any CVC. Once a tradesperson invoices a job, the customer's
status page will show a "Pay now" button. After a successful test payment,
the job flips to paid automatically — no manual step needed.

When you're ready for real customers, switch to your Stripe **live** keys
(same steps, live-mode key and live-mode webhook) and Stripe will start
processing real cards.

## 4. Run it locally

```bash
npm install
npm run dev
```

Open the printed local URL. Try: create a workspace (tradesperson), fill in
your public profile with an area and services, then open the same URL in
another tab and browse as a customer to request a quote.

## 5. Deploy for real

**Frontend — [Vercel](https://vercel.com) (free):**
1. Push this folder to a GitHub repo.
2. In Vercel, "Add New Project" → import the repo.
3. Framework preset: Vite. Add the same two environment variables from your
   `.env` file in Vercel's project settings.
4. Deploy. You'll get a live `*.vercel.app` URL immediately.

**Custom domain:** buy one (e.g. Namecheap, ~€10/year), then add it under
Vercel → your project → Settings → Domains, and follow the DNS instructions
shown there.

## What's still simplified (be aware before relying on this commercially)

- **No real WhatsApp/SMS capture.** The channel field is just a label for
  where an enquiry came from — auto-capturing actual WhatsApp/SMS messages
  needs Twilio integrated as another Edge Function or small backend service.
- **One business per account**, for simplicity — the schema supports more
  if you want to extend it (an owner could have multiple `businesses` rows).
- **Location matching uses a fixed list of Galway-area towns**, not real
  geocoding. Fine for testing in that region; extend `AREAS` in `App.jsx`
  or swap in a geocoding API for national coverage.

## Project structure

```
src/App.jsx                    — all UI and logic
src/supabaseClient.js          — Supabase client setup
supabase/schema.sql            — database tables, policies, functions
supabase/functions/ai-assess/               — Edge Function that calls Claude
supabase/functions/create-checkout-session/  — starts a Stripe payment
supabase/functions/stripe-webhook/           — confirms payment server-side
```
