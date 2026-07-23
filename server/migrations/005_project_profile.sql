ALTER TABLE vaultbase.projects
  ADD COLUMN IF NOT EXISTS environment text NOT NULL DEFAULT 'production'
    CHECK (environment IN ('production', 'staging', 'development')),
  ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT ''
    CHECK (length(notes) <= 240);
