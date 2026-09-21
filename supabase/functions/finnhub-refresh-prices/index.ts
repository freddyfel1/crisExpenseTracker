// Refreshes live market prices for the symbols the caller currently holds, via Finnhub's
// quote endpoint, and caches them in investment_prices — a stock's price isn't private data,
// so every user reads the same cached row instead of each one burning a separate Finnhub call
// for the same symbol.
//
// Crypto symbols are stored as plain tickers (e.g. "BTC") to match Plaid's convention, but
// Finnhub's free quote endpoint needs an exchange-prefixed symbol for crypto (e.g.
// "BINANCE:BTCUSDT") — this function does that translation; stocks/ETFs are queried as-is.
// A symbol Finnhub doesn't recognize (delisted, wrong exchange prefix, etc.) comes back as
// price 0 and is reported in `skipped` rather than cached.
//
// verify_jwt is off (matches parse-receipt): the platform-level JWT gate also blocks CORS
// preflight OPTIONS requests, which never carry an Authorization header. Auth is checked
// manually below instead, exactly as strictly as verify_jwt would — this also keeps the
// Finnhub API key from being callable by anyone who isn't a signed-in user of this app.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AssetType = 'etf' | 'stock' | 'crypto' | 'other'

function finnhubSymbol(symbol: string, assetType: AssetType): string {
  return assetType === 'crypto' ? `BINANCE:${symbol}USDT` : symbol
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

  const apiKey = Deno.env.get('FINNHUB_API_KEY')
  if (!apiKey) return json({ error: 'Finnhub is not configured' }, 500)

  const callerClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const {
    data: { user },
    error: userError,
  } = await callerClient.auth.getUser()
  if (userError || !user) return json({ error: 'Invalid session' }, 401)

  let symbols: { symbol: string; assetType: AssetType }[] = []
  try {
    ;({ symbols } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!Array.isArray(symbols) || symbols.length === 0) return json({ prices: {}, skipped: [] }, 200)

  // De-dupe — the same symbol can appear across multiple accounts.
  const unique = new Map<string, AssetType>()
  for (const s of symbols) {
    if (s?.symbol) unique.set(s.symbol, s.assetType)
  }

  const quotes = await Promise.all(
    [...unique.entries()].map(async ([symbol, assetType]) => {
      try {
        const res = await fetch(
          `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(finnhubSymbol(symbol, assetType))}&token=${apiKey}`,
        )
        const bodyText = await res.text()
        if (!res.ok) {
          console.error('Finnhub quote non-OK response', symbol, res.status, bodyText)
          return { symbol, price: null as number | null }
        }
        const data = JSON.parse(bodyText)
        if (!(typeof data.c === 'number' && data.c > 0)) {
          console.error('Finnhub quote had no usable price', symbol, bodyText)
          return { symbol, price: null as number | null }
        }
        return { symbol, price: data.c as number }
      } catch (err) {
        console.error('Finnhub quote error', symbol, err)
        return { symbol, price: null as number | null }
      }
    }),
  )

  const found = quotes.filter((q): q is { symbol: string; price: number } => q.price !== null)
  const skipped = quotes.filter((q) => q.price === null).map((q) => q.symbol)

  if (found.length > 0) {
    const serviceClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { error: upsertError } = await serviceClient
      .from('investment_prices')
      .upsert(
        found.map((f) => ({ symbol: f.symbol, price: f.price, updated_at: new Date().toISOString() })),
        { onConflict: 'symbol' },
      )
    if (upsertError) console.error('investment_prices upsert error', upsertError.message)
  }

  const prices: Record<string, number> = {}
  for (const f of found) prices[f.symbol] = f.price

  return json({ prices, skipped }, 200)
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
