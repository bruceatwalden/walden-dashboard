-- Dashboard-only table for tracking resolved Cost & Approval Alerts.
-- Does NOT write back to the Transcript Manager app.
-- Follows the dashboard_ prefix convention.

CREATE TABLE IF NOT EXISTS dashboard_alert_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transcript_item_id uuid NOT NULL,
  resolved_by text NOT NULL,
  resolved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(transcript_item_id)
);

-- Allow dashboard reads/writes via anon key (RLS)
ALTER TABLE dashboard_alert_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON dashboard_alert_resolutions
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access" ON dashboard_alert_resolutions
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow delete access" ON dashboard_alert_resolutions
  FOR DELETE USING (true);
