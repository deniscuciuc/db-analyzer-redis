import Redis from "ioredis";
import { parseOptions } from "./src/cli/options";
import { executeCommand } from "./src/cli/runner";
import { loadConfig, resolveProfile } from "./src/config/loader";
import { DEFAULTS } from "./src/constants";
import { InteractiveCLI } from "./src/interactive";
import type { RedisConnection } from "./src/types";
import { runWatchLoop } from "./src/watch/runner";

function resolveValue<T>(
	cliValue: T | undefined,
	envValue: T | undefined,
	profileValue: T | undefined,
	fallbackValue: T,
	preferProfile: boolean,
): T {
	if (cliValue !== undefined && cliValue !== fallbackValue) {
		return cliValue;
	}

	if (preferProfile) {
		return profileValue ?? envValue ?? cliValue ?? fallbackValue;
	}

	return envValue ?? profileValue ?? cliValue ?? fallbackValue;
}

function resolveOptionalValue<T>(
	cliValue: T | undefined,
	envValue: T | undefined,
	profileValue: T | undefined,
	preferProfile: boolean,
): T | undefined {
	if (cliValue !== undefined) {
		return cliValue;
	}

	if (preferProfile) {
		return profileValue ?? envValue;
	}

	return envValue ?? profileValue;
}

function parseNumber(value: string | undefined): number | undefined {
	if (!value) {
		return undefined;
	}

	const parsed = Number.parseInt(value, 10);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function parseBoolean(value: string | undefined): boolean | undefined {
	if (!value) {
		return undefined;
	}

	return value === "true" || value === "1";
}

function resolveConnectionDetails(
	connection: RedisConnection,
): RedisConnection {
	if (!connection.uri) {
		return connection;
	}

	try {
		const parsed = new URL(connection.uri);
		return {
			...connection,
			host: parsed.hostname || connection.host,
			port: parsed.port ? Number.parseInt(parsed.port, 10) : connection.port,
			db: parsed.pathname
				? Number.parseInt(parsed.pathname.replace("/", ""), 10) || connection.db
				: connection.db,
		};
	} catch {
		return connection;
	}
}

async function closeClient(client: Redis): Promise<void> {
	try {
		await client.quit();
	} catch {
		client.disconnect();
	}
}

async function main(): Promise<void> {
	const options = parseOptions();
	const config = loadConfig(options.config);
	const profile = resolveProfile(config, options.profile);
	const preferProfile = Boolean(options.profile);

	if (options.watch !== undefined && options.json) {
		throw new Error("--watch cannot be combined with --json.");
	}

	const connection = resolveConnectionDetails({
		host: resolveValue(
			options.host,
			process.env.REDIS_HOST,
			profile.host,
			DEFAULTS.host,
			preferProfile,
		),
		port: resolveValue(
			options.port,
			parseNumber(process.env.REDIS_PORT),
			profile.port,
			DEFAULTS.port,
			preferProfile,
		),
		password: resolveOptionalValue(
			options.password,
			process.env.REDIS_PASSWORD,
			profile.password,
			preferProfile,
		),
		db: resolveValue(
			options.db,
			parseNumber(process.env.REDIS_DB),
			profile.db,
			DEFAULTS.db,
			preferProfile,
		),
		tls: resolveValue(
			options.tls,
			parseBoolean(process.env.REDIS_TLS),
			profile.tls,
			false,
			preferProfile,
		),
		uri: resolveOptionalValue(
			options.uri,
			process.env.REDIS_URI,
			profile.uri,
			preferProfile,
		),
	});

	const runtimeOptions = {
		...options,
		outputDir: resolveValue(
			options.outputDir,
			undefined,
			config.output,
			DEFAULTS.output,
			false,
		),
		slowCommandThreshold: resolveValue(
			options.slowCommandThreshold,
			undefined,
			config.slowCommandThreshold,
			DEFAULTS.slowCommandThreshold,
			false,
		),
		maxSlowCommands: resolveValue(
			options.maxSlowCommands,
			undefined,
			config.maxSlowCommands,
			DEFAULTS.maxSlowCommands,
			false,
		),
	};

	const client = connection.uri
		? new Redis(connection.uri, {
				lazyConnect: true,
				tls: connection.tls ? {} : undefined,
			})
		: new Redis({
				host: connection.host,
				port: connection.port,
				password: connection.password,
				db: connection.db,
				tls: connection.tls ? {} : undefined,
				lazyConnect: true,
			});

	// ioredis emits 'error' on every failed reconnect attempt. With no listener
	// Node treats it as an unhandled error event and kills the process, which is
	// near-certain in watch mode.
	client.on("error", (error: Error) => {
		console.warn(`Redis connection error: ${error.message}`);
	});

	try {
		try {
			await client.connect();
			await client.ping();
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(`Cannot connect to Redis: ${message}`);
		}

		if (runtimeOptions.interactive) {
			const interactive = new InteractiveCLI(
				client,
				connection,
				runtimeOptions,
			);
			await interactive.start();
			return;
		}

		if (runtimeOptions.watch !== undefined) {
			await runWatchLoop({
				intervalSeconds: runtimeOptions.watch,
				command: runtimeOptions.command,
				runCommand: () => executeCommand(client, runtimeOptions, connection),
			});
			return;
		}

		await executeCommand(client, runtimeOptions, connection);
	} finally {
		await closeClient(client);
	}
}

main().catch((error) => {
	const message = error instanceof Error ? error.message : String(error);
	console.error("Error during analysis:", message);
	// Set exitCode rather than calling process.exit, which can truncate buffered
	// stdout — e.g. a large --json report being piped to a file.
	process.exitCode = 1;
});
