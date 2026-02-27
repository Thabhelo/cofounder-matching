# Deployment Guide

Frontend: Vercel
Backend API: Render (Web Service)
Database: Render Postgres

---

## 1. Create a Render account

Go to https://render.com and sign up. Connect your GitHub account when prompted - Render needs read access to this repo to deploy from it.

---

## 2. Provision the database and backend via Blueprint

Render Blueprints (`render.yaml`) let you spin up all services in one click.

1. In the Render dashboard, click **New** -> **Blueprint**
2. Select this repository (`cofounder-matching`)
3. Render reads `render.yaml` from the repo root and shows you what it will create:
   - `cofounder-db` - Postgres 16, basic-256mb plan, Oregon region
   - `cofounder-api` - Python web service, Starter plan, Oregon region
4. Click **Apply** - Render provisions the DB first, then the API

The `DATABASE_URL` is wired automatically from the database to the API via the `fromDatabase` reference in `render.yaml`. You do not set it manually.

---

## 3. Set environment variables

After the Blueprint is applied, go to the `cofounder-api` service -> **Environment** and fill in the `sync: false` variables:

| Variable | Where to find it |
|---|---|
| `CLERK_SECRET_KEY` | Clerk Dashboard -> API Keys -> Secret key |
| `CLERK_PUBLISHABLE_KEY` | Clerk Dashboard -> API Keys -> Publishable key |
| `CLERK_FRONTEND_API` | Clerk Dashboard -> API Keys -> Frontend API URL (e.g. `https://your-instance.clerk.accounts.dev`) |
| `CORS_ORIGINS` | `https://cofounder-matching-git-main-thabhelos-projects.vercel.app` |
| `ADMIN_CLERK_IDS` | Comma-separated Clerk user IDs for admins. Find your ID: Clerk Dashboard -> Users -> click your user -> copy User ID (`user_...`) |
| `CLERK_WEBHOOK_SECRET` | Clerk Dashboard -> Webhooks -> your endpoint -> Signing secret |
| `RESEND_API_KEY` | Resend Dashboard -> API Keys -> Secret key (see section **10. Email notifications (Resend)**) |
| `EMAIL_FROM` | The verified sender address you configure in Resend, e.g. `Cofounder Matching <updates@yourdomain.com>` |

After saving, Render redeploys automatically.

---

## 4. Verify the backend is running

```bash
curl https://cofounder-api.onrender.com/health
# Expected: {"status": "healthy", "database": "connected", ...}
```

---

## 5. Deploy the frontend to Vercel

1. Go to https://vercel.com and sign up / log in with GitHub
2. Click **Add New Project** and import this repository
3. Set the **Root Directory** to `frontend`
4. Vercel auto-detects Next.js. Add these environment variables:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://cofounder-api.onrender.com` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |

5. Click **Deploy**

---

## 6. Update CORS on the backend

Once you have the Vercel URL, update `CORS_ORIGINS` in the Render environment to include it:

```
https://cofounder-matching-git-main-thabhelos-projects.vercel.app
```

If you add a custom domain later, add that too (comma-separated).

---

## 7. Set up the GitHub Actions smoke test

The `deploy.yml` workflow runs after every push to `main` and probes the backend health endpoint.

Add your Render API URL as a **repository variable** (not a secret - it is not sensitive):

1. GitHub repo -> **Settings** -> **Variables** -> **Actions** -> **New repository variable**
2. Name: `RENDER_API_URL`
3. Value: `https://cofounder-api.onrender.com`

---

## 8. Set up Clerk webhook (for user deletion sync)

The backend handles `user.deleted` events from Clerk so that deleted Clerk users are removed from the DB.

1. Clerk Dashboard -> **Webhooks** -> **Add Endpoint**
2. URL: `https://cofounder-api.onrender.com/webhooks/clerk`
3. Events: select `user.deleted`
4. Copy the **Signing Secret** and set it as `CLERK_WEBHOOK_SECRET` in Render env vars

---

## 9. Run migrations manually (if needed)

