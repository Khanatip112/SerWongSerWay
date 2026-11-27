# Lab 5 Deployment & Operations Guide — SerWongSerWay

## 1. System Overview & Tech Stack

**SerWongSerWay** (PastelPulse Review & Survey System) is containerized using Docker and deployed as a stateless service on Google Cloud Platform (GCP) with automated CI/CD via GitHub Actions.

| Layer / Component | Technology / Service | Details & Role |
| :--- | :--- | :--- |
| **Frontend (UI)** | React 18, Vite, Nginx | Single-page application (Local dev & Compose port `5173` / Served statically on port `3000` in unified production container) |
| **Backend (API)** | Node.js 24, Express | RESTful API server listening on `0.0.0.0:${PORT}` (Docker Compose & Cloud Run port `3000`; local `npm run server:dev` port `4000`) |
| **Database** | PostgreSQL 16 | Persistent relational storage (Docker Compose host port `5434` / GCP Cloud SQL) |
| **Containerization** | Docker, Docker Compose | Multi-stage Dockerfiles (`Dockerfile` on port `3000` for production; `docker-compose.yml` for local stack) |
| **CI/CD Pipeline** | GitHub Actions | Automated testing (`ci-docker.yml`) and deployment (`deploy.yml`) via Workload Identity Federation |
| **Cloud Runtime** | Google Cloud Run | Serverless container runtime (`asia-southeast1`, auto-scaling `0–3` instances) |
| **Artifact & Secrets** | Artifact Registry, Secret Manager | Stores SHA-tagged Docker images and injects sensitive credentials at runtime |

- **Public Repository:** `https://github.com/Khanatip112/SerWongSerWay`
- **Live Production URL:** `https://serwongserway-vs56b635aq-as.a.run.app`
- **Health & Readiness Endpoints:**
  - `GET /api/health` — Verifies application process liveness (`{"status":"ok"}`).
  - `GET /api/ready` — Verifies active database connectivity (`{"status":"ready","database":"connected"}`).

---

## 2. Environment Variables & Secret Management

All runtime configurations are injected via environment variables. **Real secrets are never committed to Git**; local development uses `.env` (copied from `.env.example`), while Cloud Run retrieves secrets from **GCP Secret Manager** via per-secret IAM bindings.

| Variable Name | Description | Secret? | Local Source | Production (GCP) Source |
| :--- | :--- | :---: | :--- | :--- |
| `NODE_ENV` | Application runtime mode (`development` / `production`) | No | `.env` (`development`) | Cloud Run Env Var (`production`) |
| `PORT` | HTTP port bound by the Express server (`0.0.0.0`) | No | `.env` (`4000` local dev / `3000` Docker) | Cloud Run Container Port (`3000`) |
| `TZ` | Application timezone | No | `.env` (`Asia/Bangkok`) | Cloud Run Env Var (`Asia/Bangkok`) |
| `CLIENT_ORIGIN` | Allowed frontend origin for CORS | No | `.env` (`http://localhost:5173`) | Same-origin unified container |
| `DATABASE_URL` | PostgreSQL connection string | **Yes** | `.env` (`localhost:5434` Compose DB) | GCP Secret Manager (`toktickit-database-url`) |
| `SESSION_SECRET` | Cryptographic key for signing `pastelpulse_session` cookies | **Yes** | `.env` (`change_me_...`) | GCP Secret Manager (`serwongserway-session-secret`) |
| `CREATOR1_PASSWORD` | Seeded password for Creator 1 (`james.and@gmail.com`) | **Yes** | `.env` (placeholder) | GCP Secret Manager (`serwongserway-creator1-pass`) |
| `CREATOR2_PASSWORD` | Seeded password for Creator 2 (`william.tho@gmail.com`) | **Yes** | `.env` (placeholder) | GCP Secret Manager (`serwongserway-creator2-pass`) |
| `RESPONDENT1_PASSWORD` | Seeded password for Respondent 1 (`amelia.cla@gmail.com`) | **Yes** | `.env` (placeholder) | GCP Secret Manager (`serwongserway-respondent1-pass`) |
| `RESPONDENT2_PASSWORD` | Seeded password for Respondent 2 (`daniel.rob@gmail.com`) | **Yes** | `.env` (placeholder) | GCP Secret Manager (`serwongserway-respondent2-pass`) |

---

## 3. Local Build, Run, Test, and Database Commands

### 3.1 Fresh Clone Startup (Docker Compose)
To reproduce the full stack locally from a clean clone using only `.env.example`:

