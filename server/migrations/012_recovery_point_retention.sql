INSERT INTO vaultbase.settings(key, value)
VALUES ('retention', '{"recoveryPoints":7,"keepProtected":true,"frequency":"daily"}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
