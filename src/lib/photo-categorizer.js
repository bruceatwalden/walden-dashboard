import { getEnabledPhases, getAllPhaseLabels } from './construction-phases'

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages'

/**
 * Send a photo thumbnail to Claude Haiku for construction phase categorization.
 * Returns both main categories and subcategories in "Category > Subcategory" format.
 * @param {string} thumbnailUrl - Public URL of the photo thumbnail
 * @returns {Promise<{ phases: string[] }>}
 */
export async function categorizePhoto(thumbnailUrl) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('VITE_ANTHROPIC_API_KEY is not set')

  const phases = getEnabledPhases()
  const phaseList = phases
    .map((p) => {
      const subs =
        p.subcategories.length > 0
          ? `\n    Subcategories: ${p.subcategories.join(', ')}`
          : ''
      return `- ${p.name}: ${p.description}${subs}`
    })
    .join('\n')

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
      max_tokens: 150,
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
              text: `Analyze this construction site photo for Walden, a residential/commercial builder. Respond in EXACTLY this format with no other text:

PHASES: <1 to 3 comma-separated phases from the list below>

Use "Category > Subcategory" when a specific subcategory clearly applies.
Use just "Category" when the photo is general to the category or no subcategory fits.
If nothing fits, respond: PHASES: General / Other

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

  return parseAnalysisResponse(raw, phases)
}

function parseAnalysisResponse(raw, phases) {
  const phasesMatch = raw.match(/PHASES\s*[:=]\s*(.+)/i)
  const phasesRaw = phasesMatch
    ? phasesMatch[1].split(',').map((s) => s.trim()).filter(Boolean)
    : []

  const validLabels = new Set(getAllPhaseLabels(phases))
  const mainNames = new Set(phases.map((p) => p.name))

  const result = []
  for (const candidate of phasesRaw) {
    const cleaned = candidate.replace(/^[-*\d.)\s]+/, '').trim()

    // Exact match against valid labels (e.g. "Concrete > Formwork" or "Concrete")
    if (validLabels.has(cleaned) && !result.includes(cleaned)) {
      result.push(cleaned)
    } else {
      // Try matching just the main category name
      const mainPart = cleaned.split('>')[0].trim()
      const match = [...mainNames].find(
        (n) => n.toLowerCase() === mainPart.toLowerCase()
      )
      if (match && !result.includes(match)) result.push(match)
    }
    if (result.length >= 3) break
  }

  if (result.length === 0) result.push('General / Other')

  return { phases: result }
}
