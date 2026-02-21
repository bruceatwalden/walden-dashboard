# Walden Dashboard — Handoff Spec

> Generated: 2026-02-20
> Source: SITELOG-DATA-INVENTORY.md
> Purpose: Component design, queries, and new tables for the role-based dashboard system.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Danny — Production Dashboard](#danny--production-dashboard)
3. [Bruce — Executive Dashboard](#bruce--executive-dashboard)
4. [Doron — Admin / Financial Dashboard](#doron--admin--financial-dashboard)
5. [Vuk & Nead — CM Support Dashboard](#vuk--nead--cm-support-dashboard)
6. [Shared Components](#shared-components)
7. [Data Access Patterns](#data-access-patterns)
8. [New Tables Needed](#new-tables-needed)
9. [Suggested Database Views](#suggested-database-views)
10. [New RPC Functions](#new-rpc-functions)

---

## Architecture Overview

- **Separate app**, same Supabase instance. Connects with its own anon key or a dashboard-specific service role key.
- **Read-only against SiteLog tables.** The dashboard NEVER writes to `site_log_entries`, `cm_notes`, `cm_action_items`, `cm_emails`, `voice_recordings`, `site_photos`, `cm_users`, etc.
- **Writes only to its own tables** (prefixed `dashboard_`) for tracking review status, flags, and dashboard user preferences.
- **Auth:** The dashboard needs its own auth system (not the CM PIN system). Simplest option: a `dashboard_users` table with email/password or a shared PIN per role. The existing `authenticate_cm` RPC should NOT be reused — it's for field CMs.

---

## Danny — Production Dashboard

> "What came in from the field today?"

### A. Recommended Dashboard Components

#### D1. Loom Video Feed

| | |
|---|---|
| **What it shows** | All Loom videos submitted today (or selected date) across all projects. Each card shows: project name, CM name, Loom URL (clickable embed or link), timestamp, and a "Mark Reviewed" button. |
| **Tables** | `usage_logs`, `projects`, `dashboard_loom_reviews` (new) |
| **Update frequency** | Real-time (poll every 60s or Supabase realtime subscription on `usage_logs`) |
| **Priority** | Must-have |

```sql
-- Get all Loom videos for a date, with review status
SELECT DISTINCT ON (ul.details->>'loom_url')
  ul.id AS log_id,
  ul.details->>'loom_url' AS loom_url,
  ul.user_name AS cm_name,
  ul.project_name,
  ul.project_id,
  ul.created_at,
  dlr.reviewed_at,
  dlr.reviewer_name
FROM usage_logs ul
LEFT JOIN dashboard_loom_reviews dlr
  ON dlr.usage_log_id = ul.id
WHERE ul.action IN ('loom_processed', 'loom_submitted')
  AND ul.created_at >= '2026-02-20T00:00:00'
  AND ul.created_at < '2026-02-21T00:00:00'
ORDER BY ul.details->>'loom_url', ul.created_at DESC;
```

---

#### D2. Photo Activity Summary

| | |
|---|---|
| **What it shows** | Per-project photo counts for the day, with thumbnail strip preview. Click to expand into a mini gallery. Shows total uploaded, client-visible count, and who uploaded. |
| **Tables** | `site_photos`, `projects` |
| **Update frequency** | Every 5 minutes |
| **Priority** | Must-have |

```sql
-- Photo counts per project for a date
SELECT
  p.name AS project_name,
  sp.project_id,
  COUNT(*) AS photo_count,
  COUNT(*) FILTER (WHERE sp.client_visible) AS client_count,
  sp.uploaded_by_name,
  MIN(sp.thumb_path) AS sample_thumb
FROM site_photos sp
JOIN projects p ON p.id = sp.project_id
WHERE sp.photo_date = '2026-02-20'
GROUP BY p.name, sp.project_id, sp.uploaded_by_name
ORDER BY photo_count DESC;
```

```sql
-- Thumbnail strip for a project on a date (first 10)
SELECT thumb_path, time_taken, original_name
FROM site_photos
WHERE project_id = $1 AND photo_date = $2
ORDER BY time_taken ASC NULLS LAST
LIMIT 10;
```

---

#### D3. Site Safety Entries

| | |
|---|---|
| **What it shows** | All safety-related entries for the day across all projects. Filterable by project. Each shows: project name, description, CM name. Safety entries are high-visibility — Danny needs to confirm CMs are logging them. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Real-time |
| **Priority** | Must-have |

```sql
-- All safety entries for a date
SELECT
  sle.id,
  p.name AS project_name,
  sle.project_area,
  sle.description,
  sle.construction_manager,
  sle.created_at
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date = '2026-02-20'
  AND (sle.project_area ILIKE 'Job Log Site Safety%'
       OR sle.project_area ILIKE 'Job Log Safety%')
ORDER BY sle.created_at DESC;
```

---

#### D4. Daily Entry Counts Heatmap

| | |
|---|---|
| **What it shows** | Grid: rows = projects, columns = today's metrics. Columns: total entries, safety entry (yes/no), attendance entry (yes/no), Walden General (yes/no), photos uploaded, Smartsheet submitted (yes/partial/no). Color-coded cells: green = done, red = missing, yellow = partial. |
| **Tables** | `site_log_entries`, `site_photos`, `projects` |
| **Update frequency** | Every 2 minutes |
| **Priority** | Must-have |

```sql
-- Per-project daily completeness check
SELECT
  p.id AS project_id,
  p.name AS project_name,
  COUNT(sle.id) AS total_entries,
  BOOL_OR(sle.project_area ILIKE 'Job Log Site Safety%'
          OR sle.project_area ILIKE 'Job Log Safety%') AS has_safety,
  BOOL_OR(sle.project_area = 'Job Log Daily Attendance') AS has_attendance,
  BOOL_OR(sle.project_area = 'Job Log Walden General') AS has_walden_general,
  BOOL_OR(sle.project_area = 'End Of Day Close Up') AS has_close_up,
  COUNT(*) FILTER (WHERE sle.smartsheet_submitted) AS submitted_count,
  (SELECT COUNT(*) FROM site_photos sp
   WHERE sp.project_id = p.id AND sp.photo_date = '2026-02-20') AS photo_count
FROM projects p
LEFT JOIN site_log_entries sle
  ON sle.project_id = p.id AND sle.entry_date = '2026-02-20'
GROUP BY p.id, p.name
ORDER BY p.name;
```

---

#### D5. Job Log Entry Browser

| | |
|---|---|
| **What it shows** | Full list of today's entries across all projects, grouped by project. Expandable/collapsible project sections. Each entry shows: project_area, section_code, description, CM name, Smartsheet status. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Real-time |
| **Priority** | Must-have |

```sql
-- All entries for a date, with project names
SELECT
  sle.*,
  p.name AS project_name
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date = '2026-02-20'
ORDER BY p.name, sle.project_area, sle.section_code;
```

---

### B. Suggested Additional Components for Danny

#### D6. Unsubmitted Entries Alert

| | |
|---|---|
| **What it shows** | Projects where entries exist but haven't been submitted to Smartsheet. Danny can nudge CMs to submit. |
| **Tables** | `site_log_entries` |
| **Priority** | Nice-to-have |
| **Why** | Danny's role is production monitoring — unsubmitted entries mean the Smartsheet (which others rely on) is incomplete. |

```sql
SELECT
  p.name,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE sle.smartsheet_submitted) AS submitted,
  COUNT(*) FILTER (WHERE NOT sle.smartsheet_submitted) AS pending
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date = '2026-02-20'
GROUP BY p.name
HAVING COUNT(*) FILTER (WHERE NOT sle.smartsheet_submitted) > 0
ORDER BY pending DESC;
```

---

#### D7. Meeting Recordings Feed

| | |
|---|---|
| **What it shows** | Recent meeting recordings across all projects — meeting type, duration, entry/action counts extracted. Gives Danny visibility into what meetings are happening and what came out of them. |
| **Tables** | `site_meetings`, `projects` |
| **Priority** | Nice-to-have |
| **Why** | Meetings produce entries and action items. Danny should see that meetings are being recorded and processed. |

```sql
SELECT
  sm.id,
  p.name AS project_name,
  sm.meeting_type,
  sm.meeting_date,
  sm.audio_duration_seconds,
  sm.entry_count,
  sm.punch_list_count,
  sm.action_item_count,
  sm.context_note,
  sm.created_at
FROM site_meetings sm
JOIN projects p ON p.id = sm.project_id
WHERE sm.meeting_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY sm.created_at DESC
LIMIT 20;
```

---

#### D8. Photo Gallery Quick-View

| | |
|---|---|
| **What it shows** | Scrollable photo grid for a selected project (from D2), with date grouping and ability to view full-size. Read-only — no editing. Uses Supabase Storage public URLs. |
| **Tables** | `site_photos`, Supabase Storage (`site-photos` bucket) |
| **Priority** | Nice-to-have |
| **Why** | Danny wants to see what's actually on site without opening SiteLog. Photo data is already public-read. |

```sql
-- Photos for a project, last 7 days, newest first
SELECT
  id, photo_date, file_path, thumb_path, time_taken,
  original_name, uploaded_by_name, client_visible
FROM site_photos
WHERE project_id = $1
  AND photo_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY photo_date DESC, time_taken ASC NULLS LAST;
```

---

## Bruce — Executive Dashboard

> "Is everyone using the system? Are projects on track?"

### A. Recommended Dashboard Components

#### B1. Cross-Project Overview Grid

| | |
|---|---|
| **What it shows** | One row per project. Columns: project name, assigned CM, entries today, notes today, photos today, emails today, Looms today, open action items, overdue action items, CM last active. Color-code: green rows = active, grey = no activity, red badge on overdue. |
| **Tables** | `projects`, `site_log_entries`, `cm_notes`, `site_photos`, `cm_emails`, `cm_action_items`, `usage_logs`, `cm_users` (via RPC) |
| **Update frequency** | Every 5 minutes |
| **Priority** | Must-have |

```sql
-- This mirrors SiteLog's getProjectOverview() but as a single efficient query
-- Best implemented as a database view or RPC (see section 9/10)
WITH day_entries AS (
  SELECT project_id, COUNT(*) AS cnt
  FROM site_log_entries WHERE entry_date = $1
  GROUP BY project_id
),
day_notes AS (
  SELECT project_id, COUNT(*) AS cnt
  FROM cm_notes WHERE note_date = $1
  GROUP BY project_id
),
day_photos AS (
  SELECT project_id, COUNT(*) AS cnt
  FROM site_photos WHERE photo_date = $1
  GROUP BY project_id
),
day_emails AS (
  SELECT project_id, COUNT(*) AS cnt
  FROM cm_emails
  WHERE created_at >= ($1 || 'T00:00:00')::timestamptz
    AND created_at < (($1::date + 1) || 'T00:00:00')::timestamptz
  GROUP BY project_id
),
day_looms AS (
  SELECT project_id, COUNT(DISTINCT details->>'loom_url') AS cnt
  FROM usage_logs
  WHERE action IN ('loom_processed', 'loom_submitted')
    AND created_at >= ($1 || 'T00:00:00')::timestamptz
    AND created_at < (($1::date + 1) || 'T00:00:00')::timestamptz
  GROUP BY project_id
),
open_actions AS (
  SELECT project_id,
    COUNT(*) AS open_cnt,
    COUNT(*) FILTER (WHERE due_date < CURRENT_DATE) AS overdue_cnt
  FROM cm_action_items WHERE completed = false
  GROUP BY project_id
)
SELECT
  p.id, p.name,
  COALESCE(de.cnt, 0) AS entries_today,
  COALESCE(dn.cnt, 0) AS notes_today,
  COALESCE(dp.cnt, 0) AS photos_today,
  COALESCE(dem.cnt, 0) AS emails_today,
  COALESCE(dl.cnt, 0) AS looms_today,
  COALESCE(oa.open_cnt, 0) AS open_action_items,
  COALESCE(oa.overdue_cnt, 0) AS overdue_items
FROM projects p
LEFT JOIN day_entries de ON de.project_id = p.id
LEFT JOIN day_notes dn ON dn.project_id = p.id
LEFT JOIN day_photos dp ON dp.project_id = p.id
LEFT JOIN day_emails dem ON dem.project_id = p.id
LEFT JOIN day_looms dl ON dl.project_id = p.id
LEFT JOIN open_actions oa ON oa.project_id = p.id
ORDER BY p.name;
```

> **Note:** CM → project mapping requires calling `list_cm_users()` RPC (admin only) and joining `assigned_projects` arrays client-side, or creating a new RPC/view that exposes this mapping. See [New RPC Functions](#new-rpc-functions).

---

#### B2. CM Activity Scorecard

| | |
|---|---|
| **What it shows** | One card per CM. Shows: name, assigned projects, last login time, today's activity counts (recordings, entries processed, submissions, emails, photos uploaded, Looms). Red badge if last login > 24h ago. |
| **Tables** | `cm_users` (via RPC), `usage_logs` |
| **Update frequency** | Every 5 minutes |
| **Priority** | Must-have |

```sql
-- Per-CM activity counts for a date
SELECT
  ul.user_id,
  ul.user_name,
  COUNT(*) FILTER (WHERE ul.action = 'recording_saved') AS recordings,
  COUNT(*) FILTER (WHERE ul.action = 'process_recordings') AS processing_runs,
  COUNT(*) FILTER (WHERE ul.action = 'submit_smartsheet') AS submissions,
  COUNT(*) FILTER (WHERE ul.action = 'email_drafted') AS emails,
  COUNT(*) FILTER (WHERE ul.action = 'loom_processed') AS looms,
  COUNT(*) FILTER (WHERE ul.action = 'search') AS searches,
  COUNT(*) FILTER (WHERE ul.action = 'meeting_recorded') AS meetings,
  MAX(ul.created_at) AS last_action_at
FROM usage_logs ul
WHERE ul.created_at >= '2026-02-20T00:00:00'
  AND ul.created_at < '2026-02-21T00:00:00'
  AND ul.user_id IS NOT NULL
GROUP BY ul.user_id, ul.user_name
ORDER BY ul.user_name;
```

---

#### B3. Entry Volume Trend Chart

| | |
|---|---|
| **What it shows** | Line or bar chart: X = dates (last 30 days), Y = total entry count. Stacked by project or shown as separate lines. Shows whether production is steady, ramping up, or dropping off. |
| **Tables** | `site_log_entries` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Entry counts per project per day, last 30 days
SELECT
  sle.entry_date,
  p.name AS project_name,
  COUNT(*) AS entry_count
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sle.entry_date, p.name
ORDER BY sle.entry_date, p.name;
```

---

#### B4. App Adoption Metrics

| | |
|---|---|
| **What it shows** | Weekly summary: unique active CMs, total recordings made, total entries created, total photos uploaded, total Smartsheet submissions, total Looms. Compared to previous week (with trend arrows). |
| **Tables** | `usage_logs`, `site_log_entries`, `site_photos` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Weekly usage summary (current vs previous)
WITH weeks AS (
  SELECT
    CASE
      WHEN created_at >= date_trunc('week', CURRENT_DATE) THEN 'current'
      ELSE 'previous'
    END AS week_label,
    user_id,
    action
  FROM usage_logs
  WHERE created_at >= date_trunc('week', CURRENT_DATE) - INTERVAL '7 days'
)
SELECT
  week_label,
  COUNT(DISTINCT user_id) AS active_users,
  COUNT(*) FILTER (WHERE action = 'recording_saved') AS recordings,
  COUNT(*) FILTER (WHERE action = 'process_recordings') AS processing_runs,
  COUNT(*) FILTER (WHERE action = 'submit_smartsheet') AS submissions,
  COUNT(*) FILTER (WHERE action = 'loom_processed') AS looms,
  COUNT(*) FILTER (WHERE action = 'email_drafted') AS emails
FROM weeks
GROUP BY week_label;
```

---

#### B5. Overdue Action Items Summary

| | |
|---|---|
| **What it shows** | Count of overdue items per project (bar chart) + list of the oldest overdue items across all projects. Click to expand per project. |
| **Tables** | `cm_action_items`, `projects` |
| **Update frequency** | Hourly |
| **Priority** | Must-have |

```sql
-- Overdue action items per project
SELECT
  p.name AS project_name,
  COUNT(*) AS overdue_count,
  MIN(ai.due_date) AS oldest_due_date
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false
  AND ai.due_date < CURRENT_DATE
GROUP BY p.name
ORDER BY overdue_count DESC;

-- Top 20 oldest overdue items
SELECT
  ai.id, ai.description, ai.due_date, ai.item_date,
  ai.construction_manager,
  p.name AS project_name,
  CURRENT_DATE - ai.due_date AS days_overdue
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false AND ai.due_date < CURRENT_DATE
ORDER BY ai.due_date ASC
LIMIT 20;
```

---

### B. Suggested Additional Components for Bruce

#### B6. Smartsheet Submission Compliance

| | |
|---|---|
| **What it shows** | For each project and date (last 14 days): were entries submitted to Smartsheet? Heatmap grid — green if all submitted, yellow if partial, red if entries exist but none submitted, grey if no entries. |
| **Tables** | `site_log_entries`, `projects` |
| **Priority** | Nice-to-have |
| **Why** | Bruce cares about the system working end-to-end. If CMs record but don't submit, Smartsheet data is incomplete and downstream reporting breaks. |

```sql
SELECT
  p.name AS project_name,
  sle.entry_date,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE sle.smartsheet_submitted) AS submitted,
  CASE
    WHEN COUNT(*) = 0 THEN 'none'
    WHEN COUNT(*) = COUNT(*) FILTER (WHERE sle.smartsheet_submitted) THEN 'complete'
    WHEN COUNT(*) FILTER (WHERE sle.smartsheet_submitted) > 0 THEN 'partial'
    ELSE 'pending'
  END AS status
FROM projects p
LEFT JOIN site_log_entries sle
  ON sle.project_id = p.id
  AND sle.entry_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY p.name, sle.entry_date
ORDER BY p.name, sle.entry_date DESC;
```

---

#### B7. CM Login Recency

| | |
|---|---|
| **What it shows** | Simple table: CM name, last login time, days since last login. Red highlight if > 2 days without login. |
| **Tables** | `cm_users` (via new dashboard RPC — see section 10) |
| **Priority** | Nice-to-have |
| **Why** | Quick check that all CMs are using the tool. A CM who hasn't logged in is a red flag. |

---

#### B8. Photo Volume Tracker

| | |
|---|---|
| **What it shows** | Per-project photo totals over time (cumulative line chart). Plus daily upload counts. Helps Bruce see which projects are well-documented. |
| **Tables** | `site_photos` |
| **Priority** | Nice-to-have |
| **Why** | Photo documentation is a contractual requirement for many projects. Low photo counts signal risk. |

```sql
-- Daily photo uploads per project, last 30 days
SELECT
  sp.photo_date,
  p.name AS project_name,
  COUNT(*) AS photos_uploaded
FROM site_photos sp
JOIN projects p ON p.id = sp.project_id
WHERE sp.photo_date >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY sp.photo_date, p.name
ORDER BY sp.photo_date DESC, p.name;
```

---

## Doron — Admin / Financial Dashboard

> "What's the financial status across projects?"

### A. Recommended Dashboard Components

#### F1. Tracker Entry Feed

| | |
|---|---|
| **What it shows** | All "Tracker" entries across projects (these contain cost, T&M, and budget data). Grouped by project, filterable by date range. Each card shows: project name, tracker category (Demolition Costs, Shoring Costs, etc.), full description (which often contains dollar amounts and calculations), date, CM name. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Hourly |
| **Priority** | Must-have |

```sql
-- All Tracker entries, last 30 days
SELECT
  sle.id,
  p.name AS project_name,
  sle.project_area,
  sle.section_code,
  sle.description,
  sle.construction_manager,
  sle.entry_date,
  sle.smartsheet_submitted,
  sle.created_at
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.project_area ILIKE 'Tracker%'
  AND sle.entry_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY sle.entry_date DESC, p.name;
```

---

#### F2. Tracker Summary by Category

| | |
|---|---|
| **What it shows** | Aggregated view: for each tracker category (Demolition Costs, Shoring Costs, etc.), count of entries per project. Table format. Helps Doron see which cost categories are active where. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Tracker entries grouped by category and project
SELECT
  sle.project_area AS tracker_category,
  p.name AS project_name,
  COUNT(*) AS entry_count,
  MIN(sle.entry_date) AS first_entry,
  MAX(sle.entry_date) AS last_entry
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.project_area ILIKE 'Tracker%'
GROUP BY sle.project_area, p.name
ORDER BY sle.project_area, p.name;
```

---

#### F3. Smartsheet Submission Status

| | |
|---|---|
| **What it shows** | Per-project: total entries vs submitted entries for a date range. Doron needs to know that data is flowing to Smartsheet (which feeds financial tracking). |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Submission status per project, last 7 days
SELECT
  p.name AS project_name,
  sle.entry_date,
  COUNT(*) AS total_entries,
  COUNT(*) FILTER (WHERE sle.smartsheet_submitted) AS submitted,
  COUNT(*) FILTER (WHERE NOT sle.smartsheet_submitted) AS pending
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY p.name, sle.entry_date
ORDER BY p.name, sle.entry_date DESC;
```

---

#### F4. Email / Communication Log

| | |
|---|---|
| **What it shows** | All CM emails across projects. Shows: project name, CM name, recipient, subject, status (draft/sent), date. Link to Google Doc if available. Doron can see what's being communicated to vendors. |
| **Tables** | `cm_emails`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Nice-to-have |

```sql
SELECT
  e.id,
  p.name AS project_name,
  e.construction_manager,
  e.recipient_name,
  e.recipient_company,
  e.subject,
  e.status,
  e.doc_url,
  e.created_at
FROM cm_emails e
JOIN projects p ON p.id = e.project_id
ORDER BY e.created_at DESC
LIMIT 50;
```

---

### B. Suggested Additional Components for Doron

#### F5. Contract Info Panel (Future)

| | |
|---|---|
| **What it shows** | Placeholder for when the Contract Info feature is built. Will show contract values, change orders, milestone completion percentages per project. |
| **Tables** | Future `contract_info` table (not yet created) |
| **Priority** | Placeholder — build the frame now, wire up data later |
| **Why** | Doron's primary need. Having the panel ready means it lights up immediately when the Contract Info table is populated. |

---

#### F6. Weekly Plan Review

| | |
|---|---|
| **What it shows** | Weekly plans that have been submitted to Smartsheet. These are stored as `site_log_entries` with `project_area = 'Weekly Plan (For the coming week)'`. Shows the full 10-section description for each project. |
| **Tables** | `site_log_entries` |
| **Priority** | Nice-to-have |
| **Why** | Weekly plans contain forward-looking cost and trade scheduling info that's relevant to Doron's financial oversight. |

```sql
SELECT
  p.name AS project_name,
  sle.description,
  sle.entry_date,
  sle.construction_manager
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.project_area = 'Weekly Plan (For the coming week)'
  AND sle.entry_date >= CURRENT_DATE - INTERVAL '14 days'
ORDER BY sle.entry_date DESC, p.name;
```

---

#### F7. Vendor Activity Matrix

| | |
|---|---|
| **What it shows** | Cross-reference vendors mentioned in entries with projects. Built by searching `site_log_entries.description` for known vendor names from the `vendors` table. Shows which vendors are active on which projects. |
| **Tables** | `site_log_entries`, `vendors`, `projects` |
| **Priority** | Nice-to-have (complex query) |
| **Why** | Doron needs to understand vendor exposure across projects for financial planning. |

```sql
-- Vendor mentions in entries (last 14 days)
-- Note: this is a text search approach; consider a materialized view for performance
SELECT
  v.common_name AS vendor,
  v.company_name,
  v.trade_category,
  p.name AS project_name,
  COUNT(*) AS mention_count,
  MAX(sle.entry_date) AS last_mentioned
FROM vendors v
JOIN site_log_entries sle
  ON sle.description ILIKE '%' || v.common_name || '%'
JOIN projects p ON p.id = sle.project_id
WHERE sle.entry_date >= CURRENT_DATE - INTERVAL '14 days'
GROUP BY v.common_name, v.company_name, v.trade_category, p.name
ORDER BY v.common_name, p.name;
```

---

## Vuk & Nead — CM Support Dashboard

> "What needs attention that a CM might have missed?"

### A. Recommended Dashboard Components

#### S1. Overdue Action Items Board

| | |
|---|---|
| **What it shows** | All open action items past their due date, sorted by most overdue. Columns: project name, description, CM, due date, days overdue, date created. Filterable by project. This is the #1 widget — things that are explicitly late. |
| **Tables** | `cm_action_items`, `projects` |
| **Update frequency** | Hourly |
| **Priority** | Must-have |

```sql
SELECT
  ai.id,
  p.name AS project_name,
  ai.description,
  ai.construction_manager,
  ai.due_date,
  ai.item_date AS created_date,
  CURRENT_DATE - ai.due_date AS days_overdue
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false
  AND ai.due_date IS NOT NULL
  AND ai.due_date < CURRENT_DATE
ORDER BY ai.due_date ASC;
```

---

#### S2. Stale Open Items

| | |
|---|---|
| **What it shows** | Open action items that have NO due date AND were created more than 7 days ago. These are items that might be falling through the cracks because nobody set a due date. Sortable by age. |
| **Tables** | `cm_action_items`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
SELECT
  ai.id,
  p.name AS project_name,
  ai.description,
  ai.construction_manager,
  ai.item_date AS created_date,
  CURRENT_DATE - ai.item_date AS days_old
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false
  AND ai.due_date IS NULL
  AND ai.item_date < CURRENT_DATE - INTERVAL '7 days'
ORDER BY ai.item_date ASC;
```

---

#### S3. Open Action Items by Project

| | |
|---|---|
| **What it shows** | Summary bar chart: open action item count per project, broken into "overdue" (red) and "on-track" (yellow) segments. Click a bar to expand into the full list. |
| **Tables** | `cm_action_items`, `projects` |
| **Update frequency** | Hourly |
| **Priority** | Must-have |

```sql
SELECT
  p.name AS project_name,
  p.id AS project_id,
  COUNT(*) AS total_open,
  COUNT(*) FILTER (WHERE ai.due_date < CURRENT_DATE) AS overdue,
  COUNT(*) FILTER (WHERE ai.due_date >= CURRENT_DATE) AS on_track,
  COUNT(*) FILTER (WHERE ai.due_date IS NULL) AS no_due_date
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false
GROUP BY p.name, p.id
ORDER BY total_open DESC;
```

---

#### S4. Punch List / Deficiency Tracker

| | |
|---|---|
| **What it shows** | All entries with punch list dropdown values across projects. These come from meeting transcripts (contractor walkthroughs) and are stored as regular `site_log_entries` with `project_area` matching `*Punch List*` patterns. Grouped by project, newest first. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- All punch list entries across projects
SELECT
  sle.id,
  p.name AS project_name,
  sle.project_area,
  sle.description,
  sle.construction_manager,
  sle.entry_date,
  sle.created_at
FROM site_log_entries sle
JOIN projects p ON p.id = sle.project_id
WHERE sle.project_area ILIKE '%Punch List%'
ORDER BY sle.entry_date DESC, p.name;
```

---

#### S5. Unreviewed Meeting Items

| | |
|---|---|
| **What it shows** | Items from the Transcript Manager (`transcript_items` where `item_type = 'cm_todo'`) that have NOT been accepted or dismissed by ANY CM yet. These are meeting action items sitting in limbo. |
| **Tables** | `transcript_items`, `transcripts`, `meeting_item_reviews`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Unreviewed meeting items (not accepted/dismissed by anyone)
SELECT
  ti.id,
  ti.description,
  ti.assignee,
  t.title AS meeting_title,
  t.meeting_date,
  p.name AS project_name
FROM transcript_items ti
JOIN transcripts t ON t.id = ti.transcript_id
JOIN projects p ON p.id = t.project_id
WHERE ti.item_type = 'cm_todo'
  AND NOT EXISTS (
    SELECT 1 FROM meeting_item_reviews mir
    WHERE mir.transcript_item_id = ti.id
  )
ORDER BY t.meeting_date DESC;
```

---

#### S6. Projects Without Recent Activity

| | |
|---|---|
| **What it shows** | Projects that have had no entries in the last 2 business days. If a project is active but nothing is being logged, something's wrong. |
| **Tables** | `site_log_entries`, `projects` |
| **Update frequency** | Daily |
| **Priority** | Must-have |

```sql
-- Projects with no entries in last 2 days
SELECT
  p.id,
  p.name,
  MAX(sle.entry_date) AS last_entry_date,
  CURRENT_DATE - MAX(sle.entry_date) AS days_since_entry
FROM projects p
LEFT JOIN site_log_entries sle ON sle.project_id = p.id
GROUP BY p.id, p.name
HAVING MAX(sle.entry_date) IS NULL
   OR MAX(sle.entry_date) < CURRENT_DATE - INTERVAL '2 days'
ORDER BY last_entry_date ASC NULLS FIRST;
```

---

### B. Suggested Additional Components for Vuk & Nead

#### S7. Flagging System

| | |
|---|---|
| **What it shows** | Coordinators can flag any action item, entry, or punch list item for follow-up. A badge shows on flagged items. Flags have an optional note. This is the dashboard's first write operation (to its own `dashboard_flags` table). |
| **Tables** | `dashboard_flags` (new), any SiteLog table (read-only join) |
| **Priority** | Nice-to-have (requires new table) |
| **Why** | Coordinators need a way to track what they've identified without modifying SiteLog data. |

```sql
-- Get all active flags with item details
SELECT
  df.id AS flag_id,
  df.item_type,
  df.item_id,
  df.note,
  df.flagged_by,
  df.created_at,
  CASE df.item_type
    WHEN 'action_item' THEN ai.description
    WHEN 'entry' THEN sle.description
  END AS item_description,
  CASE df.item_type
    WHEN 'action_item' THEN p_ai.name
    WHEN 'entry' THEN p_sle.name
  END AS project_name
FROM dashboard_flags df
LEFT JOIN cm_action_items ai ON df.item_type = 'action_item' AND df.item_id = ai.id
LEFT JOIN projects p_ai ON ai.project_id = p_ai.id
LEFT JOIN site_log_entries sle ON df.item_type = 'entry' AND df.item_id = sle.id
LEFT JOIN projects p_sle ON sle.project_id = p_sle.id
WHERE df.resolved = false
ORDER BY df.created_at DESC;
```

---

#### S8. Schedule Item Compliance

| | |
|---|---|
| **What it shows** | Upcoming schedule items (next 7 days) across all projects, plus overdue uncompleted schedule items. Helps coordinators see what's coming up that a CM might not be prepared for. |
| **Tables** | `cm_schedule_items`, `projects` |
| **Priority** | Nice-to-have |
| **Why** | Schedule items represent commitments (inspections, deliveries, concrete pours). If one is missed, it has cascading effects. |

```sql
-- Upcoming and overdue schedule items
SELECT
  si.id,
  p.name AS project_name,
  si.title,
  si.description,
  si.schedule_date,
  si.schedule_time,
  si.category,
  si.completed,
  si.construction_manager,
  CASE
    WHEN si.schedule_date < CURRENT_DATE AND NOT si.completed THEN 'overdue'
    WHEN si.schedule_date = CURRENT_DATE THEN 'today'
    ELSE 'upcoming'
  END AS status
FROM cm_schedule_items si
JOIN projects p ON p.id = si.project_id
WHERE (si.schedule_date >= CURRENT_DATE - INTERVAL '3 days'
       AND si.schedule_date <= CURRENT_DATE + INTERVAL '7 days')
  OR (si.completed = false AND si.schedule_date < CURRENT_DATE)
ORDER BY si.schedule_date, si.schedule_time NULLS LAST;
```

---

#### S9. Action Item Completion Rate

| | |
|---|---|
| **What it shows** | Per-CM and per-project: how many action items were created vs completed in the last 30 days. Helps identify CMs who are accumulating items without closing them. |
| **Tables** | `cm_action_items`, `projects` |
| **Priority** | Nice-to-have |
| **Why** | Trending action item backlogs indicate a CM is overwhelmed or dropping tasks. |

```sql
SELECT
  ai.construction_manager,
  p.name AS project_name,
  COUNT(*) FILTER (WHERE ai.item_date >= CURRENT_DATE - INTERVAL '30 days') AS created_30d,
  COUNT(*) FILTER (WHERE ai.completed AND ai.completed_at >= (CURRENT_DATE - INTERVAL '30 days')::timestamptz) AS completed_30d,
  COUNT(*) FILTER (WHERE NOT ai.completed) AS currently_open
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
GROUP BY ai.construction_manager, p.name
ORDER BY currently_open DESC;
```

---

## Shared Components

These components appear on multiple dashboards.

### SC1. Project Selector

| | |
|---|---|
| **What it shows** | Dropdown or pill selector to filter the entire dashboard by one or all projects. |
| **Tables** | `projects` |
| **Used by** | All four dashboards |

```sql
SELECT id, name, status FROM projects ORDER BY name;
```

---

### SC2. Date Range Picker

| | |
|---|---|
| **What it shows** | Calendar or preset picker (Today, Last 7 Days, Last 30 Days, Custom Range). Changes the date context for all components on the dashboard. |
| **Tables** | None (UI-only, passes date params to all queries) |
| **Used by** | All four dashboards |

---

### SC3. Header Stats Bar

| | |
|---|---|
| **What it shows** | Top-level metric cards shown at the top of every dashboard. Each dashboard shows different stats, but the component shell is shared. Example for Danny: "14 Entries Today | 3 Looms | 47 Photos | 2 Safety Logged". Example for Bruce: "5 Active CMs | 87 Entries | 4 Overdue Items". |
| **Tables** | Various (depends on role) |
| **Used by** | All four dashboards |

---

### SC4. Project Activity Indicator

| | |
|---|---|
| **What it shows** | Small colored dot next to each project name — green (active today), yellow (active this week), grey (no recent activity). Reusable inline component. |
| **Tables** | `site_log_entries` (MAX entry_date per project) |
| **Used by** | All dashboards wherever project names appear |

```sql
SELECT
  p.id,
  p.name,
  MAX(sle.entry_date) AS last_entry_date,
  CASE
    WHEN MAX(sle.entry_date) = CURRENT_DATE THEN 'active'
    WHEN MAX(sle.entry_date) >= CURRENT_DATE - INTERVAL '7 days' THEN 'recent'
    ELSE 'inactive'
  END AS activity_status
FROM projects p
LEFT JOIN site_log_entries sle ON sle.project_id = p.id
GROUP BY p.id, p.name;
```

---

### SC5. Notification Badge System

| | |
|---|---|
| **What it shows** | Red badges on nav items when attention is needed. Danny: unreviewed Looms. Bruce: inactive CMs. Vuk/Nead: new overdue items since last visit. |
| **Tables** | `dashboard_last_seen` (new), plus role-specific queries |
| **Used by** | All dashboards |

---

## Data Access Patterns

### Existing Functions / RPCs That Can Be Reused

| Existing | Usable By Dashboard? | Notes |
|----------|----------------------|-------|
| `list_cm_users(caller_id)` | Partially | Requires an admin user ID. Dashboard needs its own admin-like access. Consider creating `dashboard_list_cm_users()` that only returns non-sensitive fields. |
| `getProjects()` | Yes | Direct Supabase query, no RPC needed. |
| `getDailySummary(date)` | Pattern reusable | The logic is useful but it's a client-side function. Re-implement server-side. |
| `getProjectOverview(date, userId)` | Pattern reusable | Same — 9 parallel queries, useful pattern but dashboard should have its own RPC or view. |

### Queries That Need New RPCs or Views

| Need | Why | Recommendation |
|------|-----|----------------|
| CM → Project mapping without PIN hash | `cm_users` has no anon SELECT policy | New RPC: `dashboard_get_cm_project_map()` |
| Cross-project daily stats | Too many round trips from client | New RPC: `dashboard_project_overview(date)` |
| Overdue action item counts | Used by multiple dashboards | New DB view: `v_overdue_action_items` |
| Tracker entry aggregation | Doron needs this frequently | New DB view: `v_tracker_entries` |
| Entry completeness check | Danny's heatmap needs complex logic | New RPC: `dashboard_daily_completeness(date)` |

### Read-Only Access Rules

The dashboard app should:

1. **Use its own Supabase client** with the same anon key (all SiteLog tables have anon SELECT policies).
2. **NEVER insert/update/delete** on: `site_log_entries`, `cm_notes`, `cm_action_items`, `cm_emails`, `voice_recordings`, `site_photos`, `photo_date_info`, `photo_collections`, `collection_items`, `cm_schedule_items`, `cm_users`, `vendors`, `usage_logs`, `project_smartsheet_mapping`, `site_meetings`, `transcript_items`, `meeting_item_reviews`.
3. **ONLY write to** tables prefixed with `dashboard_` (its own state).
4. Consider creating a **dedicated Supabase role** (not anon) with SELECT-only on SiteLog tables and full access on `dashboard_*` tables, for defense in depth.

---

## New Tables Needed

### 1. `dashboard_users`

Dashboard's own auth system. Separate from CM users.

```sql
CREATE TABLE dashboard_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text UNIQUE,
  pin_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('production', 'executive', 'financial', 'coordinator')),
  is_active boolean DEFAULT true,
  last_login timestamptz,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE dashboard_users ENABLE ROW LEVEL SECURITY;

-- No direct anon SELECT (same pattern as cm_users)
-- Auth via RPC only

-- Seed data
-- Danny = production, Bruce = executive, Doron = financial, Vuk/Nead = coordinator
INSERT INTO dashboard_users (name, pin_hash, role) VALUES
  ('Danny', crypt('XXXX', gen_salt('bf')), 'production'),
  ('Bruce', crypt('XXXX', gen_salt('bf')), 'executive'),
  ('Doron', crypt('XXXX', gen_salt('bf')), 'financial'),
  ('Vuk',   crypt('XXXX', gen_salt('bf')), 'coordinator'),
  ('Nead',  crypt('XXXX', gen_salt('bf')), 'coordinator');
```

---

### 2. `dashboard_loom_reviews`

Danny's Loom review tracking.

```sql
CREATE TABLE dashboard_loom_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_log_id uuid NOT NULL,          -- references usage_logs.id (the loom_processed/loom_submitted log entry)
  loom_url text NOT NULL,              -- the Loom video URL (for quick lookup)
  project_id uuid,                     -- denormalized for filtering
  reviewer_id uuid REFERENCES dashboard_users(id),
  reviewer_name text NOT NULL,
  reviewed_at timestamptz DEFAULT now(),
  notes text,                          -- optional review notes
  UNIQUE(loom_url, reviewer_id)        -- one review per person per Loom
);

ALTER TABLE dashboard_loom_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read dashboard_loom_reviews"
  ON dashboard_loom_reviews FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert dashboard_loom_reviews"
  ON dashboard_loom_reviews FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX idx_dashboard_loom_reviews_url ON dashboard_loom_reviews(loom_url);
CREATE INDEX idx_dashboard_loom_reviews_project ON dashboard_loom_reviews(project_id, reviewed_at DESC);
```

---

### 3. `dashboard_flags`

Coordinator flagging system for tracking items that need attention.

```sql
CREATE TABLE dashboard_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL CHECK (item_type IN ('action_item', 'entry', 'schedule_item', 'punch_list')),
  item_id uuid NOT NULL,                -- references the flagged item's id in its source table
  project_id uuid,                      -- denormalized for filtering
  note text,                            -- coordinator's note about why it's flagged
  flagged_by uuid REFERENCES dashboard_users(id),
  flagged_by_name text NOT NULL,
  resolved boolean DEFAULT false,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE dashboard_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read dashboard_flags"
  ON dashboard_flags FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert dashboard_flags"
  ON dashboard_flags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update dashboard_flags"
  ON dashboard_flags FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX idx_dashboard_flags_active ON dashboard_flags(resolved, created_at DESC) WHERE resolved = false;
CREATE INDEX idx_dashboard_flags_project ON dashboard_flags(project_id);
CREATE INDEX idx_dashboard_flags_item ON dashboard_flags(item_type, item_id);
```

---

### 4. `dashboard_last_seen`

Tracks when each dashboard user last viewed each section. Powers the notification badge system.

```sql
CREATE TABLE dashboard_last_seen (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES dashboard_users(id),
  section text NOT NULL,              -- e.g. 'looms', 'overdue_items', 'punch_list'
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, section)
);

ALTER TABLE dashboard_last_seen ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon read dashboard_last_seen"
  ON dashboard_last_seen FOR SELECT TO anon USING (true);
CREATE POLICY "Allow anon insert dashboard_last_seen"
  ON dashboard_last_seen FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Allow anon update dashboard_last_seen"
  ON dashboard_last_seen FOR UPDATE TO anon USING (true) WITH CHECK (true);
```

---

### 5. `dashboard_auth` (RPC)

Login function for dashboard users, same pattern as `authenticate_cm`.

```sql
CREATE OR REPLACE FUNCTION authenticate_dashboard_user(pin_input text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  found_user record;
BEGIN
  SELECT id, name, email, role
  INTO found_user
  FROM dashboard_users
  WHERE pin_hash = crypt(pin_input, pin_hash)
    AND is_active = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  UPDATE dashboard_users SET last_login = now() WHERE id = found_user.id;

  RETURN json_build_object(
    'id', found_user.id,
    'name', found_user.name,
    'email', found_user.email,
    'role', found_user.role
  );
END;
$$;
```

---

## Suggested Database Views

These views simplify dashboard queries and can be reused across multiple components.

### `v_daily_project_stats`

Used by: B1, Danny's heatmap, Bruce's overview.

```sql
CREATE OR REPLACE VIEW v_daily_project_stats AS
SELECT
  p.id AS project_id,
  p.name AS project_name,
  d.date AS stat_date,
  COALESCE(e.entry_count, 0) AS entry_count,
  COALESCE(e.submitted_count, 0) AS submitted_count,
  COALESCE(e.has_safety, false) AS has_safety,
  COALESCE(e.has_attendance, false) AS has_attendance,
  COALESCE(e.has_walden_general, false) AS has_walden_general,
  COALESCE(e.has_close_up, false) AS has_close_up,
  COALESCE(n.note_count, 0) AS note_count,
  COALESCE(ph.photo_count, 0) AS photo_count
FROM projects p
CROSS JOIN (SELECT CURRENT_DATE AS date) d
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) AS entry_count,
    COUNT(*) FILTER (WHERE smartsheet_submitted) AS submitted_count,
    BOOL_OR(project_area ILIKE 'Job Log Site Safety%' OR project_area ILIKE 'Job Log Safety%') AS has_safety,
    BOOL_OR(project_area = 'Job Log Daily Attendance') AS has_attendance,
    BOOL_OR(project_area = 'Job Log Walden General') AS has_walden_general,
    BOOL_OR(project_area = 'End Of Day Close Up') AS has_close_up
  FROM site_log_entries
  WHERE project_id = p.id AND entry_date = d.date
) e ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS note_count
  FROM cm_notes WHERE project_id = p.id AND note_date = d.date
) n ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS photo_count
  FROM site_photos WHERE project_id = p.id AND photo_date = d.date
) ph ON true;
```

> **Note:** This view uses `CURRENT_DATE` as a default. For date-range queries, use the parameterized RPC below instead.

---

### `v_open_action_items_summary`

Used by: S1, S2, S3, B5.

```sql
CREATE OR REPLACE VIEW v_open_action_items_summary AS
SELECT
  ai.id,
  ai.project_id,
  p.name AS project_name,
  ai.description,
  ai.construction_manager,
  ai.due_date,
  ai.item_date,
  ai.created_at,
  CASE
    WHEN ai.due_date IS NOT NULL AND ai.due_date < CURRENT_DATE THEN 'overdue'
    WHEN ai.due_date IS NULL AND ai.item_date < CURRENT_DATE - INTERVAL '7 days' THEN 'stale'
    WHEN ai.due_date IS NOT NULL THEN 'on_track'
    ELSE 'no_due_date'
  END AS status,
  CASE
    WHEN ai.due_date IS NOT NULL AND ai.due_date < CURRENT_DATE
    THEN CURRENT_DATE - ai.due_date
    ELSE NULL
  END AS days_overdue
FROM cm_action_items ai
JOIN projects p ON p.id = ai.project_id
WHERE ai.completed = false;
```

---

## New RPC Functions

### `dashboard_project_overview(target_date date)`

Replaces the 9-parallel-query pattern from SiteLog's `getProjectOverview()` with a single efficient server-side function.

```sql
CREATE OR REPLACE FUNCTION dashboard_project_overview(target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    WITH day_entries AS (
      SELECT project_id, COUNT(*) AS cnt,
        COUNT(*) FILTER (WHERE smartsheet_submitted) AS submitted,
        BOOL_OR(project_area ILIKE 'Job Log Site Safety%' OR project_area ILIKE 'Job Log Safety%') AS has_safety,
        BOOL_OR(project_area = 'Job Log Daily Attendance') AS has_attendance,
        BOOL_OR(project_area = 'Job Log Walden General') AS has_walden_general,
        BOOL_OR(project_area = 'End Of Day Close Up') AS has_close_up
      FROM site_log_entries WHERE entry_date = target_date
      GROUP BY project_id
    ),
    day_notes AS (
      SELECT project_id, COUNT(*) AS cnt FROM cm_notes WHERE note_date = target_date GROUP BY project_id
    ),
    day_photos AS (
      SELECT project_id, COUNT(*) AS cnt FROM site_photos WHERE photo_date = target_date GROUP BY project_id
    ),
    day_emails AS (
      SELECT project_id, COUNT(*) AS cnt FROM cm_emails
      WHERE created_at >= target_date::timestamptz AND created_at < (target_date + 1)::timestamptz
      GROUP BY project_id
    ),
    day_looms AS (
      SELECT project_id, COUNT(DISTINCT details->>'loom_url') AS cnt FROM usage_logs
      WHERE action IN ('loom_processed', 'loom_submitted')
        AND created_at >= target_date::timestamptz AND created_at < (target_date + 1)::timestamptz
      GROUP BY project_id
    ),
    open_actions AS (
      SELECT project_id,
        COUNT(*) AS open_cnt,
        COUNT(*) FILTER (WHERE due_date < CURRENT_DATE) AS overdue_cnt
      FROM cm_action_items WHERE completed = false
      GROUP BY project_id
    )
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        p.id, p.name,
        COALESCE(de.cnt, 0) AS entries_today,
        COALESCE(de.submitted, 0) AS submitted_today,
        COALESCE(de.has_safety, false) AS has_safety,
        COALESCE(de.has_attendance, false) AS has_attendance,
        COALESCE(de.has_walden_general, false) AS has_walden_general,
        COALESCE(de.has_close_up, false) AS has_close_up,
        COALESCE(dn.cnt, 0) AS notes_today,
        COALESCE(dp.cnt, 0) AS photos_today,
        COALESCE(dem.cnt, 0) AS emails_today,
        COALESCE(dl.cnt, 0) AS looms_today,
        COALESCE(oa.open_cnt, 0) AS open_action_items,
        COALESCE(oa.overdue_cnt, 0) AS overdue_items
      FROM projects p
      LEFT JOIN day_entries de ON de.project_id = p.id
      LEFT JOIN day_notes dn ON dn.project_id = p.id
      LEFT JOIN day_photos dp ON dp.project_id = p.id
      LEFT JOIN day_emails dem ON dem.project_id = p.id
      LEFT JOIN day_looms dl ON dl.project_id = p.id
      LEFT JOIN open_actions oa ON oa.project_id = p.id
      ORDER BY p.name
    ) r
  );
END;
$$;
```

---

### `dashboard_cm_activity(target_date date)`

Returns per-CM activity for a given date. Used by Bruce's CM Activity Scorecard (B2).

```sql
CREATE OR REPLACE FUNCTION dashboard_cm_activity(target_date date)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        cu.id AS user_id,
        cu.name,
        cu.role,
        cu.assigned_projects,
        cu.is_active,
        cu.last_login,
        COALESCE(ua.recordings, 0) AS recordings,
        COALESCE(ua.processing_runs, 0) AS processing_runs,
        COALESCE(ua.submissions, 0) AS submissions,
        COALESCE(ua.emails, 0) AS emails,
        COALESCE(ua.looms, 0) AS looms,
        COALESCE(ua.searches, 0) AS searches,
        COALESCE(ua.meetings, 0) AS meetings,
        ua.last_action_at
      FROM cm_users cu
      LEFT JOIN LATERAL (
        SELECT
          COUNT(*) FILTER (WHERE action = 'recording_saved') AS recordings,
          COUNT(*) FILTER (WHERE action = 'process_recordings') AS processing_runs,
          COUNT(*) FILTER (WHERE action = 'submit_smartsheet') AS submissions,
          COUNT(*) FILTER (WHERE action = 'email_drafted') AS emails,
          COUNT(*) FILTER (WHERE action = 'loom_processed') AS looms,
          COUNT(*) FILTER (WHERE action = 'search') AS searches,
          COUNT(*) FILTER (WHERE action = 'meeting_recorded') AS meetings,
          MAX(created_at) AS last_action_at
        FROM usage_logs
        WHERE user_id = cu.id
          AND created_at >= target_date::timestamptz
          AND created_at < (target_date + 1)::timestamptz
      ) ua ON true
      WHERE cu.is_active = true
      ORDER BY cu.name
    ) r
  );
END;
$$;
```

---

### `dashboard_entry_trends(days integer DEFAULT 30)`

Returns daily entry counts per project for charting. Used by Bruce's Entry Volume Trend (B3).

```sql
CREATE OR REPLACE FUNCTION dashboard_entry_trends(days integer DEFAULT 30)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT
        sle.entry_date,
        p.name AS project_name,
        COUNT(*) AS entry_count
      FROM site_log_entries sle
      JOIN projects p ON p.id = sle.project_id
      WHERE sle.entry_date >= CURRENT_DATE - (days || ' days')::interval
      GROUP BY sle.entry_date, p.name
      ORDER BY sle.entry_date, p.name
    ) r
  );
