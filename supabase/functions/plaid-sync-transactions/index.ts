// Pulls new/changed/removed transactions for every bank the caller has connected via
// Plaid, using the incremental /transactions/sync cursor so a resync only costs work
// proportional to what changed. Only spending (positive Plaid amount) is imported —
// this app tracks income separately (see monthly_income) — and rows are upserted on
// (user_id, plaid_transaction_id), so re-running this is always safe.
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

type PlaidTransaction = {
  transaction_id: string
  merchant_name: string | null
  name: string
  amount: number
  date: string
  pending: boolean
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

  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: items, error: itemsError } = await serviceClient
    .from('plaid_items')
    .select('id, item_id, access_token, cursor')
    .eq('user_id', user.id)
  if (itemsError) return json({ error: itemsError.message }, 500)
  if (!items || items.length === 0) return json({ synced: 0, removed: 0, items: 0 }, 200)

  let synced = 0
  let removed = 0

  for (const item of items) {
    let cursor: string | null = item.cursor
    let hasMore = true
    const added: PlaidTransaction[] = []
    const modified: PlaidTransaction[] = []
    const removedIds: string[] = []

    while (hasMore) {
      const syncRes = await fetch(`${baseUrl}/transactions/sync`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          secret,
          access_token: item.access_token,
          cursor: cursor ?? undefined,
        }),
      })

      if (!syncRes.ok) {
        const errText = await syncRes.text()
        console.error('Plaid transactions/sync error', syncRes.status, errText)
        break
      }

      const page = await syncRes.json()
      added.push(...page.added)
      modified.push(...page.modified)
      removedIds.push(...page.removed.map((r: { transaction_id: string }) => r.transaction_id))
      cursor = page.next_cursor
      hasMore = page.has_more
    }

    const rows = [...added, ...modified]
      .filter((tx) => tx.amount > 0 && !tx.pending)
      .map((tx) => ({
        user_id: user.id,
        merchant: tx.merchant_name || tx.name,
        amount: tx.amount,
        occurred_on: tx.date,
        tags: [],
        source: 'plaid',
        plaid_transaction_id: tx.transaction_id,
      }))

    if (rows.length > 0) {
      const { error: upsertError } = await serviceClient
        .from('transactions')
        .upsert(rows, { onConflict: 'user_id,plaid_transaction_id' })
      if (upsertError) {
        console.error('transactions upsert error', upsertError.message)
      } else {
        synced += rows.length
      }
    }

    if (removedIds.length > 0) {
      const { error: deleteError } = await serviceClient
        .from('transactions')
        .delete()
        .eq('user_id', user.id)
        .in('plaid_transaction_id', removedIds)
      if (!deleteError) removed += removedIds.length
    }

    await serviceClient.from('plaid_items').update({ cursor }).eq('id', item.id)
  }

  return json({ synced, removed, items: items.length }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
