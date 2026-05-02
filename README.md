# Taskflow

Web app for **projects**, **team roles** (Admin / Member), and **tasks** (status, assignee, due dates) with a **dashboard** (counts, overdue). Stack: **React (Vite) + TypeScript + Supabase** (Auth, Postgres, Row Level Security).

## Local development

1. **Node.js** 18+ recommended.

2. **Install dependencies**

   ```bash
   cd taskflow
   npm install
   ```

3. **Supabase project**  
   In the [Supabase dashboard](https://supabase.com/dashboard), create a project. Under **Settings → API**, copy **Project URL** and **anon public** key.

4. **Apply the database migration**  
   - **SQL editor:** paste and run the contents of [`supabase/migrations/20250502000000_initial.sql`](supabase/migrations/20250502000000_initial.sql).  
   - Or use the CLI: `supabase db push` (after `supabase link`).

5. **Edge Function: add member by email**  
   Admins add existing users (matched by email) via the `add-project-member` function. **You must deploy it** or “Add member” returns **404** (and the browser may show a **CORS** warning because the gateway 404 response lacks CORS headers).

   From your machine (with [Supabase CLI](https://supabase.com/docs/guides/cli) logged in and linked to this project):

   ```bash
   cd taskflow
   supabase functions deploy add-project-member
   ```

   The platform injects `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` into the function at runtime. Never put the **service role** key in the frontend env.

6. **Environment file**

   ```bash
   cp .env.example .env
   ```

   Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`.

7. **Run the app**

   ```bash
   npm run dev
   ```

## Deploying on Vercel

1. Push your code to GitHub (or GitLab / Bitbucket).

2. In [Vercel](https://vercel.com) → **Add New… → Project** → import that repo.

3. **Root Directory**  
   If the app is not at the repo root (e.g. it lives in `taskflow/`), open **Configure Project** and set **Root Directory** to that folder.

4. **Framework preset**  
   Vercel should detect **Vite**. Build output is **`dist`** (see [`vercel.json`](vercel.json)).

5. **Environment variables** (Project → **Settings → Environment Variables**) — use these exact names; Vite injects them at **build** time:
   - `VITE_SUPABASE_URL` — `https://<ref>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` — anon public key  

   Add them for **Production** (and **Preview** if you want preview deployments to talk to Supabase). After changing vars, **Redeploy**.

6. **Client-side routing**  
   [`vercel.json`](vercel.json) rewrites `/*` to `/index.html` so React Router works on refresh and deep links.

7. **Supabase Auth URLs**  
   In Supabase → **Authentication → URL configuration**:
   - **Site URL:** your real app URL (e.g. `https://your-app.vercel.app`), not `http://localhost:5173`. This is the default used by auth emails if no redirect is specified.
   - **Redirect URLs:** add every URL you use, or wildcards, for example:
     - `http://localhost:5173/**` (Vite dev)
     - `https://your-app.vercel.app/**`  
     The signup flow sends `emailRedirectTo` to `/dashboard` on the **current** origin; that URL must match an allowed redirect pattern.

   After changing these, new confirmation emails will point at the correct host. Old emails already sent still contain the old link.

## Security notes

- RLS on `projects`, `project_members`, and `tasks` enforces **Admin** vs **Member** rules in the database. The UI only reflects them; it is not the source of truth.
- **Task delete rule:** any **member** of a project may delete tasks in that project (see migration comment).
- The **add-project-member** function checks that the caller is a project **admin** before inserting a row; it uses the service role only on the server.

## Project layout

- [`src/lib/supabase.ts`](src/lib/supabase.ts) — browser Supabase client and functions base URL.
- [`src/contexts/AuthContext.tsx`](src/contexts/AuthContext.tsx) — session and sign-out.
- [`src/pages/`](src/pages/) — Home, Login, Signup, Dashboard, Project detail.
- [`supabase/migrations/`](supabase/migrations/) — schema, triggers, RLS.
- [`supabase/functions/add-project-member/`](supabase/functions/add-project-member/) — admin-only add-by-email.
