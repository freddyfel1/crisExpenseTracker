// Exchanges the public_token Plaid Link returns on success for a durable access_token,
// and stores the connection. Writes go through the service-role client, not the caller's
// forwarded JWT: plaid_items has no RLS policies (see migration 0010), so only the
// service role can touch it — the access_token must never be reachable from the browser.
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

  let public_token: string | undefined
  let institution_name: string | undefined
  try {
    ;({ public_token, institution_name } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!public_token) return json({ error: '"public_token" is required' }, 400)

  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')
  const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
  const baseUrl = PLAID_BASE_URLS[env]
  if (!clientId || !secret) return json({ error: 'Plaid is not configured' }, 500)
  if (!baseUrl) return json({ error: `Unknown PLAID_ENV "${env}"` }, 500)

  // Forwarded-JWT client only to identify the caller — never used to touch plaid_items.
  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  const plaidRes = await fetch(`${baseUrl}/item/public_token/exchange`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, public_token }),
  })

  if (!plaidRes.ok) {
    const errText = await plaidRes.text()
    console.error('Plaid item/public_token/exchange error', plaidRes.status, errText)
    return json({ error: 'Could not connect that bank account' }, 502)
  }

  const { access_token, item_id } = await plaidRes.json()

  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { error: insertError } = await serviceClient.from('plaid_items').insert({
    user_id: user.id,
    item_id,
    access_token,
    institution_name: institution_name ?? null,
  })
  if (insertError) {
    console.error('plaid_items insert error', insertError.message)
    return json({ error: 'Connected to the bank, but failed to save the connection' }, 500)
  }

  return json({ ok: true }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
