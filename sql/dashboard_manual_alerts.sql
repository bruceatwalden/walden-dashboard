-- Dashboard-only table for manually added alert items.
-- These appear alongside transcript-sourced items in the same panels.

CREATE TABLE IF NOT EXISTS dashboard_manual_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_type text NOT NULL,
  description text NOT NULL,
  project_id uuid NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE dashboard_manual_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access" ON dashboard_manual_alerts
  FOR SELECT USING (true);

CREATE POLICY "Allow insert access" ON dashboard_manual_alerts
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow update access" ON dashboard_manual_alerts
  FOR UPDATE USING (true) WITH CHECK (true);

CREATE POLICY "Allow delete access" ON dashboard_manual_alerts
  FOR DELETE USING (true);
