import { supabase } from './supabase'

// --- Projects ---

export async function getProjects() {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status')
    .order('name')
  if (error) throw error
  return data
}

// --- B1: Cross-Project Overview ---

function countByProject(rows) {
  const counts = {}
  for (const row of rows) {
    counts[row.project_id] = (counts[row.project_id] || 0) + 1
  }
  return counts
}

export async function getProjectOverview(startDate, endDate) {
  const dayAfterEnd = getNextDate(endDate)

  const [
    projects,
    entries,
    notes,
    photos,
    emails,
    looms,
    activeCMsResult,
    openItems,
    overdueItems,
  ] = await Promise.all([
    // Projects
    supabase.from('projects').select('id, name').order('name'),

    // Entries in date range
    supabase
      .from('site_log_entries')
      .select('project_id')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate),

    // Notes in date range
    supabase
      .from('cm_notes')
      .select('project_id')
      .gte('note_date', startDate)
      .lte('note_date', endDate),

    // Photos in date range
    supabase
      .from('site_photos')
      .select('project_id')
      .gte('photo_date', startDate)
      .lte('photo_date', endDate),

    // Emails in date range (created_at is timestamptz)
    supabase
      .from('cm_emails')
      .select('project_id')
      .gte('created_at', startDate + 'T00:00:00')
      .lt('created_at', dayAfterEnd + 'T00:00:00'),

    // Looms in date range (distinct loom_url from usage_logs)
    supabase
      .from('usage_logs')
      .select('project_id, details')
      .in('action', ['loom_processed', 'loom_submitted'])
      .gte('created_at', startDate + 'T00:00:00')
      .lt('created_at', dayAfterEnd + 'T00:00:00'),

    // Active CMs in date range (distinct user_ids from usage_logs)
    supabase
      .from('usage_logs')
      .select('user_id')
      .not('user_id', 'is', null)
      .gte('created_at', startDate + 'T00:00:00')
      .lt('created_at', dayAfterEnd + 'T00:00:00'),

    // Open action items (not date-filtered)
    supabase
      .from('cm_action_items')
      .select('project_id')
      .eq('completed', false),

    // Overdue action items
    supabase
      .from('cm_action_items')
      .select('project_id')
      .eq('completed', false)
      .not('due_date', 'is', null)
      .lt('due_date', new Date().toISOString().split('T')[0]),
  ])

  // Check for errors
  const results = [projects, entries, notes, photos, emails, looms, activeCMsResult, openItems, overdueItems]
  for (const r of results) {
    if (r.error) throw r.error
  }

  // Count looms by project (deduplicate by loom_url)
  const loomsByProject = {}
  if (looms.data) {
    const seen = new Set()
    for (const row of looms.data) {
      const url = row.details?.loom_url
      const key = `${row.project_id}:${url}`
      if (url && !seen.has(key)) {
        seen.add(key)
        loomsByProject[row.project_id] = (loomsByProject[row.project_id] || 0) + 1
      }
    }
  }

  const entryCounts = countByProject(entries.data || [])
  const noteCounts = countByProject(notes.data || [])
  const photoCounts = countByProject(photos.data || [])
  const emailCounts = countByProject(emails.data || [])
  const openCounts = countByProject(openItems.data || [])
  const overdueCounts = countByProject(overdueItems.data || [])

  // Count distinct active CMs
  const activeCMs = new Set((activeCMsResult.data || []).map((r) => r.user_id)).size

  const rows = projects.data.map((p) => ({
    id: p.id,
    name: p.name,
    entries: entryCounts[p.id] || 0,
    notes: noteCounts[p.id] || 0,
    photos: photoCounts[p.id] || 0,
    emails: emailCounts[p.id] || 0,
    looms: loomsByProject[p.id] || 0,
    openItems: openCounts[p.id] || 0,
    overdueItems: overdueCounts[p.id] || 0,
  }))

  return { rows, activeCMs }
}

// --- B2: CM Activity Scorecard ---

export async function getCMActivity(startDate, endDate) {
  const dayAfterEnd = getNextDate(endDate)

  const { data, error } = await supabase
    .from('usage_logs')
    .select('user_id, user_name, action')
    .not('user_id', 'is', null)
    .gte('created_at', startDate + 'T00:00:00')
    .lt('created_at', dayAfterEnd + 'T00:00:00')

  if (error) throw error

  // Group by user
  const byUser = {}
  for (const row of data || []) {
    if (!byUser[row.user_id]) {
      byUser[row.user_id] = {
        id: row.user_id,
        name: row.user_name,
        recordings: 0,
        processing: 0,
        submissions: 0,
        emails: 0,
        looms: 0,
        meetings: 0,
        total: 0,
      }
    }
    const u = byUser[row.user_id]
    u.total++
    switch (row.action) {
      case 'recording_saved': u.recordings++; break
      case 'process_recordings': u.processing++; break
      case 'submit_smartsheet': u.submissions++; break
      case 'email_drafted': u.emails++; break
      case 'loom_processed': u.looms++; break
      case 'meeting_recorded': u.meetings++; break
    }
  }

  return Object.values(byUser).sort((a, b) => a.name.localeCompare(b.name))
}

// --- B3: Entry Volume Trend ---

