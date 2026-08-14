# Backend Production Environment Runbook

This guide explains how to configure and run the Singh Sabha Milton backend in production. It assumes this may be your first production deployment and explains both what to do and why.

> **Use one deployment method only.** If your backend is hosted by Render, Railway, Azure, AWS, or a similar platform, follow **Method A**. If you have a Linux virtual private server (VPS), follow **Method B**. Use PM2 or Docker only when your server or team already standardizes on them.

## 1. What You Are Configuring

This repository contains two applications:

| Part | What it does | When environment values are read |
| --- | --- | --- |
| React frontend | Runs in the visitor's browser | When `npm run build` creates `build/` |
| Node backend | Runs on the server and handles `/api/*` | Every time `node server/index.js` starts |

The frontend and backend environment values are not interchangeable.

### Frontend values are public

Frontend values start with `REACT_APP_`. They are compiled into JavaScript and can be read by anyone who opens the website. Public URLs and public identifiers are suitable frontend values.

The repository's `.env.production` is for these public build-time values. The built frontend does not read `.env.production` after it has been compiled.

### Backend values are private

MySQL passwords, SMTP passwords, Stripe secret keys, Zeffy API keys, webhook secrets, and the YouTube API key must be available only to the Node backend at runtime.

Set backend values in one of these places:

- The hosting platform's **Environment Variables** or **Secrets** page.
- A protected file outside the repository, loaded by systemd, PM2, or Docker.
- A secrets manager integrated with the hosting platform.

Never put backend secrets in:

- `.env.production`
- any `REACT_APP_*` variable
- `build/`
- Git
- a ticket, screenshot, chat message, or deployment document

## 2. Recommended Production Layout

Use one public domain and route traffic like this:

