Here's every Supabase table the app touches, with columns and purpose:

  ---
  Core Project Data (6 tables)

  1. projects

  Central registry — one row per construction project.

  Column: id (uuid PK)
  Notes:
  ────────────────────────────────────────
  Column: name
  Notes:
  ────────────────────────────────────────
  Column: start_date, pre_construction_start
  Notes:
  ────────────────────────────────────────
  Column: anticipated_duration (int)
  Notes:
  ────────────────────────────────────────
  Column: baseline_locked, afc_locked (bool)
  Notes: Lock flags for schedule
  ────────────────────────────────────────
  Column: status
  Notes: 'active', 'completed', 'archived'
  ────────────────────────────────────────
  Column: created_at, updated_at
  Notes:
  ────────────────────────────────────────
  Column: key_milestone_name, key_baseline_week, key_afc_week, key_owner_accepted_week, key_projected_week, key_status
  Notes: Dashboard summary snapshot
  ────────────────────────────────────────
  Column: next_milestone_name, next_milestone_projected_week
  Notes: Dashboard "next up"

  2. milestones

  Schedule phases linked to projects — baseline, AFC, owner-accepted, and projected dates.

  ┌──────────────────────────────────────────┬─────────────────────────────────────────────────────────┐
  │                  Column                  │                          Notes                          │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ id (uuid PK), project_id (FK)            │                                                         │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ name, duration (default 4), sort_order   │                                                         │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ baseline_week, baseline_date             │ Original schedule                                       │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ afc_week, afc_date                       │ Awarded for construction                                │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ owner_accepted_week, owner_accepted_date │ Client-agreed dates                                     │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ projected_week, projected_date           │ Current forecast                                        │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ completed_at (date, nullable)            │                                                         │
  ├──────────────────────────────────────────┼─────────────────────────────────────────────────────────┤
  │ phase                                    │ 'pre_construction', 'construction', 'post_construction' │
  └──────────────────────────────────────────┴─────────────────────────────────────────────────────────┘

  3. tasks

  Action items / to-dos per project.

  ┌─────────────────────────────────────────┬──────────┐
  │                 Column                  │  Notes   │
  ├─────────────────────────────────────────┼──────────┤
  │ id (uuid PK), project_id (FK)           │          │
  ├─────────────────────────────────────────┼──────────┤
  │ content, completed (bool), completed_at │          │
  ├─────────────────────────────────────────┼──────────┤
  │ sort_order, position, order_in_position │ Ordering │
  └─────────────────────────────────────────┴──────────┘

  4. delays

  Individual delay events with category, impact, and recovery status.

  Column: id (uuid PK), project_id (FK)
  Notes:
  ────────────────────────────────────────
  Column: week_number, description, category
  Notes:
  ────────────────────────────────────────
  Column: days_impact (int), recoverable ('yes'/'no')
  Notes:
  ────────────────────────────────────────
  Column: context, source, date, notes
  Notes:
  ────────────────────────────────────────
  Column: weekly_summary_id, milestone_id (FKs)
  Notes: Links
  ────────────────────────────────────────
  Column: vendor, root_cause, date_range, time_lost, affected_milestone, responsible_party, original_description
  Notes: Enrichment fields
  ────────────────────────────────────────
  Column: combined_from (jsonb), is_archived (bool), original_days_sum
  Notes: Combine/archive feature

  5. watch_items

  Items requiring attention — risks, blockers, outstanding issues.

  Column: id (uuid PK), project_id (FK)
  Notes:
  ────────────────────────────────────────
  Column: item, trade, status, risk, risk_explanation, owner
  Notes:
  ────────────────────────────────────────
  Column: resolved (bool), resolved_date
  Notes:
  ────────────────────────────────────────
  Column: source
  Notes: 'manual', 'transcript', 'smartsheet', 'combined'
  ────────────────────────────────────────
  Column: source_author, source_file, imported_at, event_date
  Notes: Import metadata
  ────────────────────────────────────────
  Column: discussion_history (jsonb array)
  Notes: Running discussion log
  ────────────────────────────────────────
  Column: vendor, root_cause, date_range, affected_milestone, responsible_party, original_description
  Notes: Enrichment
  ────────────────────────────────────────
  Column: combined_from (jsonb), is_archived (bool)
  Notes: Combine/archive
  ────────────────────────────────────────
  Column: created_at
  Notes:

  6. shutdown_periods

  Holiday breaks and planned shutdowns per project.

  ┌───────────────────────────────┬────────────────────────────────────────────────┐
  │            Column             │                     Notes                      │
  ├───────────────────────────────┼────────────────────────────────────────────────┤
  │ id (uuid PK), project_id (FK) │                                                │
  ├───────────────────────────────┼────────────────────────────────────────────────┤
  │ name, start_date, end_date    │                                                │
  ├───────────────────────────────┼────────────────────────────────────────────────┤
  │ affects_schedule (bool)       │ true = shutdown, false = informational holiday │
  └───────────────────────────────┴────────────────────────────────────────────────┘

  ---
  Weekly Tracking (1 table)

  7. weekly_summaries

  Weekly status with transcript text and processing metadata.

  ┌─────────────────────────────────────────────┬──────────────────────────────────┐
  │                   Column                    │              Notes               │
  ├─────────────────────────────────────────────┼──────────────────────────────────┤
  │ id (uuid PK), project_id (FK)               │                                  │
  ├─────────────────────────────────────────────┼──────────────────────────────────┤
  │ week_number, summary, status                │ 'on-track', 'at-risk', 'behind'  │
  ├─────────────────────────────────────────────┼──────────────────────────────────┤
  │ transcript_text, transcript_name, call_date │ Full transcript stored for audit │
  ├─────────────────────────────────────────────┼──────────────────────────────────┤
  │ date_estimated (bool)                       │ Whether call date was estimated  │
  ├─────────────────────────────────────────────┼──────────────────────────────────┤
  │ processed_at, source_transcript_id          │ Auto-processing metadata         │
  └─────────────────────────────────────────────┴──────────────────────────────────┘

  ---
  History / Audit (2 tables)

  8. owner_accepted_history

  Audit trail when owner-accepted milestone dates change.

  ┌─────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────┐
  │                             Column                              │                     Notes                      │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ id (uuid PK)                                                    │                                                │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ milestone_id (FK, SET NULL on delete), project_id (FK)          │                                                │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ milestone_name                                                  │ Preserved for display after milestone deletion │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ previous_week, new_week, previous_date, new_date                │                                                │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ note, linked_delay_ids (uuid[]), linked_watch_item_ids (uuid[]) │                                                │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ source_milestone_id                                             │ Tracks cascaded changes                        │
  ├─────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┤
  │ changed_at                                                      │                                                │
  └─────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────┘

  9. projected_date_history

  Audit trail for projected milestone date changes.

  ┌───────────────────────────────────────────────────────────┬────────────────────────────┐
  │                          Column                           │           Notes            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ id (uuid PK)                                              │                            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ milestone_id (FK, SET NULL on delete), project_id (FK)    │                            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ milestone_name                                            │                            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ previous_date, new_date, previous_week, new_week          │                            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ reason                                                    │ e.g. "Transcript - Week 5" │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ linked_delay_ids (uuid[]), linked_watch_item_ids (uuid[]) │                            │
  ├───────────────────────────────────────────────────────────┼────────────────────────────┤
  │ changed_at                                                │                            │
  └───────────────────────────────────────────────────────────┴────────────────────────────┘

  ---
  Auto-Processing & Integration (4 tables)

  10. global_shutdowns

  App-wide shutdown/holiday library (pre-populated with Canadian holidays).

  ┌────────────────────────────┬───────┐
  │           Column           │ Notes │
  ├────────────────────────────┼───────┤
  │ id (uuid PK)               │       │
  ├────────────────────────────┼───────┤
  │ name, start_date, end_date │       │
  ├────────────────────────────┼───────┤
  │ affects_schedule (bool)    │       │
  ├────────────────────────────┼───────┤
  │ created_at                 │       │
  └────────────────────────────┴───────┘

  11. processing_log

  Audit trail of automated transcript processing results.

  Column: id (uuid PK)
  Notes:
  ────────────────────────────────────────
  Column: transcript_id, project_id (FK)
  Notes:
  ────────────────────────────────────────
  Column: status
  Notes: 'success', 'error', 'skipped'
  ────────────────────────────────────────
  Column: error_message, error_step
  Notes: Which step failed
  ────────────────────────────────────────
  Column: delays_added, watch_items_added, watch_items_updated, duplicates_skipped, milestone_changes (ints)
  Notes: Counts
  ────────────────────────────────────────
  Column: summary_added (bool), call_type, call_date
  Notes:
  ────────────────────────────────────────
  Column: processed_at
  Notes:

  12. transcripts (read-only, external)

  Managed by a separate Transcript Manager app. Read-only from this app.

  ┌─────────────────────────────────────────────┬────────────────────────────────────────┐
  │                   Column                    │                 Notes                  │
  ├─────────────────────────────────────────────┼────────────────────────────────────────┤
  │ id (uuid PK)                                │                                        │
  ├─────────────────────────────────────────────┼────────────────────────────────────────┤
  │ title, meeting_date, meeting_type, category │ category = 'project' for relevant ones │
  ├─────────────────────────────────────────────┼────────────────────────────────────────┤
  │ project_id (FK)                             │                                        │
  ├─────────────────────────────────────────────┼────────────────────────────────────────┤
  │ sentences (jsonb array)                     │ Full sentence-level transcript         │
  └─────────────────────────────────────────────┴────────────────────────────────────────┘

  13. transcript_pickups

  Junction table tracking which apps have processed which transcripts.

  ┌─────────────────────────────────────────┬────────────────────────────┐
  │                 Column                  │           Notes            │
  ├─────────────────────────────────────────┼────────────────────────────┤
  │ transcript_id + app_name (composite PK) │ app_name = 'delay_tracker' │
  ├─────────────────────────────────────────┼────────────────────────────┤
  │ picked_up_at                            │                            │
  └─────────────────────────────────────────┴────────────────────────────┘

  ---
  RPC Functions

  None. The app uses direct Supabase client queries exclusively — no .rpc() calls anywhere in the codebase.

  ---
  Summary: 13 tables total (6 core, 1 weekly tracking, 2 audit/history, 4 auto-processing/integration), ~130+ columns,
  zero RPC functions. The Edge Function process-transcript is the heaviest consumer, touching 10 of the 13 tables during
   automated transcript processing.