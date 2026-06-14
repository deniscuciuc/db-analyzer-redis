# GitHub Copilot Instructions — Redis Analyzer

You are operating inside the **Redis Analyzer** repository. This file is your authoritative guide: follow it before searching the codebase.

## What this tool does

A CLI that analyzes Redis instances and emits **JSON to stdout** (with `-j`) or **Markdown reports** to `./reports/`. Use it to inspect memory usage, cache hit rate, persistence health, replication lag, connection pressure, keyspaces, and slow commands.

## Prerequisites checklist

Before running any command, verify:

1. `.env` exists at the repo root. If missing: copy `.env.example` and ask the user for connection details — never invent credentials.
2. `node_modules/` exists. If missing, run `pnpm install`.
3. `REDIS_URI` or `REDIS_HOST` / `REDIS_PORT` is exported in `.env` (the file uses `export` so it must be sourced).

## Standard workflow

Always start with the health check, then drill down only if the score is below 90.

```bash
# 1. Health check
pnpm analyze:health

# 2. If healthScore < 90, drill into specifics
pnpm analyze:memory
pnpm analyze:hit-rate
pnpm analyze:slow
pnpm analyze:persistence
pnpm analyze:replication

# 3. For deeper investigation, use direct CLI
. ./.env && npx ts-node index.ts -j -c <command>
```

## Operational rules for the agent

- **Always reply in English.**
- **Use `-j` for parsing.** Markdown output is for humans only.
- **Do not invent credentials or hostnames.**
- **Do not commit `.env`** or any file containing secrets.
- Watch mode is allowed only for non-destructive polling commands.

## File layout

```text
index.ts                              # CLI entry, bootstrap only
src/cli/{options,runner}.ts           # CLI parsing and command execution
src/config/loader.ts                  # Config loading and profile resolution
src/constants.ts                      # Commands, defaults, watch rules
src/collectors/stats-collector.ts     # INFO / SLOWLOG / CONFIG collection
src/analyzers/*.ts                    # Redis-specific analyzers
src/reporters/*.ts                    # Markdown, HTML, and diff output
src/interactive/{index,display,menus}.ts
src/watch/runner.ts                   # Watch mode loop
```
