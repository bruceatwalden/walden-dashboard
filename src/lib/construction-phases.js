const STORAGE_KEY = 'construction_phases_config'

export const DEFAULT_PHASES = [
  {
    name: 'Site Work',
    description: 'Excavation, grading, backfill, compaction, and general site preparation including temporary facilities and erosion control.',
    subcategories: ['Excavation', 'Grading & Backfill', 'Erosion Control', 'Temporary Facilities'],
    enabled: true,
  },
  {
    name: 'Foundation',
    description: 'Footings, foundation walls, waterproofing, drainage, and all below-grade structural work.',
    subcategories: ['Footings', 'Foundation Walls', 'Waterproofing', 'Weeping Tile & Drainage', 'Slab on Grade'],
    enabled: true,
  },
  {
    name: 'Concrete',
    description: 'Formwork, rebar placement, concrete pours, finishing, and curing for all above-grade concrete work.',
    subcategories: ['Formwork', 'Rebar & Reinforcement', 'Concrete Pour', 'Finishing & Curing'],
    enabled: true,
  },
  {
    name: 'Structural Steel',
    description: 'Steel beam and column erection, welding, bolted connections, and structural steel framing.',
    subcategories: ['Beam & Column Erection', 'Welding', 'Bolted Connections'],
    enabled: true,
  },
  {
    name: 'Framing',
    description: 'Wood or steel stud wall framing, floor joists, roof trusses, header installation, and sheathing.',
    subcategories: ['Wall Framing', 'Floor Framing', 'Roof Framing', 'Steel Stud Framing', 'Sheathing'],
    enabled: true,
  },
  {
    name: 'Roofing',
    description: 'Roof structure, shingles, membrane roofing, flashing, and all weatherproofing of the roof assembly.',
    subcategories: ['Roof Structure', 'Shingles & Membrane', 'Flashing & Details', 'Skylights & Penetrations'],
    enabled: true,
  },
  {
    name: 'Exterior Cladding',
    description: 'Siding, brick veneer, stucco, stone, metal panels, air/vapour barriers, and building wrap.',
    subcategories: ['Siding & Panels', 'Masonry & Stone', 'Stucco', 'Air & Vapour Barrier'],
    enabled: true,
  },
  {
    name: 'Windows & Doors',
    description: 'Window and door installation, flashing, sealing, hardware, and all glazing work.',
    subcategories: ['Window Installation', 'Door Installation', 'Flashing & Sealing'],
    enabled: true,
  },
  {
    name: 'Waterproofing',
    description: 'Below-grade waterproofing membranes, damp-proofing, drainage boards, and moisture protection systems.',
    subcategories: ['Below-Grade Membrane', 'Damp-Proofing', 'Drainage Board'],
    enabled: true,
  },
  {
    name: 'MEP Rough-in',
    description: 'Mechanical, electrical, and plumbing rough-in including ductwork, wiring, and piping before walls are closed.',
    subcategories: ['HVAC Ductwork', 'Electrical Wiring', 'Plumbing Piping', 'Gas Lines', 'Fire Protection'],
    enabled: true,
  },
  {
    name: 'Insulation & Drywall',
    description: 'All insulation types (batt, spray foam, rigid), drywall hanging, taping, mudding, and sanding.',
    subcategories: ['Batt Insulation', 'Spray Foam', 'Drywall Hanging', 'Taping & Finishing'],
    enabled: true,
  },
  {
    name: 'Interior Finishes',
    description: 'Trim carpentry, cabinetry, countertops, flooring, tile, paint, and all visible interior finishes.',
    subcategories: ['Trim & Millwork', 'Cabinetry & Countertops', 'Flooring', 'Tile', 'Painting'],
    enabled: true,
  },
  {
    name: 'MEP Finish',
    description: 'Final mechanical, electrical, and plumbing installations: fixtures, devices, panels, equipment startup.',
    subcategories: ['Light Fixtures', 'Plumbing Fixtures', 'HVAC Equipment', 'Electrical Panel & Devices'],
    enabled: true,
  },
  {
    name: 'Landscaping',
    description: 'Grading, sodding, planting, hardscaping, driveways, walkways, decks, fencing, and exterior finishes.',
    subcategories: ['Grading & Sodding', 'Hardscaping & Driveways', 'Decks & Railings', 'Fencing'],
    enabled: true,
  },
  {
    name: 'Safety',
    description: 'Fall protection, scaffolding, barricades, PPE compliance, safety signage, and site safety conditions.',
    subcategories: ['Fall Protection', 'Scaffolding', 'Barricades & Signage'],
    enabled: true,
  },
  {
    name: 'Inspections',
    description: 'Municipal inspections, engineer reviews, pressure tests, air tightness tests, and deficiency walks.',
    subcategories: ['Municipal Inspections', 'Engineering Reviews', 'Testing', 'Deficiency Walks'],
    enabled: true,
  },
  {
    name: 'General / Other',
    description: 'Deliveries, site conditions, cleanup, weather, and anything that does not fit another category.',
    subcategories: ['Deliveries', 'Cleanup', 'Site Conditions', 'Weather'],
    enabled: true,
  },
]

// Backward compat: old configs stored {name, enabled} only.
// Merge with defaults to fill in description/subcategories.
function migrateConfig(stored) {
  const defaultMap = {}
  for (const d of DEFAULT_PHASES) defaultMap[d.name] = d

  return stored.map((item) => {
    const defaults = defaultMap[item.name]
    return {
      name: item.name,
      description: item.description ?? defaults?.description ?? '',
      subcategories: item.subcategories ?? defaults?.subcategories ?? [],
      enabled: item.enabled ?? true,
    }
  })
}

export function getPhases() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_PHASES.map((p) => ({ ...p }))
    const stored = JSON.parse(raw)
    if (!Array.isArray(stored)) return DEFAULT_PHASES.map((p) => ({ ...p }))

    const migrated = migrateConfig(stored)

    // Add any new default phases not in stored config
    const existingNames = new Set(migrated.map((p) => p.name))
    for (const d of DEFAULT_PHASES) {
      if (!existingNames.has(d.name)) migrated.push({ ...d })
    }

    return migrated
  } catch {
    return DEFAULT_PHASES.map((p) => ({ ...p }))
  }
}

export function savePhases(phases) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(phases))
}

export function getEnabledPhases() {
  return getPhases().filter((p) => p.enabled)
}

// Flat list of all valid phase label strings for validation
export function getAllPhaseLabels(phases) {
  const labels = []
  for (const p of phases) {
    labels.push(p.name)
    for (const sub of p.subcategories) {
      labels.push(`${p.name} > ${sub}`)
    }
  }
  return labels
}

// Legacy export for code that imports CONSTRUCTION_PHASES directly
export const CONSTRUCTION_PHASES = DEFAULT_PHASES.map((p) => p.name)
