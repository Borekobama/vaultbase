CREATE TABLE IF NOT EXISTS vaultbase.project_secret_refs (
  project_id text NOT NULL REFERENCES vaultbase.projects(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('database', 'storage_s3', 'management_api')),
  secret_ref text NOT NULL UNIQUE,
  configured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, kind)
);

INSERT INTO vaultbase.project_secret_refs(project_id, kind, secret_ref)
SELECT id, 'database', secret_ref FROM vaultbase.projects
ON CONFLICT (project_id, kind) DO NOTHING;
