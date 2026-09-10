# Redis Analyzer

[![Node.js 22+](https://img.shields.io/badge/node-20%2B-339933?logo=node.js)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/@deniscuciuc/redis-analyzer?logo=npm&color=cb3837)](https://www.npmjs.com/package/@deniscuciuc/redis-analyzer)
[![npm downloads](https://img.shields.io/npm/dm/@deniscuciuc/redis-analyzer)](https://www.npmjs.com/package/@deniscuciuc/redis-analyzer)
[![License: MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![TypeScript](https://img.shields.io/badge/types-TypeScript-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![CI](https://github.com/deniscuciuc/db-analyzer-redis/actions/workflows/ci.yml/badge.svg)](https://github.com/deniscuciuc/db-analyzer-redis/actions/workflows/ci.yml)

A CLI tool that analyzes Redis health with a focus on memory pressure, cache hit rate, persistence safety, replication lag, connection pressure, and slow commands. It emits structured JSON for automation or writes Markdown, JSON, and optional HTML reports to `./reports/`.

## Quick start

No installation required:

```bash
npx @deniscuciuc/redis-analyzer -h localhost -p 6379 -c health
npx @deniscuciuc/redis-analyzer --uri redis://localhost:6379/0 -c full --json > report.json
```

Or install globally:

```bash
npm install -g @deniscuciuc/redis-analyzer
redis-analyzer -h your-host -p 6379 -c health
```

> **Working with an AI agent?** See [.github/copilot-instructions.md](.github/copilot-instructions.md) for the integrated GitHub Copilot workflow and JSON contracts.

---

## Table of Contents

- [Features](#features)
- [Requirements](#requirements)
- [Development / local setup](#development--local-setup)
- [Configuration](#configuration)
- [Usage](#usage)
- [Commands](#commands)
- [CLI options](#cli-options)
- [Output formats](#output-formats)
- [Health score](#health-score)
- [Architecture](#architecture)
- [Contributing](#contributing)

---

## Features

- Memory usage analysis with fragmentation and RSS overhead checks
- Cache hit-rate analysis with eviction and expiry context
- Persistence safety checks for RDB and AOF
- Replication health checks for standalone, primary, and replica nodes
- Slow command analysis from `SLOWLOG`
- Keyspace summaries by logical database
- Interactive mode, compare mode, HTML reports, and watch mode for safe commands

## Requirements

- Node.js 22+
- pnpm >= 10
- Redis 6+

## Development / local setup

```bash
pnpm install
cp .env.example .env
# edit .env with your Redis connection details
pnpm build
node dist/index.js --help
```

## Configuration

### Environment variables (`.env`)

```bash
export REDIS_HOST=localhost
export REDIS_PORT=6379
export REDIS_DB=0
export REDIS_PASSWORD=secret
export REDIS_TLS=false

# Alternative: URI format
# export REDIS_URI=redis://:secret@redis.internal:6379/0
```

### Config file (`.analyzerrc.json`)

Place `.analyzerrc.json` in your project root (or `~/.config/db-analyzer/config.json` for global settings). Copy `analyzerrc.example.json` to get started:

```bash
cp analyzerrc.example.json .analyzerrc.json
```

Profiles let you switch between Redis instances:

```bash
. ./.env && npx ts-node index.ts -c health --profile prod
pnpm analyze:health -- --profile local
```

CLI flags always win. When you explicitly select `--profile`, that profile overrides the sourced environment defaults for that run.

## Usage

### Interactive mode

```bash
pnpm start
```

### npm scripts

```bash
pnpm analyze
pnpm analyze:help
pnpm analyze:health
pnpm analyze:memory
pnpm analyze:hit-rate
pnpm analyze:slow
pnpm analyze:keys
pnpm analyze:connections
pnpm analyze:persistence
pnpm analyze:replication
pnpm analyze:config
pnpm analyze:html
pnpm analyze:watch
pnpm server:info
pnpm build
pnpm lint
pnpm test
```

### Direct CLI

```bash
. ./.env && npx ts-node index.ts -j -c health
. ./.env && npx ts-node index.ts -j -c slow-commands --slow-threshold 5000
npx ts-node index.ts --uri redis://localhost:6379/0 -c full --html
```

---

## Commands

| Command | Description |
| ------- | ----------- |
| `full` | Complete analysis (default) |
| `health` | Health score and key metrics |
| `server-info` | Redis version, mode, uptime, config file |
| `memory` | Memory usage, fragmentation, and overhead |
| `hit-rate` | Cache hit ratio, expirations, and evictions |
| `slow-commands` | `SLOWLOG` analysis with top command types |
| `keys` | Keyspace counts, expiries, and average TTL |
| `connections` | Connected, blocked, rejected, and buffer metrics |
| `persistence` | RDB and AOF health |
| `replication` | Primary / replica status and lag |
| `config` | Important Redis configuration values |

## CLI options

| Option | Short | Description | Default |
| ------ | ----- | ----------- | ------- |
| `--host` | `-h` | Redis host | `localhost` |
| `--port` | `-p` | Redis port | `6379` |
| `--password` | `-a` | Redis password | - |
| `--db` | `-n` | Database number | `0` |
| `--tls` |  | Enable TLS | `false` |
| `--uri` |  | Redis URI (`redis://...`) | - |
| `--profile` |  | Use named profile from `.analyzerrc.json` | - |
| `--config` |  | Use a custom config file path | auto-search |
| `--slow-threshold` |  | Slow command threshold in microseconds | `10000` |
| `--max-slow-commands` |  | Max `SLOWLOG` rows to fetch | `25` |
| `--compare` |  | Compare against a previous JSON report | - |
| `--watch` |  | Poll interval in seconds | - |
| `--command` | `-c` | Run a specific analysis command | `full` |
| `--json` | `-j` | Output JSON | `false` |
| `--quiet` | `-q` | Suppress non-essential output | `false` |
| `--output` | `-o` | Reports directory | `./reports` |
| `--html` |  | Also generate an HTML report | `false` |
| `--interactive` | `-i` | Interactive menu | `false` |

---

## Output formats

### JSON

Use `-j` to emit machine-readable JSON to stdout.

### Markdown / HTML reports

`full` analysis writes:

- Markdown report
- JSON report
- Optional HTML report when `--html` is set

### Compare mode

Compare two snapshots:

```bash
. ./.env && npx ts-node index.ts -c full --compare ./reports/redis-analysis-prev.json
```

## Health score

The analyzer starts at **100** and deducts points for:

- high memory usage or fragmentation
- low cache hit rate
- failed or stale persistence
- replication lag or broken links
- rejected client connections

Score guide:

| Score | Status |
| ----- | ------ |
| 90-100 | Excellent |
| 70-89 | Good |
| 50-69 | Warning |
| 0-49 | Critical |

## Programmatic usage

The package has two entry points. Importing it gives you the library and does nothing else;
the CLI is reached through the `redis-analyzer` binary.

```ts
import { RedisAnalyzer } from "@deniscuciuc/redis-analyzer";

const analyzer = new RedisAnalyzer({
  host: "localhost",
  port: 6379,
  password: process.env.REDIS_PASSWORD,
  outputDir: "./reports",
});

try {
  const report = await analyzer.analyze();

  console.log(`Health score: ${report.healthScore}`);
  for (const recommendation of report.recommendations) {
    console.log(`- [${recommendation.severity}] ${recommendation.message}`);
  }

  // "markdown" (default), "json" or "html"; returns the path written.
  const path = await analyzer.generateReport("json", report);
  console.log(`Report written to ${path}`);
} finally {
  await analyzer.close();
}
```

### `RedisAnalyzer`

| Member | Description |
|---|---|
| `new RedisAnalyzer(options?)` | Opens no connection. See the option table below. |
| `connect()` | Connects and pings. Called automatically by `analyze()`; call it directly to surface a connection failure early. |
| `analyze()` | Runs a full analysis and resolves to a `FullRedisReport`. |
| `generateReport(format?, report?)` | Writes a report and resolves to the file path. Generates a report first if one is not supplied. |
| `close()` | Closes the connection. Does nothing to a client you supplied yourself. |

| Option | Default | Description |
|---|---|---|
| `host` | `localhost` | Ignored when `uri` is set |
| `port` | `6379` | Ignored when `uri` is set |
| `password` | — | |
| `db` | `0` | |
| `tls` | `false` | TLS with the server certificate verified |
| `uri` | — | A `redis://` or `rediss://` URI, taking precedence over the fields above |
| `outputDir` | `./reports` | Where `generateReport` writes |
| `slowCommandThreshold` | `10000` | Microseconds |
| `maxSlowCommands` | `20` | |
| `client` | — | Use an existing `ioredis` client; you keep ownership and `close()` will not disconnect it |

The analyzers, collectors, reporters and every report type are exported too, so you can
assemble a different pipeline — see [`src/index.ts`](src/index.ts) for the full surface.

## Architecture

```text
src/cli/main.ts                       # CLI entry point (the `redis-analyzer` binary)
src/index.ts                          # Library entry point, no side effects
src/api.ts                            # RedisAnalyzer, the programmatic API
src/cli/{options,runner,validate}.ts  # CLI parsing, command execution, validation
src/config/loader.ts                  # Config loading and profile resolution
src/collectors/stats-collector.ts     # INFO / SLOWLOG / CONFIG collection
src/analyzers/*.ts                    # Memory, performance, persistence, replication analysis
src/reporters/*.ts                    # Markdown, HTML, and diff rendering
src/interactive/{index,display,menus}.ts
src/watch/runner.ts                   # Watch mode loop
tests/*.test.ts                       # Automated tests
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
