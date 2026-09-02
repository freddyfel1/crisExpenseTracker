// Creates a Plaid Link token for the calling user, which the client hands to Plaid's
// hosted Link widget. Bank credentials are entered inside that widget, never in this app —
// this function only ever sees a client_user_id and returns a short-lived token.
//
// verify_jwt is off (matches parse-receipt): the platform-level JWT gate also blocks CORS
// preflight OPTIONS requests, which never carry an Authorization header. Auth is checked
// manually below instead, exactly as strictly as verify_jwt would.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PLAID_BASE_URLS: Record<string, string> = {
  sandbox: 'https://sandbox.plaid.com',
  development: 'https://development.plaid.com',
  production: 'https://production.plaid.com',
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')
  const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
  const baseUrl = PLAID_BASE_URLS[env]
  if (!clientId || !secret) return json({ error: 'Plaid is not configured' }, 500)
  if (!baseUrl) return json({ error: `Unknown PLAID_ENV "${env}"` }, 500)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  const plaidRes = await fetch(`${baseUrl}/link/token/create`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      secret,
      client_name: 'crisExpenseTracker',
      user: { client_user_id: user.id },
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    }),
  })

  if (!plaidRes.ok) {
    const errText = await plaidRes.text()
    console.error('Plaid link/token/create error', plaidRes.status, errText)
    return json({ error: 'Could not create a Plaid Link token' }, 502)
  }

  const { link_token } = await plaidRes.json()
  return json({ link_token }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
