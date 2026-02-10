.PHONY: help \
	docker-build docker-up docker-down docker-logs docker-clean \
	frontend-install frontend-dev frontend-build frontend-lint \
	backend-dev

COMPOSE_FILE := infra/docker/docker-compose.yml
DOCKER_COMPOSE := docker compose -f $(COMPOSE_FILE)

docker-build:  ## Build Docker images (no cache)
	$(DOCKER_COMPOSE) build --no-cache

docker-up:  ## Start backend container(s)
	$(DOCKER_COMPOSE) up --build -d
	@echo "Server running at http://localhost:8000"
	@echo "API docs at http://localhost:8000/api/docs"

docker-down:  ## Stop backend container(s)
	$(DOCKER_COMPOSE) down

docker-logs:  ## Stream backend container logs
	$(DOCKER_COMPOSE) logs -f

docker-clean:  ## Remove containers, volumes, and local images
	$(DOCKER_COMPOSE) down -v --rmi local

frontend-install:  ## Install frontend dependencies from repo root
	cd frontend && npm install

frontend-dev:  ## Run Next.js dev server from repo root
	cd frontend && npm run dev

frontend-build:  ## Build frontend from repo root
	cd frontend && npm run build

frontend-lint:  ## Lint frontend from repo root
	cd frontend && npm run lint

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
