# Lab 5 Deployment & Operations Guide — SerWongSerWay

## 1. System Overview & Tech Stack

**SerWongSerWay** (PastelPulse Review & Survey System) is containerized using Docker and deployed as a stateless service on Google Cloud Platform (GCP) with automated CI/CD via GitHub Actions.

| Layer / Component | Technology / Service | Details & Role |
| :--- | :--- | :--- |
| **Frontend (UI)** | React, Vite, Nginx | Single-page application served via Nginx (Local port `5173` / Containerized static assets) |
| **Backend (API)** | Node.js, Express | RESTful API server listening on `0.0.0.0:${PORT}` (Default port `3000`) |
| **Database** | PostgreSQL 16 | Persistent relational storage (Local Docker container / GCP Cloud SQL) |
| **Containerization** | Docker, Docker Compose | Multi-stage Dockerfiles for reproducible local and cloud builds |
| **CI/CD Pipeline** | GitHub Actions | Automated testing (`ci-docker.yml`) and deployment (`deploy.yml`) via Workload Identity Federation |
| **Cloud Runtime** | Google Cloud Run | Serverless container runtime (`asia-southeast1`, auto-scaling `0–3` instances) |
| **Artifact & Secrets** | Artifact Registry, Secret Manager | Stores SHA-tagged Docker images and injects sensitive credentials at runtime |

* **Public Repository:** `https://github.com/Khanatip112/SerWongSerWay`
* **Live Production URL:** `https://serwongserway-vs56b635aq-as.a.run.app`
* **Health & Readiness Endpoints:**
  * `GET /api/health` — Verifies application process liveness.
  * `GET /api/ready` — Verifies active database connectivity (`{"status":"ready","db":"connected"}`).

---

## 2. Environment Variables & Secret Management

All runtime configurations are injected via environment variables. **Real secrets are never committed to Git**; local development uses `.env` (copied from `.env.example`), while Cloud Run retrieves secrets from **GCP Secret Manager**.

| Variable Name | Description | Secret? | Local Source | Production (GCP) Source |
| :--- | :--- | :---: | :--- | :--- |
| `NODE_ENV` | Application runtime mode (`development` / `production`) | No | `.env` | Cloud Run Env Var (`production`) |
| `PORT` | HTTP port bound by the Express server | No | `.env` (`3000`) | Automatically injected by Cloud Run (`8080` / `3000`) |
| `TZ` | Application timezone | No | `.env` (`Asia/Bangkok`) | Cloud Run Env Var (`Asia/Bangkok`) |
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | `.env` (local Docker DB) | GCP Secret Manager (`toktickit-database-url`) |
| `SESSION_SECRET` / `JWT_SECRET` | Cryptographic key for signing user sessions/tokens | **Yes** | `.env` (`change-me-...`) | GCP Secret Manager (`toktickit-session-secret`) |
| `ADMIN_EMAIL` | Default seeded administrator email | No | `.env` | Cloud Run Env Var / Seed config |
| `ADMIN_PASSWORD` | Default seeded administrator password | **Yes** | `.env` (`change-me-...`) | GCP Secret Manager (`toktickit-admin-password`) |

> **Note:** Verify exact secret names in **GCP Console > Security > Secret Manager** (if renamed from `toktickit-*` to `serwongserway-*`, update the table accordingly).

---

## 3. Local Build, Run, Test, and Database Commands

### 3.1 Fresh Clone Startup (Docker Compose)
To reproduce the full stack locally from a clean clone using only `.env.example`:

```bash
# 1. Clone the repository
git clone https://github.com/Khanatip112/SerWongSerWay.git
cd SerWongSerWay

# 2. Create local environment file(s) from example
cp .env.example .env
# (If separate server/.env exists, copy server/.env.example to server/.env)

# 3. Build images and start database, migrations, server, and client
docker compose up --build -d

# 4. Verify container health (migrate container should exit with code 0)
docker compose ps -a

# 5. Verify API endpoints
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
```

* **Local Web UI:** `http://localhost:5173`
* **Stop & Clean Up:** `docker compose down` (add `-v` only if resetting local database volumes).

### 3.2 Database Migrations, Seeding, Build, and Automated Tests

