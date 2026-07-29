# Supabase project rebuild checklist

Keep an encrypted offline copy of this checklist and a separate password-manager
record containing the corresponding secret values. Do not put provider secrets,
database passwords, API keys, bot tokens, or recovery URLs in this document.

## Before an incident

- Record the Supabase organization, project name, region, plan, and PostgreSQL version.
- Record the expected Vaultbase backup mode and whether Storage object bodies are required.
- Keep the Restic password, Vaultbase master key, R2 credentials, and project credentials in a password manager.
- Keep application and Edge Function source in version control.
- Record the names, but not the values, of every application and Edge Function secret.
- Record custom domains, DNS records, network restrictions, webhook endpoints, and external callback URLs.
- Complete and record at least one disposable-project restore drill.

## Create the replacement project

- Create a new Supabase project in the intended organization and region.
- Confirm PostgreSQL compatibility before restoring.
- Enable required database extensions.
- Recreate network restrictions and custom domains.
- Record the new project reference and connection endpoints.

## Restore the application database

- Download the intended Vaultbase recovery pack.
- Verify every file against `manifest.json`.
- Review `roles.sql` before applying it to the managed project.
- Restore application schema before application data.
- Restore application data with error-stop behavior enabled.
- Validate functions, triggers, indexes, grants, RLS policies, publications, and scheduled jobs.
- Compare critical table counts with the manifest/source records.
- Do not restore Vault or managed platform schemas blindly; follow the tested restore-drill procedure.

## Restore Authentication

- Recreate the Site URL and allowed redirect URLs.
- Reconfigure OAuth providers and their callback URLs.
- Restore SMTP, email templates, CAPTCHA, MFA, hooks, and rate limits.
- Restore Auth users and identities only through the procedure proven by the restore drill.
- Rotate or update application API keys and JWT-related configuration as required.
- Test sign-in, token refresh, sign-out, password reset, and each enabled OAuth provider.

## Restore Storage

- Recreate bucket names and public/private settings.
- Recreate file-size and MIME-type restrictions.
- Restore object bodies through a supported Storage or S3 interface.
- Recreate Storage access policies.
- Validate representative private, public, and signed-object downloads.
- Do not assume that restoring raw `storage` metadata is sufficient until the process has passed a hosted Supabase restore drill.

## Restore application infrastructure

- Deploy the application and Edge Functions from version control.
- Populate environment variables and function secrets from the password manager.
- Update Supabase URLs, public keys, service credentials, and webhook targets.
- Re-register the Telegram webhook and other inbound integrations.
- Update DNS and TLS configuration.
- Rotate credentials that may have been exposed during the incident.

## Acceptance test

- The application and moderation bot start without configuration errors.
- Existing users can authenticate.
- Critical database records and relationships are present.
- RLS permits and denies the expected operations.
- Storage objects are accessible with the intended permissions.
- Telegram updates and other webhooks are processed successfully.
- A fresh Vaultbase backup succeeds.
- The Vaultbase restore verification succeeds.
- Healthchecks receives a successful heartbeat.
- Direct Telegram failure and recovery tests reach the owner.

Record the date, operator, source snapshot ID, verification results, and any manual
steps discovered during the exercise. Update this checklist after every drill.
