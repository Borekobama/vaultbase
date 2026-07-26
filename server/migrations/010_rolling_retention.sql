INSERT INTO vaultbase.settings(key, value)
VALUES ('retention', '{"windowDays":7,"keepLatest":true,"frequency":"daily"}'::jsonb)
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    updated_at = now();
