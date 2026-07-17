# Security policy

## Current boundary

The production React interface uses the authenticated server API. A submitted PostgreSQL connection string is sent once over HTTPS, encrypted with AES-256-GCM and persisted as a local secret file; the browser and metadata databases receive only the secret reference.

The in-memory mock registry is compiled only for automated test mode. Production builds cannot select it at runtime.

The Supabase mirror contains metadata only. Never add database connection strings, R2 credentials, Restic passwords, API bearer tokens, or encryption keys to mirrored tables.

## Production controls

The server:

- encrypts project secrets at rest and keeps R2/Restic credentials in separate mounted files;
- inject secrets into runner processes without command-line arguments or logs;
- authenticates the UI with a Secure, HttpOnly, SameSite cookie and supports bearer tokens for automation;
- apply CSRF protection, rate limiting, request-size limits, and strict schema validation;
- maintain an append-only audit trail for secret and job operations;
- use a restrictive Content Security Policy and HTTPS;
- run backup commands without a shell and with least-privilege service accounts;
- verify restores regularly, not only successful uploads.

Deploy behind HTTPS and keep port 12013 bound to loopback. Rotate any credential that has been exposed in chat, logs or screenshots before protecting production data.

Report suspected vulnerabilities privately to the repository owner. Never include credentials, connection strings, or backup contents in an issue.
