.PHONY: dev build start migrate seed docker-up docker-down docker-logs docker-reset secrets

dev:
	npm run dev

build:
	npm run build

start:
	npm start

migrate:
	npx prisma migrate dev

deploy-migrate:
	npx prisma migrate deploy

seed:
	npm run seed

docker-up:
	docker compose up -d --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f api

docker-reset:
	docker compose down -v
	docker compose up -d --build

secrets:
	bash scripts/generate-secrets.sh
