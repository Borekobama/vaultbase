# Vaultbase runner bootstrap

The runner is the trusted process that resolves encrypted Supabase database secret references, creates logical recovery packs, encrypts them with Restic, and uploads them to Cloudflare R2.

Configure the R2 endpoint, bucket, region, and credentials only in the runner's ignored deployment files. Do not commit account-specific endpoints or bucket names to this repository.

The Restic repository was initialized and integrity-checked on July 17, 2026. It is ready to receive encrypted snapshots. The initial password is stored locally at `.vaultbase-secrets/restic-password` and is excluded from Git.

## Cloudflare action required

Create an R2 API token with:

- `Object Read & Write`
- Access restricted to the configured backup bucket

Cloudflare returns an Access Key ID and Secret Access Key once. Save them in your password manager, then place them only in `/etc/vaultbase/r2.env` on the runner. Do not paste them into chat, Git, the browser UI, or a shell command.

The repository must not have a Cloudflare lifecycle rule that deletes individual Restic objects. Retention is managed by Restic using `forget` and `prune`.

## Install on the VPS/NAS

On Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y awscli restic postgresql-client util-linux
sudo install -d -m 750 -o root -g root /etc/vaultbase
sudo install -m 640 -o root -g root runner/r2.env.example /etc/vaultbase/r2.env
sudo install -m 755 runner/check-r2.sh /usr/local/bin/vaultbase-check-r2
sudo install -m 755 runner/check-restic.sh /usr/local/bin/vaultbase-check-restic
```

Edit `/etc/vaultbase/r2.env` and replace only the two R2 credential placeholders. Then run:

```bash
sudo vaultbase-check-r2
```

The test only checks access to the bucket; it does not upload a backup.

After copying the Restic password to `/etc/vaultbase/restic-password`, verify the initialized repository with:

```bash
sudo vaultbase-check-restic
```

## Restore encryption key

Create a separate Restic password and keep a second copy in your password manager:

```bash
sudo sh -c 'umask 077; openssl rand -base64 48 > /etc/vaultbase/restic-password'
sudo sh -c 'printf "\nRESTIC_PASSWORD_FILE=/etc/vaultbase/restic-password\n" >> /etc/vaultbase/r2.env'
```

Without this password, the R2 objects cannot be restored.

## Hosting with aaPanel

The UI and API can run on the same VPS. A domain is not technically required for an internal test: the app can listen on `127.0.0.1` and aaPanel/Nginx can proxy it. A domain is strongly recommended for real use so aaPanel can issue HTTPS certificates and the control plane can use secure cookies and a stable origin.

The runner itself does not need to be public. Keep it bound to localhost or a private network and let the control-plane API enqueue jobs through a local Unix socket or authenticated private endpoint.

The production UI uses authenticated API sessions. A mock registry remains available only to automated tests and is excluded from production behavior.