export async function getEntryTrend(startDate, endDate) {
  const [entriesResult, projectsResult] = await Promise.all([
    supabase
      .from('site_log_entries')
      .select('entry_date, project_id')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate)
      .order('entry_date'),
    supabase
      .from('projects')
      .select('id, name')
      .order('name'),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  // Build a map: date -> { date, [projectName]: count, total: count }
  const byDate = {}
  for (const row of entriesResult.data || []) {
    const d = row.entry_date
    if (!byDate[d]) byDate[d] = { date: d, total: 0 }
    const name = projectNames[row.project_id] || 'Unknown'
    byDate[d][name] = (byDate[d][name] || 0) + 1
    byDate[d].total++
  }

  // Fill in missing dates with zeros
  const allDates = []
  const cur = new Date(startDate + 'T00:00:00')
  const last = new Date(endDate + 'T00:00:00')
  while (cur <= last) {
    const ds = cur.toISOString().split('T')[0]
    if (!byDate[ds]) byDate[ds] = { date: ds, total: 0 }
    allDates.push(byDate[ds])
    cur.setDate(cur.getDate() + 1)
  }

  // Collect all project names that appear in the data
  const projectKeys = [...new Set(
    (entriesResult.data || []).map((r) => projectNames[r.project_id] || 'Unknown')
  )].sort()

  return { chartData: allDates, projectKeys }
}

// --- B5: Overdue Action Items ---

export async function getOverdueActionItems(projectId) {
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('cm_action_items')
    .select('id, project_id, description, construction_manager, due_date, item_date')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .lt('due_date', today)
    .order('due_date', { ascending: true })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [itemsResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const items = (itemsResult.data || []).map((item) => ({
    ...item,
    projectName: projectNames[item.project_id] || 'Unknown',
    daysOverdue: Math.floor((new Date(today) - new Date(item.due_date)) / (1000 * 60 * 60 * 24)),
  }))

  // Counts per project for the chart
  const byProject = {}
  for (const item of items) {
    if (!byProject[item.projectName]) {
      byProject[item.projectName] = 0
    }
    byProject[item.projectName]++
  }

  const chartData = Object.entries(byProject)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  return { items, chartData, total: items.length }
}

// --- B4: App Adoption Metrics ---

export async function getAdoptionMetrics() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Current period: Monday of this week through today
  const dayOfWeek = today.getDay()
  const mondayOffset = dayOfWeek === 0 ? 6 : dayOfWeek - 1
  const currentStart = new Date(today)
  currentStart.setDate(today.getDate() - mondayOffset)

  // Previous period: same length, ending the day before current starts
  const prevEnd = new Date(currentStart)
  prevEnd.setDate(prevEnd.getDate() - 1)
  const periodLength = mondayOffset + 1 // days in current period so far
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevEnd.getDate() - periodLength + 1)

  const fmt = (d) => d.toISOString().split('T')[0]
  const dayAfterToday = getNextDate(fmt(today))
  const dayAfterPrevEnd = getNextDate(fmt(prevEnd))

  const [currentLogs, prevLogs, currentEntries, prevEntries, currentPhotos, prevPhotos] = await Promise.all([
    supabase
      .from('usage_logs')
      .select('user_id, action')
      .gte('created_at', fmt(currentStart) + 'T00:00:00')
      .lt('created_at', dayAfterToday + 'T00:00:00'),
    supabase
      .from('usage_logs')
      .select('user_id, action')
      .gte('created_at', fmt(prevStart) + 'T00:00:00')
      .lt('created_at', dayAfterPrevEnd + 'T00:00:00'),
    supabase
      .from('site_log_entries')
      .select('id')
      .gte('entry_date', fmt(currentStart))
      .lte('entry_date', fmt(today)),
    supabase
      .from('site_log_entries')
      .select('id')
      .gte('entry_date', fmt(prevStart))
      .lte('entry_date', fmt(prevEnd)),
    supabase
      .from('site_photos')
      .select('id')
      .gte('photo_date', fmt(currentStart))
      .lte('photo_date', fmt(today)),
    supabase
      .from('site_photos')
      .select('id')
      .gte('photo_date', fmt(prevStart))
      .lte('photo_date', fmt(prevEnd)),
  ])

  const results = [currentLogs, prevLogs, currentEntries, prevEntries, currentPhotos, prevPhotos]
  for (const r of results) {
    if (r.error) throw r.error
  }

  function summarizeLogs(logs) {
    const users = new Set()
    let recordings = 0, submissions = 0, emails = 0, looms = 0
    for (const row of logs || []) {
      if (row.user_id) users.add(row.user_id)
      switch (row.action) {
        case 'recording_saved': recordings++; break
        case 'submit_smartsheet': submissions++; break
        case 'email_drafted': emails++; break
        case 'loom_processed': looms++; break
      }
    }
    return { activeUsers: users.size, recordings, submissions, emails, looms }
  }

  const current = {
    ...summarizeLogs(currentLogs.data),
    entries: (currentEntries.data || []).length,
    photos: (currentPhotos.data || []).length,
  }
  const previous = {
    ...summarizeLogs(prevLogs.data),
    entries: (prevEntries.data || []).length,
    photos: (prevPhotos.data || []).length,
  }

  return {
    current,
    previous,
    periodLabel: `${formatShort(currentStart)} – ${formatShort(today)}`,
    prevLabel: `${formatShort(prevStart)} – ${formatShort(prevEnd)}`,
  }
}