Commands executed inside the `server/` workspace (or via `docker compose exec server ...`):

```bash
cd server

# Generate Prisma Client
npm run db:generate

# Apply database migrations (production / CI / Docker)
npm run db:migrate:deploy

# Apply migrations in local development (if creating new migrations)
npm run db:migrate

# Seed initial roles and synthetic test accounts (runs tsx prisma/seed.ts)
npm run db:seed

# Compile TypeScript source to dist/index.js
npm run build

# Run automated unit, API integration, and rule tests via Vitest
npm test
```

## 4. Google Cloud Platform (GCP) Resources

All cloud infrastructure is provisioned in region **`asia-southeast1`** (Singapore) under project **`cpe334-team046`**.

| Resource Type | Resource Name / Identifier | Configuration Summary |
| :--- | :--- | :--- |
| **GCP Project ID** | `cpe334-team046` | Billing enabled with budget alerts only (`Alerts only`) |
| **Cloud Run Service** | `serwongserway` | Public unauthenticated access (`allUsers`), Min `0` / Max `3` instances |
| **Cloud SQL Instance** | `toktickit-pg` *(verify exact name in Console)* | PostgreSQL 16, `Runnable`, Storage auto-increase **Disabled** |
| **Artifact Registry** | `asia-southeast1-docker.pkg.dev/cpe334-team046/serwongserway` | Stores immutable Docker images tagged with 40-char commit SHAs |
| **Runtime Service Account** | `toktickit-runner@cpe334-team046.iam.gserviceaccount.com` | Least-privilege IAM: `Cloud SQL Client` & `Secret Manager Secret Accessor` |
| **Deployer Service Account** | `toktickit-deployer@cpe334-team046.iam.gserviceaccount.com` | Keyless authentication via Workload Identity Federation (`github-actions` pool) |

---

## 5. Release, Rollback, and Version Verification Procedures

### 5.1 Standard Release Pipeline (`staging` -> `main`)
1. **Feature Development:** Create a GitHub Issue (labeled `lab5`), branch from `staging`, implement changes, and open a Pull Request into `staging`.
2. **Quality Gate (`ci-docker.yml`):** GitHub Actions runs `test-and-docker` (database migration, seed, automated tests, and Docker build). A teammate reviews and approves the PR before merging into `staging`.
3. **Production Release (`deploy.yml`):** Open a Release PR from `staging` into `main`. Branch ruleset `protect-main` blocks merging unless `test-and-docker` passes and approval is granted.
4. **Automated Deployment:** Merging into `main` triggers **Deploy demo** (`deploy.yml`), which:
   * Authenticates to GCP via Workload Identity Federation (no JSON keys).
   * Builds and pushes the Docker image tagged with the exact 40-character Git commit SHA.
   * Executes database migrations (`deploy/release.sh`).
   * Deploys the new revision to Cloud Run (`serwongserway`) with `100%` traffic.
   * Runs `deploy/smoke_test.py` against `https://serwongserway-vs56b635aq-as.a.run.app`.

### 5.2 Rollback & Roll-Forward Procedure
Because every release image in Artifact Registry is tagged with its immutable commit SHA and database data persists in Cloud SQL:
1. Navigate to **GitHub > Actions > Deploy demo**.
2. Click **Run workflow** (selecting branch `main`).
3. Paste the target 40-character commit SHA into the **`image_tag`** input field and click **Run workflow**.
4. GitHub Actions skips rebuilding and immediately updates Cloud Run to serve the specified image digest while preserving all Cloud SQL records. Repeat with the latest commit SHA to roll forward.

### 5.3 Verifying the Currently Running Commit
To audit which exact commit is live in production at any time:
1. **GitHub Actions:** Open the latest green run in **Actions > Deploy demo > Summary** and inspect `Commit image tag` and `Digest` (e.g., commit `c75d3ce4d3fafdf95b33322308f3bbc7306545ca` / digest `sha256:69fc47d1f9b3...`).
2. **GCP Console:** Open **Cloud Run > `serwongserway` > Revisions**, select the active revision receiving `100%` traffic (e.g., `serwongserway-00004-nmp`), and confirm its container image digest matches the Artifact Registry tag for that commit SHA.