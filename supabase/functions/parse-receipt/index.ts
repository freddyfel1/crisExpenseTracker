// Receives { path } — a storage path in the "receipts" bucket — downloads the image
// (scoped to the caller's own data via their JWT, same as every other query in this app),
// sends it to Claude, and returns structured fields for the client to fill into the
// transaction form. Uses Haiku 4.5: this is a high-volume, well-specified extraction task,
// not one that needs a heavier model.

import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  let path: string | undefined
  try {
    ;({ path } = await req.json())
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  if (!path) return json({ error: '"path" is required' }, 400)

  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY is not configured' }, 500)

  // Scoped to the caller: RLS applies exactly as it does for every other client query,
  // so this function can only ever read the calling user's own receipt and categories.
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: categories, error: catError } = await supabase.from('categories').select('id, name')
  if (catError) return json({ error: catError.message }, 400)

  const { data: imageBlob, error: downloadError } = await supabase.storage.from('receipts').download(path)
  if (downloadError || !imageBlob) {
    return json({ error: downloadError?.message ?? 'Could not download receipt image' }, 400)
  }

  const arrayBuffer = await imageBlob.arrayBuffer()
  const base64Image = base64Encode(new Uint8Array(arrayBuffer))
  const mediaType = imageBlob.type || 'image/jpeg'

  const categoryList = (categories ?? []).map((c) => `- ${c.id}: ${c.name}`).join('\n')
  const prompt = `You are extracting structured data from a photo of a receipt for an expense tracking app.

Available categories (choose the single best match by id, or null if none fit):
${categoryList}

Return ONLY a JSON object with this exact shape, no other text, no markdown fences:
{
  "merchant": string,
  "date": string | null (YYYY-MM-DD, your best reading of the receipt date; null if illegible),
  "amount": number (the final total paid),
  "tax": number | null,
  "tip": number | null,
  "categoryId": string | null,
  "confidence": "high" | "medium" | "low"
}`

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Image } },
            { type: 'text', text: prompt },
          ],
        },
      ],
    }),
  })

  if (!claudeRes.ok) {
    const errText = await claudeRes.text()
    return json({ error: `Claude API error: ${errText}` }, 502)
  }

  const result = await claudeRes.json()
  const textBlock = result.content?.find((b: { type: string }) => b.type === 'text')
  const jsonMatch = textBlock?.text?.match(/\{[\s\S]*\}/)

  if (!jsonMatch) return json({ error: 'Could not parse a response from Claude' }, 502)

  try {
    const parsed = JSON.parse(jsonMatch[0])
    return json(parsed, 200)
  } catch {
    return json({ error: 'Claude returned malformed JSON' }, 502)
  }
})

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  })
}

function base64Encode(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}
