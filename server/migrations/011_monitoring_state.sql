CREATE TABLE IF NOT EXISTS vaultbase.monitoring_state (
  scope text PRIMARY KEY,
  label text NOT NULL,
  status text NOT NULL CHECK (status IN ('healthy', 'failed')),
  failure_started_at timestamptz,
  last_failure_at timestamptz,
  recovered_at timestamptz,
  last_error_fingerprint text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