Migrations run automatically on each deploy via the start command (`alembic upgrade head && uvicorn ...`). If you ever need to run them manually:

1. Render dashboard -> `cofounder-api` -> **Shell**
2. Run: `alembic upgrade head`

To connect to the database directly:
1. Render dashboard -> `cofounder-db` -> **Info** -> copy the **External Database URL**
2. `psql <external-url>`

---

## 10. Email notifications (Resend)

The backend sends transactional emails for:

- New match / intro request notifications (for users who opt in with `alert_on_new_matches`)
- Profile approval / rejection notifications (when an admin updates `profile_status`)

These emails are sent via [Resend](https://resend.com). To enable them in production, follow these steps.

### 10.1 Create and configure the Resend account (manager/owner)

1. Go to `https://resend.com` and sign up with the company email (or log in if an account already exists).
2. In the Resend dashboard, go to **Domains** and click **Add Domain**.
3. Choose a domain or subdomain you control for product emails, for example:
   - `updates.example.com`, or
   - `cofounder.example.com`
4. Enter the domain in the **Name** field and click **Add Domain**.
5. Resend will show a list of DNS records (TXT, MX, and CNAME). Copy these.
6. In your DNS provider (e.g. Cloudflare, Namecheap, Route 53):
   - Add each record exactly as shown (type, host/name, and value).
   - Save the DNS changes.
7. Back in Resend, on the domain page, click **Verify**. DNS propagation can take a few minutes. Wait until Resend shows the domain as **Verified** for sending.

Once the domain is verified, you can send from any address at that domain, for example `updates@updates.example.com` or `founders@cofounder.example.com`.

### 10.2 Create a sender address in Resend

1. On the verified domain page in Resend, choose a sender address for the app, for example:
   - `updates@updates.example.com`
2. Decide on the display name you want users to see, for example:
   - `Cofounder Matching`
3. The final **From** value the backend will use should look like:

   `Cofounder Matching <updates@updates.example.com>`

Keep both the raw email address and the full display string handy for the next step.

### 10.3 Create a Resend API key

1. In the Resend dashboard, go to **API Keys**.
2. Click **Create API Key**.
3. Give it a descriptive name, for example `cofounder-api-production`.
4. Copy the **secret** key value somewhere secure. This value is only shown once.

Share the following with the developer who operates the Render service (do not commit these to Git):

- `RESEND_API_KEY` – the secret key you just created.
- `EMAIL_FROM` – the full From string, e.g. `Cofounder Matching <updates@updates.example.com>`.

### 10.4 Wire Resend into the backend (Render + local)

1. **Render (production):**
   - Open Render dashboard -> `cofounder-api` -> **Environment**.
   - Set:
     - `RESEND_API_KEY` to the secret API key from Resend.
     - `EMAIL_FROM` to the chosen From address, e.g. `Cofounder Matching <updates@updates.example.com>`.
   - Click **Save** so Render restarts the service with the new variables.

2. **Local development (optional but recommended):**
   - In `backend/.env`, add the same values:

     ```bash
     RESEND_API_KEY=your_resend_secret_key_here
     EMAIL_FROM="Cofounder Matching <updates@updates.example.com>"
     ```

   - Restart the local backend (`./STOP_SERVERS.sh` then `./START_SERVERS.sh`).

If `RESEND_API_KEY` or `EMAIL_FROM` are not set, the backend will skip sending emails (no-op) but the application will still function. Once these variables are configured, email notifications will be sent automatically for the flows described above.

---

## Regions

Both services are in `oregon` (US West). Keep them in the same region - this is what gives you the low-latency internal network between API and DB.

---

## Monthly cost estimate

| Service | Plan | Cost |
|---|---|---|
| Render Web Service (backend) | Starter | $7/mo |
| Render Postgres (database) | basic-256mb | $7/mo |
| Vercel (frontend) | Hobby | $0 |
| **Total** | | **~$14/mo** |

Render Starter (API) includes: 512MB RAM, shared CPU. basic-256mb (Postgres) includes: 256MB RAM, 1GB storage, daily backups, SSL.
