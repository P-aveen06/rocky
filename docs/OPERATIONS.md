# Operations

Everything that isn't needed to understand or run Rocky, but is needed to keep
it running: databases, migrations, retention, and moving data between hosts.

See the [README](../README.md) for setup and deployment.

## Migrations

Alembic owns the schema everywhere except the zero-setup local SQLite path.

```bash
cd server && alembic upgrade head
```

If the database was first created with `AUTO_CREATE_SCHEMA=true`, `upgrade head`
fails with "table users already exists". The tables are there, but no
`alembic_version` row records which revision they match. Tell Alembic what the
schema already is, then upgrade:

```bash
cd server
alembic stamp 20260807_0007
alembic upgrade head
```

Only stamp a database whose schema really is at that revision — stamping records
a revision without running it.

Revision `20260808_0008` (transcript provenance) adds three
nullable-or-defaulted columns to `interview_turns` and backfills existing rows
with `transcription_source="legacy"`, so no turn, session or report is lost.
Back the file up first anyway:

```bash
cp data/interview_coach.db data/interview_coach.db.bak
```

## Retention and deletion

Configured retention defaults to 30 days for transcripts, drafts and delivery
metrics, and 90 days for usage events. Run cleanup with:

```bash
cd server && python scripts/run_retention.py
```

The **Privacy & usage** workspace in the app shows the daily session quota,
content-free usage counts, the active retention defaults, and whether provider
cost telemetry is available. A session can be deleted from its own card after
confirmation. Account deletion requires typing `DELETE MY ACCOUNT`; repeated
deletion calls are idempotent, and a PII-free terminal receipt prevents silent
recreation.

## Neon PostgreSQL for local development

Create a Neon project, open its **Connect** dialog, disable connection pooling,
and copy the direct connection string. Don't paste it into chat or commit it —
it contains the database password.

```text
APP_ENV=local
AUTH_MODE=local
AUTO_CREATE_SCHEMA=false
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@ep-example.REGION.aws.neon.tech/neondb?sslmode=verify-full
```

If Neon gave you a URL beginning `postgresql://`, the application adds the
`asyncpg` driver itself. It also adapts Neon's libpq-oriented `channel_binding`
option to asyncpg with full TLS certificate and hostname verification.

Then `alembic upgrade head`, start the API, and create a session and refresh to
confirm it persists.

## Supabase PostgreSQL for local development

Production uses PostgreSQL inside Zerops. Supabase is still supported for local
work or data export. In the Supabase dashboard open **Project Settings →
Database → Connection string → URI** and copy the **session pooler** URL:

```text
postgresql://postgres.PROJECTREF:PASSWORD@aws-0-REGION.pooler.supabase.com:5432/postgres
```

Four details matter, and the application handles each of them:

- **Use the pooler, not the direct endpoint.** `db.PROJECTREF.supabase.co`
  publishes only an AAAA record — IPv6-only, and unreachable from an IPv4-only
  network. The pooler is IPv4 on every tier. Note the username is
  `postgres.PROJECTREF`, not plain `postgres`.
- **Port 5432 is session mode; 6543 is transaction mode.** Session mode is the
  simpler default. On 6543 the app detects the port and turns off both asyncpg's
  and SQLAlchemy's prepared-statement caches, because a transaction pooler
  multiplexes connections and would otherwise fail with
  `DuplicatePreparedStatement`.
- **TLS uses Supabase's own CA.** Supabase serves a certificate issued by
  `Supabase Root 2021 CA`, which is in no public trust store, so verifying
  against certifi fails with `CERTIFICATE_VERIFY_FAILED`. That root is public and
  is vendored at `server/certs/supabase-prod-ca-2021.crt`; Supabase hosts use it
  automatically. `DATABASE_SSL_ROOT_CERT` overrides it if the root ever rotates.
- **`sslmode` and `channel_binding` are stripped** from the URL before it reaches
  asyncpg, which doesn't accept them. Verification still happens — this is
  `verify-full`, not a downgrade.

## Adding PostgreSQL to an existing Zerops project

For a project that currently uses Supabase, import only the database service:

```bash
zcli project service-import zerops-db-import.yml
```

The runtime maps `DATABASE_URL` to Zerops's generated `${db_connectionString}`.
The app connects to `db:5432` on the project's private network, so no public
database IP and no committed password are needed.

## Moving existing Supabase data into Zerops

Skip this if the existing rows are disposable — the first deploy runs
`alembic upgrade head` and creates a clean schema.

To keep the data: stop writes to the Supabase-backed app, use a `pg_dump` client
at least as new as the Supabase server, and export only the application-owned
`public` schema. Keep both connection URLs out of shell history and source
control.

```bash
pg_dump "$SOURCE_DATABASE_URL" \
  --format=custom \
  --schema=public \
  --no-owner \
  --no-acl \
  --file=/tmp/rocky-public.dump
```

Start the Zerops VPN, copy the internal connection URL from the `db` service's
**Peek access details**, and restore before deploying the application:

```bash
pg_restore \
  --dbname="$ZEROPS_DATABASE_URL" \
  --clean \
  --if-exists \
  --no-owner \
  --no-acl \
  /tmp/rocky-public.dump
```

The dump includes `alembic_version`, so the deploy-time migration only advances
revisions that weren't already there. Afterwards, check `/api/health/ready`, sign
in, and confirm an existing interview and report still open before pausing or
removing the Supabase project.

## Runtime dependency note

`server/requirements.txt` is what Zerops installs at runtime, because the prepare
container can't see the build tree and so can't `pip install .`. Keep it in sync
with `[project].dependencies` in `server/pyproject.toml`.

## Manual acceptance pass

Automated tests don't cover the parts that need a real browser, a real
microphone and a real provider:

1. Create a practice session; the setup page opens immediately.
2. Upload a text-based PDF or DOCX under 5 MB and select **Extract profile**.
3. Generate and save a scorecard totalling 100%, then **Continue to preflight**.
4. Play the headphone test sound and confirm it. Select **Developer text** where
   speaking isn't practical — the browser must not request camera or microphone
   permission in that mode.
5. Start an interview. Confirm spoken audio, live transcript, connection state
   and countdown.
6. Submit multiline text with Ctrl/Cmd+Enter; Enter alone adds a newline. Refresh
   before submitting a second draft and confirm the draft returns.
7. Disconnect and reconnect once. A pending submitted answer must not appear
   twice.
8. Stop the interview and wait for the report. Expand a transcript excerpt and
   confirm the quote matches what was submitted.
9. In text mode, **Speaking delivery** must be marked unavailable rather than
   scored.
10. Open **Privacy & usage** and verify the active quota and retention policy.
    Test session deletion only on a disposable session.
11. In voice mode, speak one non-sensitive answer. The candidate turn must appear
    once — first as live text, then replaced by the final transcript, ending with
    `transcription_source="final_model"`.
12. Repeat the short formats: a 2-minute and a 5-minute session ask one focused
    evidence question with a concise follow-up rather than a compressed version
    of the full interview.

Voice-mode completion on current Chrome, Safari and Edge, the latency and
impaired-network measurements, and the dual-transcription degradation matrix all
remain manual release checks.
