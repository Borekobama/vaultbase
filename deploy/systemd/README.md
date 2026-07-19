# Deprecated systemd deployment

These units are retained only for migration reference. The supported production path is `infra/docker-compose.yml`, which runs the compiled server output with the hardened container configuration.

Do not install these units for a new Vaultbase deployment. They execute TypeScript source through `tsx`, do not receive the same runtime hardening, and may be removed after existing installations have migrated to Docker.
