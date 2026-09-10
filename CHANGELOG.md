# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.2.3] - 2026-09-10

### Added

- A README banner. The README is the whole npm listing, since npm has no package icon
  field, so this is the package's only branding surface.

### Fixed

- `biome.json` pointed at the 2.3.11 schema after the bump to 2.5.12, which biome reported
  as an info diagnostic on every run.

## [1.2.2] - 2026-09-10

### Fixed

- Expose `./package.json` through the `exports` map. Without it, tooling that reads a
  dependency's `package.json` — a common pattern — fails with
  `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## [1.2.1] - 2026-09-10

### Fixed

- Name `@types/node` explicitly in `tsconfig.json`. TypeScript 7 no longer reliably
  auto-includes it, which can leave every Node global unresolved. This repository happened
  to still resolve them, but the sibling analyzers did not — pinning it explicitly removes
  the difference.

## [1.2.0] - 2026-09-10

### Changed

- **The minimum supported Node.js version is now 22.** Node 20 reached end of life on
  30 April 2026. This also fixes a latent bug: `@inquirer/prompts` v8 is ESM-only, and
  `require()` of an ES module only works from Node 20.19 onward — so interactive mode was
  broken on Node 20.0 through 20.18, which the previous `>=20` range claimed to support.
- TypeScript 7. It removes the legacy `node10` module resolution, so the projects moved to
  `nodenext`, which is what correctly models Node 22+ being able to `require()` an ES
  module. `@types/node` is pinned to the supported floor rather than the newest release, so
  the compiler rejects APIs that would not exist at runtime.
- Updated `ioredis` to 6, `mongodb` to 7, `pg`, `@inquirer/prompts` and `@biomejs/biome`,
  and the GitHub Actions to their current majors. Each was verified against a real database
  container, not just a green type-check.

## [1.1.0] - 2026-09-10

### Added

- A programmatic API. `RedisAnalyzer` is exported from the package root, alongside the
  analyzers, collectors, reporters and every report type. Importing the package now has
  no side effects — previously `require("@deniscuciuc/redis-analyzer")` connected to the
  database and ran an analysis, because the CLI was the package entry point and
  `main`/`types` pointed at it. The CLI moved to `src/cli/main.ts` and is still reached
  through the `redis-analyzer` binary.
- A test suite. `pnpm test` runs it, and CI runs it on Node 20, 22 and 24.
- `SECURITY.md` and `CODE_OF_CONDUCT.md`.

### Fixed

- `--watch -1` was mistaken for a flag and silently replaced by the default interval
  instead of being rejected.
- Numeric flags were parsed with no validation, so `--port abc` produced `NaN` and
  surfaced as a confusing driver error far from the actual mistake. Each flag now reports
  its own name.
- A flag at the end of the argument list stored `undefined` rather than failing.
- An unknown flag was silently ignored, so a typo like `--jsno` produced human-readable
  output instead of JSON.
- The connection is no longer torn down by an unhandled `error` event: with no listener
  attached, an idle-connection failure terminated the process, which was near-certain in
  `--watch` mode.
- Ctrl+C during a query did nothing, and a second Ctrl+C did nothing either, so the CLI
  appeared to hang. A second signal now exits, and `SIGTERM` is handled so `docker stop`
  reaches the connection cleanup.
- `process.exitCode` is set instead of calling `process.exit`, which could truncate
  buffered output when piping `--json` to a file.

### Changed

- The npm tarball no longer contains the compiled tests.
- Stricter TypeScript (`noUncheckedIndexedAccess` and friends) and Biome rules; unused
  variables and imports are errors rather than warnings.
- CI runs on every branch, not just `main` and `develop`, and cancels superseded runs.
- Publishing now emits npm provenance and verifies the tag matches `package.json`.

## [1.0.0] - 2026-06-14

### Added

- Redis analyzer CLI with memory, hit-rate, persistence, replication, keyspace, connection, and slow-command commands
- URI, host/port, TLS, password, and database-number connection support
- `.analyzerrc.json` profiles, compare mode, HTML reports, and watch mode
- Interactive CLI with report generation and runtime settings
- Markdown, JSON, and HTML reports under `./reports/`
- Diff reporting between JSON snapshots
- Automated tests for option parsing, Redis INFO parsing, health scoring, and report generation
- GitHub Actions CI and publish workflows
- Dependabot configuration for npm and GitHub Actions
- MIT license and OSS metadata

### Changed

- Full analysis generates Markdown, JSON, and optional HTML reports in one run

### Fixed

- Explicit `--profile` selection overrides sourced environment defaults for the active run
