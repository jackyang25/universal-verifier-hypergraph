.PHONY: build start stop logs test clean

build:  ## Build Docker images (no cache)
	docker-compose build --no-cache
	@echo "Docker images rebuilt"

start:  ## Start the server (Docker)
	docker-compose up --build -d
	@echo "Server running at http://localhost:8000"
	@echo "API docs at http://localhost:8000/api/docs"

stop:  ## Stop the server
	docker-compose down

logs:  ## View server logs
	docker-compose logs -f

clean:  ## Remove containers and cache
	docker-compose down -v --rmi local
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true

help:  ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-10s\033[0m %s\n", $$1, $$2}'
