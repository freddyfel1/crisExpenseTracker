// Pulls investment accounts and their buy/sell/dividend history from Plaid's Investments
// product for every bank the caller has connected, and upserts them into the same
// investment_accounts/investment_transactions tables the manual-entry Investments page
// reads — holdings and cost basis are still derived client-side from that log (see
// holdingsForAccount), so this never writes a "current holdings" snapshot.
//
// Unlike /transactions/sync, Plaid's investments endpoints are not cursor-based: holdings/get
// returns the account+security catalog, and investments/transactions/get is a date-range
// query. Every sync re-requests a lookback window and re-upserts — cheap and correct because
// rows are keyed on (user_id, plaid_investment_transaction_id), so a repeat sync no-ops.
//
// An item connected before Investments was enabled (or whose institution doesn't support it)
// answers holdings/get with Plaid's PRODUCT_NOT_READY / INVALID_PRODUCT — that item is just
// skipped, not treated as a hard failure, since /transactions/sync still works fine for it.
//
// investments_last_synced_at is a separate column from plaid-sync-transactions' last_synced_at
// (0017) since the two syncs run independently — one shouldn't make the other look fresher
// than it is.
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

// How far back to pull investment transaction history on every sync (there's no cursor
// endpoint for this product, so each sync re-covers this whole window).
const LOOKBACK_DAYS = 730

type PlaidInvestmentAccount = {
  account_id: string
  name: string
  type: string | null
  subtype: string | null
}

// Some institutions (SoFi among them) answer /investments/holdings/get with every
// account under the item — checking and savings included — not just the investment
// ones. Those depository accounts are already synced via the regular transactions
// sync, so importing them here would just duplicate them as bogus "investment"
// accounts with no holdings.
const NON_INVESTMENT_SUBTYPES = new Set([
  'checking',
  'savings',
  'cd',
  'money market',
  'prepaid',
  'hsa',
  'cash management',
])

function isInvestmentAccount(acc: PlaidInvestmentAccount): boolean {
  if (acc.type && acc.type.toLowerCase() !== 'investment') return false
  if (acc.subtype && NON_INVESTMENT_SUBTYPES.has(acc.subtype.toLowerCase())) return false
  return true
}

type PlaidSecurity = {
  security_id: string
  ticker_symbol: string | null
  name: string | null
  type: string | null
}

type PlaidInvestmentTransaction = {
  investment_transaction_id: string
  account_id: string
  security_id: string | null
  date: string
  name: string
  quantity: number
  amount: number
  price: number | null
  fees: number | null
  type: string
  subtype: string
}

function mapAccountType(subtype: string | null): 'brokerage' | 'crypto' | 'retirement' | 'other' {
  if (!subtype) return 'brokerage'
  const s = subtype.toLowerCase()
  if (s.includes('crypto')) return 'crypto'
  if (s.includes('ira') || s.includes('401k') || s.includes('403b') || s.includes('retirement') || s.includes('pension')) {
    return 'retirement'
  }
  if (s === 'brokerage') return 'brokerage'
  return 'other'
}

