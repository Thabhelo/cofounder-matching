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