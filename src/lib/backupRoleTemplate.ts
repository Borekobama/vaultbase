export const BACKUP_ROLE_NAME = 'vaultbase_backup'

export const BACKUP_ROLE_SQL = `DO $vaultbase$
DECLARE
  backup_password CONSTANT text := 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD';
BEGIN
  IF backup_password = 'REPLACE_WITH_A_LONG_RANDOM_PASSWORD' THEN
    RAISE EXCEPTION 'Replace the placeholder with a long random password before running this script.';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'vaultbase_backup') THEN
    EXECUTE format(
      'ALTER ROLE vaultbase_backup WITH LOGIN PASSWORD %L
       NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
       BYPASSRLS INHERIT CONNECTION LIMIT 5',
      backup_password
    );
  ELSE
    EXECUTE format(
      'CREATE ROLE vaultbase_backup WITH LOGIN PASSWORD %L
       NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION
       BYPASSRLS INHERIT CONNECTION LIMIT 5',
      backup_password
    );
  END IF;

  GRANT CONNECT ON DATABASE postgres TO vaultbase_backup;
  GRANT pg_read_all_data TO vaultbase_backup;
  REVOKE pg_write_all_data FROM vaultbase_backup;
  REVOKE CREATE ON DATABASE postgres FROM vaultbase_backup;
  REVOKE CREATE ON SCHEMA public FROM vaultbase_backup;

  ALTER ROLE vaultbase_backup SET default_transaction_read_only = on;
END
$vaultbase$;`
