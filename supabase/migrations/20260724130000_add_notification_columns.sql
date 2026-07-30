-- Add notification tracking columns to payslips
-- Run id: 20260724130000

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_status') THEN
    CREATE TYPE notification_status AS ENUM ('pending','sent','failed');
  END IF;
END$$;

ALTER TABLE payslips
  ADD COLUMN IF NOT EXISTS notification_status notification_status NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS notification_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS notification_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS notification_last_error text;

CREATE INDEX IF NOT EXISTS idx_payslips_run_notification_status
  ON payslips (payroll_run_id, notification_status);
