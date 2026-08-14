# PostgreSQL to MySQL 8 Migration

PostgreSQL remains supported and is the default runtime database. Do not switch `DB_ENGINE` to `mysql` until the migration command reports `"valid": true`.

## Requirements

- A reachable PostgreSQL source configured through `DATABASE_URL` or the existing `DB_*` variables.
- A MySQL 8 target configured through `MYSQL_URL` or the `MYSQL_*` variables.
- An empty MySQL database, or an approved replacement of its existing runtime data.
- A database backup before replacing any existing MySQL data.

The MySQL account needs permission to create and alter tables, indexes, and foreign keys during initial setup.

## Local MySQL 8

With Docker Desktop running, a local development target can be created with:

```bash
docker run --name singhsabha-mysql \
  --restart unless-stopped \
  -e MYSQL_ROOT_PASSWORD=local-root-password \
  -e MYSQL_DATABASE=singhsabha \
  -e MYSQL_USER=singhsabha \
  -e MYSQL_PASSWORD=local-app-password \
  -p 3307:3306 \
  -v singhsabha-mysql-data:/var/lib/mysql \
  -d mysql:8.4
```

Use development-only passwords for a local container. Do not commit credentials.

## Configure

Keep the PostgreSQL settings and add MySQL settings to `.env.local`:

```dotenv
DB_ENGINE=postgresql
DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/DBNAME

MYSQL_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=true
```

For a local MySQL container, set `MYSQL_SSL=false`.

The local container above is available at `127.0.0.1:3307` and persists data in the `singhsabha-mysql-data` Docker volume.

## Migrate

The migration creates the MySQL schema, copies canonical runtime data, and compares row counts and record identities:

```bash
npm run db:migrate:mysql
```

The command refuses to modify a non-empty MySQL target. To replace a target after confirming its backup and destination:

```bash
npm run db:migrate:mysql -- --replace
```

A successful result ends with:

```json
{
  "countMismatches": [],
  "identityMismatches": [],
  "valid": true
}
```

## Verify and Cut Over

Recheck the databases without modifying either one:

```bash
npm run db:verify:mysql
```

Run disposable behavior checks. Both commands create temporary records and remove them afterward:

```bash
npm run db:smoke:mysql
npm run newsletter:smoke
```

If MySQL has already received post-cutover writes, do not use `--replace`. Create and populate the full relational mirror schema without changing the canonical MySQL runtime tables:

```bash
npm run db:sync:mysql-relational
```

This command creates all 33 PostgreSQL-equivalent table names, copies the 25 relational mirror tables in foreign-key order, then overlays newer records from MySQL's canonical `app_items` and `app_singletons` stores. Count differences are reported because post-cutover MySQL data can legitimately be newer than PostgreSQL.

After verification succeeds, set:

```dotenv
DB_ENGINE=mysql
```

Restart the backend and test content administration, subscriptions, bookings, event registration and waitlists, donations, quiz files, and search.

## Roll Back

Set `DB_ENGINE=postgresql` and restart the backend. The PostgreSQL adapter and configuration remain intact. Writes made after MySQL cutover are not automatically replicated back to PostgreSQL, so reconcile those records before rollback in production.

## Data Scope

The migration copies:

- Generic singleton and item content
- Quiz bank files
- Events and event registrants
- Donation campaigns
- Active donations
- Pending donations
- All 25 typed relational mirror tables, including CMS, users, schedule, seva, library, hukamnama, media, subscribers, and analytics

Soft-deleted donation rows are intentionally excluded because they are not part of the runtime donation feed. JSON data is stored in native MySQL `JSON` columns and timestamps use UTC connections.
