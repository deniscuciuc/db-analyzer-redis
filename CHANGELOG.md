# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
