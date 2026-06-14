import { COMMANDS, DEFAULTS } from "../constants";
import type { AnalyzerOptions } from "../types";

export interface ParsedOptions extends AnalyzerOptions {
	host: string;
	port: number;
	password?: string;
	db: number;
	tls: boolean;
	uri?: string;
	profile?: string;
	config?: string;
	compare?: string;
	html: boolean;
	watch?: number;
	command: string;
	json: boolean;
	quiet: boolean;
	outputDir: string;
	slowCommandThreshold: number;
	maxSlowCommands: number;
	interactive: boolean;
}

export function parseOptions(argv = process.argv.slice(2)): ParsedOptions {
	const options: ParsedOptions = {
		host: DEFAULTS.host,
		port: DEFAULTS.port,
		db: DEFAULTS.db,
		tls: false,
		command: "full",
		json: false,
		quiet: false,
		html: false,
		outputDir: DEFAULTS.output,
		slowCommandThreshold: DEFAULTS.slowCommandThreshold,
		maxSlowCommands: DEFAULTS.maxSlowCommands,
		interactive: false,
	};

	for (let index = 0; index < argv.length; index++) {
		switch (argv[index]) {
			case "--host":
			case "-h":
				options.host = argv[++index];
				break;
			case "--port":
			case "-p":
				options.port = Number.parseInt(argv[++index], 10);
				break;
			case "--password":
			case "-a":
				options.password = argv[++index];
				break;
			case "--db":
			case "-n":
				options.db = Number.parseInt(argv[++index], 10);
				break;
			case "--tls":
				options.tls = true;
				break;
			case "--uri":
				options.uri = argv[++index];
				break;
			case "--output":
			case "-o":
				options.outputDir = argv[++index];
				break;
			case "--profile":
				options.profile = argv[++index];
				break;
			case "--config":
				options.config = argv[++index];
				break;
			case "--compare":
				options.compare = argv[++index];
				break;
			case "--html":
				options.html = true;
				break;
			case "--watch": {
				const nextValue = argv[index + 1];
				if (nextValue && !nextValue.startsWith("-")) {
					options.watch = Number.parseInt(nextValue, 10);
					index++;
				} else {
					options.watch = DEFAULTS.watchInterval;
				}
				break;
			}
			case "--slow-threshold":
				options.slowCommandThreshold = Number.parseInt(argv[++index], 10);
				break;
			case "--max-slow-commands":
				options.maxSlowCommands = Number.parseInt(argv[++index], 10);
				break;
			case "--help":
				printHelp();
				process.exit(0);
				return options;
			case "--json":
			case "-j":
				options.json = true;
				break;
			case "--quiet":
			case "-q":
				options.quiet = true;
				break;
			case "--command":
			case "-c":
				options.command = argv[++index];
				break;
			case "--interactive":
			case "-i":
			case "start":
				options.interactive = true;
				break;
		}
	}

	if (
		options.watch !== undefined &&
		(!Number.isFinite(options.watch) || options.watch <= 0)
	) {
		throw new Error(`Invalid watch interval: ${options.watch}`);
	}

	if (!COMMANDS.includes(options.command as (typeof COMMANDS)[number])) {
		throw new Error(
			`Unknown command "${options.command}". Use --help to see available commands.`,
		);
	}

	return options;
}

export function toAnalyzerOptions(options: ParsedOptions): AnalyzerOptions {
	return {
		slowCommandThreshold: options.slowCommandThreshold,
		maxSlowCommands: options.maxSlowCommands,
		outputDir: options.outputDir,
	};
}

function printHelp(): void {
	console.log(`
Redis Analyzer
==============

Usage:
  npx ts-node index.ts [options]

Connection options:
  -h, --host <host>              Redis host (env: REDIS_HOST)
  -p, --port <port>              Redis port (env: REDIS_PORT)
  -a, --password <password>      Redis password (env: REDIS_PASSWORD)
  -n, --db <number>              Redis database number (env: REDIS_DB)
      --tls                      Enable TLS (env: REDIS_TLS=true)
      --uri <uri>                Redis URI (env: REDIS_URI)
      --profile <name>           Use named profile from .analyzerrc.json
      --config <path>            Use a custom config file path

Analysis options:
      --slow-threshold <μs>      Slow command threshold in microseconds (default: ${DEFAULTS.slowCommandThreshold})
      --max-slow-commands <n>    Max slow log rows to fetch (default: ${DEFAULTS.maxSlowCommands})
      --compare <path>           Compare against a previous JSON report
      --watch [seconds]          Watch mode (default interval: ${DEFAULTS.watchInterval}s)

Output options:
  -o, --output <dir>             Output directory for reports (default: ${DEFAULTS.output})
  -j, --json                     Output JSON to stdout
      --html                     Also generate an HTML report
  -q, --quiet                    Suppress non-essential output
  -i, --interactive              Interactive mode with menu
      start                      Alias for --interactive

Commands:
  -c, --command <cmd>            Run a specific analysis command

Available commands:
  ${COMMANDS.join("\n  ")}
`);
}
