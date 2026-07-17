# vaultbase

Supabase-inspired control plane for self-hosted database backups and keep-alive jobs.

## Current build

This repository contains the first working UI slice: project registry, protection status, activity view, add-project flow, runner status, and local interaction state. It intentionally uses mock data until a NAS runner and encrypted secret provider are connected.

## Run locally

```bash
npm install
npm run dev
```

Then open the Vite URL shown in the terminal.

## Planned runner contract

The UI should communicate with a small runner API that resolves `database_secret` at job time. Secrets must remain outside the project registry and must never be returned to the browser.
