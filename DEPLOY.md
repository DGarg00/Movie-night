# Deploying Movie Night — Step by Step

This gets you a permanent link, working admin login, and data that survives
even when your laptop is off. Total cost: **$0/month**.

Pieces:
- **Database** → Supabase (free Postgres, never deleted)
- **Backend** (Express API) → Render (free web service)
- **Frontend** (the website people visit) → Vercel (free static hosting)

Do these in order — each step needs something from the one before it.

---

## 1. Push this folder to GitHub

If you haven't already:
1. Create a new GitHub repo (e.g. `movie-night`).
2. Upload/push this whole `movie-night` folder to it (both `frontend` and
   `backend` folders inside).

This is exactly what your friend did with the `sports` repo — except your
project has a real backend, so it needs two separate deployments (below)
instead of just GitHub Pages.

---

## 2. Create the database (Supabase)

1. Go to https://supabase.com → sign up (free) → **New Project**.
2. Pick any name, generate/save a database password, pick a region close to
   you, click **Create new project**. Wait ~2 minutes while it provisions.
3. Once it's ready: **Project Settings → Database → Connection string**.
   Choose the **URI** format, **"Transaction" pooler** mode. Copy it — it
   looks like:
   `postgresql://postgres.xxxx:[YOUR-PASSWORD]@aws-...pooler.supabase.com:6543/postgres`
4. Replace `[YOUR-PASSWORD]` in that string with the password you set in
   step 2. Save this full string somewhere — you'll paste it into Render
   in the next step as `DATABASE_URL`.

---

## 3. Deploy the backend (Render)

1. Go to https://render.com → sign up (free, GitHub sign-in is easiest).
2. **New → Web Service** → connect your GitHub repo.
3. When asked which folder: set **Root Directory** to `backend`.
4. Settings:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
5. Under **Environment Variables**, add:
   - `DATABASE_URL` → the Supabase connection string from step 2
   - `JWT_SECRET` → any long random string (mash your keyboard, 30+ characters)
   - `ADMIN_SIGNUP_CODE` → a secret word only you and your co-admin friend
     know (e.g. `reel2026` or make up your own) — anyone who enters this
     code while signing up becomes an admin
6. Click **Create Web Service**. Wait for the first deploy to finish.
7. Copy the URL Render gives you, e.g. `https://movie-night-abcd.onrender.com`
   — this is your **backend URL**. You'll need it in the next step.

Note: Render's free tier "sleeps" after 15 minutes of no traffic, so the
very first request after a quiet period takes ~30–60 seconds to wake up.
Totally fine for a college voting app — it's just the free-tier tradeoff.

---

## 4. Deploy the frontend (Vercel)

1. Go to https://vercel.com → sign up (free, GitHub sign-in is easiest).
2. **Add New → Project** → import the same GitHub repo.
3. Set **Root Directory** to `frontend`.
4. Vercel auto-detects Vite — leave build settings as default.
5. Under **Environment Variables**, add:
   - `VITE_API_URL` → your Render backend URL from step 3 (no trailing slash),
     e.g. `https://movie-night-abcd.onrender.com`
6. Click **Deploy**. When it's done, Vercel gives you a permanent link like
   `https://movie-night.vercel.app` — **this is the link you share with
   everyone.**

---

## 5. Create your admin account

1. Open your Vercel link.
2. Sign up like a normal user, but enter the `ADMIN_SIGNUP_CODE` you set in
   step 3 in the admin code field on the sign-up form.
3. Log in — you should now see the Admin view with the movie library,
   nominee picker, and suggestions list.
4. Have your friend do the same (with the same admin code) if they should
   also be an admin.

---

## Updating the site later

Any time you push new code to GitHub, both Render and Vercel auto-redeploy.
Nothing else needed.

## If something breaks

- **"Failed to fetch" on the site** → check `VITE_API_URL` in Vercel matches
  your Render URL exactly, then redeploy the frontend.
- **500 errors from the backend** → check Render's **Logs** tab; it's almost
  always a wrong/missing `DATABASE_URL`.
- **Backend seems slow to respond the first time** → normal free-tier
  spin-up, see note in step 3.
