# PastelPulse - Review, Feedback, and Survey System

PastelPulse is a modern, web-based Review, Feedback, and Survey platform built with a high-contrast Pastel Pink design system. It allows authenticated **Creators** to design and publish surveys and review campaigns, while enabling **Respondents** to submit structured answers under strict business rules (such as single-submission enforcement, lifecycle restrictions, and record-level creator ownership isolation).

---

## 📁 Monorepo Architecture

```text
├── client/                     # Frontend (React 18 + TypeScript + Vite)
│   ├── src/
│   │   ├── App.tsx             # Main component & system status display
│   │   ├── index.css           # Global design tokens (--color-brand-pastel: #fadadd, etc.)
│   │   └── main.tsx            # Entry point
│   ├── Dockerfile              # Multi-stage client build with Nginx
│   ├── nginx.conf              # SPA routing & API reverse proxy configuration
│   └── package.json
│
├── server/                     # Backend (Node.js 24 + Express + TypeScript + Prisma + Zod)
│   ├── prisma/
│   │   ├── schema.prisma       # Database models (User, Campaign, Question, Submission, Answer)
│   │   └── seed.ts             # Deterministic seed data script
│   ├── src/
│   │   ├── config/             # Zod environment variable parsing
│   │   ├── db/                 # Prisma client instance
│   │   ├── routes/             # Health and readiness routes (/api/health, /api/ready)
│   │   ├── app.ts              # Express application configuration
│   │   └── index.ts            # Application server bootstrap
│   ├── Dockerfile              # Server container build
│   ├── docker-entrypoint.sh    # DB connection wait, schema push & auto-seed
│   └── package.json
│
├── docs/                       # Project specifications & SRS/SDS documentation
├── Dockerfile                  # Unified production container (API + built SPA on port 3000)
├── docker-compose.yml          # Container orchestration (Postgres :5434, backend :3000, frontend :5173)
├── .env.example                # Root environment variables template
└── package.json                # Monorepo workspaces definition
```

---

## 🎨 Design System Theme Tokens

The client implements the cohesive high-contrast Pastel Pink palette defined in `docs/system-sds.md`:

| Token Name | Hex Value | Purpose |
| :--- | :--- | :--- |
| `--color-brand-pastel` | `#fadadd` | Primary brand accent, header background, active tab indicators |
| `--color-brand-hover` | `#f4c2c7` | Hover / focus state for interactive brand elements |
| `--color-bg-page` | `#fdf6f7` | Main viewport background |
| `--color-surface-card` | `#ffffff` | Content cards, modal dialogs, and form containers |
| `--color-border-subtle` | `#e5d0d3` | Borders and dividers |
| `--color-text-primary` | `#1a1a1a` | High-contrast body text and headings (> 11:1 on `#fadadd`) |
| `--color-text-muted` | `#52525b` | Secondary captions and helper text |
| `--color-accent-action` | `#1a1a1a` | Primary CTA buttons |
| `--color-error` | `#dc2626` | Validation errors, alert banners, and 403/422 alerts |
| `--color-success` | `#16a34a` | Submission success banners, active badges |
| `--color-warning` | `#d97706` | Closed campaign warning badges |

---

### Sample Seeded Campaigns
- **"CPE 334 Course Experience Survey"** (`status: PUBLISHED`): Active survey with 1-5 star rating and open-ended text questions.
- **"Archived Orientation Feedback"** (`status: CLOSED`): Historical survey verifying `BR-02` submission rejection on closed campaigns.

---

## 🚀 Quickstart with Docker Compose

Running via Docker Compose automatically launches PostgreSQL (host port `5434`), applies Prisma schema migrations, seeds test accounts and sample campaigns, and serves both the client (`5173`) and server (`3000`).

1. **Clone and enter repository:**
   ```bash
   cd "Survey System"
   ```

2. **Prepare environment variables:**
   ```bash
   cp .env.example .env
   ```

3. **Build and start all services:**
   ```bash
   docker compose up --build
   # Or on older Docker versions:
   docker-compose up --build
   ```

4. **Access the applications (Docker Compose):**
   - **Frontend UI:** [http://localhost:5173](http://localhost:5173)
   - **Backend API:** [http://localhost:3000](http://localhost:3000)
   - **API Health:** [http://localhost:3000/api/health](http://localhost:3000/api/health)
   - **Database Readiness:** [http://localhost:3000/api/ready](http://localhost:3000/api/ready)
   - **PostgreSQL (Host Port):** `localhost:5434`

   > **Note (Production / Cloud Run Unified Image):** The root `Dockerfile` serves both the Express API and the built React SPA on **port `3000`** (`http://localhost:3000`).

5. **Stop containers:**
   ```bash
   docker compose down
   # To remove persisted database volume:
   docker compose down -v
   ```

---

## 💻 Local Development Setup (Without Docker)

### Prerequisites
- **Node.js**: v24 or higher
- **npm**: v10 or higher
- **PostgreSQL**: v16 running locally on port `5432` (or via Docker Compose DB on port `5434`: `docker compose up -d db`)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
In `server/`:
```bash
cp server/.env.example server/.env
```
Ensure `DATABASE_URL` in `server/.env` matches your PostgreSQL connection string (`5432` for native local PostgreSQL, or `5434` when using `docker compose up -d db`):
```env
PORT=4000
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/pastelpulse?schema=public
SESSION_SECRET=change_me_to_a_secure_random_secret_in_production
CLIENT_ORIGIN=http://localhost:5173
NODE_ENV=development
```

### 3. Generate Prisma Client, Apply Schema & Seed Database
```bash
# Push database schema to PostgreSQL
npm run db:push

# Seed synthetic test users and sample campaigns
npm run db:seed
```

### 4. Start Development Servers
Run backend server and frontend client concurrently or in separate terminals:

```bash
# Terminal 1: Backend server (http://localhost:4000)
npm run server:dev

# Terminal 2: Frontend client (http://localhost:5173)
npm run client:dev
```

---

## 🧪 Testing & Health Checks

### Check API Health & Database Readiness
```bash
# Process liveness probe (use :3000 for Docker Compose / Cloud Run, or :4000 for local server:dev)
curl -i http://localhost:3000/api/health
# Response: {"status":"ok"}

# Database connectivity probe (executes SELECT 1)
curl -i http://localhost:3000/api/ready
# Response: {"status":"ready","database":"connected"}
```

### Run Automated Unit and Integration Tests
```bash
# Run backend test suite via Vitest
npm test
```

---

## 📋 Available Root NPM Scripts

- `npm run server:dev` - Run server in watch mode with `tsx` on port `4000`.
- `npm run server:build` - Compile server TypeScript to `dist/`.
- `npm run client:dev` - Run Vite dev server on port `5173`.
- `npm run client:build` - Type-check and build client production bundle.
- `npm run db:generate` - Generate Prisma Client types.
- `npm run db:push` - Synchronize schema directly with PostgreSQL.
- `npm run db:migrate` - Run Prisma migrate in development.
- `npm run db:seed` - Run idempotent seed script.
- `npm test` - Run automated test suite with Vitest.