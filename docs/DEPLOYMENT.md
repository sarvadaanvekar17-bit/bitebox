# BiteBox — Deployment Runbook

Architecture: static frontend (HTML/CSS/JS) + Spring Boot API (`backend/`) + MySQL.

Recommended free-tier stack:
- **Frontend:** Netlify (drag-and-drop or Git) — `sarvadaanvekar17-bit/bitebox`
- **Backend:** Render (Spring Boot) or Railway
- **Database:** Aiven free MySQL / Railway MySQL / any hosted MySQL

---

## 1. Database (MySQL)

1. Create a free MySQL DB (e.g. Aiven → "MySQL" free plan, or Railway → MySQL).
2. Note: host, port, database name, user, password, and whether SSL is required.
3. No manual schema setup needed — JPA creates tables on first boot
   (dev) — **for prod set `ddl-auto: validate` only after tables exist**;
   simplest: boot once with `ddl-auto: update`, then switch to `validate`.

## 2. Backend (Render example)

Option A — Blueprint (easiest):
1. Push this repo to GitHub (already at `sarvadaanvekar17-bit/bitebox`).
2. Render Dashboard → **New → Blueprint** → connect repo → it reads `render.yaml`.
3. Fill in env vars when prompted:
   - `DB_URL` = `jdbc:mysql://HOST:PORT/DBNAME?useSSL=true&serverTimezone=UTC`
   - `DB_USER`, `DB_PASSWORD`
   - `JWT_SECRET` = long random string (Render can generate)
   - `CORS_ORIGINS` = `https://YOUR-SITE.netlify.app` (set after step 3)
4. Deploy → note the URL, e.g. `https://bitebox-api.onrender.com`.
5. Verify: `https://bitebox-api.onrender.com/actuator/health` → `{"status":"UP"}`
   and `https://bitebox-api.onrender.com/api/menu` → JSON items.

Option B — manual: build `mvn package` locally, deploy jar to any Java host
(Railway, Koyeb, a VPS). Start with `--spring.profiles.active=prod`.

PowerShell (local prod test):
```powershell
cd backend
$env:DB_URL="jdbc:mysql://HOST:3306/bitebox?useSSL=true&serverTimezone=UTC"
$env:DB_USER="..."; $env:DB_PASSWORD="..."; $env:JWT_SECRET="..."
$env:CORS_ORIGINS="http://localhost:8080"
mvn spring-boot:run -Dspring-profiles.active=prod   # note: -Dspring-boot.run.profiles=prod for spring-boot:run
```

## 3. Frontend (Netlify)

1. Netlify Dashboard → **Add new site → Deploy manually** → drag the project
   folder (or connect the GitHub repo for auto-deploys).
2. After first deploy, set the API base URL — either:
   - edit `js/api.js`: change the fallback `"http://localhost:8081"` to your
     Render URL, **or**
   - add before `js/api.js` loads on each page:
     `<script>window.BB_API_BASE="https://bitebox-api.onrender.com";</script>`
3. Set `CORS_ORIGINS` on the backend to the Netlify URL and redeploy backend.
4. Netlify picks up `_headers` automatically (CSP, caching, security headers).

## 4. Post-deploy verification checklist

- [ ] `https://<api>/actuator/health` → UP
- [ ] `https://<api>/api/menu` → 4+ items
- [ ] Homepage loads; menu images (WebP) load
- [ ] Sign up → JWT login works
- [ ] Add to cart → checkout → real order (`BB-XXXXXXXX`)
- [ ] `orders.html` shows the order with live status
- [ ] `admin.html` login as admin → live dashboard
- [ ] Mobile nav (hamburger) works
- [ ] Browser console: no CORS errors, no 404s

## 5. Secrets rules

- Never commit `DB_PASSWORD`, `JWT_SECRET`, or tokens — env vars only.
- `.gitignore` already excludes `backend/target`, `.env`, IDE files.
- Rotate the seeded demo admin password (`admin@bitebox.demo`) or delete it
  before real users sign up.
