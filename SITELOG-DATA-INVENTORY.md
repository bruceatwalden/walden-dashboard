# SiteLog V2 — Data Inventory

> Generated: 2026-02-20
> Purpose: Handoff document for dashboard project. Covers all database tables, API endpoints, RPC functions, query functions, and external integrations.

---

## Table of Contents

1. [Database Tables by Domain](#database-tables-by-domain)
2. [RPC Functions](#rpc-functions)
3. [Database Triggers](#database-triggers)
4. [Serverless API Endpoints](#serverless-api-endpoints)
5. [Database Query Functions (src/lib/database.js)](#database-query-functions)
6. [External Data Sources & Integrations](#external-data-sources--integrations)
7. [Client-Side-Only Data (Not in Database)](#client-side-only-data)
8. [Supabase Storage Buckets](#supabase-storage-buckets)
9. [Static Data Files](#static-data-files)
10. [Environment Variables](#environment-variables)

---

## Database Tables by Domain

### PROJECTS

#### `projects`

> **Note:** This table is NOT defined in the SiteLog migrations — it pre-exists in the shared Walden Supabase instance. SiteLog reads from it but does not create or modify its schema.

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Project identifier |
| `name` | text | Project display name (e.g. "40 Elgin") |
| `status` | text | Project status |
| `slug` | text (UNIQUE) | URL-friendly name for photo viewer links (e.g. "40-elgin"). Added by migration 012. |
| `location` | text | Human-readable location string. Added by migration 012. |
| `location_lat` | numeric | Latitude for weather lookups. Added by migration 012. |
| `location_lng` | numeric | Longitude for weather lookups. Added by migration 012. |

- **FK relationships:** Referenced by almost every other table via `project_id`
- **Written by:** Admin panel (location fields), auto-slug trigger on insert
- **Read by:** Every part of the app — project picker, dashboard, overview, photo viewer
- **Change frequency:** Rarely (new projects added quarterly)
- **Row volume:** Tens (5-15 active projects)

---

#### `project_smartsheet_mapping`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Row identifier |
| `project_id` | uuid (FK → projects) | Which project this maps |
| `smartsheet_name` | text | The Smartsheet project name used when submitting form entries |
| `created_at` | timestamptz | When the mapping was created |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Auto-created by trigger on `projects` insert (migration 008). Backfilled for existing projects.
- **Read by:** Smartsheet submission flow (`getSmartsheetName()`), admin panel
- **Change frequency:** Rarely (only when new projects are added)
- **Row volume:** Tens (one per project)
- **Dashboard note:** This is the bridge between SiteLog projects and Smartsheet. The `smartsheet_name` is used as the "Sheet ID" field in form submissions.

---

### USERS

#### `cm_users`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | User identifier |
| `name` | text | Display name (e.g. "Gary") |
| `pin_hash` | text | bcrypt hash of 4-digit PIN |
| `email` | text | User email (optional) |
| `role` | text | One of: `cm`, `coordinator`, `admin`. Default: `cm` |
| `assigned_projects` | uuid[] | Array of project UUIDs this user can access |
| `is_active` | boolean | Whether the user can log in |
| `last_login` | timestamptz | Timestamp of most recent login |
| `phone` | text | Phone number for SMS reminders. Added by migration 012. |
| `created_at` | timestamptz | When the user was created |

- **FK relationships:** Referenced by `usage_logs.user_id`, `site_photos.uploaded_by`, `photo_collections.created_by`
- **Written by:** Admin panel (via RPCs: `create_cm_user`, `update_cm_user`, `reset_cm_pin`). `last_login` updated by `authenticate_cm` RPC.
- **Read by:** Login screen (via `authenticate_cm` RPC), admin panel (via `list_cm_users` RPC), project overview dashboard
- **Change frequency:** Rarely (users added/edited infrequently)
- **Row volume:** Tens (5-10 users)
- **Security note:** No direct anon SELECT policy. All reads go through SECURITY DEFINER RPCs to protect `pin_hash`.

---

### ENTRIES (Daily Site Log)

#### `site_log_entries`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Entry identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `entry_date` | date | The date this entry covers |
| `construction_manager` | text | CM name (denormalized from user) |
| `project_area` | text | Dropdown value from Walden's standard list (e.g. "Job Log Plumbing", "Tracker Demolition Costs") |
| `section_code` | text | Numeric code matching the dropdown (e.g. "19.11", "2.01") |
| `description` | text | The entry content — what happened |
| `source_text` | text | Original raw text before AI processing (for audit trail) |
| `smartsheet_submitted` | boolean | Whether this entry has been sent to Smartsheet |
| `smartsheet_submitted_at` | timestamptz | When it was submitted |
| `created_at` | timestamptz | When the entry was created in SiteLog |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Voice recorder (AI-processed recordings), daily report import, Loom transcript processing, photo detail processing, weekly plan submission, Walden General auto-generation
- **Read by:** Entries preview/review screen, daily summary dashboard, Smartsheet submission, search (recent 50 entries as context), email generator (recent 30 as context), project overview, Walden General generator
- **Change frequency:** Real-time throughout the day (CMs record entries continuously)
- **Row volume:** Thousands (50-100+ entries/day across all projects)
- **Indexes:** `(project_id, entry_date)`

---

### NOTES & ACTION ITEMS

#### `cm_notes`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Note identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `construction_manager` | text | Who wrote it |
| `content` | text | The note text |
| `source_text` | text | Original transcription text before AI cleanup |
| `note_date` | date | The date this note pertains to |
| `created_at` | timestamptz | When the note was saved |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Voice recorder (AI classification), meeting transcript processing
- **Read by:** Dashboard (recent 5), notes-by-date view, search (recent 20 as context), email generator (recent 10 as context), calendar (notes by date range), project overview
- **Change frequency:** Multiple times daily
- **Row volume:** Hundreds to low thousands
- **Indexes:** `(project_id, note_date)`

---

#### `cm_action_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Action item identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `construction_manager` | text | Who owns it |
| `description` | text | What needs to be done |
| `source_text` | text | Original transcription text |
| `due_date` | date | When it's due (nullable — not all items have due dates) |
| `completed` | boolean | Whether it's been checked off |
| `completed_at` | timestamptz | When it was completed |
| `item_date` | date | The date this item was created/assigned |
| `created_at` | timestamptz | When it was saved in the database |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Voice recorder (AI classification), meeting transcript processing, meeting item triage (accept from `transcript_items`)
- **Read by:** Action items hub (open items), dashboard, calendar (items by due_date range), search (recent 20), email generator (open items), project overview, daily summary
- **Change frequency:** Multiple times daily (created and completed)
- **Row volume:** Hundreds to low thousands
- **Indexes:** `(project_id, item_date)`, `(completed, item_date)`

---

### COMMUNICATIONS

#### `cm_emails`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Email identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `construction_manager` | text | Who drafted it |
| `recipient_name` | text | To whom |
| `recipient_email` | text | Recipient email address |
| `recipient_company` | text | Recipient company name |
| `subject` | text | Email subject line |
| `body` | text | Full email body |
| `intent_text` | text | Original voice intent that generated the email |
| `status` | text | One of: `draft`, `sent`. Default: `draft` |
| `doc_url` | text | URL to the Google Doc version. Added by migration 007. |
| `created_at` | timestamptz | When the draft was created |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Email generator flow (voice intent → AI draft → save)
- **Read by:** Email history view, project overview (count per day)
- **Change frequency:** A few per day
- **Row volume:** Hundreds
- **Indexes:** `(project_id, created_at)`

---

### VOICE RECORDINGS

#### `voice_recordings`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Recording identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `construction_manager` | text | Who recorded it |
| `recording_date` | date | The date of the recording session |
| `recording_number` | integer | Sequence number within the day (1, 2, 3…) |
| `recording_time` | text | Human-readable time string |
| `transcription` | text | Whisper transcription text |
| `is_transcribing` | boolean | Whether transcription is in progress |
| `processed` | boolean | Whether this recording has been processed into entries/notes/actions |
| `created_at` | timestamptz | When the recording was saved |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Voice recorder (after Whisper transcription completes)
- **Read by:** Voice recorder (load today's unprocessed recordings), processed-check for undo
- **Change frequency:** Real-time throughout the day (CMs record continuously)
- **Row volume:** Thousands (5-20 recordings/day per CM)
- **Indexes:** `(project_id, recording_date)`
- **Lifecycle note:** Recordings are marked `processed=true` after AI processing. They can be "unprocessed" (reset to `processed=false`) for re-processing. Individual recordings can be deleted.

---

### PHOTOS

#### `site_photos`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Photo metadata identifier |
| `project_id` | uuid (FK → projects, CASCADE) | Which project |
| `photo_date` | date | Date the photo was taken (from EXIF or file date) |
| `file_path` | text | Storage path for full-size image (e.g. `{project_id}/{date}/{uuid}.jpg`) |
| `thumb_path` | text | Storage path for thumbnail (e.g. `{project_id}/{date}/{uuid}_thumb.jpg`) |
| `original_name` | text | Original filename from the camera/phone (used for deduplication) |
| `file_size` | integer | Size of the compressed full-size image in bytes |
| `client_visible` | boolean | Whether this photo appears in the client-facing viewer |
| `time_taken` | timestamptz | EXIF DateTimeOriginal timestamp |
| `uploaded_by` | uuid | CM user who uploaded it |
| `uploaded_by_name` | text | CM name (denormalized) |
| `created_at` | timestamptz | When the metadata row was created |

- **FK relationships:** `project_id` → `projects.id` (CASCADE), `uploaded_by` → `cm_users.id` (implicit)
- **Written by:** Single photo upload, bulk photo upload engine, photo detail flow
- **Read by:** Photo browser (all project photos), client photo viewer (client_visible only), photo collections, bulk upload (dedup by original_name), dashboard (today's photo count), project overview (photo count per day), photo count summary
- **Change frequency:** Burst uploads (tens to hundreds at a time during bulk upload)
- **Row volume:** Thousands to tens of thousands per project
- **Indexes:** `(project_id, photo_date DESC)`, `(project_id, client_visible) WHERE client_visible = true`

---

#### `photo_date_info`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Row identifier |
| `project_id` | uuid (FK → projects, CASCADE) | Which project |
| `info_date` | date | The date this info covers |
| `weather_temp` | numeric | Average temperature in °C |
| `weather_code` | integer | WMO weather code from Open-Meteo |
| `weather_desc` | text | Human-readable weather description (e.g. "Partly Cloudy") |
| `no_work` | boolean | Whether it was a no-work day (suppresses SMS reminders) |
| `no_work_reason` | text | Why no work (e.g. "Holiday", "Weather") |
| `client_note` | text | Client-facing note for this date. Added by migration 013. |
| `created_at` | timestamptz | When the row was created |

- **FK relationships:** `project_id` → `projects.id` (CASCADE)
- **Unique constraint:** `(project_id, info_date)`
- **Written by:** Photo browser (auto-fetches weather on first view of a date), admin (no_work toggle), client note voice recording
- **Read by:** Photo browser (date separator cards), client photo viewer (weather + notes)
- **Change frequency:** Daily (one per project per active day)
- **Row volume:** Hundreds per project
- **Indexes:** `(project_id, info_date DESC)`

---

#### `photo_collections`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Collection identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `title` | text | Collection display name |
| `description` | text | Optional description |
| `slug` | text (UNIQUE) | URL-friendly slug for shareable link |
| `created_by` | uuid (FK → cm_users) | Who created it |
| `created_by_name` | text | Creator name (denormalized) |
| `created_at` | timestamptz | When the collection was created |
| `updated_at` | timestamptz | When it was last modified |

- **FK relationships:** `project_id` → `projects.id`, `created_by` → `cm_users.id`
- **Written by:** Share Photos feature (create curated collections)
- **Read by:** Share Photos list, collection viewer (public shareable link)
- **Change frequency:** Weekly or less
- **Row volume:** Tens per project

---

#### `collection_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Item identifier |
| `collection_id` | uuid (FK → photo_collections, CASCADE) | Which collection |
| `photo_id` | uuid (FK → site_photos, CASCADE) | Which photo |
| `comment` | text | Optional comment on this photo in this collection |
| `sort_order` | integer | Display order within the collection |
| `created_at` | timestamptz | When the item was added |

- **FK relationships:** `collection_id` → `photo_collections.id` (CASCADE), `photo_id` → `site_photos.id` (CASCADE)
- **Written by:** Share Photos (add/remove/reorder photos in collections)
- **Read by:** Collection viewer, collection editor
- **Change frequency:** When collections are edited
- **Row volume:** Tens to hundreds per collection
- **Indexes:** `(collection_id, sort_order)`

---

### TRACKABLES (Schedule)

#### `cm_schedule_items`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Schedule item identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `user_id` | uuid | CM user who created it (nullable) |
| `construction_manager` | text | CM name |
| `title` | text | Short event title |
| `description` | text | Optional longer description |
| `schedule_date` | date | When the event is scheduled |
| `schedule_time` | text | Time in HH:MM 24h format (nullable) |
| `category` | text | One of: `concrete`, `inspection`, `delivery`, `meeting`, `trade`, `cleanup`, `general` |
| `completed` | boolean | Whether the item is done |
| `completed_at` | timestamptz | When it was completed |
| `source_text` | text | Original transcription text |
| `created_at` | timestamptz | When the item was created |

- **FK relationships:** `project_id` → `projects.id`
- **Written by:** Calendar voice input (AI-parsed), meeting transcript processing
- **Read by:** Weekly calendar view (by date range), search (recent 30 as context), project overview
- **Change frequency:** Multiple times daily
- **Row volume:** Hundreds
- **Indexes:** `(project_id, schedule_date)`

---

### ANALYTICS

#### `usage_logs`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Log entry identifier |
| `user_id` | uuid (FK → cm_users) | Who performed the action |
| `user_name` | text | User name (denormalized) |
| `action` | text | Action type string |
| `details` | jsonb | Extra data as JSON (varies by action) |
| `project_id` | uuid (FK → projects) | Which project (nullable) |
| `project_name` | text | Project name (denormalized) |
| `created_at` | timestamptz | When the action occurred |

Known `action` values:
- `login` — User logged in
- `recording_saved` — Voice recording completed
- `process_recordings` — AI processed recordings into entries
- `submit_smartsheet` — Entries submitted to Smartsheet
- `search` — CM asked a question via AI search
- `email_drafted` — AI generated an email draft
- `loom_processed` — Loom video transcript processed
- `loom_submitted` — Loom entry submitted to Smartsheet
- `meeting_recorded` — Meeting recorded and transcribed

- **FK relationships:** `user_id` → `cm_users.id`, `project_id` → `projects.id`
- **Written by:** Fire-and-forget `logAction()` calls throughout the app. Never blocks UI.
- **Read by:** Project overview (loom counts, user activity for the day), Loom display (query by `loom_processed`/`loom_submitted` actions to extract Loom URLs from `details.loom_url`)
- **Change frequency:** Real-time (every user action)
- **Row volume:** Thousands to tens of thousands
- **Indexes:** `(created_at DESC)`, `(user_id)`, `(action)`

---

### VENDORS

#### `vendors`

| Column | Type | Description |
|--------|------|-------------|
| `id` | uuid (PK) | Vendor identifier |
| `unique_id` | text | External ID from source spreadsheet |
| `common_name` | text | Short name used on site (e.g. "Toronto Shoring") |
| `company_name` | text | Official company name |
| `contact_name` | text | Primary contact person |
| `phone_1` | text | Primary phone |
| `phone_2` | text | Secondary phone |
| `trade_category` | text | Trade/industry (e.g. "Shoring", "Plumbing") |
| `created_at` | timestamptz | When the vendor was added |

- **FK relationships:** None (standalone reference table)
- **Written by:** Seed script (`scripts/seed-vendors.js`) from Excel spreadsheet. Not edited in-app.
- **Read by:** AI report processor (vendor name matching), AI search (vendor directory context), AI email generator (vendor lookup)
- **Change frequency:** Rarely (bulk-seeded from spreadsheet when vendor list changes)
- **Row volume:** Hundreds (50-200 vendors)
- **Indexes:** `(common_name)`, `(company_name)`

---

### MEETINGS & REVIEWS (Cross-App Tables)

> **Note:** These tables (`site_meetings`, `transcripts`, `transcript_items`, `meeting_item_reviews`) are NOT defined in the SiteLog V2 migrations. They likely exist in the shared Walden Supabase instance, possibly created by a separate "Transcript Manager" app. SiteLog reads and writes to them.

#### `site_meetings`

| Column | Type | Description (inferred from code) |
|--------|------|-------------|
| `id` | uuid (PK) | Meeting identifier |
| `project_id` | uuid (FK → projects) | Which project |
| `user_id` | uuid | CM who recorded the meeting |
| `meeting_date` | date | Date of the meeting |
| `meeting_type` | text | `contractor_walkthrough`, `psych_meeting`, or `general` |
| `context_note` | text | CM's context note about the meeting |
| `audio_duration_seconds` | numeric | Length of the recording |
| `assemblyai_transcript_id` | text | AssemblyAI transcript ID (for dedup) |
| `raw_transcript` | text | Speaker-diarized transcript text |
| `utterances` | jsonb | AssemblyAI utterance array with speaker labels |
| `processed_result` | jsonb | AI-processed meeting output (entries, punch list, actions) |
| `entry_count` | integer | Number of job log entries extracted |
| `punch_list_count` | integer | Number of punch list entries extracted |
| `action_item_count` | integer | Number of action items extracted |
| `created_at` | timestamptz | When the meeting was saved |

- **Written by:** Meeting recorder (after AssemblyAI transcription + Supabase sync)
- **Read by:** Meeting recorder (dedup check on same date)
- **Change frequency:** A few per week
- **Row volume:** Tens to hundreds

---

#### `transcripts` (External — Transcript Manager app)

| Column | Type | Description (inferred from joins) |
|--------|------|-------------|
| `id` | uuid (PK) | Transcript identifier |
| `title` | text | Meeting/transcript title |
| `meeting_date` | date | Date of the meeting |
| `project_id` | uuid (FK → projects) | Which project |

- **Written by:** External Transcript Manager app
- **Read by:** SiteLog CM dashboard (meeting items triage — joined with `transcript_items`)

---

#### `transcript_items` (External — Transcript Manager app)

| Column | Type | Description (inferred from queries) |
|--------|------|-------------|
| `id` | uuid (PK) | Item identifier |
| `transcript_id` | uuid (FK → transcripts) | Parent transcript |
| `item_type` | text | Type of item (SiteLog filters for `cm_todo`) |
| `description` | text | What needs to be done |
| `assignee` | text | Who it's assigned to |

- **Written by:** External Transcript Manager app
- **Read by:** SiteLog CM dashboard (pending meeting items for triage)

---

#### `meeting_item_reviews`

| Column | Type | Description (inferred from queries) |
|--------|------|-------------|
| `id` | uuid (PK) | Review identifier |
| `transcript_item_id` | uuid (FK → transcript_items) | Which item was reviewed |
| `cm_user_id` | uuid (FK → cm_users) | Which CM reviewed it |
| `action` | text | `accepted` or `dismissed` |
| `created_at` | timestamptz | When the review happened |

- **Unique constraint:** `(transcript_item_id, cm_user_id)` — one review per CM per item
- **Written by:** CM dashboard meeting items triage (accept/dismiss buttons)
- **Read by:** CM dashboard (filter out already-reviewed items)
- **Change frequency:** A few per week when meetings generate action items
- **Row volume:** Tens to hundreds

---

## RPC Functions

### `authenticate_cm(pin_input text)` → json

- **Purpose:** PIN-based login. Validates a 4-digit PIN against bcrypt hashes.
- **Security:** SECURITY DEFINER (bypasses RLS to read `cm_users.pin_hash`)
- **Returns:** `{ id, name, email, role, assigned_projects }` or `NULL` on failure
- **Side effect:** Updates `last_login` timestamp on the matched user
- **Called by:** `src/lib/auth.js → login()`

### `list_cm_users(caller_id uuid)` → json

- **Purpose:** Returns all CM users (excluding `pin_hash`) for admin management.
- **Security:** SECURITY DEFINER. Requires caller to be an active admin.
- **Returns:** JSON array of `{ id, name, email, role, assigned_projects, is_active, last_login, created_at }`
- **Called by:** Admin panel, project overview (for CM → project mapping)

### `create_cm_user(caller_id, cm_name, pin, cm_role, project_ids)` → json

- **Purpose:** Creates a new CM user with duplicate PIN validation.
- **Security:** SECURITY DEFINER. Requires caller to be an active admin.
- **Validation:** PIN must be exactly 4 digits. Role must be `cm`, `coordinator`, or `admin`. PIN must not collide with any active user.
- **Returns:** The new user as JSON
- **Called by:** Admin panel

### `update_cm_user(caller_id, target_id, cm_name, cm_role, project_ids, active)` → json

- **Purpose:** Updates a CM's profile (name, role, projects, active status). Does NOT change PIN.
- **Security:** SECURITY DEFINER. Requires caller to be an active admin.
- **Returns:** The updated user as JSON
- **Called by:** Admin panel

### `reset_cm_pin(caller_id, target_id, new_pin)` → json

- **Purpose:** Resets a CM's PIN with duplicate check.
- **Security:** SECURITY DEFINER. Requires caller to be an active admin.
- **Returns:** `{ success: true }`
- **Called by:** Admin panel

### `generate_project_slug(name text)` → text

- **Purpose:** Utility function to generate a URL-friendly slug from a project name.
- **Called by:** `set_project_slug()` trigger, backfill UPDATE in migration 012

---

## Database Triggers

### `trg_auto_smartsheet_mapping` (on `projects` INSERT)

- **Function:** `auto_create_smartsheet_mapping()`
- **Behavior:** When a new project is inserted, automatically creates a `project_smartsheet_mapping` row using the project name as the default `smartsheet_name`.

### `trg_project_slug` (on `projects` BEFORE INSERT)

- **Function:** `set_project_slug()`
- **Behavior:** If `slug` is NULL on insert, auto-generates it from the project name.

---

## Serverless API Endpoints

All endpoints are Vercel serverless functions in the `api/` directory.

### `POST /api/smartsheet-submit?formKey={key}`

- **File:** `api/smartsheet-submit.js`
- **Purpose:** Proxies multipart form submissions to Smartsheet's form API. Exists because Vercel's rewrite proxy has a ~4 MB body size limit that truncates photo attachments.
- **Parameters:**
  - Query: `formKey` (required) — the Smartsheet form key
  - Body: Raw multipart form data (passed through unchanged)
  - Headers: `content-type`, `x-smar-submission-token`, `x-smar-forms-version`, `x-smar-is-user`
- **Returns:** Proxied Smartsheet response (status + body)
- **Auth:** None (public endpoint, relies on Smartsheet form token for auth)
- **Data touched:** None in Supabase — passes data directly to Smartsheet

### `GET /api/loom-transcript?url={loomUrl}`

- **File:** `api/loom-transcript.js`
- **Purpose:** Fetches a Loom video's transcript by calling Loom's GraphQL API and parsing the VTT caption file into plain text.
- **Parameters:**
  - Query: `url` (required) — a Loom share/embed URL (e.g. `https://www.loom.com/share/{32-char-hex-id}`)
- **Returns:** `{ videoId, transcript }` — the video ID and plain-text transcript
- **Auth:** None (public endpoint, uses Loom's public GraphQL API)
- **Data touched:** None in Supabase — fetches from Loom CDN only

### `POST /api/create-google-doc`

- **File:** `api/create-google-doc.js`
- **Purpose:** Creates a Google Doc from an email draft and saves it to a shared Google Drive folder. Used for email archival as Google Docs.
- **Parameters (JSON body):**
  - `subject` (required) — email subject
  - `body` (required) — email body text
  - `recipient` — recipient name/company
  - `projectName` — project name for doc title
  - `cmName` — construction manager name
- **Returns:** `{ url, docId }` — the Google Doc URL and ID
- **Auth:** OAuth2 via server-side refresh token (env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN`)
- **Data touched:** Creates a file in Google Drive. The returned `url` is saved to `cm_emails.doc_url` by the client.

---

### Vercel Rewrites (not serverless functions, but route proxies)

Defined in `vercel.json`:

| Source | Destination | Purpose |
|--------|-------------|---------|
| `/smartsheet-form/:path*` | `https://app.smartsheet.com/:path*` | Fetches Smartsheet form HTML to scrape submission tokens |
| `/smartsheet-api/:path*` | `https://forms.smartsheet.com/:path*` | Text-only form submissions (no file attachments) |
| `/photos/:path*` | `/index.html` | SPA routing for client photo viewer |
| `/share/:path*` | `/index.html` | SPA routing for collection viewer |

---

## Database Query Functions

All functions are in `src/lib/database.js`. Grouped by domain.

### Projects

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `getProjects()` | `projects` | SELECT | Get all projects (id, name, status, slug), ordered by name |
| `getProjectBySlug(slug)` | `projects` | SELECT | Look up a project by its URL slug |
| `getProjectsWithLocation()` | `projects` | SELECT | Get all projects with location fields for weather config |
| `updateProjectLocation(id, {location, lat, lng})` | `projects` | UPDATE | Set a project's location for weather lookups |
| `getProjectLocation(projectId)` | `projects` | SELECT | Get lat/lng for weather API call |
| `getProjectSmartsheetMapping()` | `project_smartsheet_mapping` (join `projects`) | SELECT | Get all Smartsheet mappings with project names |
| `getProjectPhotoCounts()` | `site_photos` | SELECT (count) | Count photos per project (paginated fetchAll) |

### Entries

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveSiteLogEntries(entries)` | `site_log_entries` | INSERT | Save AI-processed entries (batch) |
| `getSiteLogEntries(projectId, date)` | `site_log_entries` | SELECT | Get all entries for a project+date, ordered by area/code |
| `getRecentSiteLogEntries(projectId, limit)` | `site_log_entries` | SELECT | Recent entries for AI context (search, email) |
| `getDailySummary(date)` | `projects`, `site_log_entries` | SELECT | Entry counts + Smartsheet status per project for a date |
| `getWaldenGeneralEntry(projectId, date)` | `site_log_entries` | SELECT | Get the "Job Log Walden General" entry for a date |
| `deleteWaldenGeneralEntry(projectId, date)` | `site_log_entries` | DELETE | Remove Walden General before regenerating |

### Notes

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveNotes(notes)` | `cm_notes` | INSERT | Save AI-classified notes (batch) |
| `getNotes(projectId)` | `cm_notes` | SELECT | All notes for a project, newest first |
| `getNotesByDate(projectId, date)` | `cm_notes` | SELECT | Notes for a specific date |
| `getNotesByDateRange(projectId, start, end)` | `cm_notes` | SELECT | Notes within a date range (calendar) |
| `getDashboardNotes(projectId, limit)` | `cm_notes` | SELECT | Recent notes for dashboard cards |
| `getRecentNotes(projectId, limit)` | `cm_notes` | SELECT | Recent notes for AI context |
| `updateNote(id, content)` | `cm_notes` | UPDATE | Edit a note's text |
| `deleteNote(id)` | `cm_notes` | DELETE | Remove a note |

### Action Items

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveActionItems(items)` | `cm_action_items` | INSERT | Save AI-classified action items (batch) |
| `getActionItems(projectId)` | `cm_action_items` | SELECT | All items for a project, open first |
| `getActionItemsByDate(projectId, date)` | `cm_action_items` | SELECT | Items created on a specific date |
| `getActionItemsByDateRange(projectId, start, end)` | `cm_action_items` | SELECT | Open items with due_date in range (calendar) |
| `getOpenActionItems(projectId)` | `cm_action_items` | SELECT | All open (uncompleted) items |
| `getAllOpenActionItems(projectIds)` | `cm_action_items` (join `projects`) | SELECT | Open items across multiple projects |
| `getRecentActionItems(projectId, limit)` | `cm_action_items` | SELECT | Recent items for AI context |
| `completeActionItem(id)` | `cm_action_items` | UPDATE | Mark as completed with timestamp |
| `updateActionItem(id, description)` | `cm_action_items` | UPDATE | Edit description |
| `deleteActionItem(id)` | `cm_action_items` | DELETE | Remove an action item |

### Emails

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveEmail(email)` | `cm_emails` | INSERT | Save an AI-generated email draft |
| `getEmails(projectId)` | `cm_emails` | SELECT | All emails for a project, newest first |

### Voice Recordings

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveVoiceRecording(recording)` | `voice_recordings` | INSERT | Save a new recording with transcription |
| `getVoiceRecordings(projectId, date)` | `voice_recordings` | SELECT | Get today's unprocessed recordings |
| `updateVoiceRecording(id, updates)` | `voice_recordings` | UPDATE | Update transcription text or status |
| `deleteVoiceRecording(id)` | `voice_recordings` | DELETE | Remove a recording |
| `markRecordingsProcessed(projectId, date)` | `voice_recordings` | UPDATE | Mark all as processed after AI run |
| `resetProcessedRecordings(projectId)` | `voice_recordings` | UPDATE | Undo processing (set `processed=false`) |
| `hasProcessedRecordings(projectId, date)` | `voice_recordings` | SELECT (count) | Check if any processed recordings exist |

### Photos

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `savePhotoMetadata(photos)` | `site_photos` | INSERT | Save photo metadata (batch) |
| `getProjectPhotos(projectId)` | `site_photos` | SELECT (paginated) | All photos for a project |
| `getClientPhotos(projectId)` | `site_photos` | SELECT (paginated) | Client-visible photos only |
| `deletePhoto(id)` | `site_photos` | DELETE | Remove photo metadata (storage deletion handled separately) |
| `updatePhotoVisibility(id, clientVisible)` | `site_photos` | UPDATE | Toggle client_visible flag |
| `bulkTagClientByNames(projectId, names, onChunk)` | `site_photos` | UPDATE (batched) | Tag photos as client-visible by matching original filenames |
| `getTodayPhotoCount(projectId, date)` | `site_photos` | SELECT (count) | Photo count for today (dashboard) |

### Photo Date Info

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `getPhotoDateInfo(projectId, date)` | `photo_date_info` | SELECT | Get weather/no-work info for a date |
| `savePhotoDateInfo(info)` | `photo_date_info` | UPSERT | Save or update date info (weather, no-work, client note) |
| `getProjectDateInfo(projectId)` | `photo_date_info` | SELECT | All date info for a project |

### Photo Collections

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveCollection(collection)` | `photo_collections` | INSERT | Create a new collection |
| `saveCollectionItems(items)` | `collection_items` | INSERT | Add photos to a collection |
| `getProjectCollections(projectId)` | `photo_collections` (join `collection_items`) | SELECT | List collections with item counts |
| `getCollectionBySlug(slug)` | `photo_collections` (join `projects`) | SELECT | Look up collection by shareable slug |
| `getCollectionItems(collectionId)` | `collection_items` (join `site_photos`) | SELECT | Get all items with photo details |
| `updateCollection(id, updates)` | `photo_collections` | UPDATE | Edit title/description |
| `replaceCollectionItems(collectionId, items)` | `collection_items` | DELETE + INSERT | Replace all items (reorder/edit) |
| `deleteCollection(id)` | `photo_collections` | DELETE | Remove a collection (items cascade) |

### Schedule

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveScheduleItems(items)` | `cm_schedule_items` | INSERT | Save AI-parsed calendar events (batch) |
| `getScheduleItemsByDateRange(projectId, start, end)` | `cm_schedule_items` | SELECT | Items in a date range for weekly calendar |
| `getRecentScheduleItems(projectId, limit)` | `cm_schedule_items` | SELECT | Recent items for AI context |
| `updateScheduleItem(id, updates)` | `cm_schedule_items` | UPDATE | Edit a schedule item |
| `deleteScheduleItem(id)` | `cm_schedule_items` | DELETE | Remove a schedule item |
| `completeScheduleItem(id)` | `cm_schedule_items` | UPDATE | Mark as completed |

### Usage / Looms

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `getProjectLooms(projectId, date)` | `usage_logs` | SELECT | Get Loom URLs for a project+date (from `loom_processed`/`loom_submitted` actions) |
| `getProjectOverview(date, userId)` | Multiple (9 parallel queries) | SELECT | Admin dashboard: entry/note/photo/email/loom counts per project for a date, plus CM activity |

### Meeting Items (Cross-App)

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `getPendingMeetingItems(projectId, cmUserId)` | `transcript_items` (join `transcripts`), `meeting_item_reviews` | SELECT | Get unreviewed cm_todo items from external Transcript Manager |
| `acceptMeetingItem(transcriptItemId, cmUserId, actionItemData)` | `meeting_item_reviews`, `cm_action_items` | UPSERT + INSERT | Accept a meeting item → creates a review record + a new action item |
| `dismissMeetingItem(transcriptItemId, cmUserId)` | `meeting_item_reviews` | UPSERT | Dismiss a meeting item (record review only) |

### Site Meetings

| Function | Table(s) | Operation | Purpose |
|----------|----------|-----------|---------|
| `saveSiteMeeting(meeting)` | `site_meetings` | INSERT | Save meeting transcript + metadata |
| `getSiteMeetings(projectId, date)` | `site_meetings` | SELECT | Get meetings for a project+date (dedup check) |

---

## External Data Sources & Integrations

### 1. Smartsheet (Form Submission API)

- **Direction:** SiteLog → Smartsheet (write-only)
- **Mechanism:** Submits data via Smartsheet's form API (`https://forms.smartsheet.com/api/submit/{formKey}`)
- **What flows to Smartsheet:**
  - Daily site log entries (project_area, description, date, sheet name)
  - Photo detail entries (with compressed photo attachments, max 3 per batch)
  - Weekly plan entries (single entry with all 10 sections in description)
- **Form fields:** Sheet ID (`D3GLRML`), Project Area (`Jkknw8d`), Description (`Nwknq2k`), Item Date (`5l69qWG`), Attachment (`ATTACHMENT`)
- **Authentication:** Single-use submission tokens scraped from the Smartsheet form HTML page
- **Proxy routes:** `/smartsheet-form/` → `app.smartsheet.com`, `/smartsheet-api/` → `forms.smartsheet.com`, `/api/smartsheet-submit` for file uploads
- **Dashboard note:** Smartsheet contains a complete copy of all submitted entries. It could be queried directly if Smartsheet API access is available. The `smartsheet_submitted` flag in `site_log_entries` tracks what has been sent.

### 2. Anthropic Claude API (AI Processing)

- **Direction:** SiteLog → Claude → SiteLog (request/response)
- **Model:** `claude-sonnet-4-5-20250929` (used for all AI calls)
- **API Key:** Client-side via `VITE_ANTHROPIC_API_KEY` (browser-based, `dangerouslyAllowBrowser: true`)
- **Used for:**
  - `report-processor.js` → Process voice recordings into structured entries, notes, action items
  - `report-processor.js` → Process Loom transcripts into entries
  - `report-processor.js` → Process photo descriptions into entries
  - `report-processor.js` → Generate Walden General summary from existing entries
  - `search.js` → Answer CM questions using project data as context
  - `email-generator.js` → Draft professional emails from voice intent
  - `weekly-plan-processor.js` → Organize voice recordings into 10 weekly plan sections
  - `calendar-processor.js` → Parse voice input into calendar events
  - `meeting-processor.js` → Process diarized meeting transcripts into entries, punch list items, action items
  - `client-note.js` → Rewrite voice notes into client-friendly language

### 3. OpenAI Whisper API (Transcription)

- **Direction:** SiteLog → OpenAI → SiteLog
- **API Key:** Client-side via `VITE_OPENAI_API_KEY`
- **Used for:** Voice recording transcription (speech-to-text) in the VoiceRecorder component
- **Note:** The actual Whisper API call is in the VoiceRecorder component, not in a lib file

### 4. AssemblyAI (Meeting Transcription)

- **Direction:** SiteLog → AssemblyAI → SiteLog
- **API Key:** Client-side via `VITE_ASSEMBLYAI_API_KEY`
- **Used for:** Long-form meeting transcription with speaker diarization
- **Flow:** Upload audio blob → Create transcript job → Poll until complete → Get diarized utterances
- **Lib file:** `src/lib/assemblyai.js`

### 5. Open-Meteo API (Weather)

- **Direction:** SiteLog → Open-Meteo → SiteLog (read-only)
- **Auth:** None required (free public API)
- **Used for:**
  - `fetchWeather(lat, lng, date)` — Get daily weather for photo date separators
  - `searchLocation(query)` — Geocode locations for project weather setup
- **Data stored:** Weather results saved to `photo_date_info` (temp, code, description)
- **Lib file:** `src/lib/weather.js`

### 6. Loom (Video Transcript Fetching)

- **Direction:** SiteLog → Loom → SiteLog (read-only)
- **Auth:** None (public GraphQL API)
- **Mechanism:** Server-side API endpoint (`/api/loom-transcript`) calls Loom's GraphQL API to get VTT caption URL, fetches and parses VTT to plain text
- **Data stored:** Transcript fed into AI processing → entries saved to `site_log_entries`. Loom URL stored in `usage_logs.details.loom_url`.

### 7. Google Drive (Email Archival)

- **Direction:** SiteLog → Google Drive (write-only)
- **Auth:** OAuth2 with refresh token (server-side env vars)
- **Mechanism:** Server-side API endpoint (`/api/create-google-doc`) creates a Google Doc in a shared folder with email content, sets anyone-can-edit sharing
- **Data stored:** Google Doc URL saved back to `cm_emails.doc_url`

---

## Client-Side-Only Data

These data items exist in the browser but are NOT persisted to Supabase:

### IndexedDB: `walden-meetings` database

Used by `src/lib/meeting-storage.js` for offline-first meeting recordings.

**Store: `recordings`**
- Fields: `id`, `projectId`, `projectName`, `userId`, `userName`, `meetingType`, `contextNote`, `meetingDate`, `mimeType`, `durationSeconds`, `status`, `errorMessage`, `retryCount`, `lastRetryAt`, `assemblyaiTranscriptId`, `rawTranscript`, `utterances`, `audioDurationSeconds`, `createdAt`, `updatedAt`
- Status lifecycle: `recording` → `saved` → `uploading` → `transcribed` → `synced`
- Includes crash recovery (`recoverInProgressRecording()`)

**Store: `audio_chunks`**
- Fields: `id`, `recordingId`, `chunkIndex`, `blob`, `createdAt`
- Audio data saved incrementally during recording (every 30s)
- Consolidated into single blob on finalization

**Purpose:** Meeting audio persists through page refreshes and browser crashes. Once transcribed and synced to Supabase (`site_meetings`), audio chunks are deleted.

### localStorage

| Key | Purpose |
|-----|---------|
| `sitelog_session` | User session: `{ user: {id, name, email, role, assigned_projects}, timestamp }`. Expires after 7 days. |
| `sitelog_notes_expanded` | UI preference: whether the notes section is expanded on dashboard |

### Calculated On-the-Fly (Not Stored)

- **Daily Summary** (`getDailySummary`): Smartsheet submission status per project (computed from `smartsheet_submitted` flags)
- **Project Overview** (`getProjectOverview`): Entry/note/photo/email/loom counts per project, CM activity status, overdue action item counts — all computed from parallel queries
- **Photo counts per project** (`getProjectPhotoCounts`): Counted by iterating all `site_photos` rows
- **Separator card detection**: Image analysis in Canvas API to filter out day-card/weather-card images during bulk upload — never stored
- **EXIF time extraction**: Photo timestamps extracted client-side — stored as `time_taken` in `site_photos`
- **AI-processed results**: Before the user confirms, AI output is held in component state (React useState) — not persisted until the user saves

---

## Supabase Storage Buckets

### `site-photos` (public read)

- **Purpose:** Stores all project photos (full-size and thumbnails)
- **Path structure:** `{project_id}/{photo_date}/{uuid}.jpg` (full) and `{project_id}/{photo_date}/{uuid}_thumb.jpg` (thumb)
- **Access:** Public read (no auth needed for viewing), anon write and delete
- **Photo specs:**
  - Full: max 2560px longest side, JPEG quality 0.85
  - Thumb: max 400px longest side, JPEG quality 0.70
  - HEIC files converted to JPEG before upload

---

## Static Data Files

These JSON files are bundled into the app at build time. They are generated from Excel spreadsheets by scripts.

### `src/data/dropdown-mapping.json`

- **Source:** `data/Drop Down List Report Job Log (1).xlsx`
- **Generator:** `scripts/generate-dropdown-mapping.js`
- **Content:** Array of `{ code, item }` objects representing all valid Smartsheet dropdown values
- **Used by:** AI report processor (constrains job log entries to valid dropdown values), meeting processor
- **Subsets:** Code filters for Job Log items (`Job Log *`, `Tracker *`, `End Of Day Close Up`) and Punch List items (`* Punch List`)

### `src/data/photo-detail-mapping.json`

- **Source:** `data/Drop Down List Report Photo Detail (1).xlsx`
- **Generator:** (same script, different source)
- **Content:** Array of `{ code, item }` objects for photo detail dropdown values
- **Used by:** AI photo description processor

### `src/data/vendor-list.json`

- **Source:** `data/Trade & Supplier Contact List.xlsx`
- **Generator:** `scripts/generate-vendor-list.js`
- **Content:** Array of `{ common_name, company_name }` objects
- **Used by:** AI report processor (vendor name matching), search, email generator

---

## Environment Variables

| Variable | Used In | Purpose |
|----------|---------|---------|
| `VITE_SUPABASE_URL` | `src/lib/supabase.js` | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | `src/lib/supabase.js` | Supabase anonymous API key |
| `VITE_ANTHROPIC_API_KEY` | Multiple AI processors | Claude API key (client-side) |
| `VITE_OPENAI_API_KEY` | VoiceRecorder | Whisper transcription API key |
| `VITE_SMARTSHEET_FORM_KEY` | `src/lib/smartsheet.js` | Smartsheet form identifier |
| `VITE_ASSEMBLYAI_API_KEY` | `src/lib/assemblyai.js` | AssemblyAI transcription key |
| `VITE_GOOGLE_DRIVE_FOLDER_ID` | `api/create-google-doc.js` | Google Drive folder for email docs |
| `GOOGLE_CLIENT_ID` | `api/create-google-doc.js` | Google OAuth2 client ID (server-side) |
| `GOOGLE_CLIENT_SECRET` | `api/create-google-doc.js` | Google OAuth2 secret (server-side) |
| `GOOGLE_REFRESH_TOKEN` | `api/create-google-doc.js` | Google OAuth2 refresh token (server-side) |

---

## Data Flow Summary

```
Voice Recording (phone mic)
    → OpenAI Whisper (transcription)
    → Supabase: voice_recordings
    → Claude AI (classification)
    → Supabase: site_log_entries + cm_notes + cm_action_items
    → Smartsheet (form submission)

Meeting Recording (phone mic)
    → IndexedDB (offline-first audio chunks)
    → AssemblyAI (diarized transcription)
    → Supabase: site_meetings
    → Claude AI (extraction)
    → Supabase: site_log_entries + cm_action_items + cm_notes

Loom Video (URL paste)
    → /api/loom-transcript (server-side VTT fetch)
    → Claude AI (classification)
    → Supabase: site_log_entries

Photos (camera roll / bulk folder)
    → EXIF extraction (client-side)
    → Supabase Storage: site-photos bucket
    → Supabase: site_photos metadata

Email Draft (voice intent)
    → Claude AI (draft generation)
    → Supabase: cm_emails
    → /api/create-google-doc (Google Drive archival)

Calendar Events (voice input)
    → Claude AI (date parsing)
    → Supabase: cm_schedule_items
```