```bash
# 1. Clone the repository
git clone [https://github.com/Khanatip112/SerWongSerWay.git](https://github.com/Khanatip112/SerWongSerWay.git)
cd SerWongSerWay

# 2. Create local environment file(s) from example
cp .env.example .env
cp server/.env.example server/.env

# 3. Build images and start database (:5434), migrations, server (:3000), and client (:5173)
docker compose up --build -d

# 4. Verify container health
docker compose ps -a

# 5. Verify Compose API endpoints (port 3000)
curl --fail http://localhost:3000/api/health
curl --fail http://localhost:3000/api/ready
```

- **Local Web UI:** `http://localhost:5173` (or `http://localhost:3000` when running the unified production `Dockerfile`)
- **Stop & Clean Up:** `docker compose down` (add `-v` only if resetting local database volumes).

### 3.2 Database Migrations, Seeding, Build, and Automated Tests

Commands executed inside the `server/` workspace (Node.js 24):

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

---

## 4. Google Cloud Platform (GCP) Resources

All cloud infrastructure is provisioned in region **`asia-southeast1`** (Singapore) under project **`cpe334-team046`**.

| Resource Type | Resource Name / Identifier | Configuration Summary |
| :--- | :--- | :--- |
| **GCP Project ID** | `cpe334-team046` | Billing enabled with budget alerts only (`Alerts only`) |
| **Cloud Run Service** | `serwongserway` | Public unauthenticated access (`allUsers`), Port `3000`, Min `0` / Max `3` instances |
| **Cloud SQL Instance** | `toktickit-pg` | PostgreSQL 16, `Runnable`, Storage auto-increase **Disabled** |
| **Artifact Registry** | `asia-southeast1-docker.pkg.dev/cpe334-team046/serwongserway` | Stores immutable Docker images tagged with 40-char commit SHAs |
| **Runtime Service Account** | `toktickit-runner@cpe334-team046.iam.gserviceaccount.com` | Least-privilege IAM: `Cloud SQL Client` & per-secret `Secret Manager Secret Accessor` |
| **Deployer Service Account** | `toktickit-deployer@cpe334-team046.iam.gserviceaccount.com` | Keyless authentication via Workload Identity Federation (`github-actions` pool) |

---

## 5. Release, Rollback, and Version Verification Procedures

### 5.1 Standard Release Pipeline (`staging` -> `main`)
1. **Feature Development:** Create a GitHub Issue (labeled `lab5`), branch from `staging`, implement changes, and open a Pull Request into `staging`.
2. **Quality Gate (`ci-docker.yml`):** GitHub Actions runs `test-and-docker` (Node.js 24 build, database migration, seed, automated tests, and Docker build). A teammate reviews and approves the PR before merging into `staging`.
3. **Production Release (`deploy.yml`):** Open a Release PR from `staging` into `main`. Branch ruleset `protect-main` blocks merging unless `test-and-docker` passes and approval is granted.
4. **Automated Deployment:** Merging into `main` triggers **Deploy demo** (`deploy.yml`), which:
   - Authenticates to GCP via Workload Identity Federation (no JSON keys).
   - Builds and pushes the Docker image tagged with the exact 40-character Git commit SHA.
   - Executes database migrations and seeding (`deploy/release.sh` / `toktickit-migrate`).
   - Deploys the new revision to Cloud Run (`serwongserway`) on port `3000` with `100%` traffic.
   - Runs `deploy/smoke_test.py` against `https://serwongserway-vs56b635aq-as.a.run.app`.

### 5.2 Rollback & Roll-Forward Procedure
Because every release image in Artifact Registry is tagged with its immutable commit SHA and database data persists in Cloud SQL:
1. Navigate to **GitHub > Actions > Deploy demo**.
2. Click **Run workflow** (selecting branch `main`).
3. Paste the target 40-character commit SHA into the **`image_tag`** input field and click **Run workflow**.
4. GitHub Actions skips rebuilding and immediately updates Cloud Run to serve the specified image digest while preserving all Cloud SQL records. Repeat with the latest commit SHA to roll forward.

### 5.3 Verifying the Currently Running Commit
To audit which exact commit is live in production at any time:
1. **GitHub Actions:** Open the latest green run in **Actions > Deploy demo > Summary** and inspect `Commit image tag` and `Digest` (e.g., commit `c75d3ce4d3fafdf95b33322308f3bbc7306545ca` / digest `sha256:69fc47d1f9b3...`).
2. **GCP Console:** Open **Cloud Run > `serwongserway` > Revisions**, select the active revision receiving `100%` traffic, and confirm its container image digest matches the Artifact Registry tag for that commit SHA.