import { existsSync, readFileSync } from "node:fs";
import type { Redis } from "ioredis";
import { MemoryAnalyzer } from "../analyzers/memory-analyzer";
import { PerformanceAnalyzer } from "../analyzers/performance-analyzer";
import { PersistenceAnalyzer } from "../analyzers/persistence-analyzer";
import { ReplicationAnalyzer } from "../analyzers/replication-analyzer";
import { StatsCollector } from "../collectors/stats-collector";
import { IMPORTANT_CONFIG_KEYS } from "../constants";
import { buildRecommendations, computeHealthScore } from "../health";
import { DiffReporter } from "../reporters/diff-reporter";
import { ReportGenerator } from "../reporters/report-generator";
import type {
	FullRedisReport,
	FullReport,
	RedisConnection,
	RedisInfo,
	RedisMetrics,
} from "../types";
import type { ParsedOptions } from "./options";
import { toAnalyzerOptions } from "./options";

interface AnalyzerServices {
	client: Redis;
	collector: StatsCollector;
	memory: MemoryAnalyzer;
	performance: PerformanceAnalyzer;
	persistence: PersistenceAnalyzer;
	replication: ReplicationAnalyzer;
	reporter: ReportGenerator;
}

function createServices(
	client: Redis,
	options: ParsedOptions,
): AnalyzerServices {
	const analyzerOptions = toAnalyzerOptions(options);
	return {
		client,
		collector: new StatsCollector(client),
		memory: new MemoryAnalyzer(),
		performance: new PerformanceAnalyzer(),
		persistence: new PersistenceAnalyzer(),
		replication: new ReplicationAnalyzer(),
		reporter: new ReportGenerator(options.outputDir, analyzerOptions),
	};
}

function buildMetrics(info: RedisInfo): RedisMetrics {
	return {
		version: info.redisVersion,
		mode: info.redisMode,
		uptimeDays: info.uptimeInDays,
		connectedClients: info.connectedClients,
		blockedClients: info.blockedClients,
		maxClients: info.maxClients,
		opsPerSec: info.instantaneousOpsPerSec,
		totalKeyCount: info.keyspaces.reduce(
			(sum, keyspace) => sum + keyspace.keys,
			0,
		),
		keyspacesCount: info.keyspaces.length,
		rejectedConnections: info.rejectedConnections,
	};
}

export function summarizeKeyspaces(info: RedisInfo): {
	totalKeys: number;
	totalExpiringKeys: number;
	expiringRatio: number;
	keyspaces: RedisInfo["keyspaces"];
} {
	const totalKeys = info.keyspaces.reduce(
		(sum, keyspace) => sum + keyspace.keys,
		0,
	);
	const totalExpiringKeys = info.keyspaces.reduce(
		(sum, keyspace) => sum + keyspace.expires,
		0,
	);
	return {
		totalKeys,
		totalExpiringKeys,
		expiringRatio: totalKeys === 0 ? 0 : (totalExpiringKeys / totalKeys) * 100,
		keyspaces: info.keyspaces,
	};
}

export async function buildFullReport(
	client: Redis,
	options: ParsedOptions,
	connection: RedisConnection,
): Promise<FullRedisReport> {
	const services = createServices(client, options);
	const [info, totalSlowLogged, config] = await Promise.all([
		services.collector.getInfo(),
		services.collector.getSlowLogLength(),
		services.collector.getConfigValues(IMPORTANT_CONFIG_KEYS),
	]);
	const slowCommands = await services.collector.getSlowLog(
		options.maxSlowCommands,
	);

	const memory = services.memory.analyze(info);
	const hitRate = services.performance.analyzeHitRate(info);
	const persistence = services.persistence.analyze(info);
	const replication = services.replication.analyze(info);
	const slowCommandAnalysis = services.performance.analyzeSlowCommands(
		slowCommands,
		totalSlowLogged,
		options.slowCommandThreshold,
	);
	const metrics = buildMetrics(info);

	const reportBase = {
		generatedAt: new Date(),
		host: connection.host,
		port: connection.port,
		db: connection.db,
		metrics,
		memory,
		hitRate,
		persistence,
		replication,
		slowCommands: slowCommandAnalysis,
		keyspaces: info.keyspaces,
		config,
	};

	const recommendations = buildRecommendations({
		memory,
		hitRate,
		persistence,
		replication,
		metrics,
	});
	const healthScore = computeHealthScore(reportBase);

	return {
		...reportBase,
		healthScore,
		recommendations,
	};
}

