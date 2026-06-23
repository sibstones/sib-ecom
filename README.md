# SIB ECOM AI CMS

![Shop screenshot](shop.png)

Full-featured e-commerce platform for a store: storefront on `SvelteKit`, backend API on `Express + TypeScript`, `PostgreSQL` via `Prisma`, file storage in `S3`/`MinIO`, and a separate RAG setup for `GPT Assistant`.

## Active Projects

| Project | Description |
| --- | --- |
| [shisterov.to](https://shisterov.to/) | Niche brand, personal online store, and designer showcase for Danila Shisterov |

## Repository Layout

- `frontend/` — storefront and admin UI built with `SvelteKit`
- `backend/` — API, business logic, Prisma schema, seeds, and utility scripts
- `docker-compose.dev.yml` — local development stack with `PostgreSQL`, `pgvector`, and `MinIO`
- `docker-compose.yml` — production / self-hosted application stack
- `Makefile` — commands for startup, updates, migrations, logs, and backups

## Stack

- Frontend: `SvelteKit`, `Svelte 5`, `Vite`, `Tailwind CSS`
- Backend: `Node.js`, `Express`, `TypeScript`, `Prisma`
- Database: `PostgreSQL`
- File storage: `MinIO` or any S3-compatible storage
- AI / RAG: `OpenAI SDK`, separate `PostgreSQL + pgvector` database for RAG
- Infrastructure: `Docker Compose`, `Makefile`

## Project Areas

Use this as a quick map of where each part of the project is managed:

- App startup and lifecycle: `docker-compose.dev.yml`, `docker-compose.yml`, `Makefile`
- Environment configuration: `.env.dev`, `.env.dev.example`, `.env.docker.example`, `frontend/.env.example`
- Frontend storefront: `frontend/`
- Backend and API: `backend/src/`
- Database and migrations: `backend/prisma/`, `backend/prisma-rag/`
- Admin panel and content tools: `frontend/src/routes/(admin)/admin/`
- GPT Assistant and RAG: `backend/src/services/gpt-*`, `backend/src/services/rag.service.ts`
- Backups and restore scripts: `backend/src/scripts/backup-*.ts`, `backend/src/scripts/restore-*.ts`
- Production deployment: `docker-compose.yml`, `.env.docker.example`, `scripts/check-prod-env.sh`

## Admin Panel Features

The admin area lives in `frontend/src/routes/(admin)/admin/`.

### Catalog

- `Products` — create and edit products, prices, media, and statuses
- `Categories` — manage catalog categories
- `Brands` — manage brands
- `Lookbook` — manage lookbook entries and related content
- `Pages` — manage standalone content pages

### Storefront and Content

- `Homepage` — manage homepage sections
- `Header` — manage header and navigation
- `Footer` — manage footer content
- `Shop Page Design` — control catalog page design
- `Product Page Design` — control product page design
- `Blog` — manage blog posts and blog content

### Sales and Orders

- `Orders` — review and process orders
- `Returns` — manage return requests
- `Payment Requests` — handle payment request flows
- `Payment Gateways` — configure available payment providers
- `Promo` — manage promo codes and promotions
- `Marketing` — manage marketing-related flows and campaigns

### Customers and Communication

- `Customers` — review customer records
- `Tickets` — handle support tickets
- `Partners` — manage partner program data
- `Profile` — edit the current admin profile

### Operations

- `Warehouses` — manage warehouses
- `Sales Points` — manage sales points
- `Countries` — configure countries
- `Languages` — manage languages and localization
- `Currency Rates` — manage exchange rates
- `Delivery Tracking` — configure and review delivery tracking

### Finance and Reporting

- `Accounting` — work with accounting-related entities and financial data
- `Reports` — review store reports
- `Dashboard` — see high-level project metrics
- `Backups` — run or monitor backup operations

### System and Access

- `Settings` — general system configuration
- `Settings -> Admins` — manage admin users
- `Settings -> Activity Logs` — review activity history
- `Settings -> API Keys` — manage API keys
- `Settings -> License` — manage license state
- `Onboarding` — run initial project setup flows

### GPT Assistant

- `Settings -> GPT Assistant` — enable and configure AI features
- `Settings -> GPT Assistant -> Prompts` — manage prompts
- `Settings -> GPT Assistant -> Analytics` — view usage analytics
- `Settings -> GPT Assistant -> Logs` — inspect logs and diagnostics
- `Settings -> GPT Assistant -> Test` — test assistant behavior

## Quick Start

### Option 1. Full local stack in Docker

Recommended for the first run.

```bash
cp .env.dev.example .env.dev
docker compose --env-file .env.dev -f docker-compose.dev.yml up --build
```

After startup:

- site: `http://localhost:8080`
- API: `http://localhost:3001`
- healthcheck: `http://localhost:3001/health`
- PostgreSQL: `localhost:15432`
- RAG PostgreSQL: `localhost:15433`
- MinIO API: `http://localhost:19000`
- MinIO Console: `http://localhost:19001`

Stop the stack:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down
```

Remove volumes too:

```bash
docker compose --env-file .env.dev -f docker-compose.dev.yml down -v
```

### Option 2. Backend in Docker, frontend locally

Useful for active UI work.

1. Start backend infrastructure:

```bash
./scripts/dev-start.sh
```

2. Check `frontend/.env`:

```env
VITE_API_PROXY_TARGET=3001
```

3. Start the frontend:

```bash
cd frontend
npm install
npm run dev
```

The frontend will usually be available at `http://localhost:5173`.

## Requirements

- `Docker` and `Docker Compose`
- `Node.js 20+` and `npm` for non-Docker local workflows
- `Make` for management commands

## Environment Files

Available templates:

- `.env.dev` — local working copy used by `docker-compose.dev.yml` (create it from `.env.dev.example`)
- `.env.dev.example` — template for local Docker development
- `.env.docker.example` — template for self-hosted / production compose
- `frontend/.env.example` — frontend local dev proxy

Key variables:

- `DATABASE_URL` — main application database
- `RAG_DATABASE_URL` and `RAG_DATABASE_DIRECT_URL` — separate RAG database
- `FRONTEND_BASE_URL` — public frontend URL
- `CORS_ORIGIN` — allowed frontend origins
- `PUBLIC_SITE_URL` — canonical site URL
- `MINIO_*` — S3 / MinIO connection settings
- `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` — required for production

## Common Commands

### Docker / services

```bash
make docker-up
make docker-down
make docker-logs
make docker-build
make docker-dev
make status
make health
```

### Production / self-hosted

```bash
cp .env.docker.example .env
make prod-check
make prod-deploy
```

Important: `docker-compose.yml` does not start PostgreSQL for production.

The production application compose starts only:

- `frontend`
- `backend`

Production `PostgreSQL` must be provisioned separately:

- as a managed database from your provider
- as a dedicated server or dedicated container service
- as a separate database cluster outside this app stack

The backend receives its production database connection only through `DATABASE_URL`.

Production architecture:

```text
User -> Frontend -> Backend -> External PostgreSQL
                         -> External S3 / Object Storage
```

Practical implications:

- `make prod-deploy` will not create a production database for you
- the database must already exist before deployment
- the database connection string must be passed through `.env`
- S3 / object storage settings must also be provided through `.env`

Minimum production variables:

```env
DATABASE_URL=postgresql://USER:PASSWORD@DB_HOST:5432/DB_NAME?schema=public
FRONTEND_BASE_URL=https://your-domain.com
CORS_ORIGIN=https://your-domain.com
PUBLIC_SITE_URL=https://your-domain.com

JWT_SECRET=replace-with-real-secret
JWT_REFRESH_SECRET=replace-with-real-secret
ENCRYPTION_KEY=replace-with-real-secret

MINIO_ENDPOINT=s3-provider-host
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=your-access-key
MINIO_SECRET_KEY=your-secret-key
MINIO_BUCKET_NAME=your-bucket
MINIO_PRIVATE_BUCKET_NAME=your-private-bucket
MINIO_PUBLIC_URL=https://files.your-domain.com
```

Recommended production deployment order:

1. Provision a separate `PostgreSQL` instance.
2. Create a production database and an app-specific user.
3. Prepare S3 / object storage with two buckets: one public bucket for storefront media and one private bucket for documents, payment proofs, and future internal/RAG sources.
4. Fill in `.env` on the target server or deployment platform.
5. Validate configuration with `make prod-check`.
6. Start the application with `make prod-deploy`.

What `prod-deploy` does:

- validates `.env`
- runs `npm audit`, lint, and type checks
- builds Docker images
- starts the application services from `docker-compose.yml`

On startup, the backend will:

- wait for database availability
- apply `Prisma` migrations
- start the server

If `DATABASE_URL` is invalid or the external database is unavailable, the backend will not start.

Treat `docker-compose.yml` as the application compose, not as the full infrastructure compose.

## Database Operations

Via `make`:

```bash
make db-migrate
make db-setup
make db-seed
make db-studio
make db-shell
```

Via backend npm scripts:

```bash
cd backend
npm run prisma:migrate
npm run prisma:migrate:deploy
npm run db:seed
npm run prisma:generate
```

## RAG / GPT Assistant

This project has a separate RAG setup:

- the main `DATABASE_URL` should not be reused for RAG
- RAG uses a separate `PostgreSQL` database
- locally, that database is included in `docker-compose.dev.yml`

Useful commands:

```bash
cd backend
npm run prisma:generate:rag
npm run prisma:deploy:rag
```

Basic health endpoints:

- `GET /health`
- `GET /api/gpt-assistant/admin/health`

## Backup and Restore

Available backend scripts:

```bash
cd backend
npm run backup:db
npm run restore:db
npm run list:backups
npm run backup:s3
npm run restore:s3
```

For Docker-based migration backups:

```bash
make backup-migrate
```

## Project Structure

```text
.
├── backend/
├── frontend/
├── docs/
├── scripts/
├── docker-compose.yml
├── docker-compose.dev.yml
└── Makefile
```


## Post-Launch Check

Minimal smoke test:

1. Open `http://localhost:8080`
2. Check `http://localhost:3001/health`
3. Verify that `GET /api` returns `API v1`
4. Sign in to the admin panel using credentials from env

English documentation is below. Russian version: [README.ru.md](README.ru.md).

## License

This project is distributed under the license in [LICENSE](LICENSE).
