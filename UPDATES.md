# What changed, and the one new setup step you need to do

## The one manual step: Google Sign-In credentials

Everything else works automatically once you redeploy, but Google sign-in
needs you to create a free "OAuth Client ID" — this tells Google which
websites are allowed to use "Sign in with Google" for your app.

1. Go to https://console.cloud.google.com/ → sign in with any Google account.
2. Top-left, create a **New Project** (any name, e.g. "Movie Night").
3. Search bar at top → search **"OAuth consent screen"** → open it.
   - User type: **External** → Create.
   - Fill in: App name (e.g. "Saturday Night Cinema"), your email in the two
     email fields. Save and continue through the remaining steps with
     defaults — you don't need to add scopes or test users for this.
   - Publish the app (Publishing status → "Publish App") so anyone can sign
     in, not just accounts you manually approve.
4. Search bar → **"Credentials"** → **+ Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Name: anything
   - **Authorized JavaScript origins** → Add URI → enter your GitHub Pages
     domain **without any path**, e.g.:
     ```
     https://dgarg00.github.io
     ```
   - Leave "Authorized redirect URIs" empty — not needed for this flow.
   - Click **Create**. You'll get a **Client ID** that looks like:
     `123456789-abc123.apps.googleusercontent.com`

5. **Add this Client ID in two places:**

   **Render (backend)** → your service → Environment → add:
   - `GOOGLE_CLIENT_ID` → the Client ID from step 4

   **GitHub (frontend build)** → your repo → Settings → Secrets and
   variables → Actions → Variables tab → add:
   - `VITE_GOOGLE_CLIENT_ID` → the same Client ID

6. On Render, trigger a redeploy (Manual Deploy → Deploy latest commit) so
   it picks up the new environment variable. On GitHub, re-run the Actions
   workflow (Actions tab → your workflow → Run workflow) so the frontend
   rebuilds with it too.

That's it — open your site and you should see a "Sign in with Google"
button.

### Becoming an admin
Sign in with Google like anyone else, then click **"I'm an organizer"**
near the top of the page and enter your `ADMIN_SIGNUP_CODE` (the one you
set in Render). That unlocks the Admin tab for your account. Do this for
any co-organizer too.

### Heads up: old accounts
Since sign-in is now Google-only, anyone who registered the old way
(reg-no + password) will need to sign in fresh with Google — their old
account won't carry over automatically. Given you're still setting this
up, that should only affect your own test account.

---

## Everything else — works automatically after you redeploy

- **Experience checkboxes in "Rate Last Movie"** — I added the 3 options
  you listed (you mentioned "4 options" but only wrote 3 — let me know if
  there's a 4th you meant to include and I'll add it):
  1. Sitting arrangement should be improved
  2. People were talking/shouting too much
  3. Everything was perfect

- **Download / Copy report** — in "Rate Last Movie", once there's at least
  one rating, you'll see "Copy Report" and "Download Report" buttons that
  give you a clean text summary (ratings, experience tags, comments) —
  ready to paste into an email or attach for your teachers.

- **Poster not showing (the "logo" issue)** — this wasn't a bug, it just
  needs a *direct image link*, not a webpage link. In the Admin "Add A
  Movie" form there's now a tip explaining this: paste the link into a new
  browser tab first — if you see *just* the picture and nothing else,
  it'll work. Right-click an actual poster image (not the search results
  page) → "Copy image address."

- **Suggestions: downvote + 1-per-person limit** — everyone gets exactly
  one suggestion. Once used, the form is replaced with a note saying so.
  Admins can reset one person's limit (by email) or everyone's at once,
  from the Admin → Suggestions section. Downvote button sits next to
  upvote and turns red when clicked (voting up automatically removes a
  downvote and vice versa).

- **Remove your own comment** — in "Rate Last Movie," if you've already
  rated and left a comment, you'll see a "Remove My Comment" button. Your
  star rating stays; only the comment text is cleared.

- **"Old Movies" tab** — new tab between "Rate Last Movie" and "Admin",
  visible to everyone. Every movie the admin has ever marked as "shown"
  stays here permanently, grouped by year, with its date and average
  rating — nothing gets overwritten anymore when you mark a new movie as
  shown.

- **Admin → Danger Zone** — new section at the bottom of Admin with reset
  buttons: Poll/Votes, Suggestions, Old Movies & Ratings, Movie Library,
  or Everything. Each asks for confirmation first. None of them delete
  people's accounts or admin status.

- **Marking a movie as "shown" now asks for the date** — this is what
  makes the Old Movies history date/year-accurate.
