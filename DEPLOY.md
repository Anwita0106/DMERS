# Put DMERS online for free

You will end up with a public link like `https://dmers-yourname.vercel.app` that anyone can open.
It uses three free services, each doing one job:

| Part | Free service | What it holds |
|---|---|---|
| Database | **Neon** (neon.com) | Your PostgreSQL tables, triggers and procedures |
| API (backend) | **Render** (render.com) | The Python/FastAPI server |
| Website | **Vercel** (vercel.com) | The React website |

No credit card is needed. It takes about 30 minutes the first time.

**Limits of the free plans (fine for a college demo):**
* **Render sleeps** after 15 minutes without visitors. The first visit after that takes about
  1 minute to wake up, so open the site a minute before you present.
* **Uploaded incident photos** are not kept on Render's free plan; they disappear when it restarts.
  Everything else is stored in the database and stays.
* **Neon** gives 1 GB of storage per project and pauses when idle (it wakes in under a second).

---

## Step 1: Put the project on GitHub (about 5 minutes)

GitHub stores your code online so Render and Vercel can read it.

1. Create a free account at **github.com**.
2. Install **GitHub Desktop** (desktop.github.com) and sign in with that account.
3. In GitHub Desktop choose **File → Add local repository** and pick your `DMERS` folder.
   When it says "this is not a Git repository", click **create a repository** and then **Create repository**.
4. Click **Publish repository**. You can keep **"Keep this code private"** ticked; Render and Vercel can still read it.

> Your `backend\.env` file (with your PostgreSQL password) is **not** uploaded, because it is
> listed in `.gitignore`. Before publishing, check that `.env` is not in the list of changed files.

---

## Step 2: Database on Neon (about 5 minutes)

1. Sign up at **neon.com** (use "Continue with GitHub").
2. Create a project: name `dmers`, Postgres version **17**, region **Singapore** (closest to India).
3. On the project dashboard click **Connect**. Turn **Connection pooling OFF** and copy the
   connection string. It looks like this, and must **not** contain `-pooler`:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```
4. Load the DMERS tables and demo data into it. On your laptop, in the DMERS folder, double-click
   **`windows\LOAD_CLOUD_DB.bat`**, paste the connection string and press Enter. It should end with:
   ```
   Done: 16 users, 14 incidents, 8 shelters loaded.
   ```
   The script refuses to run if the tables already exist, so it can never overwrite anything.

**Optional: copy your own local data instead of the demo data.** Do this on an *empty* Neon
database, and do not also run step 4. In Command Prompt, change the port, database name and
Neon string to yours:
```
"C:\Program Files\PostgreSQL\18\bin\pg_dump.exe" -U postgres -p 5433 -d dmers_course --no-owner --no-privileges -f dmers_backup.sql
"C:\Program Files\PostgreSQL\18\bin\psql.exe" "PASTE_NEON_STRING_HERE" -f dmers_backup.sql
```

---

## Step 3: API on Render (about 10 minutes)

1. Sign up at **render.com** with GitHub.
2. Click **New → Blueprint**, choose your `DMERS` repository and click **Connect**.
   Render reads `render.yaml` from the project and sets almost everything for you.
3. It asks for **DATABASE_URL**: paste the Neon connection string from Step 2.
4. Click **Apply** / **Deploy Blueprint**. The first build takes 5–10 minutes.
5. When it shows **Live**, copy the service address, for example `https://dmers-api.onrender.com`.
6. Check it: open `https://dmers-api.onrender.com/api/health` (with your address). You should see
   `"status":"ok","service":"dmers-api"` and your incident count.

---

## Step 4: Website on Vercel (about 5 minutes)

1. Sign up at **vercel.com** with GitHub.
2. Click **Add New → Project** and **Import** your `DMERS` repository.
3. Settings:
   * **Root Directory:** click *Edit* and choose `frontend`.
   * **Framework Preset:** Vite (detected automatically).
   * **Environment Variables:** add
     `VITE_API_BASE_URL` = `https://dmers-api.onrender.com/api` (your Render address followed by `/api`).
4. Click **Deploy**. After about a minute you get your link, for example `https://dmers-yourname.vercel.app`.
5. Open it and sign in with `priya.natarajan@dmers.example.org` and the password `Dmers@2026`.

The API already accepts requests from any `*.vercel.app` website, so there is nothing else to configure.

---

## If something doesn't work

| What you see | Fix |
|---|---|
| Red banner "No answer from the server" for about a minute | Render is waking up; wait and click **Retry** |
| Red banner stays | Open `https://<your-render>.onrender.com/api/health`. If it errors, check the Render **Logs** tab |
| Render log: `password authentication failed` or `could not translate host name` | DATABASE_URL is wrong. Copy it again from Neon (pooling **off**) and paste it in Render → Environment |
| Render log: `table incidents is missing` | Step 2.4 was not done. Run `windows\LOAD_CLOUD_DB.bat` |
| Website loads but every page is empty | `VITE_API_BASE_URL` on Vercel is missing or wrong. Fix it, then **Redeploy** |
| Map or photos missing | They load from OpenStreetMap and Wikimedia; check the viewer's internet |

## Updating the online version later
Change the code on your laptop, then in GitHub Desktop click **Commit to main** and **Push origin**.
Render and Vercel rebuild by themselves within a few minutes.

## Showing the live database to your faculty
Neon has a **SQL Editor** in its dashboard. Run the same queries from the README
(section 4 "Showing the database working live") there while using the online website. The new
rows appear in Neon, and rows you insert in Neon appear on the website within 5 seconds.
