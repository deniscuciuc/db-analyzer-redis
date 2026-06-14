# Contributing

Contributions are welcome. Here is how to get started quickly.

## Prerequisites

- Node.js >= 20
- pnpm >= 10
- A reachable Redis instance

## Local setup

```bash
git clone https://github.com/deniscuciuc/db-analyzer-redis.git
cd db-analyzer-redis
pnpm install
cp analyzerrc.example.json .analyzerrc.json
# edit .analyzerrc.json or .env with your local Redis connection details
pnpm build
node dist/index.js --help
```

## Development workflow

```bash
pnpm lint
pnpm build
pnpm test
pnpm lint:fix
```

## Submitting a pull request

1. Fork the repository and create a branch: `git checkout -b fix/my-fix`
2. Make your changes
3. Run `pnpm lint && pnpm build && pnpm test`
4. Open a PR against `main` with a clear description of what changed and why

## Coding standards

- TypeScript strict mode
- Biome formatting (tab indent, enforced by CI)
- No destructive Redis commands in this tool

## Reporting bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md).
Always include the Redis version, Node.js version, OS, the command you ran, and the full output.
