# Vaultbase metadata databases

Vaultbase uses local PostgreSQL as the authoritative control-plane database. Every application write commits locally with normal PostgreSQL durability; there is no local sync interval.

The `vaultbase` schema is migrated identically into a separate Supabase PostgreSQL project. A daily job reads all recoverable tables from one repeatable-read snapshot and replaces the remote copy in one transaction. The remote database is never used by the normal request path.

Mirrored tables:

- `projects`
- `snapshots`
- `activities`
- `audit_events`
- `settings`

`mirror_runs` is local operational telemetry and is intentionally not mirrored. Raw credentials, Restic passwords and encryption keys never enter either metadata database.

## Development

```bash
createdb vaultbase
cp server/.env.example server/.env
npm run db:migrate
npm run db:migrate -- --mirror
npm run db:mirror
npm run db:mirror:check
npm run dev:api
```

The API binds to `127.0.0.1:8787`. Put it behind the same HTTPS reverse proxy as the frontend and require authentication. `/health` is intentionally non-sensitive; `/api/*` requires the configured bearer token.

## VPS schedule

The units under `deploy/systemd` are a deprecated legacy deployment path and are not used by the supported Docker deployment. They execute TypeScript sources with development tooling and may drift from the compiled container runtime. Do not install them for new deployments.

For historical systemd installations, the former setup was:

```bash
sudo systemctl enable --now vaultbase-mirror.timer vaultbase-mirror-check.timer vaultbase-api.service
```

The mirror runs daily around 03:15 with jitter and content verification runs around 04:00. `Persistent=true` catches up after downtime.
