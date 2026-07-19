# Database trust certificates

`prod-ca-2021.crt` is the public Supabase Root 2021 CA certificate used to verify Supabase PostgreSQL and pooler server identities. It is not a credential and is intentionally tracked so Docker deployments remain portable across hosts and project-directory moves.

The certificate currently expires on April 26, 2031. If Supabase rotates its database CA, verify the replacement fingerprint through the Supabase dashboard before updating this file.
