# Walden Transcript Manager — Supabase Data Inventory

All table access is centralized in `src/lib/database.js`.
RPC calls live in `src/lib/auth.js` and `src/lib/admin.js`.

---

## Tables

### transcripts

Stores meeting transcripts imported from Fireflies.ai.

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| fireflies_id | text | ID from Fireflies API |
| title | text | Meeting title |
| meeting_date | timestamp | Date of the meeting |
| meeting_type | text | Nullable |
| category | text | Nullable |
| project_id | FK → projects | Nullable |
| updated_at | timestamp | Last update timestamp |
| sentences | json/array | Transcript sentences |

### transcript_pickups

Tracks when transcripts are picked up or processed by external apps.
Unique constraint on (`transcript_id`, `app_name`).

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| transcript_id | FK → transcripts | |
| app_name | text | App that picked it up |
| picked_up_at | timestamp | |
| processed_by | text | Nullable |
| notes | text | Nullable |

### extracted_items

Items extracted from transcripts. Only queried by transcript_id; no other columns are referenced in code.

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| transcript_id | FK → transcripts | |

### transcript_topics

Topic-based sections of meeting minutes (narrative summaries organized by construction trade).

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| transcript_id | FK → transcripts | |
| topic_title | text | Title of the topic |
| summary | text | One-sentence summary; nullable |
| narrative | text | Detailed narrative paragraph |
| section_code | text | Construction trade code, e.g. "12.01"; nullable |
| sort_order | integer | Display order |

### transcript_items

Extracted action items, client concerns, and red-button alerts.

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| transcript_id | FK → transcripts | |
| item_type | text | `cm_todo`, `client_concern`, or `red_button` |
| description | text | Item description |
| assignee | text | Nullable |
| section_code | text | Construction trade code; nullable |
| amount | numeric | Dollar amount (red buttons); nullable |
| sort_order | integer | Display order |

### meeting_item_reviews

Records CM triage decisions on transcript items.
Unique constraint on (`transcript_item_id`, `cm_user_id`).

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| transcript_item_id | FK → transcript_items | |
| cm_user_id | text | ID of the CM user |
| action | text | `accepted` or `dismissed` |

### cm_action_items

Action items created when a CM accepts a meeting item.

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| project_id | FK → projects | |
| construction_manager | text | CM assigned |
| description | text | Action description |
| source_text | text | Original transcript text; nullable |
| due_date | date | Nullable |
| item_date | date | Nullable |
| completed | boolean | |
| source | text | Always `meeting` |
| source_transcript_item_id | FK → transcript_items | Nullable |

### projects

Construction projects. Shared with the Walden Delay Tracker app.

| Column | Type | Notes |
|--------|------|-------|
| id | PK | |
| name | text | Project name |

---

## RPC Functions

### authenticate_cm

Authenticate a CM user by PIN.

| Parameter | Type | Notes |
|-----------|------|-------|
| pin_input | text | PIN entered by user |
| app_id | text | Optional; application identifier |

Returns a user object (`id`, `name`, `role`) on success, `null` on mismatch, or `{ access_denied: true }` when access is denied.

### check_cm_users_exist

Check whether any CM users have been created in the system.

No parameters. Returns boolean.

### list_cm_users

List all CM users (access-controlled).

| Parameter | Type | Notes |
|-----------|------|-------|
| caller_id | text | ID of the requesting user |

Returns an array of user objects (`id`, `name`, `role`, `active`, `project_ids`, `app_list`).

### create_cm_user

Create a new CM user.

| Parameter | Type | Notes |
|-----------|------|-------|
| caller_id | text | ID of the admin creating the user |
| cm_name | text | User's name |
| cm_role | text | User role; default `cm` |
| pin | text | PIN code |
| project_ids | array | Optional |
| app_list | array | Optional |

### update_cm_user

Update an existing CM user.

| Parameter | Type | Notes |
|-----------|------|-------|
| caller_id | text | ID of the admin |
| target_id | text | ID of the user to update |
| cm_name | text | User's name |
| cm_role | text | User role |
| project_ids | array | Optional |
| active | boolean | Whether user is active |
| app_list | array | Optional |

### reset_cm_pin

Reset a CM user's PIN.

| Parameter | Type | Notes |
|-----------|------|-------|
| caller_id | text | ID of the admin |
| target_id | text | ID of the user |
| new_pin | text | New PIN code |

---

## Relationships

```
projects (1) ←── (M) transcripts
transcripts (1) ──→ (M) transcript_pickups
transcripts (1) ──→ (M) transcript_topics
transcripts (1) ──→ (M) transcript_items
transcripts (1) ──→ (M) extracted_items
transcript_items (1) ──→ (M) meeting_item_reviews
meeting_item_reviews ──→ cm_action_items
projects (1) ←── (M) cm_action_items
```
