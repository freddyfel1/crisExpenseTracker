// Refreshes live market prices for the symbols the caller currently holds, and caches them
// in investment_prices — a stock or coin's price isn't private data, so every user reads the
// same cached row instead of each one burning a separate API call for the same symbol.
//
// Stocks/ETFs are priced via Finnhub's quote endpoint, queried as-is. Crypto is priced via
// CoinGecko instead of Finnhub: Finnhub's free crypto quote only understands
// exchange-prefixed pairs (e.g. "BINANCE:BTCUSDT"), which only resolves for coins actually
// listed on that one exchange — anything smaller (say, Electroneum) silently fails. CoinGecko
// tracks thousands of coins regardless of which exchange a user's account happens to be on,
// which matters here since accounts are user-entered (Coinbase, Kraken, or any other exchange)
// rather than tied to a fixed set Plaid understands.
//
// CoinGecko's price endpoints take a coin *id* ("bitcoin"), not a ticker ("BTC"), and tickers
// aren't unique (several coins can share one). This resolves a ticker by first checking a
// cached "top coins by market cap" list — for an ambiguous ticker the highest-market-cap coin
// is overwhelmingly the intended one — and falling back to CoinGecko's search endpoint (which
// itself ranks by relevance/market cap) for anything not in that top slice.
//
// verify_jwt is off (matches parse-receipt): the platform-level JWT gate also blocks CORS
// preflight OPTIONS requests, which never carry an Authorization header. Auth is checked
// manually below instead, exactly as strictly as verify_jwt would — this also keeps the
// Finnhub/CoinGecko API keys from being callable by anyone who isn't a signed-in user of
// this app.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AssetType = 'etf' | 'stock' | 'crypto' | 'other'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Missing authorization' }, 401)

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

  const cryptoSymbols = [...unique.entries()].filter(([, t]) => t === 'crypto').map(([s]) => s)
  const otherSymbols = [...unique.entries()].filter(([, t]) => t !== 'crypto')

  const [cryptoQuotes, otherQuotes] = await Promise.all([
    quoteCrypto(cryptoSymbols),
    Promise.all(otherSymbols.map(([symbol]) => quoteFinnhub(symbol))),
  ])
  const quotes = [...cryptoQuotes, ...otherQuotes]

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

