ALTER TABLE vaultbase.project_secret_refs
  DROP CONSTRAINT IF EXISTS project_secret_refs_kind_check;

ALTER TABLE vaultbase.project_secret_refs
  ADD CONSTRAINT project_secret_refs_kind_check
  CHECK (kind IN ('database', 'database_direct', 'storage_s3', 'management_api'));
