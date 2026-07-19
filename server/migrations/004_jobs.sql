CREATE TABLE IF NOT EXISTS vaultbase.jobs (
  id uuid PRIMARY KEY,
  project_id text NOT NULL REFERENCES vaultbase.projects(id) ON DELETE CASCADE,
  job_type text NOT NULL CHECK (job_type IN ('backup')),
  status text NOT NULL CHECK (status IN ('queued', 'running', 'success', 'failed')),
  result jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_summary text,
  created_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS jobs_one_active_backup_per_project_idx
  ON vaultbase.jobs(project_id, job_type)
  WHERE status IN ('queued', 'running');

CREATE INDEX IF NOT EXISTS jobs_created_idx ON vaultbase.jobs(created_at DESC);