function formatShort(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getNextDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// --- D: Danny's Production Dashboard ---

// D4 + Stats: Daily Entry Heatmap + Header Stats
export async function getDannyOverview(startDate, endDate) {
  const dayAfterEnd = getNextDate(endDate)

  const [projectsResult, entriesResult, photosResult, loomsResult] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase
      .from('site_log_entries')
      .select('project_id, project_area, smartsheet_submitted')
      .gte('entry_date', startDate)
      .lte('entry_date', endDate),
    supabase
      .from('site_photos')
      .select('project_id')
      .gte('photo_date', startDate)
      .lte('photo_date', endDate),
    supabase
      .from('usage_logs')
      .select('project_id, details')
      .in('action', ['loom_processed', 'loom_submitted'])
      .gte('created_at', startDate + 'T00:00:00')
      .lt('created_at', dayAfterEnd + 'T00:00:00'),
  ])

  const results = [projectsResult, entriesResult, photosResult, loomsResult]
  for (const r of results) {
    if (r.error) throw r.error
  }

  const byProject = {}
  for (const p of projectsResult.data) {
    byProject[p.id] = {
      id: p.id,
      name: p.name,
      entries: 0,
      hasSafety: false,
      hasAttendance: false,
      hasWaldenGeneral: false,
      hasCloseUp: false,
      submitted: 0,
      photos: 0,
      looms: 0,
    }
  }

  for (const e of entriesResult.data || []) {
    const p = byProject[e.project_id]
    if (!p) continue
    p.entries++
    if (e.smartsheet_submitted) p.submitted++
    const area = (e.project_area || '').toLowerCase()
    if (area.startsWith('job log site safety') || area.startsWith('job log safety')) p.hasSafety = true
    if (e.project_area === 'Job Log Daily Attendance') p.hasAttendance = true
    if (e.project_area === 'Job Log Walden General') p.hasWaldenGeneral = true
    if (e.project_area === 'End Of Day Close Up') p.hasCloseUp = true
  }

  for (const ph of photosResult.data || []) {
    if (byProject[ph.project_id]) byProject[ph.project_id].photos++
  }

  const seenLooms = new Set()
  for (const l of loomsResult.data || []) {
    const url = l.details?.loom_url
    const key = `${l.project_id}:${url}`
    if (url && !seenLooms.has(key)) {
      seenLooms.add(key)
      if (byProject[l.project_id]) byProject[l.project_id].looms++
    }
  }

  const rows = Object.values(byProject).sort((a, b) => a.name.localeCompare(b.name))
  return { rows }
}

// D1: Loom Video Feed
export async function getLoomFeed(startDate, endDate, projectId) {
  const dayAfterEnd = getNextDate(endDate)

  let loomQuery = supabase
    .from('usage_logs')
    .select('id, action, details, user_name, project_name, project_id, created_at')
    .in('action', ['loom_processed', 'loom_submitted'])
    .gte('created_at', startDate + 'T00:00:00')
    .lt('created_at', dayAfterEnd + 'T00:00:00')
    .order('created_at', { ascending: false })

  let entriesQuery = supabase
    .from('site_log_entries')
    .select('project_id, project_area, description, created_at')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)

  if (projectId) {
    loomQuery = loomQuery.eq('project_id', projectId)
    entriesQuery = entriesQuery.eq('project_id', projectId)
  }

  const [loomResult, entriesResult] = await Promise.all([loomQuery, entriesQuery])
  if (loomResult.error) throw loomResult.error
  if (entriesResult.error) throw entriesResult.error

  // Build per-loom data — keep loom_processed time and loom_submitted entry_count
  const byUrl = new Map()
  for (const row of loomResult.data || []) {
    const url = row.details?.loom_url
    if (!url) continue

    if (!byUrl.has(url)) {
      byUrl.set(url, {
        logId: row.id,
        loomUrl: url,
        cmName: row.user_name,
        projectName: row.project_name,
        projectId: row.project_id,
        createdAt: row.created_at,
        processedAt: row.action === 'loom_processed' ? row.created_at : null,
        entryCount: row.details?.entry_count || null,
        topics: [],
      })
    } else {
      const existing = byUrl.get(url)
      if (row.action === 'loom_processed' && !existing.processedAt) {
        existing.processedAt = row.created_at
      }
      if (row.details?.entry_count && !existing.entryCount) {
        existing.entryCount = row.details.entry_count
      }
    }
  }

  // Match entries to looms by project + time proximity (created within 5 min after processing)
  const entries = entriesResult.data || []
  for (const [, loom] of byUrl) {
    const refTime = new Date(loom.processedAt || loom.createdAt).getTime()
    const areas = new Set()
    const descriptions = []
    for (const entry of entries) {
      if (entry.project_id !== loom.projectId) continue
      const entryTime = new Date(entry.created_at).getTime()
      if (entryTime >= refTime - 60000 && entryTime <= refTime + 300000) {
        areas.add(entry.project_area)
        if (entry.description) descriptions.push(entry.description)
      }
    }
    loom.topics = [...areas].sort()
    // Build a brief summary from the first few entry descriptions
    loom.summary = buildSummary(descriptions)
  }

  return [...byUrl.values()]
}

function buildSummary(descriptions) {
  if (descriptions.length === 0) return null
  // Take first few descriptions and truncate to a readable summary
  const combined = descriptions.slice(0, 4).join(' \u2022 ')
  if (combined.length <= 200) return combined
  return combined.slice(0, 197) + '...'
}