async function quoteFinnhub(symbol: string): Promise<{ symbol: string; price: number | null }> {
  const apiKey = Deno.env.get('FINNHUB_API_KEY')
  if (!apiKey) {
    console.error('Finnhub is not configured, skipping', symbol)
    return { symbol, price: null }
  }
  try {
    const res = await fetch(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`)
    const bodyText = await res.text()
    if (!res.ok) {
      console.error('Finnhub quote non-OK response', symbol, res.status, bodyText)
      return { symbol, price: null }
    }
    const data = JSON.parse(bodyText)
    if (!(typeof data.c === 'number' && data.c > 0)) {
      console.error('Finnhub quote had no usable price', symbol, bodyText)
      return { symbol, price: null }
    }
    return { symbol, price: data.c as number }
  } catch (err) {
    console.error('Finnhub quote error', symbol, err)
    return { symbol, price: null }
  }
}

// --- CoinGecko ---

const COINGECKO_BASE = 'https://api.coingecko.com/api/v3'
// Coin ids the free/demo plan requires no key for, though an optional COINGECKO_API_KEY
// (a free "Demo" key from coingecko.com) raises the rate limit and reduces throttling.
function coingeckoHeaders(): HeadersInit {
  const apiKey = Deno.env.get('COINGECKO_API_KEY')
  return apiKey ? { 'x-cg-demo-api-key': apiKey } : {}
}

// The top-coins-by-market-cap list is the same for every caller and barely changes minute to
// minute, so it's cached across invocations on the same warm isolate instead of re-fetched on
// every single price refresh anyone triggers.
let marketCapCache: { bySymbol: Map<string, { id: string; price: number }>; fetchedAt: number } | null = null
const MARKET_CAP_CACHE_TTL_MS = 5 * 60 * 1000
const MARKET_CAP_PAGES = 2 // 2 x 250 = top 500 coins by market cap

async function fetchTopCoinsBySymbol(): Promise<Map<string, { id: string; price: number }>> {
  if (marketCapCache && Date.now() - marketCapCache.fetchedAt < MARKET_CAP_CACHE_TTL_MS) {
    return marketCapCache.bySymbol
  }

  const bySymbol = new Map<string, { id: string; price: number }>()
  try {
    const pages = await Promise.all(
      Array.from({ length: MARKET_CAP_PAGES }, (_, i) =>
        fetch(
          `${COINGECKO_BASE}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${i + 1}`,
          { headers: coingeckoHeaders() },
        ).then((res) => (res.ok ? res.json() : Promise.reject(new Error(`status ${res.status}`)))),
      ),
    )
    for (const page of pages) {
      for (const coin of page as { id: string; symbol: string; current_price: number }[]) {
        const key = coin.symbol.toUpperCase()
        // Results already arrive ordered by market cap descending, so the first entry seen
        // for a shared ticker (e.g. multiple coins ticker "SUN") is the most likely one meant.
        if (!bySymbol.has(key) && typeof coin.current_price === 'number' && coin.current_price > 0) {
          bySymbol.set(key, { id: coin.id, price: coin.current_price })
        }
      }
    }
  } catch (err) {
    console.error('CoinGecko markets fetch error', err)
  }

  marketCapCache = { bySymbol, fetchedAt: Date.now() }
  return bySymbol
}

async function priceByCoinId(id: string): Promise<number | null> {
  try {
    const res = await fetch(`${COINGECKO_BASE}/simple/price?ids=${encodeURIComponent(id)}&vs_currencies=usd`, {
      headers: coingeckoHeaders(),
    })
    if (!res.ok) {
      console.error('CoinGecko simple/price non-OK response', id, res.status)
      return null
    }
    const data = await res.json()
    const price = data?.[id]?.usd
    return typeof price === 'number' && price > 0 ? price : null
  } catch (err) {
    console.error('CoinGecko simple/price error', id, err)
    return null
  }
}

// Best-effort lookup for a ticker not in the top-500-by-market-cap set, and not in
// KNOWN_COIN_IDS below: CoinGecko's search endpoint ranks matches by relevance (which tracks
// market cap), so the first coin result with a matching symbol is used. This is the same
// "pick the biggest coin with this ticker" heuristic as the market-cap list, and can be wrong
// for the same reason — see KNOWN_COIN_IDS.
async function searchCoingeckoBySymbol(symbol: string): Promise<number | null> {
  try {
    const searchRes = await fetch(`${COINGECKO_BASE}/search?query=${encodeURIComponent(symbol)}`, {
      headers: coingeckoHeaders(),
    })
    if (!searchRes.ok) {
      console.error('CoinGecko search non-OK response', symbol, searchRes.status)
      return null
    }
    const searchData = await searchRes.json()
    const coins = (searchData?.coins ?? []) as { id: string; symbol: string }[]
    const match = coins.find((c) => c.symbol.toUpperCase() === symbol.toUpperCase()) ?? coins[0]
    return match ? priceByCoinId(match.id) : null
  } catch (err) {
    console.error('CoinGecko search error', symbol, err)
    return null
  }
}

// Ticker collisions are real: more than one independent coin can use the same symbol (several
// small/older projects share "ETN", for instance), and both the market-cap list and the search
// fallback above just pick whichever coin with that ticker ranks highest — not necessarily the
// one actually meant. This override wins over both for a ticker already known to collide.
// Confirmed case: Electroneum's real ETN (~$0.0000257) was losing to an unrelated, higher
// market-cap "ETN" (~$0.0023, ~90x off) that the automatic resolution picked instead. Add to
// this map as more mismatches like this one turn up.
const KNOWN_COIN_IDS: Record<string, string> = {
  ETN: 'electroneum',
}

async function quoteCrypto(symbols: string[]): Promise<{ symbol: string; price: number | null }[]> {
  if (symbols.length === 0) return []
  const bySymbol = await fetchTopCoinsBySymbol()

  return Promise.all(
    symbols.map(async (symbol) => {
      const knownId = KNOWN_COIN_IDS[symbol.toUpperCase()]
      if (knownId) {
        const price = await priceByCoinId(knownId)
        if (price != null) return { symbol, price }
      }
      const hit = bySymbol.get(symbol.toUpperCase())
      if (hit) return { symbol, price: hit.price }
      const price = await searchCoingeckoBySymbol(symbol)
      return { symbol, price }
    }),
  )
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}