END;
$$;
```

---

### `dashboard_get_looms(target_date date)`

Returns all Loom videos for a date with review status. Used by Danny's Loom Feed (D1).

```sql
CREATE OR REPLACE FUNCTION dashboard_get_looms(target_date date)
RETURNS json
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN (
    SELECT json_agg(row_to_json(r))
    FROM (
      SELECT DISTINCT ON (ul.details->>'loom_url')
        ul.id AS log_id,
        ul.details->>'loom_url' AS loom_url,
        ul.user_name AS cm_name,
        ul.project_name,
        ul.project_id,
        ul.created_at,
        dlr.reviewed_at,
        dlr.reviewer_name,
        dlr.notes AS review_notes
      FROM usage_logs ul
      LEFT JOIN dashboard_loom_reviews dlr ON dlr.loom_url = ul.details->>'loom_url'
      WHERE ul.action IN ('loom_processed', 'loom_submitted')
        AND ul.created_at >= target_date::timestamptz
        AND ul.created_at < (target_date + 1)::timestamptz
        AND ul.details->>'loom_url' IS NOT NULL
      ORDER BY ul.details->>'loom_url', ul.created_at DESC
    ) r
  );
END;
$$;
```

---

## Component → Query Quick Reference

| Component | Role | Tables Read | Dashboard Table Written | New RPC/View Needed? |
|-----------|------|-------------|------------------------|---------------------|
| D1. Loom Video Feed | Danny | `usage_logs` | `dashboard_loom_reviews` | `dashboard_get_looms()` |
| D2. Photo Activity Summary | Danny | `site_photos`, `projects` | — | No |
| D3. Site Safety Entries | Danny | `site_log_entries`, `projects` | — | No |
| D4. Daily Entry Heatmap | Danny | `site_log_entries`, `site_photos`, `projects` | — | `dashboard_project_overview()` |
| D5. Entry Browser | Danny | `site_log_entries`, `projects` | — | No |
| D6. Unsubmitted Alert | Danny | `site_log_entries`, `projects` | — | No |
| D7. Meeting Feed | Danny | `site_meetings`, `projects` | — | No |
| D8. Photo Gallery | Danny | `site_photos`, Storage | — | No |
| B1. Project Overview Grid | Bruce | Multiple | — | `dashboard_project_overview()` |
| B2. CM Activity Scorecard | Bruce | `cm_users`, `usage_logs` | — | `dashboard_cm_activity()` |
| B3. Entry Volume Trends | Bruce | `site_log_entries`, `projects` | — | `dashboard_entry_trends()` |
| B4. App Adoption Metrics | Bruce | `usage_logs` | — | No (client-side agg) |
| B5. Overdue Items Summary | Bruce | `cm_action_items`, `projects` | — | `v_open_action_items_summary` |
| B6. Submission Compliance | Bruce | `site_log_entries`, `projects` | — | No |
| B7. CM Login Recency | Bruce | `cm_users` | — | `dashboard_cm_activity()` |
| B8. Photo Volume Tracker | Bruce | `site_photos`, `projects` | — | No |
| F1. Tracker Entry Feed | Doron | `site_log_entries`, `projects` | — | No |
| F2. Tracker by Category | Doron | `site_log_entries`, `projects` | — | No |
| F3. Submission Status | Doron | `site_log_entries`, `projects` | — | No |
| F4. Communication Log | Doron | `cm_emails`, `projects` | — | No |
| F5. Contract Info | Doron | Future table | — | Future |
| F6. Weekly Plan Review | Doron | `site_log_entries` | — | No |
| F7. Vendor Activity | Doron | `site_log_entries`, `vendors`, `projects` | — | Consider materialized view |
| S1. Overdue Items Board | Vuk/Nead | `cm_action_items`, `projects` | — | `v_open_action_items_summary` |
| S2. Stale Open Items | Vuk/Nead | `cm_action_items`, `projects` | — | `v_open_action_items_summary` |
| S3. Open Items by Project | Vuk/Nead | `cm_action_items`, `projects` | — | `v_open_action_items_summary` |
| S4. Punch List Tracker | Vuk/Nead | `site_log_entries`, `projects` | — | No |
| S5. Unreviewed Meeting Items | Vuk/Nead | `transcript_items`, `transcripts`, `meeting_item_reviews` | — | No |
| S6. Inactive Projects | Vuk/Nead | `site_log_entries`, `projects` | — | No |
| S7. Flagging System | Vuk/Nead | Multiple | `dashboard_flags` | No |
| S8. Schedule Compliance | Vuk/Nead | `cm_schedule_items`, `projects` | — | No |
| S9. Completion Rate | Vuk/Nead | `cm_action_items`, `projects` | — | No |
| SC5. Notification Badges | All | Various | `dashboard_last_seen` | No |

---

## 8. ARCHITECTURE RECOMMENDATIONS

### 8.1 Deployment: Separate App vs Route Within SiteLog

**Recommendation: Separate Vercel app with its own repo.**

**Why separate:**

| Factor | Separate App | Route Within SiteLog |
|--------|-------------|---------------------|
| User base | Office staff (5 people) | Field CMs (10+ people) |
| Usage pattern | Desktop browser, all day | Mobile, intermittent |
| Auth model | Email/password or magic link | 4-digit PIN |
| Data direction | Read-only consumer | Read-write producer |
| Deploy risk | Dashboard deploys can't break field app | Shared deploy pipeline |
| Bundle size | Dashboard-only code ships | Dashboard code bloats CM bundle |
| Development | Independent iteration | Coordinated releases |

The two apps share a Supabase backend but serve completely different users with different needs. A broken dashboard deploy should never prevent a CM from logging entries in the field. Separate repos mean separate CI/CD, separate error tracking, and independent release cadences.

**Practical setup:**
- Repo: `walden-dashboard` (or similar)
- Deploy: Vercel (free tier is sufficient for 5 users)
- Shared: Same Supabase project URL and anon key
- Environment: Own `.env.local` with Supabase credentials only (no Anthropic/OpenAI/AssemblyAI keys needed — dashboard does no AI processing)

**Tradeoff acknowledged:** Two repos means shared database types aren't automatically synced. Mitigate this by keeping the dashboard's Supabase queries simple and by documenting table schemas in `SITELOG-DATA-INVENTORY.md` (already done).

---

### 8.2 Auth Approach for Office Users

**Recommendation: Separate `dashboard_users` table with email + password, using Supabase Auth (optional) or a simple custom approach.**

**Why not the CM PIN system:**
- PINs are designed for speed on mobile — office users at desks don't need 4-digit fast entry
- CM PINs are stored in `cm_users` which has no anon SELECT policy — deliberately locked down
- Office users need persistent sessions (stay logged in for days), not the 7-day-then-re-PIN flow
- Role-based access (Danny sees different components than Doron) doesn't map to the CM model

**Two viable approaches, simplest first:**

#### Option A: Custom PIN/password auth (Recommended — matches SiteLog's pattern)

Use the `dashboard_users` table already spec'd in Section 6.1 with a `pin_hash` column and an `authenticate_dashboard_user()` RPC (also spec'd). This mirrors how SiteLog handles CM auth:

1. Office user enters email + password (or a 6-digit PIN for simplicity)
2. App calls `authenticate_dashboard_user(email, pin)` RPC
3. RPC returns user record with `role` field
4. App stores session in `localStorage` with expiry
5. Role determines which dashboard components render

**Pros:** Zero new dependencies, consistent with existing codebase patterns, works immediately with anon Supabase key.
**Cons:** Not "real" auth — no JWT, no RLS enforcement per-user. Acceptable because the dashboard is read-only and internal-only.

#### Option B: Supabase Auth (email magic links)

Use Supabase's built-in auth with magic links sent to office emails. No passwords to manage.

**Pros:** Proper JWT sessions, could enable per-user RLS in the future.
**Cons:** Requires Supabase Auth configuration, email provider setup (Supabase's built-in has rate limits), more complex client code, overkill for 5 known users.

**Verdict:** Go with Option A. You have 5 known users. A simple password/PIN table with a SECURITY DEFINER RPC is pragmatic, proven (it's how SiteLog already works), and takes an hour to implement.

---

### 8.3 Data Access Layer: Direct Reads vs Views/API

**Recommendation: Direct Supabase reads for most queries, with 2-3 database views for complex aggregations. No separate API layer.**

**Rationale:**

The dashboard is a read-only consumer of data that SiteLog produces. The simplest approach:

```
Dashboard (React) → Supabase JS client → PostgreSQL tables/views
```

Adding an API layer (Vercel serverless functions between the dashboard and Supabase) would mean:
- Writing and maintaining 30+ API endpoints for 33 components
- Extra latency (browser → Vercel → Supabase → Vercel → browser vs browser → Supabase → browser)
- Extra deploy/debug surface area
- No meaningful benefit — the data is already accessible via anon key + RLS

**Where views help:**

Create views for queries that join 3+ tables or require complex aggregations that multiple components share:

| View | Used By | Purpose |
|------|---------|---------|
| `v_daily_project_stats` | P1, E1, E2, E3, E4 | Pre-aggregated daily entry counts by project/CM |
| `v_open_action_items_summary` | S1, S2, S3, S9 | Open items with project names and age calculations |
| `v_cm_activity_summary` | E2, E5, E7 | Last login, last entry, entry counts per CM |

These views are already defined in Section 6 of this spec. They run server-side in PostgreSQL (fast), simplify client queries, and provide a stable interface even if underlying table columns change.

**What about schema coupling?**

The risk: if SiteLog changes a column name, the dashboard breaks. Mitigation:
- Views act as a contract — if a column renames, update the view definition, dashboard code unchanged
- The team is small (same people maintain both apps) — schema changes are communicated naturally
- Document breaking changes in the data inventory

**Verdict:** Direct reads + views. Skip the API layer entirely. It's unnecessary complexity for a 5-user internal tool.

---

### 8.4 Real-Time Updates

**Recommendation: Polling at 60-second intervals for most components. Supabase Realtime for 1-2 components where immediacy matters.**

**Why not full Realtime everywhere:**
- Supabase Realtime requires enabling replication on each table (admin config change)
- Each subscription is a persistent WebSocket — 33 components × multiple tables = connection overhead
- Most dashboard data (weekly trends, category breakdowns, compliance stats) doesn't need second-level freshness
- Supabase free tier has Realtime limits

**Tiered approach:**

| Tier | Refresh | Components | Implementation |
|------|---------|------------|----------------|
| **Live** | Supabase Realtime | P1 (Loom Feed), P3 (Safety Entries) — Danny wants to see new entries as CMs log them | `supabase.channel('entries').on('postgres_changes', ...)` |
| **Frequent** | 60-second polling | P2 (Photo Summary), E1 (Project Grid), S1 (Overdue Board) — things that change throughout the workday | `useEffect` with `setInterval` + `refetchQueries` |
| **Standard** | 5-minute polling or manual refresh | E3 (Entry Trends), F2 (Tracker Categories), S6 (Inactive Projects) — aggregations that don't shift minute-to-minute | Same `setInterval` pattern or refresh button |
| **Static** | On page load only | E4 (App Adoption), F5 (Contract Info) — rarely changing data | Fetch once in `useEffect` |

**Implementation pattern (polling):**

```javascript
function useDashboardQuery(queryFn, intervalMs = 60000) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const result = await queryFn();
      setData(result);
      setLoading(false);
    };
    fetch();
    const id = setInterval(fetch, intervalMs);
    return () => clearInterval(id);
  }, [queryFn, intervalMs]);

  return { data, loading };
}
```

**Implementation pattern (Realtime — only for Danny's live feed):**

```javascript
useEffect(() => {
  const channel = supabase
    .channel('new-entries')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'site_log_entries' },
      (payload) => {
        setEntries(prev => [payload.new, ...prev]);
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, []);
```

**Supabase config needed:** Enable Realtime on `site_log_entries` table only (Supabase Dashboard → Table → Enable Realtime toggle). No other tables need it.

**Verdict:** 60-second polling is the default. Add Realtime only to Danny's entry feed if he needs it. This can be upgraded later with zero architecture changes.

---

### 8.5 Tech Stack

**Recommendation: React + Vite + Vercel — match SiteLog exactly.**

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| **Framework** | React 18 | Same as SiteLog. Same mental model, same component patterns. No learning curve. |
| **Build tool** | Vite | Same as SiteLog. Fast dev server, simple config. |
| **Hosting** | Vercel | Same as SiteLog. Free tier handles 5 users easily. Automatic preview deploys for PRs. |
| **Supabase client** | `@supabase/supabase-js` | Same version as SiteLog. Shared Supabase project. |
| **Styling** | Tailwind CSS | Same as SiteLog. Utility classes are fast for dashboards. |
| **Charts** | Recharts | Lightweight, React-native charting. Covers bar charts, line charts, pie charts needed by E3, E4, F2, S9. ~45KB gzipped. |
| **Data grid/tables** | TanStack Table (optional) | Only if you need sortable/filterable tables. Otherwise plain `<table>` with Tailwind. |
| **State management** | React Context + hooks | No Redux needed. Dashboard state is simple: current project filter, date range, user role. |
| **Routing** | React Router v6 | 4-5 routes total (one per role dashboard + login). Minimal config. |

**What NOT to use:**
- **Next.js** — SSR is unnecessary for a 5-user internal dashboard. Adds complexity for no benefit.
- **Redux/Zustand** — The state is trivial (filters + cached query results). Context is enough.
- **GraphQL** — Supabase's PostgREST API is already a perfect fit for direct table reads.
- **Separate component library** — Tailwind + a few custom components is sufficient. No need for Material UI, Chakra, etc.

**Suggested project structure:**

```
walden-dashboard/
├── src/
│   ├── components/
│   │   ├── shared/          # ProjectSelector, DatePicker, StatsHeader
│   │   ├── danny/           # LoomFeed, PhotoSummary, SafetyEntries, ...
│   │   ├── bruce/           # ProjectGrid, CMScorecard, EntryTrends, ...
│   │   ├── doron/           # TrackerFeed, CategoryBreakdown, ...
│   │   └── vuk-nead/        # OverdueBoard, StaleItems, FlagSystem, ...
│   ├── hooks/
│   │   └── useDashboardQuery.js
│   ├── lib/
│   │   ├── supabase.js      # Supabase client init (copy from SiteLog)
│   │   └── queries.js       # All Supabase query functions
│   ├── pages/
│   │   ├── Login.jsx
│   │   ├── DannyDashboard.jsx
│   │   ├── BruceDashboard.jsx
│   │   ├── DoronDashboard.jsx
│   │   └── CoordinatorDashboard.jsx
│   ├── App.jsx
│   └── main.jsx
├── .env.local               # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY only
├── package.json
├── vite.config.js
├── tailwind.config.js
└── vercel.json
```

**Estimated dependencies (package.json):**

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.x",
    "react": "^18.x",
    "react-dom": "^18.x",
    "react-router-dom": "^6.x",
    "recharts": "^2.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "autoprefixer": "^10.x",
    "postcss": "^8.x",
    "tailwindcss": "^3.x",
    "vite": "^5.x"
  }
}
```

That's 5 runtime dependencies. Lean, fast, and familiar.

---

### 8.6 Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│                  walden-dashboard                     │
│              (Separate Vercel App)                    │
│                                                       │
│  React + Vite + Tailwind + Recharts                  │
│  React Router (4 role-based routes)                  │
│  Custom auth (dashboard_users + RPC)                 │
│                                                       │
│  Data fetching:                                       │
│    - Direct Supabase reads (anon key)                │
│    - 2-3 database views for aggregations             │
│    - 60s polling (default)                           │
│    - Supabase Realtime (Danny's feed only)           │
│                                                       │
│  Writes ONLY to:                                      │
│    - dashboard_users (auth)                           │
│    - dashboard_loom_reviews (review tracking)        │
│    - dashboard_flags (flagging system)               │
│    - dashboard_last_seen (notification state)        │
└──────────────────────┬──────────────────────────────┘
                       │
                       │ Supabase JS Client
                       │ (anon key, direct connection)
                       │
┌──────────────────────▼──────────────────────────────┐
│              Supabase (Shared Instance)               │
│                                                       │
│  SiteLog tables (read-only from dashboard):          │
│    site_log_entries, cm_notes, cm_action_items,      │
│    cm_emails, voice_recordings, site_photos,         │
│    projects, cm_users (via RPC), vendors,            │
│    cm_schedule_items, site_meetings, transcripts,    │
│    transcript_items, usage_logs                       │
│                                                       │
│  Dashboard tables (read-write):                      │
│    dashboard_users, dashboard_loom_reviews,           │
│    dashboard_flags, dashboard_last_seen              │
│                                                       │
│  Views:                                               │
│    v_daily_project_stats, v_open_action_items_summary│
│                                                       │
│  RPCs:                                                │
│    authenticate_dashboard_user()                      │
│    dashboard_project_overview()                       │
│    dashboard_cm_activity()                            │
│    dashboard_entry_trends()                           │
│    dashboard_get_looms()                              │
└─────────────────────────────────────────────────────┘
```

**Key decisions:**
1. **Separate app** — isolates deploy risk, keeps SiteLog lean
2. **Custom auth** — mirrors SiteLog's proven pattern, trivial for 5 users
3. **Direct reads + views** — no API layer, minimal moving parts
4. **Polling + selective Realtime** — simple default, upgrade path exists
5. **Same tech stack** — zero learning curve, copy-paste patterns from SiteLog