// D2: Photo Activity Summary
export async function getPhotoActivity(startDate, endDate, projectId) {
  let query = supabase
    .from('site_photos')
    .select('id, project_id, thumb_path, file_path, uploaded_by_name, client_visible, photo_date, construction_phases, instagram_worthy, visual_quality_score')
    .gte('photo_date', startDate)
    .lte('photo_date', endDate)
    .order('time_taken', { ascending: true, nullsFirst: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [photosResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (photosResult.error) throw photosResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const byProject = {}
  for (const photo of photosResult.data || []) {
    const name = projectNames[photo.project_id] || 'Unknown'
    if (!byProject[photo.project_id]) {
      byProject[photo.project_id] = {
        projectId: photo.project_id,
        projectName: name,
        total: 0,
        clientVisible: 0,
        uploaders: new Set(),
        photos: [],
      }
    }
    const group = byProject[photo.project_id]
    group.total++
    if (photo.client_visible) group.clientVisible++
    if (photo.uploaded_by_name) group.uploaders.add(photo.uploaded_by_name)
    group.photos.push({ id: photo.id, thumbPath: photo.thumb_path, filePath: photo.file_path, photoDate: photo.photo_date, constructionPhases: photo.construction_phases || [], instagramWorthy: !!photo.instagram_worthy, qualityScore: photo.visual_quality_score })
  }

  return Object.values(byProject)
    .map((g) => ({ ...g, uploaders: [...g.uploaders] }))
    .sort((a, b) => b.total - a.total)
}

// Photo Gallery: all projects, photos grouped by date (most recent first)
export async function getPhotoGallery(startDate, endDate) {
  let photosQuery = supabase
    .from('site_photos')
    .select('id, project_id, thumb_path, file_path, photo_date, client_visible, construction_phases, instagram_worthy, visual_quality_score')
  if (startDate) photosQuery = photosQuery.gte('photo_date', startDate)
  if (endDate) photosQuery = photosQuery.lte('photo_date', endDate)
  photosQuery = photosQuery
    .order('photo_date', { ascending: false })
    .order('time_taken', { ascending: false })

  const [photosResult, projectsResult] = await Promise.all([
    photosQuery,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (photosResult.error) throw photosResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const byProject = {}
  for (const photo of photosResult.data || []) {
    const pid = photo.project_id
    if (!byProject[pid]) {
      byProject[pid] = {
        projectId: pid,
        projectName: projectNames[pid] || 'Unknown',
        dateGroups: {},
        total: 0,
      }
    }
    const group = byProject[pid]
    const date = photo.photo_date
    if (!group.dateGroups[date]) {
      group.dateGroups[date] = []
    }
    group.dateGroups[date].push({
      id: photo.id,
      thumbPath: photo.thumb_path,
      filePath: photo.file_path,
      photoDate: date,
      clientVisible: !!photo.client_visible,
      constructionPhases: photo.construction_phases || [],
      instagramWorthy: !!photo.instagram_worthy,
      qualityScore: photo.visual_quality_score,
    })
    group.total++
  }

  return Object.values(byProject)
    .map((p) => ({
      ...p,
      dateGroups: Object.entries(p.dateGroups)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([date, photos]) => ({ date, photos })),
    }))
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// Supabase Storage public URL helper
export function getStorageUrl(path) {
  if (!path) return null
  const url = import.meta.env.VITE_SUPABASE_URL
  return `${url}/storage/v1/object/public/site-photos/${path}`
}

// Uncategorized photos for admin categorization
export async function getUncategorizedPhotos() {
  const { data, error } = await supabase
    .from('site_photos')
    .select('id, thumb_path')
    .is('construction_phases', null)
    .order('photo_date', { ascending: false })
  if (error) throw error
  return data || []
}

// Update a photo's analysis results
export async function updatePhotoAnalysis(photoId, { phases }) {
  const { error } = await supabase
    .from('site_photos')
    .update({
      construction_phases: phases,
    })
    .eq('id', photoId)
  if (error) throw error
}

// Auto-categorizer: recent uncategorized photos (Feb 2026 onwards)
export async function getRecentUncategorizedPhotos(limit = 10) {
  const { data, error, count } = await supabase
    .from('site_photos')
    .select('id, thumb_path', { count: 'exact' })
    .is('construction_phases', null)
    .gte('photo_date', '2026-02-01')
    .order('photo_date', { ascending: false })
    .limit(limit)
  if (error) throw error
  return { photos: data || [], totalPending: count || 0 }
}

// Phase counts: count photos per construction phase label (for admin categories page)
export async function getPhaseCounts() {
  const { data, error } = await supabase
    .from('site_photos')
    .select('construction_phases')
    .not('construction_phases', 'is', null)
  if (error) throw error

  const counts = {}
  for (const row of data || []) {
    for (const label of row.construction_phases || []) {
      counts[label] = (counts[label] || 0) + 1
      // Also count toward the main category
      const main = label.split(' > ')[0]
      if (main !== label) {
        counts[main] = (counts[main] || 0) + 1
      }
    }
  }
  return counts
}

// Manual categorizer: filtered uncategorized photos
export async function getUncategorizedPhotosFiltered({ projectId, startDate, endDate } = {}) {
  let query = supabase
    .from('site_photos')
    .select('id, thumb_path')
    .is('construction_phases', null)
    .order('photo_date', { ascending: false })
  if (projectId) query = query.eq('project_id', projectId)
  if (startDate) query = query.gte('photo_date', startDate)
  if (endDate) query = query.lte('photo_date', endDate)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

// D3: Site Safety Entries
export async function getSafetyEntries(startDate, endDate, projectId) {
  let query = supabase
    .from('site_log_entries')
    .select('id, project_id, project_area, description, construction_manager, created_at')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .or('project_area.ilike.Job Log Site Safety%,project_area.ilike.Job Log Safety%')
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [entriesResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  return (entriesResult.data || []).map((e) => ({
    ...e,
    projectName: projectNames[e.project_id] || 'Unknown',
  }))
}

// D5: Job Log Entry Browser
export async function getJobLogEntries(startDate, endDate, projectId) {
  let query = supabase
    .from('site_log_entries')
    .select('id, project_id, project_area, section_code, description, construction_manager, smartsheet_submitted, entry_date, created_at')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [entriesResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const byProject = {}
  for (const e of entriesResult.data || []) {
    const name = projectNames[e.project_id] || 'Unknown'
    if (!byProject[e.project_id]) {
      byProject[e.project_id] = { projectId: e.project_id, projectName: name, entries: [] }
    }
    byProject[e.project_id].entries.push({ ...e, projectName: name })
  }

  return Object.values(byProject).sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// D6: Site Activity This Week
// Skip purely administrative areas
const SKIP_AREAS = [
  'Job Log Daily Attendance',
  'Job Log Walden General',
  'End Of Day Close Up',
]

function isActivityArea(area) {
  if (!area) return false
  if (!area.startsWith('Job Log ')) return false
  if (SKIP_AREAS.includes(area)) return false
  return true
}

// --- Work classification ---
// Physical trade areas strongly indicate on-site work by their nature.
// The classifier uses both the area name and description content.

// Area names that are inherently physical on-site trades
const PHYSICAL_TRADE_AREAS = [
  'plumbing', 'electrical', 'concrete', 'demolition', 'hvac', 'mechanical',
  'framing', 'drywall', 'painting', 'roofing', 'flooring', 'masonry',
  'steel', 'shoring', 'excavat', 'grading', 'landscaping', 'carpentry',
  'millwork', 'glazing', 'waterproofing', 'insulation', 'fire protection',
  'sprinkler', 'elevator', 'cladding', 'siding', 'stucco', 'paving',
  'asphalt', 'fencing', 'ironwork', 'welding', 'scaffolding', 'hoarding',
  'formwork', 'rebar', 'backfill', 'underpinning', 'caisson', 'pile',
  'structural', 'rough-in', 'finish', 'ceramic', 'stone', 'granite',
  'marble', 'cabinet', 'countertop', 'ceiling', 'partition', 'door',
  'window', 'hardware', 'lumber', 'wood', 'metal', 'duct', 'conduit',
  'piping', 'drainage', 'sewer', 'water main', 'gas line', 'abatement',
]

// Area names that indicate coordination / off-site work
const COORDINATION_AREA_NAMES = [
  'safety', 'coordination', 'scheduling', 'communication', 'inspection',
  'planning', 'admin', 'office', 'permit', 'review',
]

// Description patterns: physical work being performed
const ONSITE_PATTERNS = [
  // Actions — past tense and present forms
  /\b(install|pour|frame|demolish|excavat|strip|form|grade|compact)\w*/i,
  /\b(drill|cut|weld|bolt|connect|wire|pipe|lay|laid|place[ds]?)\b/i,
  /\b(backfill|trench|hoist|lift|haul|deliver|erect|assemble|mount)\w*/i,
  /\b(insulate|waterproof|caulk|grout|patch|repair|remov)\w*/i,
  /\b(poured|installed|hung|nailed|screwed|glued|sealed|tied)\b/i,
  /\b(pulled|bent|loaded|unloaded|demolished|stripped|completed)\b/i,
  /\b(rough.?in|clean.?up|mobiliz|demobiliz)\w*/i,
  // Work in progress
  /\b(working on|work on|started|continu|progress)\w*/i,
  /\b(on.?site|crew|workers?|men on site|labou?rers?)\b/i,
  // Materials and building elements
  /\b(concrete|rebar|steel|lumber|drywall|plaster|mortar)\b/i,
  /\b(membrane|brick|block|slab|footing|foundation)\b/i,
  /\b(duct|conduit|copper|pex|abs|pvc|pipe)\b/i,
  // Locations on site
  /\b(floor|level|storey|basement|roof|parkade|garage)\b/i,
  /\b(suite|unit|corridor|stairwell|shaft|column|beam)\b/i,
]

// Description patterns: coordination / planning / off-site
// Strong signals (weight 3) — these are clearly not physical on-site work
const COORDINATION_STRONG = [
  /\b(phone|phone call|called|call to|call with)\b/i,
  /\b(email|emailed|e-mail|sent email|sent message)\b/i,
  /\b(review|reviewed|reviewing)\b/i,
  /\b(meeting|met with)\b/i,
  /\b(coordinat)\w*/i,
  /\b(schedul)\w*/i,
  /\b(spoke with|spoke to|talking to|talked to)\b/i,
]
// Normal signals (weight 1)
const COORDINATION_PATTERNS = [
  /\b(discuss|contact|noti[fy]|inform)\w*/i,
  /\b(follow.?up|arrange|confirm)\w*/i,
  /\b(submit|approv|permit|rfi|change order)\w*/i,
  /\b(drawing|shop drawing|specification|document)\w*/i,
  /\b(quote|pricing|estimate|bid|proposal|contract)\b/i,
  /\b(invoice|payment|procurement|purchase order)\b/i,
  /\b(awaiting|waiting|pending|delay|postpone|reschedul|cancel)\w*/i,
  /\b(requested|on order|back.?order|lead time)\b/i,
  /\b(plan |planning|design|engineer|consultant)\w*/i,
  /\b(inspect|test result|lab result|report)\w*/i,
]

// Classify a trade by analyzing ALL its descriptions holistically.
// Returns 'onSite' or 'coordination'.
function classifyTrade(areaName, descriptions) {
  const areaLower = (areaName || '').toLowerCase()

  // Area name gives a mild starting bias
  const isPhysicalArea = PHYSICAL_TRADE_AREAS.some((t) => areaLower.includes(t))
  const isCoordArea = COORDINATION_AREA_NAMES.some((t) => areaLower.includes(t))
  let onSiteScore = isPhysicalArea ? 2 : 0
  let coordScore = isCoordArea ? 3 : 0

  // Analyze every description — the body of work determines the classification
  for (const desc of descriptions) {
    if (!desc) continue
    for (const pattern of ONSITE_PATTERNS) {
      if (pattern.test(desc)) onSiteScore++
    }
    for (const pattern of COORDINATION_STRONG) {
      if (pattern.test(desc)) coordScore += 3
    }
    for (const pattern of COORDINATION_PATTERNS) {
      if (pattern.test(desc)) coordScore++
    }
  }

  return coordScore > onSiteScore ? 'coordination' : 'onSite'
}

// Build a synthesized narrative from all descriptions for a trade.
// Groups by day, deduplicates, and weaves into a readable summary
// using only the original language from the entries.
function buildNarrative(dateDescriptions) {
  const dayNames = {}
  for (const [dateStr] of dateDescriptions) {
    const d = new Date(dateStr + 'T00:00:00')
    dayNames[dateStr] = d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const parts = []
  // Collect all unique descriptions, tagging each with its day(s)
  const seen = new Map() // description text → Set of day names
  for (const [dateStr, entries] of dateDescriptions) {
    const day = dayNames[dateStr]
    for (const entry of entries) {
      const text = entry.text
      if (!seen.has(text)) {
        seen.set(text, { days: new Set(), cm: entry.cm })
      }
      seen.get(text).days.add(day)
    }
  }

  for (const [text, info] of seen) {
    const dayList = [...info.days]
    const dayTag = dayList.length < dateDescriptions.length
      ? ` (${dayList.join(', ')})`
      : ''
    const cmTag = info.cm ? ` — ${info.cm}` : ''
    parts.push(text + dayTag + cmTag)
  }

  return parts.length > 0 ? parts : null
}

export async function getSiteActivity(startDate, endDate, projectId) {
  let query = supabase
    .from('site_log_entries')
    .select('project_id, project_area, section_code, entry_date, construction_manager, description, smartsheet_submitted')
    .gte('entry_date', startDate)
    .lte('entry_date', endDate)
    .like('project_area', 'Job Log %')
    .order('entry_date', { ascending: true })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [entriesResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  // Group by project → trade, collecting all entries
  const byProject = {}
  for (const e of entriesResult.data || []) {
    if (!isActivityArea(e.project_area)) continue

    const trade = e.project_area.replace(/^Job Log /, '')
    const projName = projectNames[e.project_id] || 'Unknown'

    if (!byProject[e.project_id]) {
      byProject[e.project_id] = { projectId: e.project_id, projectName: projName, trades: {} }
    }

    if (!byProject[e.project_id].trades[trade]) {
      byProject[e.project_id].trades[trade] = {
        trade, dates: {}, cms: new Set(), entryCount: 0, allDescriptions: [],
      }
    }

    const tradeData = byProject[e.project_id].trades[trade]
    tradeData.entryCount++
    if (e.construction_manager) tradeData.cms.add(e.construction_manager)

    if (!tradeData.dates[e.entry_date]) {
      tradeData.dates[e.entry_date] = []
    }
    if (e.description && e.description.trim()) {
      tradeData.dates[e.entry_date].push({
        text: e.description.trim(),
        cm: e.construction_manager || null,
      })
      tradeData.allDescriptions.push(e.description.trim())
    }
  }

  // Build structured result — classify each trade holistically
  return Object.values(byProject)
    .map((proj) => {
      const allTrades = Object.values(proj.trades).map((t) => {
        const dateKeys = Object.keys(t.dates).sort()
        const category = classifyTrade(t.trade, t.allDescriptions)
        const dateDescriptions = dateKeys.map((d) => [d, t.dates[d]])
        const narrative = buildNarrative(dateDescriptions)

        return {
          trade: t.trade,
          category,
          dates: dateKeys,
          daysOnSite: dateKeys.length,
          entryCount: t.entryCount,
          cms: [...t.cms].sort(),
          narrative,
        }
      })

      return {
        projectId: proj.projectId,
        projectName: proj.projectName,
        onSite: allTrades.filter((t) => t.category === 'onSite')
          .sort((a, b) => a.trade.localeCompare(b.trade)),
        coordination: allTrades.filter((t) => t.category === 'coordination')
          .sort((a, b) => a.trade.localeCompare(b.trade)),
      }
    })
    .sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// --- S: Coordinator (Vuk & Nead) Dashboard ---

// Stats: Coordinator overview powers the stats bar
export async function getCoordinatorOverview(projectId) {
  const today = new Date().toISOString().split('T')[0]
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]

  let overdueQuery = supabase
    .from('cm_action_items')
    .select('id, project_id')
    .eq('completed', false)
    .not('due_date', 'is', null)
    .lt('due_date', today)

  let staleQuery = supabase
    .from('cm_action_items')
    .select('id, project_id')
    .eq('completed', false)
    .is('due_date', null)
    .lt('item_date', sevenDaysAgo)

  if (projectId) {
    overdueQuery = overdueQuery.eq('project_id', projectId)
    staleQuery = staleQuery.eq('project_id', projectId)
  }

  const [overdueResult, staleResult, projectsResult, recentEntriesResult, todoItemsResult, reviewsResult] = await Promise.all([
    overdueQuery,
    staleQuery,
    supabase.from('projects').select('id'),
    supabase.from('site_log_entries').select('project_id').gte('entry_date', twoDaysAgo),
    supabase.from('transcript_items').select('id, transcripts(project_id)').eq('item_type', 'cm_todo'),
    supabase.from('meeting_item_reviews').select('transcript_item_id'),
  ])

  if (overdueResult.error) throw overdueResult.error
  if (staleResult.error) throw staleResult.error
  if (projectsResult.error) throw projectsResult.error
  if (recentEntriesResult.error) throw recentEntriesResult.error

  // Count overdue and stale (with project filter already applied)
  const overdue = (overdueResult.data || []).length
  const stale = (staleResult.data || []).length

  // Count unreviewed meeting items
  let unreviewed = 0
  if (!todoItemsResult.error && !reviewsResult.error) {
    const reviewedIds = new Set((reviewsResult.data || []).map((r) => r.transcript_item_id))
    let unreviewedItems = (todoItemsResult.data || []).filter((item) => !reviewedIds.has(item.id))
    if (projectId) {
      unreviewedItems = unreviewedItems.filter((item) => item.transcripts?.project_id === projectId)
    }
    unreviewed = unreviewedItems.length
  }

  // Count inactive projects
  const activeProjectIds = new Set((recentEntriesResult.data || []).map((r) => r.project_id))
  let allProjects = projectsResult.data || []
  if (projectId) {
    allProjects = allProjects.filter((p) => p.id === projectId)
  }
  const inactive = allProjects.filter((p) => !activeProjectIds.has(p.id)).length

  return { overdue, stale, unreviewed, inactive }
}

// S2: Stale Open Items (no due date, created > 7 days ago)
export async function getStaleOpenItems(projectId) {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]

  let query = supabase
    .from('cm_action_items')
    .select('id, project_id, description, construction_manager, item_date')
    .eq('completed', false)
    .is('due_date', null)
    .lt('item_date', sevenDaysAgo)
    .order('item_date', { ascending: true })

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [itemsResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const today = new Date().toISOString().split('T')[0]
  return (itemsResult.data || []).map((item) => ({
    ...item,
    projectName: projectNames[item.project_id] || 'Unknown',
    daysOld: Math.floor((new Date(today) - new Date(item.item_date)) / (1000 * 60 * 60 * 24)),
  }))
}

// S3: Open Action Items by Project (chart data)
export async function getOpenItemsByProject(projectId) {
  const today = new Date().toISOString().split('T')[0]

  let query = supabase
    .from('cm_action_items')
    .select('id, project_id, due_date')
    .eq('completed', false)

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [itemsResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  const byProject = {}
  for (const item of itemsResult.data || []) {
    const name = projectNames[item.project_id] || 'Unknown'
    if (!byProject[item.project_id]) {
      byProject[item.project_id] = { name, overdue: 0, onTrack: 0, noDueDate: 0 }
    }
    const bucket = byProject[item.project_id]
    if (!item.due_date) {
      bucket.noDueDate++
    } else if (item.due_date < today) {
      bucket.overdue++
    } else {
      bucket.onTrack++
    }
  }

  return Object.values(byProject)
    .map((b) => ({ ...b, total: b.overdue + b.onTrack + b.noDueDate }))
    .sort((a, b) => b.total - a.total)
}

// S4: Punch List / Deficiency Tracker
export async function getPunchListEntries(startDate, endDate, projectId) {
  let query = supabase
    .from('site_log_entries')
    .select('id, project_id, project_area, description, construction_manager, entry_date, created_at')
    .ilike('project_area', '%Punch List%')
    .order('entry_date', { ascending: false })

  if (startDate && endDate) {
    query = query.gte('entry_date', startDate).lte('entry_date', endDate)
  }

  if (projectId) {
    query = query.eq('project_id', projectId)
  }

  const [entriesResult, projectsResult] = await Promise.all([
    query,
    supabase.from('projects').select('id, name').order('name'),
  ])

  if (entriesResult.error) throw entriesResult.error
  if (projectsResult.error) throw projectsResult.error

  const projectNames = {}
  for (const p of projectsResult.data) {
    projectNames[p.id] = p.name
  }

  // Group by project
  const byProject = {}
  for (const e of entriesResult.data || []) {
    const name = projectNames[e.project_id] || 'Unknown'
    if (!byProject[e.project_id]) {
      byProject[e.project_id] = { projectId: e.project_id, projectName: name, entries: [] }
    }
    byProject[e.project_id].entries.push({ ...e, projectName: name })
  }

  return Object.values(byProject).sort((a, b) => a.projectName.localeCompare(b.projectName))
}

// S5: Unreviewed Meeting Items
export async function getUnreviewedMeetingItems(projectId) {
  // Query transcript_items with cm_todo type, join transcripts for meeting info
  let query = supabase
    .from('transcript_items')
    .select('id, description, assignee, transcript_id, transcripts(id, title, meeting_date, project_id, projects(id, name))')
    .eq('item_type', 'cm_todo')

  const [itemsResult, reviewsResult] = await Promise.all([
    query,
    supabase.from('meeting_item_reviews').select('transcript_item_id'),
  ])

  if (itemsResult.error) throw itemsResult.error
  if (reviewsResult.error) throw reviewsResult.error

  const reviewedIds = new Set((reviewsResult.data || []).map((r) => r.transcript_item_id))

  let items = (itemsResult.data || [])
    .filter((item) => !reviewedIds.has(item.id))
    .map((item) => ({
      id: item.id,
      description: item.description,
      assignee: item.assignee,
      meetingTitle: item.transcripts?.title || 'Unknown Meeting',
      meetingDate: item.transcripts?.meeting_date,
      projectName: item.transcripts?.projects?.name || 'Unknown',
      projectId: item.transcripts?.project_id,
    }))

  if (projectId) {
    items = items.filter((item) => item.projectId === projectId)
  }

  // Sort by meeting date descending
  items.sort((a, b) => {
    if (!a.meetingDate) return 1
    if (!b.meetingDate) return -1
    return new Date(b.meetingDate) - new Date(a.meetingDate)
  })

  return items
}

// S6: Projects Without Recent Activity
export async function getInactiveProjects(projectId) {
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0]

  const [projectsResult, recentEntriesResult] = await Promise.all([
    supabase.from('projects').select('id, name').order('name'),
    supabase
      .from('site_log_entries')
      .select('project_id, entry_date')
      .gte('entry_date', twoDaysAgo),
  ])

  if (projectsResult.error) throw projectsResult.error
  if (recentEntriesResult.error) throw recentEntriesResult.error

  // Build map of project -> latest entry date from recent entries
  const recentByProject = {}
  for (const e of recentEntriesResult.data || []) {
    if (!recentByProject[e.project_id] || e.entry_date > recentByProject[e.project_id]) {
      recentByProject[e.project_id] = e.entry_date
    }
  }

  // Find last entry date for inactive projects
  const activeProjectIds = new Set(Object.keys(recentByProject))
  let projects = (projectsResult.data || []).filter((p) => !activeProjectIds.has(p.id))

  if (projectId) {
    projects = projects.filter((p) => p.id === projectId)
  }

  // For inactive projects, fetch their last entry date
  if (projects.length === 0) return []

  const { data: allLastEntries, error: lastErr } = await supabase
    .from('site_log_entries')
    .select('project_id, entry_date')
    .in('project_id', projects.map((p) => p.id))
    .order('entry_date', { ascending: false })

  if (lastErr) throw lastErr

  const lastEntryByProject = {}
  for (const e of allLastEntries || []) {
    if (!lastEntryByProject[e.project_id]) {
      lastEntryByProject[e.project_id] = e.entry_date
    }
  }

  const today = new Date().toISOString().split('T')[0]
  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    lastEntryDate: lastEntryByProject[p.id] || null,
    daysSinceEntry: lastEntryByProject[p.id]
      ? Math.floor((new Date(today) - new Date(lastEntryByProject[p.id])) / (1000 * 60 * 60 * 24))
      : null,
  }))
}

// Transcript alert items (reusable for Cost Alerts, Client Concerns, Hot Buttons)
export async function getTranscriptAlerts(itemTypes, projectId) {
  // Fetch transcript items and manual items in parallel
  const [transcriptResult, manualResult, projectsResult] = await Promise.all([
    supabase
      .from('transcript_items')
      .select('id, item_type, description, assignee, amount, section_code, sort_order, transcript_id, transcripts(id, title, meeting_date, meeting_type, project_id, projects(id, name))')
      .in('item_type', itemTypes),
    supabase
      .from('dashboard_manual_alerts')
      .select('id, item_type, description, project_id, created_by, created_at')
      .in('item_type', itemTypes)
      .then((res) => {
        if (res.error) return { data: [], error: null } // table may not exist yet
        return res
      })
      .catch(() => ({ data: [], error: null })),
    supabase.from('projects').select('id, name'),
  ])

  if (transcriptResult.error) throw transcriptResult.error

  const projectNames = {}
  for (const p of (projectsResult.data || [])) {
    projectNames[p.id] = p.name
  }

  // Map transcript items
  let items = (transcriptResult.data || []).map((item) => ({
    id: item.id,
    source: 'transcript',
    itemType: item.item_type,
    description: item.description,
    assignee: item.assignee,
    amount: item.amount,
    sectionCode: item.section_code,
    transcriptId: item.transcript_id,
    meetingTitle: item.transcripts?.title || 'Unknown Meeting',
    meetingDate: item.transcripts?.meeting_date,
    meetingType: item.transcripts?.meeting_type,
    projectName: item.transcripts?.projects?.name || 'Unknown',
    projectId: item.transcripts?.project_id,
    createdAt: null,
    createdBy: null,
  }))

  // Map manual items
  const manualItems = (manualResult.data || []).map((item) => ({
    id: item.id,
    source: 'manual',
    itemType: item.item_type,
    description: item.description,
    assignee: null,
    amount: null,
    sectionCode: null,
    transcriptId: null,
    meetingTitle: null,
    meetingDate: null,
    meetingType: null,
    projectName: projectNames[item.project_id] || 'Unknown',
    projectId: item.project_id,
    createdAt: item.created_at,
    createdBy: item.created_by,
  }))

  items = [...items, ...manualItems]

  if (projectId) {
    items = items.filter((item) => item.projectId === projectId)
  }

  // Fetch resolutions — gracefully handle if table doesn't exist yet
  let resolutionMap = {}
  try {
    const { data: resolutions, error: resErr } = await supabase
      .from('dashboard_alert_resolutions')
      .select('transcript_item_id, resolved_by, resolved_at')

    if (!resErr && resolutions) {
      for (const r of resolutions) {
        resolutionMap[r.transcript_item_id] = {
          resolvedBy: r.resolved_by,
          resolvedAt: r.resolved_at,
        }
      }
    }
  } catch {
    // Table may not exist yet
  }

  // Attach resolution state to each item
  for (const item of items) {
    const res = resolutionMap[item.id]
    item.resolved = !!res
    item.resolution = res || null
  }

  // Sort: newest first (meeting date for transcript items, created_at for manual)
  items.sort((a, b) => {
    const dateA = a.meetingDate || a.createdAt
    const dateB = b.meetingDate || b.createdAt
    if (!dateA) return 1
    if (!dateB) return -1
    return new Date(dateB) - new Date(dateA)
  })

  return items
}

// Add a manual alert item (dashboard-only)
export async function addManualAlert(itemType, description, projectId, createdBy) {
  const { error } = await supabase
    .from('dashboard_manual_alerts')
    .insert({
      item_type: itemType,
      description,
      project_id: projectId,
      created_by: createdBy,
    })

  if (error) throw error
}

// Delete a manual alert item
export async function deleteManualAlert(id) {
  // Also clean up any resolution for this item
  await supabase
    .from('dashboard_alert_resolutions')
    .delete()
    .eq('transcript_item_id', id)

  const { error } = await supabase
    .from('dashboard_manual_alerts')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// Resolve a cost/approval alert (dashboard-only, doesn't write back to Transcript Manager)
export async function resolveAlert(transcriptItemId, resolvedBy) {
  // Delete any existing resolution first (handles re-resolve case)
  await supabase
    .from('dashboard_alert_resolutions')
    .delete()
    .eq('transcript_item_id', transcriptItemId)

  const { error } = await supabase
    .from('dashboard_alert_resolutions')
    .insert({
      transcript_item_id: transcriptItemId,
      resolved_by: resolvedBy,
      resolved_at: new Date().toISOString(),
    })

  if (error) throw error
}

// Unresolve (reopen) a cost/approval alert
export async function unresolveAlert(transcriptItemId) {
  const { error } = await supabase
    .from('dashboard_alert_resolutions')
    .delete()
    .eq('transcript_item_id', transcriptItemId)

  if (error) throw error
}

// --- Admin: CM Users ---

export async function getCMUsers(callerId) {
  const { data, error } = await supabase.rpc('list_cm_users', {
    caller_id: callerId,
  })
  if (error) throw error
  return data
}

export async function updateCMUser(id, updates) {
  const { error } = await supabase
    .from('cm_users')
    .update(updates)
    .eq('id', id)
  if (error) throw error
}
