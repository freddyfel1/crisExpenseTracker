// Disconnects a bank: revokes the access_token with Plaid (so it can't pull data any
// more) and then removes the plaid_items row. Ownership is enforced in the same query
// that reads the access_token — a caller can only ever disconnect their own connection.
// Past transactions already synced are left in place; only the connection is removed.
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

  let id: string | undefined
  try {
    ;({ id } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!id) return json({ error: '"id" is required' }, 400)

  const clientId = Deno.env.get('PLAID_CLIENT_ID')
  const secret = Deno.env.get('PLAID_SECRET')
  const env = Deno.env.get('PLAID_ENV') ?? 'sandbox'
  const baseUrl = PLAID_BASE_URLS[env]
  if (!clientId || !secret) return json({ error: 'Plaid is not configured' }, 500)
  if (!baseUrl) return json({ error: `Unknown PLAID_ENV "${env}"` }, 500)

  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: item, error: itemError } = await serviceClient
    .from('plaid_items')
    .select('access_token')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()
  if (itemError) return json({ error: itemError.message }, 500)
  if (!item) return json({ error: 'Connection not found' }, 404)

  const plaidRes = await fetch(`${baseUrl}/item/remove`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_id: clientId, secret, access_token: item.access_token }),
  })
  if (!plaidRes.ok) {
    const errText = await plaidRes.text()
    console.error('Plaid item/remove error', plaidRes.status, errText)
    return json({ error: 'Could not disconnect that bank account' }, 502)
  }

  const { error: deleteError } = await serviceClient.from('plaid_items').delete().eq('id', id).eq('user_id', user.id)
  if (deleteError) return json({ error: deleteError.message }, 500)

  return json({ ok: true }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
