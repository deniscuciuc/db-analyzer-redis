# db-analyzer-redis — common commands
# First run: `pnpm install` to install dependencies.

.PHONY: install build lint lint-fix test run help

install:           ## Install dependencies
	pnpm install

build:             ## Compile TypeScript
	pnpm build

lint:              ## Lint with Biome
	pnpm lint

lint-fix:          ## Auto-fix lint issues
	pnpm lint:fix

test:              ## Run automated tests
	pnpm test

run:               ## Run redis-analyzer (pass args via ARGS, e.g. make run ARGS="-j -c health")
	pnpm analyze $(ARGS)

help:              ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFLIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'
