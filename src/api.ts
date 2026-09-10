import Redis from "ioredis";
import { buildFullReport } from "./cli/runner";
import { DEFAULTS } from "./constants";
import { ReportGenerator } from "./reporters/report-generator";
import type {
	AnalyzerOptions,
	FullRedisReport,
	RedisConnection,
} from "./types";

/** Connection and analysis settings for {@link RedisAnalyzer}. */
export interface RedisAnalyzerOptions {
	/** Host name. Ignored when {@link uri} is set. Defaults to `localhost`. */
	host?: string;
	/** Port. Ignored when {@link uri} is set. Defaults to `6379`. */
	port?: number;
	/** Password, if the server requires one. */
	password?: string;
	/** Database index. Defaults to `0`. */
	db?: number;
	/** Connect over TLS, with the certificate verified. Defaults to `false`. */
	tls?: boolean;
	/** A full `redis://` or `rediss://` URI, taking precedence over the fields above. */
	uri?: string;
	/** Directory that {@link RedisAnalyzer.generateReport} writes into. Defaults to `./reports`. */
	outputDir?: string;
	/** Commands slower than this many microseconds are reported. */
	slowCommandThreshold?: number;
	/** Maximum slow-log entries to fetch. */
	maxSlowCommands?: number;
	/**
	 * Use this client instead of creating one. The caller keeps ownership: `close()` will
	 * not disconnect a client it did not create.
	 */
	client?: Redis;
}

/**
 * Programmatic entry point for the Redis analyzer.
 *
 * Importing this module has no side effects — unlike the CLI entry point, which connects and
 * runs an analysis on import. Always `close()` when finished, ideally in a `finally`.
 *
 * ```ts
 * import { RedisAnalyzer } from "@deniscuciuc/redis-analyzer";
 *
 * const analyzer = new RedisAnalyzer({ host: "localhost", port: 6379 });
 * try {
 *   const report = await analyzer.analyze();
 *   console.log(report.healthScore);
 * } finally {
 *   await analyzer.close();
 * }
 * ```
 */
export class RedisAnalyzer {
	private readonly connection: RedisConnection;
	private readonly analyzerOptions: AnalyzerOptions;
	private readonly ownsClient: boolean;
	private client: Redis | undefined;
	private connected = false;

	constructor(options: RedisAnalyzerOptions = {}) {
		this.connection = {
			host: options.host ?? DEFAULTS.host,
			port: options.port ?? DEFAULTS.port,
			password: options.password,
			db: options.db ?? DEFAULTS.db,
			tls: options.tls ?? false,
			uri: options.uri,
		};

		this.analyzerOptions = {
			outputDir: options.outputDir ?? DEFAULTS.output,
			slowCommandThreshold:
				options.slowCommandThreshold ?? DEFAULTS.slowCommandThreshold,
			maxSlowCommands: options.maxSlowCommands ?? DEFAULTS.maxSlowCommands,
		};

		this.client = options.client;
		this.ownsClient = options.client === undefined;
	}

	/**
	 * Connects to Redis. Called automatically by {@link analyze}; call it directly to
	 * surface a connection failure before doing any work.
	 */
	async connect(): Promise<void> {
		if (this.connected) {
			return;
		}

		if (!this.client) {
			this.client = this.connection.uri
				? new Redis(this.connection.uri, {
						lazyConnect: true,
						tls: this.connection.tls ? {} : undefined,
					})
				: new Redis({
						host: this.connection.host,
						port: this.connection.port,
						password: this.connection.password,
						db: this.connection.db,
						tls: this.connection.tls ? {} : undefined,
						lazyConnect: true,
					});

			// ioredis emits 'error' on every failed reconnect; with no listener Node treats
			// it as an unhandled error event and terminates the process.
			this.client.on("error", () => {});
		}

		try {
			if (this.client.status !== "ready") {
				await this.client.connect();
			}
			await this.client.ping();
			this.connected = true;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot connect to Redis: ${message}`);
		}
	}

	/** Runs a full analysis and returns the report. */
	async analyze(): Promise<FullRedisReport> {
		await this.connect();

		return buildFullReport(
			this.requireClient(),
			{
				...this.analyzerOptions,
				command: "full",
			} as never,
			this.connection,
		);
	}

	/**
	 * Writes a report to {@link RedisAnalyzerOptions.outputDir}.
	 *
	 * @param format Output format. Defaults to `markdown`.
	 * @param report A report from {@link analyze}; one is generated if omitted.
	 * @returns The path of the file written.
	 */
	async generateReport(
		format: "markdown" | "json" | "html" = "markdown",
		report?: FullRedisReport,
	): Promise<string> {
		const resolved = report ?? (await this.analyze());
		const generator = new ReportGenerator(
			this.analyzerOptions.outputDir,
			this.analyzerOptions,
		);

		switch (format) {
			case "json":
				return generator.generateJsonReport(resolved);
			case "html":
				return generator.generateHtmlReport(resolved);
			default:
				return generator.generateFullReport(resolved);
		}
	}

	/**
	 * Closes the connection. Does nothing when the client was supplied by the caller, who
	 * retains ownership of it.
	 */
	async close(): Promise<void> {
		this.connected = false;

		if (!this.client || !this.ownsClient) {
			return;
		}

		const client = this.client;
		this.client = undefined;

		try {
			await client.quit();
		} catch {
			client.disconnect();
		}
	}

	private requireClient(): Redis {
		if (!this.client) {
			throw new Error("Not connected. Call connect() first.");
		}
		return this.client;
	}
}
