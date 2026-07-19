# Credential exposure rotation runbook

Use this sequence whenever production credentials appear in chat, terminal capture, CI output, or another persistent log. Never paste replacement values into an issue or chat.

## 1. Contain and inventory

1. Restrict access to the exposed log and record who or what could read it.
2. Stop Vaultbase application and scheduler containers before changing database or encryption credentials.
3. Back up the local PostgreSQL volume and the encrypted secret directory. Preserve the current Restic password until the new repository key has been tested.
4. List the exact exposed values and every service that consumes them. A mostly exposed high-entropy value is treated as fully exposed.

## 2. Rotate external access

1. Create a new bucket-scoped Cloudflare R2 token with only Object Read & Write access. Update the ignored R2 environment file, test repository access, and revoke the old token.
2. Reset the mirror Supabase database password and update the encoded mirror connection URL.
3. Reset the local PostgreSQL role password and update the Docker deployment environment in the same maintenance window.
4. Generate a new Vaultbase API token and invalidate all existing browser sessions by restarting the app container.

## 3. Rotate Restic access without stranding the repository

1. Generate a new password into a new mode-600 password file.
2. Authenticate with the existing password and add the new Restic repository key.
3. Authenticate using only the new password file and run `restic snapshots` followed by `restic check`.
4. Update Vaultbase to mount the new password file and complete one backup plus one restore verification.
5. List repository keys, identify the old key unambiguously, and remove only that key. Keep an independent password-manager copy of the new password.

Do not initialize a replacement repository over the existing bucket and do not delete the old password file before the new key passes both repository and restore checks.

## 4. Rotate the Vaultbase master key

Changing `VAULTBASE_MASTER_KEY` without re-encrypting every file under the secret directory makes all project credentials unreadable. Keep the services stopped and use a reviewed, backup-preserving migration that decrypts each envelope with the old key, writes an atomic replacement encrypted with the new key, and verifies every replacement before retiring the old key. Do not perform an in-place search-and-replace or delete the pre-rotation backup until a backup and restore drill succeeds.

## 5. Resume and verify

1. Start PostgreSQL, then the app and scheduler.
2. Confirm health, login, mirror connectivity, R2 access, a manual backup, and isolated restore verification.
3. Confirm failure/success activities and audit events are visible.
4. Revoke remaining old credentials and record completion outside the repository without including secret values.