function mapAssetType(securityType: string | null): 'etf' | 'stock' | 'crypto' | 'other' {
  if (!securityType) return 'other'
  const t = securityType.toLowerCase()
  if (t === 'etf') return 'etf'
  if (t === 'equity') return 'stock'
  if (t === 'cryptocurrency') return 'crypto'
  return 'other'
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
    .select('id, access_token, institution_name')
    .eq('user_id', user.id)
  if (itemsError) return json({ error: itemsError.message }, 500)
  if (!items || items.length === 0) return json({ accounts: 0, transactions: 0, items: 0, skipped: 0 }, 200)

  const endDate = new Date().toISOString().slice(0, 10)
  const startDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  let accountsSynced = 0
  let transactionsSynced = 0
  let skipped = 0

  for (const item of items) {
    const holdingsRes = await fetch(`${baseUrl}/investments/holdings/get`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, secret, access_token: item.access_token }),
    })

    // Stamped as soon as we've heard back from Plaid, whatever the result — a
    // PRODUCT_NOT_READY skip below still counts as "we tried", same as 0017's
    // last_synced_at for the regular transactions sync.
    await serviceClient
      .from('plaid_items')
      .update({ investments_last_synced_at: new Date().toISOString() })
      .eq('id', item.id)

    if (!holdingsRes.ok) {
      // Investments product not enabled/supported for this item — skip it, not an error.
      const errText = await holdingsRes.text()
      console.log('Skipping item for investments/holdings/get', holdingsRes.status, errText)
      skipped++
      continue
    }

    const holdings = await holdingsRes.json()
    const plaidAccounts = ((holdings.accounts as PlaidInvestmentAccount[]) ?? []).filter(isInvestmentAccount)
    if (plaidAccounts.length === 0) continue

    const accountIdMap = new Map<string, string>() // plaid account_id -> our internal id
    for (const acc of plaidAccounts) {
      const { data: row, error: upsertError } = await serviceClient
        .from('investment_accounts')
        .upsert(
          {
            user_id: user.id,
            plaid_item_id: item.id,
            plaid_account_id: acc.account_id,
            name: acc.name,
            institution: item.institution_name,
            account_type: mapAccountType(acc.subtype),
          },
          { onConflict: 'user_id,plaid_account_id' },
        )
        .select('id')
        .single()
      if (upsertError) {
        console.error('investment_accounts upsert error', upsertError.message)
        continue
      }
      accountIdMap.set(acc.account_id, row.id)
      accountsSynced++
    }

    // investments/transactions/get paginates via offset/count, unlike the cursor-based
    // /transactions/sync — pull pages until we've seen every transaction it reports.
    const securitiesById = new Map<string, PlaidSecurity>()
    const allTx: PlaidInvestmentTransaction[] = []
    let offset = 0
    let total = Infinity
    while (offset < total) {
      const txRes = await fetch(`${baseUrl}/investments/transactions/get`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          secret,
          access_token: item.access_token,
          start_date: startDate,
          end_date: endDate,
          options: { count: 500, offset },
        }),
      })
      if (!txRes.ok) {
        const errText = await txRes.text()
        console.error('Plaid investments/transactions/get error', txRes.status, errText)
        break
      }
      const page = await txRes.json()
      for (const sec of page.securities as PlaidSecurity[]) securitiesById.set(sec.security_id, sec)
      allTx.push(...(page.investment_transactions as PlaidInvestmentTransaction[]))
      total = page.total_investment_transactions
      offset += page.investment_transactions.length
      if (page.investment_transactions.length === 0) break
    }

    const rows = allTx
      .map((tx) => {
        const accountId = accountIdMap.get(tx.account_id)
        if (!accountId) return null

        const security = tx.security_id ? securitiesById.get(tx.security_id) : undefined

        // Plaid represents cash sitting in a brokerage account as buys/sells of a
        // synthetic "cash" security (ticker CUR:USD, security type "cash") every time
        // money sweeps in or out — that's bookkeeping noise, not a real holding, so it's
        // dropped entirely rather than logged as an "other" transaction.
        if (security?.type?.toLowerCase() === 'cash' || security?.ticker_symbol?.startsWith('CUR:')) return null

        const symbol = security?.ticker_symbol || security?.name || 'UNKNOWN'
        const assetType = mapAssetType(security?.type ?? null)

        let transactionType: 'buy' | 'sell' | 'dividend' | 'other'
        let quantity: number
        let pricePerUnit: number
        if (tx.type === 'buy') {
          transactionType = 'buy'
          quantity = Math.abs(tx.quantity)
          pricePerUnit = tx.price ?? 0
        } else if (tx.type === 'sell') {
          transactionType = 'sell'
          quantity = Math.abs(tx.quantity)
          pricePerUnit = tx.price ?? 0
        } else if (tx.subtype === 'dividend' || tx.subtype === 'interest') {
          // Cash dividends/interest usually carry quantity 0 and no per-share price from
          // Plaid — fold the whole cash amount into a single "1 unit" entry so
          // holdingsForAccount's quantity * price recovers the right dividend total.
          transactionType = 'dividend'
          quantity = 1
          pricePerUnit = Math.abs(tx.amount)
        } else {
          // Fees, transfers, cash deposits/withdrawals, etc. — logged for the record but
          // excluded from both the holdings and dividend math.
          transactionType = 'other'
          quantity = Math.abs(tx.quantity)
          pricePerUnit = tx.price ?? 0
        }

        return {
          user_id: user.id,
          account_id: accountId,
          symbol,
          asset_type: assetType,
          transaction_type: transactionType,
          quantity,
          price_per_unit: pricePerUnit,
          fees: tx.fees ?? 0,
          occurred_on: tx.date,
          notes: tx.name || null,
          source: 'plaid',
          plaid_investment_transaction_id: tx.investment_transaction_id,
        }
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length > 0) {
      const { error: upsertError } = await serviceClient
        .from('investment_transactions')
        .upsert(rows, { onConflict: 'user_id,plaid_investment_transaction_id' })
      if (upsertError) {
        console.error('investment_transactions upsert error', upsertError.message)
      } else {
        transactionsSynced += rows.length
      }
    }
  }

  return json({ accounts: accountsSynced, transactions: transactionsSynced, items: items.length, skipped }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