export async function executeCommand(
	client: Redis,
	options: ParsedOptions,
	connection: RedisConnection,
): Promise<void> {
	const log = options.quiet || options.json ? () => {} : console.log;
	const services = createServices(client, options);

	if (options.command !== "full") {
		const result = await runCommand(services, options, connection);
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	const report = await buildFullReport(client, options, connection);

	if (options.compare) {
		const previous = loadPreviousReport(options.compare);
		DiffReporter.print(
			DiffReporter.diff(report, previous),
			options.json ? console.error : console.log,
		);
	}

	if (options.json) {
		console.log(
			JSON.stringify(
				{
					success: true,
					report,
					summary: {
						healthScore: report.healthScore,
						usedMemory: report.memory.usedMemoryHuman,
						memoryUsagePercent: Number(report.memory.usagePercent.toFixed(2)),
						hitRate: Number(report.hitRate.hitRate.toFixed(2)),
						totalKeys: report.metrics.totalKeyCount,
						slowCommandsLogged: report.slowCommands.totalLogged,
						rejectedConnections: report.metrics.rejectedConnections,
					},
					recommendations: report.recommendations,
				},
				null,
				2,
			),
		);
		return;
	}

	services.reporter.printSummary(report);

	log("\nGenerating reports...");
	const [markdown, json, html] = await Promise.all([
		services.reporter.generateFullReport(report),
		services.reporter.generateJsonReport(report),
		options.html ? services.reporter.generateHtmlReport(report) : undefined,
	]);

	log("\nReports generated:");
	log(`  - Markdown: ${markdown}`);
	log(`  - JSON: ${json}`);
	if (html) {
		log(`  - HTML: ${html}`);
	}
}

async function runCommand(
	services: AnalyzerServices,
	options: ParsedOptions,
	connection: RedisConnection,
): Promise<unknown> {
	switch (options.command) {
		case "health": {
			const report = await buildFullReport(
				services.client,
				options,
				connection,
			);
			return {
				healthScore: report.healthScore,
				metrics: report.metrics,
				issues: report.recommendations.map(
					(recommendation) => recommendation.message,
				),
			};
		}
		case "server-info": {
			const info = await services.collector.getInfo();
			return {
				version: info.redisVersion,
				mode: info.redisMode,
				os: info.os,
				uptimeDays: info.uptimeInDays,
				tcpPort: info.tcpPort,
				configFile: info.configFile,
			};
		}
		case "memory": {
			const info = await services.collector.getInfo();
			return services.memory.analyze(info);
		}
		case "hit-rate": {
			const info = await services.collector.getInfo();
			return services.performance.analyzeHitRate(info);
		}
		case "slow-commands": {
			const [commands, totalLogged] = await Promise.all([
				services.collector.getSlowLog(options.maxSlowCommands),
				services.collector.getSlowLogLength(),
			]);
			return services.performance.analyzeSlowCommands(
				commands,
				totalLogged,
				options.slowCommandThreshold,
			);
		}
		case "keys": {
			const info = await services.collector.getInfo();
			return summarizeKeyspaces(info);
		}
		case "connections": {
			const info = await services.collector.getInfo();
			return {
				connectedClients: info.connectedClients,
				blockedClients: info.blockedClients,
				maxClients: info.maxClients,
				clientUtilization:
					info.maxClients === 0
						? 0
						: Number(
								((info.connectedClients / info.maxClients) * 100).toFixed(2),
							),
				rejectedConnections: info.rejectedConnections,
				recentMaxInputBufferBytes: info.clientRecentMaxInputBuffer,
				recentMaxOutputBufferBytes: info.clientRecentMaxOutputBuffer,
			};
		}
		case "persistence": {
			const info = await services.collector.getInfo();
			return services.persistence.analyze(info);
		}
		case "replication": {
			const info = await services.collector.getInfo();
			return services.replication.analyze(info);
		}
		case "config":
			return services.collector.getConfigValues(IMPORTANT_CONFIG_KEYS);
		default:
			throw new Error(`Unsupported command: ${options.command}`);
	}
}

export function loadPreviousReport(reportPath: string): FullReport {
	if (!existsSync(reportPath)) {
		throw new Error(`Previous report not found: ${reportPath}`);
	}

	const parsed = JSON.parse(readFileSync(reportPath, "utf-8")) as
		| FullReport
		| { report: FullReport };
	return "report" in parsed ? parsed.report : parsed;
}
