import { CONSTRUCTION_PHASES } from './construction-phases'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Send a photo thumbnail to Claude Haiku for construction phase categorization.
 * @param {string} thumbnailUrl - Public URL of the photo thumbnail
 * @returns {Promise<{ phases: string[] }>}
 */
export async function categorizePhoto(thumbnailUrl) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const phaseList = CONSTRUCTION_PHASES.map((p) => `- ${p}`).join('\n')

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 100,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'url', url: thumbnailUrl },
            },
            {
              type: 'text',
              text: `Analyze this construction site photo for Walden, a construction management company. Respond in EXACTLY this format with no other text:

PHASES: <1 to 3 comma-separated categories from the list below, most relevant first>

Categories:
${phaseList}`,
            },
          ],
        },
      ],
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Anthropic API error ${response.status}: ${err}`)
  }

  const data = await response.json()
  const raw = (data.content?.[0]?.text || '').trim()

  return parseAnalysisResponse(raw)
}

function parseAnalysisResponse(raw) {
  // Parse PHASES — look for the line anywhere in the response
  const phasesMatch = raw.match(/PHASES\s*[:=]\s*(.+)/i)
  const phasesRaw = phasesMatch ? phasesMatch[1].split(',').map((s) => s.trim()).filter(Boolean) : []
  const phases = []
  for (const candidate of phasesRaw) {
    // Strip leading bullets/numbers/dashes
    const cleaned = candidate.replace(/^[-*\d.)\s]+/, '').trim()
    const match = CONSTRUCTION_PHASES.find(
      (p) => p.toLowerCase() === cleaned.toLowerCase()
    )
    if (match && !phases.includes(match)) phases.push(match)
    if (phases.length >= 3) break
  }
  if (phases.length === 0) phases.push('General / Other')

  return { phases }
}
