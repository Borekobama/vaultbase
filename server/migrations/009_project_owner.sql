ALTER TABLE vaultbase.projects
  ADD COLUMN IF NOT EXISTS owner_email text;

ALTER TABLE vaultbase.projects
  DROP CONSTRAINT IF EXISTS projects_owner_email_length_check;

ALTER TABLE vaultbase.projects
  ADD CONSTRAINT projects_owner_email_length_check
  CHECK (owner_email IS NULL OR length(owner_email) <= 254);
