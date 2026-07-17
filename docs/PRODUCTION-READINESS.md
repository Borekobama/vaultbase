# Production capability status

## Implemented and verified

- Local PostgreSQL primary and schema-identical Supabase metadata mirror
- Daily atomic mirror and independent content-hash verification
- Authenticated loopback API with rate limiting and security headers
- AES-256-GCM local secret store; metadata databases contain references only
- Supabase connection parsing and port-5432 backup safety validation
- Database recovery packs with roles, schema, data, SHA-256 manifest and Restic upload
- Full-project database components for Auth data and Storage metadata
- Incremental Supabase Storage S3 cache/sync implementation (requires per-project Storage credentials for external verification)
- R2/Restic encrypted repository
- Authenticated ZIP download stream
- Isolated PostgreSQL restore drill with checksum, schema, data and `ANALYZE` verification
- GFS retention: 24 hourly, 7 daily, 4 weekly, 12 monthly, protected labels
- Daily metadata mirror timers, verification timer and weekly prune timer
- Authenticated React UI with real project, job, activity and download data
- Secure HttpOnly session flow with CSRF/origin protection
- Per-project backup and keep-alive scheduler with jitter and advisory overlap locks
- Hardened Docker stack with PostgreSQL 17, read-only application containers and loopback-only port 12013
- aaPanel Nginx HTTPS reverse-proxy deployment scripts

## Implemented boundary, awaiting credentials for external verification

- Supabase Storage object bodies: requires each project's Storage S3 endpoint, access key and secret

## Optional expansion backlog

- Management API project discovery/status/configuration export
- Auth provider/JWT configuration recovery through Management API
- Edge Function source/config recovery
- Email/Telegram/Discord/Slack alert delivery and dead-man monitor
- Configuration/schema drift UI
- Immutable weekly/monthly R2 export bucket and bucket-lock policy
- Second-provider replication
- Automated temporary Supabase-project restore drills; current drills target isolated PostgreSQL

The core database backup, download, restore-verification, keep-alive and metadata-mirror system is deployable without these integrations. Features in this backlog must not be represented as available in the UI until implemented and externally verified.
