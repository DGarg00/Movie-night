# Saturday Night Cinema

A full-stack site for your hostel's Saturday movie nights: students sign in with
their college reg no., vote on next Saturday's movie, suggest new ones, and rate
the last one shown. You and your friend manage everything from an Admin panel.

## What's actually in here

```
movie-night/
  backend/     Node.js + Express API, with a real SQLite database
  frontend/    React app (built with Vite) — this is what people see and use
```

- **Database:** SQLite (a real SQL database, stored as a single file `movienight.db`
  that the backend creates automatically). Good enough for a hostel's worth of
  students. If this ever needs to serve a much bigger crowd, the same code can be
  pointed at PostgreSQL/MySQL later with only the `db.js` file changing.
- **Auth:** students register once with their reg no. + a password. Passwords are
  hashed (never stored in plain text). Logging in gives them a token that keeps
  them signed in.
- **Admin:** during registration, entering the secret **admin code** makes that
  account an admin. Admins get an extra "Admin" tab in the nav to manage movies.

---

## 1. Running it on your own laptop (do this first)

You need [Node.js](https://nodejs.org) installed (version 18 or later — anything
recent is fine). Then, open a terminal in the project folder:

**Start the backend:**
```bash
cd backend
npm install
cp .env.example .env
npm start
```
You should see `Movie Night API running on http://localhost:4000`. Leave this
terminal open.

**Start the frontend** (in a *second* terminal):
```bash
cd frontend
npm install
npm run dev
```
It'll print a URL like `http://localhost:5173` — open that in your browser.
The frontend automatically talks to the backend for you (no config needed on
your laptop).

That's it — you now have the whole site running locally, backed by a real
database file at `backend/movienight.db`.

---

## 2. How to add movies & fill in "Next Saturday" info

1. Register an account and, in the **Admin Code** field, enter the code from
   `backend/.env` (`ADMIN_SIGNUP_CODE`, defaults to `reel2026` — **change this**
   before you actually launch it, see step 4). This makes you an admin.
2. Log in, click the **Admin** tab.
3. Under **Add a Movie**, fill in the form:
   - **Title, Genre, Duration, Language, Release Year, IMDb Rating** — type these
     in exactly like IMDb/Google shows them.
   - **Poster / Logo Image** — click "Choose file" and pick an image from your
     computer (a poster you saved, or a screenshot of the logo). This is a real
     file upload — the backend saves it and serves it back to everyone. No image
     hosting service needed.
   - **Parent's Guide Tag** — a quick badge (Clean / Mild / Caution / Strict).
   - **Parent's Guide Detail** — a sentence or two, e.g. "One mild profanity,
     brief violence, no sexual content" — like the IMDb Parents Guide page.
   - **Storyline** — paste in the synopsis, same as the one Google shows on the
     right-hand info panel for a movie.
4. Click **Add To Library**. Repeat for every movie you're considering — the
   library holds everything you've ever added, not just this week's picks.
5. Scroll to **Set Next Saturday's Nominees**, tick 2–3 movies from your library,
   and click **Save Nominees & Reset Votes**. This is what shows up on the
   "Next Saturday" tab for everyone to vote on, and it resets the vote count to
   zero (so old votes from a past week don't carry over).
6. After Saturday's screening, come back to Admin → **Mark Last Shown Movie**,
   pick the movie from the dropdown, and save. That's what shows up on "Rate
   Last Movie" for people to leave feedback on. It also clears out feedback from
   whatever was shown before.
7. **Suggestions From Everyone** at the bottom of Admin shows what people have
   proposed (sorted by upvotes), with a Remove button in case something's a
   duplicate or not appropriate.

You and your friend can both register as admins with the same admin code —
you'll each have your own reg no./login, both with admin access.

---

## 3. How the four tabs work for students

- **Next Saturday** — see the nominated movies (poster, genre, duration,
  language, year, IMDb rating, parent's guide, storyline) and vote for one.
  They can change their vote any time before you lock in nominees for the next
  week.
- **Suggest a Movie** — anyone can propose a movie (name + optional link +
  optional note) and upvote other people's suggestions, so the popular ones
  float to the top for you to consider.
- **Rate Last Movie** — once you've marked what was shown, people leave a
  1–5 star rating and an optional comment. One rating per person per movie.
- **Admin** — only visible to accounts created with the admin code.

---

## 4. Putting it online for real (so it's not just on your laptop)

Right now it only works while your laptop is on and both terminals are running.
To make it a real website your whole hostel can reach:

1. **Change the secrets first.** In `backend/.env`, set:
   - `JWT_SECRET` to a long random string (this signs everyone's login tokens).
   - `ADMIN_SIGNUP_CODE` to something only you and your friend know.
2. **Host the backend** somewhere that keeps running 24/7. Free options that
   work well for a student project: [Render](https://render.com) or
   [Railway](https://railway.app). You'd point it at the `backend/` folder,
   set the same environment variables in their dashboard, and it gives you a
   permanent URL like `https://your-app.onrender.com`.
3. **Host the frontend.** Run `npm run build` inside `frontend/` — this
   produces a `frontend/dist` folder of plain HTML/CSS/JS you can deploy for
   free on [Vercel](https://vercel.com) or [Netlify](https://netlify.com).
4. **Connect them.** In `frontend/src/api.js`, the app currently calls `/api/...`
   assuming the frontend and backend share a domain (that's what the
   `vite.config.js` proxy does for local development). When they're hosted on
   two different URLs, change the `request()` function in `api.js` to prefix
   calls with your backend's full URL, e.g.:
   ```js
   const API_BASE = 'https://your-app.onrender.com';
   const res = await fetch(`${API_BASE}/api${path}`, ...)
   ```
5. **One important note on file uploads (posters):** most free hosts (like
   Render's free tier) don't keep uploaded files permanently — they can get
   wiped on redeploy. For a real deployment, consider hosting poster images
   somewhere persistent (e.g., a free Cloudinary account) instead of the
   local `uploads/` folder, or just re-upload posters after deploys until
   you're ready to invest in that.

If you want, I can also walk you through the Render/Vercel setup screen by
screen once you're ready to actually deploy — it's mostly clicking "New Web
Service," pointing it at your code, and filling in the same environment
variables from `.env`.

---

## 5. A few honest limitations

- This is sized for a hostel-scale audience (tens to low hundreds of users),
  not a public product — that's exactly what you asked for.
- Passwords are hashed properly, but there's no "forgot password" flow yet —
  if that matters to you, it's a reasonable next feature to add.
- The admin code is a shared secret, not per-person permissions — fine for two
  organizers, not meant to scale to a large admin team.
