# Vaultbase

A Supabase-inspired control plane for encrypted database backups and keep-alive scheduling.

## What works today

- Responsive, accessible Supabase-inspired dashboard backed by the production API
- Vaultbase-key login using an HttpOnly, SameSite session cookie
- Local PostgreSQL metadata database with a schema-identical daily Supabase mirror
- AES-256-GCM encrypted project secrets stored outside both metadata databases
- Scheduled database/full-project recovery packs and Free-plan keep-alive queries
- Roles, schema, data, Auth data, Storage metadata, manifests and checksums
- Encrypted R2/Restic upload, GFS retention and protected snapshot labels
- Real ZIP downloads and isolated PostgreSQL restore verification
- Optional incremental Supabase Storage object synchronization when S3 credentials are supplied
- Measured-size backup planning for Free, Pro and Team projects
- TypeScript tests, production builds, browser smoke tests and accessibility checks

The planner uses current included egress allowances (Free: 5 GB/month; Pro/Team: 250 GB/month) and assigns 60% to backups, leaving 40% for application traffic. Supabase allowances are organization-wide, so projects in the same organization must share the budget. Recommendations start only after a first dump measures the actual export size.

Production uses local PostgreSQL on the VPS for project metadata, schedules, snapshot references and job history. The same schema is mirrored atomically to a separate Supabase PostgreSQL project once daily. The local database is authoritative and the mirror is never part of the request path. Raw database and R2 credentials stay in separate secret files and are never mirrored. Downloads restore the selected Restic snapshot into a dedicated disk-backed work volume and stream a generated ZIP through the authenticated API. The work volume must reside on encrypted host storage and is cleaned after each operation and on service startup.

## Development

```bash
npm install
npm run dev
```

Open <http://localhost:5173>.

## Verification

```bash
npm test
npm run build
python3 smoke_test.py
```

The browser test expects the Vite server on port 5173 and Playwright for Python with Chromium installed.

## VPS / aaPanel deployment

The production stack runs the UI/API, scheduler and PostgreSQL in Docker. Only `127.0.0.1:12013` is published; aaPanel Nginx terminates HTTPS and proxies the domain to that loopback port.

```bash
./bin/setup.sh
# Edit the single generated .env file and fill every placeholder.
./bin/deploy.sh --clean-build
./bin/deploy.sh --status
```

Set `NGINX_DOMAIN` and `PUBLIC_ORIGIN=https://your-domain` in `.env`. Create that site and issue its certificate in aaPanel before deployment; `bin/nginx-sync.sh` installs and validates the reverse proxy. A domain is strongly recommended because production session cookies require HTTPS. For a loopback-only health check, a domain is not required.

Persistent data lives in the Docker PostgreSQL volume and the ignored `runtime/` directories. The ignored, mode-600 `.env` is the deployment source for application, R2 and Restic settings. At deploy time, Vaultbase automatically materializes the R2 and Restic values as protected mounted files so they do not appear in the container environment. Keep independent password-manager copies of the R2 credentials, Vaultbase master key and Restic password; losing the original Restic password makes the existing repository unrecoverable.

The public Supabase Root 2021 CA certificate is tracked at `certs/prod-ca-2021.crt` and mounted into both application containers automatically. It therefore moves with the project during redeployment. Database dumps, keep-alive checks, and metadata mirroring use full certificate and hostname verification. Replace the tracked certificate if Supabase rotates its database CA.

If any credential is exposed in a log, chat, or screenshot, follow [the incident rotation runbook](./docs/INCIDENT-ROTATION.md) before resuming backups.

See [docs/PRODUCTION-READINESS.md](./docs/PRODUCTION-READINESS.md) for the verified core and optional expansion backlog.