```text
Browser
  |
  | HTTPS https://singhsabhamilton.com
  v
Nginx, load balancer, or hosting-platform router
  |-- /api/*  -> Node backend on its private port
  `-- /*      -> React files in build/

Node backend -> MySQL 8
             -> SMTP provider
             -> Stripe/Zeffy/YouTube APIs
             -> persistent server/uploads storage
```

This is important because the frontend calls relative URLs such as `/api/health`. The proxy must send `/api/*` to Node while serving all other paths from `build/`.

The Node server does **not** serve the React `build/` directory itself.

## 3. Information to Collect First

Do not begin by guessing values. Obtain the following from the service owners or provider dashboards.

### Required

- Production website URL, for example `https://singhsabhamilton.com`.
- MySQL 8 host, port, database name, application username, and password.
- Whether the MySQL provider requires TLS/SSL. Managed databases normally do.
- The machine or platform where the Node backend will run.
- A persistent storage location for `server/uploads`.

### Required when email features are enabled

- SMTP hostname and port.
- SMTP username and password.
- Verified sender address.
- Contact form destination address.

### Required when the corresponding integration is enabled

- Stripe live secret key and live webhook signing secret.
- Zeffy API key and optional webhook token.
- YouTube Data API key.

Use production credentials, not local, sandbox, or test credentials.

## 4. Production Variable Template

This is a template, not a ready-to-use secret file. Replace every value containing angle brackets. Do not include the angle brackets in real values.

For a managed platform, create each entry in its Environment Variables page. For a VPS, place the entries in `/etc/singhsabha/backend.env` as explained in Method B.

```dotenv
# Runtime
NODE_ENV=production
DB_ENGINE=mysql
SERVER_PORT=4242

# MySQL 8 - recommended discrete form
MYSQL_HOST=<production-mysql-host>
MYSQL_PORT=3306
MYSQL_USER=<application-database-user>
MYSQL_PASSWORD=<strong-database-password>
MYSQL_DATABASE=<production-database-name>
MYSQL_SSL=true
MYSQL_SSL_REJECT_UNAUTHORIZED=true
MYSQL_POOL_SIZE=10

# Public production URLs used inside server-generated email
PUBLIC_SITE_URL=https://singhsabhamilton.com
VOLUNTEER_REMINDER_BASE_URL=https://singhsabhamilton.com
VOLUNTEER_REMINDER_LOGO_URL=https://singhsabhamilton.com/<public-logo-path>
VOLUNTEER_REMINDER_ORG_NAME=Singh Sabha Milton Gurdwara

# SMTP email delivery
LOCAL_MAIL_TRANSPORT=smtp
LOCAL_MAIL_FROM=no-reply@singhsabhamilton.com
SMTP_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=<gmail-smtp-username>
SMTP_PASS=<gmail-app-password>
SMTP_FROM=no-reply@singhsabhamilton.com
CONTACT_US_EMAIL=<contact-inbox-address>

# Future SMTP2GO credentials; not used while SMTP_PROVIDER=gmail
SMTP2GO_HOST=mail.smtp2go.com
SMTP2GO_PORT=587
SMTP2GO_SECURE=false
SMTP2GO_USER=<smtp2go-smtp-username>
SMTP2GO_PASS=<smtp2go-smtp-password>
SMTP2GO_FROM=no-reply@singhsabhamilton.com

# Newsletter signing and delivery
NEWSLETTER_UNSUBSCRIBE_SECRET=<random-secret-at-least-32-bytes>
NEWSLETTER_SEND_CONCURRENCY=3

# Reminder schedules use the Toronto timezone
VOLUNTEER_REMINDER_SEND_TIME=09:00
VOLUNTEER_REMINDER_TIME_ZONE=America/Toronto
EVENT_REMINDER_SEND_TIME=09:00
EVENT_REMINDER_TIME_ZONE=America/Toronto
EVENT_REMINDER_DAYS=7,3,1
BOOKING_REMINDER_SEND_TIME=09:00
BOOKING_REMINDER_TIME_ZONE=America/Toronto
BOOKING_REMINDER_DAYS=7,4,2,1

# Stripe - omit these lines until live Stripe is enabled
STRIPE_SECRET_KEY=<stripe-live-secret-key>
STRIPE_WEBHOOK_SECRET=<stripe-live-webhook-signing-secret>
STRIPE_CURRENCY=cad

# Zeffy - omit unused optional entries
ZEFFY_API_KEY=<zeffy-api-key>
ZEFFY_WEBHOOK_TOKEN=<random-token-also-configured-at-zeffy>
ZEFFY_CAMPAIGN_ID=<numeric-local-campaign-id>
ZEFFY_CAMPAIGN_NAME=Help Us Build Our Gurdwara

# YouTube - omit until the media integration is enabled
YOUTUBE_API_KEY=<youtube-data-api-key>
```

### Values you normally omit

Do not set these unless there is a specific reason:

- `PORT`: most managed platforms create it automatically. On a VPS, use `SERVER_PORT=4242`.
- `DATABASE_URL` and PostgreSQL `DB_*`: the production runtime is MySQL.
- `MYSQL_URL`: the discrete `MYSQL_*` form above makes this application's TLS behavior explicit.
- `INTERNAL_MAIL_RELAY_URL`: the backend defaults to its own internal relay route.
- Reminder webhook URLs: when omitted, reminders use the backend's internal mail relay and SMTP configuration.
- `DANGEROUSLY_DISABLE_HOST_CHECK`: development only.

Delete optional lines instead of saving fake values such as `change-me`. A fake value may look configured to the application and cause confusing failures.

### Switch from Gmail to SMTP2GO

Gmail remains active while this value is set:

```dotenv
SMTP_PROVIDER=gmail
```

The `SMTP2GO_*` values are kept separate and are never used in Gmail mode. After the SMTP2GO credentials are available and the sender domain's SPF/DKIM records are verified, change only:

```dotenv
SMTP_PROVIDER=smtp2go
```

Restart or redeploy the backend, then confirm `/api/health` reports `"smtpProvider": "smtp2go"` and send a test email. To roll back immediately, restore `SMTP_PROVIDER=gmail` and restart the backend.

### Generate the newsletter secret

Run this on a trusted administrator machine or on the server:

```bash
openssl rand -hex 32
```

Place the output in `NEWSLETTER_UNSUBSCRIBE_SECRET`. Do not reuse a database, SMTP, or payment password. Rotating this secret invalidates previously issued newsletter unsubscribe links.

## 5. MySQL Configuration

### Use a dedicated application account

Do not run the website using MySQL's `root` account. If you manage MySQL yourself, connect as a database administrator and create a dedicated account:

```sql
CREATE DATABASE singhsabha
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER 'singhsabha_app'@'<backend-private-ip>'
  IDENTIFIED BY '<strong-unique-password>';

GRANT ALL PRIVILEGES ON singhsabha.*
  TO 'singhsabha_app'@'<backend-private-ip>';

FLUSH PRIVILEGES;
```

For a managed MySQL service, create the database and application user through its dashboard. Restrict network access to the backend service or its private network whenever the provider supports it.

### Choose the SSL settings

| MySQL location | Recommended values |
| --- | --- |
| Managed production database with a publicly trusted certificate | `MYSQL_SSL=true`, `MYSQL_SSL_REJECT_UNAUTHORIZED=true` |
| Private production database with TLS terminated by the provider | Follow the provider's TLS instructions; keep certificate verification enabled where supported |
| Local Docker MySQL used only for development | `MYSQL_SSL=false` |

Do not disable SSL verification merely to make an error disappear. First verify the hostname, provider CA requirements, firewall rules, and server time.

### Passwords containing special URL characters

The recommended discrete variables accept the password exactly as issued. This avoids URL-encoding mistakes with characters such as `@`, `:`, `/`, `#`, and `%`.

If a provider gives only a `MYSQL_URL`, store the exact provider-issued URL as one secret and do not also set the discrete fields. Test the connection before cutover.

## 6. Method A: Managed Hosting Platform

This is the easiest method for a first deployment. Names vary by provider, but the settings are usually under **Service**, **Configuration**, **Environment**, or **Secrets**.

### A1. Create the backend web service

Use these service settings:

| Setting | Value |
| --- | --- |
| Runtime | Node.js 20 LTS |
| Install command | `npm ci --omit=dev` |
| Start command | `node server/index.js` |
| Health-check path | `/api/health` |
| Working directory | repository root |
| Restart policy | always/on failure |

Do not use `npm start` in production. In this repository, `npm start` also starts the Create React App development server.

### A2. Add the environment variables

1. Open the backend service's Environment Variables or Secrets page.
2. Add each required key from the production template.
3. Paste each secret value directly from its provider.
4. Mark secret values as encrypted or secret when the platform offers that choice.
5. Do not set `SERVER_PORT` if the platform requires its own generated `PORT`.
6. Save the configuration and redeploy or restart the backend.

The backend accepts a platform-provided `PORT`. An explicitly configured `SERVER_PORT` takes priority, so leave it unset unless the platform instructs otherwise.

### A3. Configure persistent storage

Attach a persistent disk or volume to the repository's `server/uploads` directory. The exact absolute path depends on the provider.

Also consider persistence for:

- `server/data`, which contains scheduler logs and JSON fallback files.
- `public/quiz`, if quiz files are edited through production administration tools.

Without persistent storage, uploads and file-backed changes can disappear during a redeploy.

### A4. Configure frontend routing

The frontend uses `/api/*` on the same public origin. Configure the platform router, CDN, or reverse proxy so:

- `/api/*` reaches the Node backend.
- all other paths reach the static React `build/` output.
- unmatched frontend paths fall back to `build/index.html`.

Do not rewrite `/api/health` to `/health`; the backend expects the complete `/api/...` path.

### A5. Verify

Open:

```text
https://<production-domain>/api/health
```

The response should include:

```json
{
  "ok": true,
  "eventsDatabaseConfigured": true,
  "databaseEngine": "mysql"
}
```

If `eventsDatabaseConfigured` is `false`, stop the deployment and fix MySQL configuration before allowing production writes.

## 7. Method B: Linux VPS with systemd and Nginx

Use this method when you control an Ubuntu/Debian-style server. Adapt usernames and paths to your server.

### B1. Suggested filesystem layout

```text
/var/www/singhsabha/current/       application checkout
/etc/singhsabha/backend.env       protected backend settings
/var/log/ or system journal       backend logs
```

Create a non-login service user if one does not already exist:

```bash
sudo useradd --system --home /var/www/singhsabha --shell /usr/sbin/nologin singhsabha
```

Install Node.js 20 LTS and Nginx using your organization's approved method. Confirm the actual Node path:

```bash
command -v node
node --version
```

### B2. Install the application

Place the repository at `/var/www/singhsabha/current`, then run:

```bash
cd /var/www/singhsabha/current
npm ci
npm run build
sudo chown -R singhsabha:singhsabha server/uploads server/data public/quiz
```

The build command creates the public frontend in `build/`. Do not deploy your development `.env.local` file to the server.

### B3. Create the protected backend environment file

```bash
sudo install -d -m 750 -o root -g singhsabha /etc/singhsabha
sudo install -m 640 -o root -g singhsabha /dev/null /etc/singhsabha/backend.env
sudoedit /etc/singhsabha/backend.env
```

Enter the values from the production template. The file must contain `KEY=value` entries with no `export` prefix.

Check permissions without printing its contents:

```bash
sudo stat -c '%A %U %G %n' /etc/singhsabha/backend.env
```

Expected ownership is `root singhsabha`, and only root should be able to write it.

### B4. Create the systemd service

Create `/etc/systemd/system/singhsabha-backend.service`:

```ini
[Unit]
Description=Singh Sabha Milton Node backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=singhsabha
Group=singhsabha
WorkingDirectory=/var/www/singhsabha/current
EnvironmentFile=/etc/singhsabha/backend.env
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=5
TimeoutStopSec=30
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

Use the value returned by `command -v node` in `ExecStart` if it is not `/usr/bin/node`.

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now singhsabha-backend
sudo systemctl status singhsabha-backend --no-pager
```

Check the private health endpoint from the VPS:

```bash
curl --fail http://127.0.0.1:4242/api/health
```

### B5. Configure Nginx

Create `/etc/nginx/sites-available/singhsabha`:

```nginx
server {
    listen 80;
    server_name singhsabhamilton.com www.singhsabhamilton.com;

    root /var/www/singhsabha/current/build;
    index index.html;
    client_max_body_size 16m;

    location /api/ {
        proxy_pass http://127.0.0.1:4242;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

Enable and test the configuration:

```bash
sudo ln -s /etc/nginx/sites-available/singhsabha /etc/nginx/sites-enabled/singhsabha
sudo nginx -t
sudo systemctl reload nginx
```

Install an HTTPS certificate using your approved certificate process, such as Certbot. Production login, donations, webhooks, and credentials must use HTTPS.

Firewall rules should expose ports `80` and `443`, plus restricted administrative SSH access. Do not expose backend port `4242` or MySQL port `3306` to the public internet.

### B6. Deploy future updates

After placing a tested release on the server:

```bash
cd /var/www/singhsabha/current
npm ci
npm run build
sudo systemctl restart singhsabha-backend
curl --fail http://127.0.0.1:4242/api/health
```

Use an atomic release/symlink process when your infrastructure supports one. Preserve the environment file and persistent directories between releases.

## 8. Method C: PM2 on a VPS

Use PM2 only if PM2 is already your team's process manager. Nginx and the persistent-storage requirements remain the same as Method B.

Load the protected environment file into the current shell and start the backend:

```bash
cd /var/www/singhsabha/current
set -a
. /etc/singhsabha/backend.env
set +a
pm2 start server/index.js --name singhsabha-backend --cwd /var/www/singhsabha/current
pm2 save
pm2 startup
```

`pm2 startup` prints a machine-specific command. Review it and run that generated command using the account that owns the PM2 process.

After changing a backend variable:

```bash
set -a
. /etc/singhsabha/backend.env
set +a
pm2 restart singhsabha-backend --update-env
pm2 save
```

Verify with:

```bash
pm2 status
pm2 logs singhsabha-backend --lines 100
curl --fail http://127.0.0.1:4242/api/health
```

Do not commit a PM2 ecosystem file containing secrets.

## 9. Method D: Docker Compose

Use this only if the deployment already uses Docker. Store the production environment file outside the repository and mount persistent directories.

An example backend service is:

```yaml
services:
  backend:
    build: .
    restart: unless-stopped
    env_file:
      - /etc/singhsabha/backend.env
    ports:
      - "127.0.0.1:4242:4242"
    volumes:
      - /srv/singhsabha/uploads:/app/server/uploads
      - /srv/singhsabha/data:/app/server/data
      - /srv/singhsabha/quiz:/app/public/quiz
    healthcheck:
      test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:4242/api/health').then(r => { if (!r.ok) process.exit(1) })"]
      interval: 30s
      timeout: 10s
      retries: 3
```

The example assumes the image uses `/app` as its working directory and starts `node server/index.js`. Match paths to the actual Dockerfile. Do not copy `.env`, `.env.local`, or the production secret file into the image.

Start and verify:

```bash
docker compose up -d --build
docker compose ps
docker compose logs --tail=100 backend
curl --fail http://127.0.0.1:4242/api/health
```

## 10. Configure External Services

### SMTP

For port `587`, normally use:

```dotenv
SMTP_PORT=587
SMTP_SECURE=false
```

This starts unencrypted and upgrades with STARTTLS. For provider-documented implicit TLS on port `465`, use:

```dotenv
SMTP_PORT=465
SMTP_SECURE=true
```

Verify the sender domain's SPF and DKIM records in the SMTP provider dashboard. Test the contact form, one reminder email, one donation receipt, and newsletter subscribe/unsubscribe behavior.

### Stripe

1. Switch the Stripe dashboard to live mode.
2. Store the live `STRIPE_SECRET_KEY` only in the backend environment.
3. Create a webhook endpoint:

   ```text
   https://<production-domain>/api/stripe/webhook
   ```

4. Subscribe to the production events used by the donation workflow, including `checkout.session.completed`.
5. Copy that endpoint's live signing secret to `STRIPE_WEBHOOK_SECRET`.
6. Restart the backend and send a Stripe test webhook from the dashboard.

Stripe test-mode keys and live-mode keys are separate. A test webhook signing secret will not verify a live webhook.

### Zeffy

Configure the webhook endpoint as:

```text
https://<production-domain>/api/zeffy/webhook
```

Subscribe it to `payment.completed`. Set `ZEFFY_WEBHOOK_TOKEN` only when Zeffy or the webhook sender is configured to send the identical custom token. Never place an API key or token in the webhook URL.

### YouTube

Create a server-side API key with YouTube Data API access. Restrict it using the controls supported for a server-side key, monitor its quota, and store it as `YOUTUBE_API_KEY`.

## 11. Production Verification Checklist

Run these checks after every first deployment and after environment changes.

### Service and database

- `https://<production-domain>/api/health` returns HTTP `200`.
- Health shows `"ok": true`.
- Health shows `"databaseEngine": "mysql"`.
- Health shows `"eventsDatabaseConfigured": true`.
- Backend logs contain `Events database schema ready.`.
- Backend logs do not contain authentication, TLS, or connection errors.

### Website behavior

- Refreshing a nested frontend route does not return an Nginx `404`.
- Admin login works on the production domain.
- An authorized administrator can create and read a low-risk test record.
- An upload remains accessible after a backend restart or redeploy.
- Search and quiz content load.

### Email and integrations

- Contact form email arrives at `CONTACT_US_EMAIL`.
- Reminder and newsletter test emails arrive and render production URLs.
- Stripe and Zeffy dashboards show successful webhook deliveries.
- Re-delivering the same payment webhook does not create a duplicate donation.
- Media content requiring the YouTube API loads without exposing the API key in browser developer tools.

Remove test records after verification.

## 12. Logs and Troubleshooting

### View logs

systemd:

```bash
sudo journalctl -u singhsabha-backend -n 200 --no-pager
sudo journalctl -u singhsabha-backend -f
```

PM2:

```bash
pm2 logs singhsabha-backend --lines 200
```

Docker:

```bash
docker compose logs --tail=200 backend
```

Managed platform: use its Logs or Runtime Logs page.

Do not paste unreviewed production logs into public systems; logs can contain personal or operational data.

### Common failures

| Symptom | Likely cause | What to check |
| --- | --- | --- |
| Health endpoint is unreachable | Node is stopped, wrong port, or proxy route is wrong | Service status, runtime logs, `PORT`/`SERVER_PORT`, Nginx `proxy_pass` |
| `databaseEngine` is `postgresql` | `DB_ENGINE` is absent or misspelled | Set exactly `DB_ENGINE=mysql`, then restart |
| `eventsDatabaseConfigured` is `false` | MySQL host/user/database values are missing | Confirm all required `MYSQL_*` values exist in the backend process |
| MySQL access denied | Wrong username/password or user host restriction | Provider credentials, MySQL grants, backend source IP |
| MySQL certificate error | Hostname or TLS settings do not match provider | Provider TLS documentation and certificate chain |
| API works on port 4242 but not public HTTPS | Nginx/platform routing error | Preserve the `/api/...` path and inspect proxy logs |
| Upload disappears after deploy | Ephemeral filesystem | Attach/mount persistent storage at `server/uploads` |
| Emails are not sent | SMTP mode or credentials are wrong | `LOCAL_MAIL_TRANSPORT=smtp`, SMTP host/port/TLS, verified sender |
| Email links use localhost | Public URL variables are absent | Set `PUBLIC_SITE_URL` and `VOLUNTEER_REMINDER_BASE_URL` |
| Stripe webhook returns an error | Wrong mode or signing secret | Live endpoint secret, exact public URL, raw webhook delivery logs |
| New environment value has no effect | Process was not restarted or old host value wins | Restart/redeploy and inspect the service's configured environment keys |

Never print complete secrets while debugging. Confirm presence using the hosting dashboard, or print only whether a value is set.

## 13. Backups, Rollback, and Secret Rotation

### Before deployment

- Create a MySQL backup or provider snapshot.
- Confirm that restore instructions have been tested.
- Back up persistent uploads and any file-backed runtime data.
- Record the currently deployed application version.

### Rollback application code

1. Redeploy the previous tested application version.
2. Keep `DB_ENGINE=mysql` unless an approved database rollback plan says otherwise.
3. Restart the backend.
4. Re-run the health and smoke checks.

Do not switch back to PostgreSQL casually. Writes made after the MySQL cutover are not automatically copied back to PostgreSQL.

### Rotate a compromised secret

1. Create a replacement in the owning service, such as MySQL, SMTP, Stripe, or Zeffy.
2. Update the production secret store without deleting the old credential yet.
3. Restart or redeploy the backend.
4. Verify health and the affected feature.
5. Revoke the old credential.
6. Review provider audit logs for unexpected use.

## 14. Final Handover Record

Record these facts in the team's private operations system without recording secret values:

- Production domain and backend hosting provider.
- Deployed application version or commit.
- MySQL provider, region, database name, and backup policy.
- Which secret store owns backend variables.
- Who can rotate MySQL, SMTP, Stripe, Zeffy, and YouTube credentials.
- Persistent-volume location and backup policy.
- Health-check URL.
- Log location.
- Last successful deployment and verification date.

The deployment is complete only when the public health check reports MySQL, uploads survive a redeploy, SMTP is tested, enabled payment webhooks are verified, and a rollback owner is identified.