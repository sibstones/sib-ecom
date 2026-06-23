.PHONY: help docker-up docker-down docker-build docker-logs docker-dev docker-clean update update-self-hosted \
	check-env prod-check prod-deploy db-migrate db-studio timeweb-config-check timeweb-compose

help: ## Show help
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# --- Production: full build with checks and migrations ---
check-env: ## Check .env for production (JWT secrets are not default)
	@if [ -z "$$PROD_SKIP_ENV" ]; then \
		sh "$(CURDIR)/scripts/check-prod-env.sh" "$(CURDIR)/.env"; \
	else \
		echo "SKIP: check-env (PROD_SKIP_ENV=1)"; \
	fi

prod-check: check-env ## Checks before production: env, npm audit, lint, type-check (backend + frontend)
	@echo "[prod-check] Backend: audit (high/critical)..."
	@cd backend && npm audit --audit-level=high
	@echo "[prod-check] Frontend: audit (high/critical)..."
	@cd frontend && npm audit --audit-level=high
	@echo "[prod-check] Backend: lint..."
	@cd backend && npm run lint
	@echo "[prod-check] Frontend: lint..."
	@cd frontend && npm run lint
	@echo "[prod-check] Backend: type-check..."
	@cd backend && npm run type-check
	@echo "[prod-check] Frontend: check..."
	@cd frontend && npm run check
	@echo "[prod-check] OK: all checks passed."

prod-deploy: ## Production: checks → build → up. Migrations are performed on backend start.
	$(MAKE) prod-check
	docker-compose build
	docker-compose up -d
	@echo "Backend applies migrations on start. Logs: make docker-logs"

# Docker commands
docker-up: ## Start containers without rebuild (for full prod: make prod-deploy)
	docker-compose up -d

update: ## Update application (build + up without checks): postgres, minio, backend, frontend. Data is saved.
	docker-compose up -d --build

update-self-hosted: ## Same for self-hosted (docker-compose.self-hosted.yml)
	docker-compose -f docker-compose.self-hosted.yml up -d --build

timeweb-config-check: ## Check Timeweb compose for validity through .env.timeweb.example
	docker compose --env-file .env.timeweb.example -f docker-compose.timeweb.yml config >/dev/null
	@echo "OK: docker-compose.timeweb.yml is valid."

timeweb-compose: ## Show the final Timeweb compose configuration
	docker compose --env-file .env.timeweb.example -f docker-compose.timeweb.yml config

docker-down: ## Stop Docker Compose (data in volumes is saved)
	docker-compose down

	docker-build: ## Rebuild Docker images
	docker-compose build

docker-build-backend: ## Rebuild only backend (without cache; for MODULE_NOT_FOUND, for example xlsx)
	docker-compose build --no-cache backend

docker-logs: ## Show logs
	docker-compose logs -f

docker-dev: ## Start in development mode
	docker-compose -f docker-compose.dev.yml up

docker-dev-down: ## Stop development environment
	docker-compose -f docker-compose.dev.yml down

docker-clean: ## Stop and delete volumes (⚠️ WILL DELETE DB AND MINIO — only for dev/full reset)
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v

docker-restart: ## Restart services
	docker-compose restart

# Move to another server: full DB backup + MinIO (files in backend/backups/)
backup-migrate: ## Create backup for migration: DB (pg_dump) + MinIO. Containers must be running.
	cd backend && npm run backup:db-docker
	docker-compose exec -T backend npm run backup:s3

# Database
db-migrate: ## Execute Prisma migrations (backend must be running)
	docker-compose exec backend npx prisma migrate deploy

db-migrate-standalone: ## Execute migrations without running backend (single container)
	docker-compose run --rm backend npx prisma migrate deploy

db-setup: ## Reset DB to defaults: drop + migrations + seed (FASHION, en/US)
	docker-compose exec backend npm run db:setup

db-seed: ## Only seed (default settings, languages, countries)
	docker-compose exec backend npm run db:seed

db-studio: ## Open Prisma Studio
	docker-compose exec backend npx prisma studio

db-shell: ## Connect to PostgreSQL
	docker-compose exec postgres psql -U postgres -d fashion_db

# Backend
backend-shell: ## Enter backend container
	docker-compose exec backend sh

backend-logs: ## Backend logs
	docker-compose logs -f backend

# Utilities
	status: ## Show container status
	docker-compose ps

health: ## Check health check (Docker: backend on port 3001; for another port: PORT=3002 make health)
	@curl -s http://localhost:$${PORT:-3001}/health | jq . || echo "Backend not available (default port 3001)"

# Full cleanup
clean-all: ## Full cleanup (containers, volumes, images)
	docker-compose down -v --rmi all
	docker-compose -f docker-compose.dev.yml down -v --rmi all
	docker system prune -a -f
