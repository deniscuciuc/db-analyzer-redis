import type {
	FullRedisReport,
	HitRateAnalysis,
	KeyspaceInfo,
	MemoryAnalysis,
	PersistenceAnalysis,
	RedisInfo,
	ReplicationAnalysis,
	SlowCommandAnalysis,
} from "../types";
import {
	formatBytes,
	formatDuration,
	formatNumber,
	formatPercent,
} from "../utils/format";
import {
	healthEmoji,
	healthLabel,
	printBullet,
	printRow,
	printSection,
	printSeparator,
	printSubBullet,
} from "../utils/print";

export function showFullReport(report: FullRedisReport): void {
	showHealth(report);
	printSeparator();
	showMemory(report.memory);
	printSeparator();
	showHitRate(report.hitRate);
	printSeparator();
	showPersistence(report.persistence);
	printSeparator();
	showReplication(report.replication);
	printSeparator();
	showSlowCommands(report.slowCommands);
}

export function showHealth(report: FullRedisReport): void {
	printSection("Health");
	printRow(
		"Health score",
		`${report.healthScore}/100 ${healthEmoji(report.healthScore)} ${healthLabel(report.healthScore)}`,
	);
	printRow("Redis version", report.metrics.version);
	printRow("Mode", report.metrics.mode);
	printRow("Used memory", report.memory.usedMemoryHuman);
	printRow("Hit rate", formatPercent(report.hitRate.hitRate));
	printRow("Ops / sec", formatNumber(report.metrics.opsPerSec));
}

export function showServerInfo(info: RedisInfo): void {
	printSection("Server Info");
	printRow("Version", info.redisVersion);
	printRow("Mode", info.redisMode);
	printRow("OS", info.os);
	printRow("Uptime", `${info.uptimeInDays} days`);
	printRow("Port", info.tcpPort);
	printRow("Config file", info.configFile || "n/a");
}

export function showMemory(analysis: MemoryAnalysis): void {
	printSection("Memory");
	printRow("Used", analysis.usedMemoryHuman);
	printRow("Max", analysis.maxMemoryHuman || "unlimited");
	printRow("Usage", formatPercent(analysis.usagePercent));
	printRow("Fragmentation", analysis.fragRatio.toFixed(2));
	printRow("Fragmentation waste", formatBytes(analysis.fragBytes));
	printRow("RSS overhead", formatBytes(analysis.rssOverhead));
	for (const recommendation of analysis.recommendations) {
		printBullet(recommendation);
	}
}

export function showHitRate(analysis: HitRateAnalysis): void {
	printSection("Hit Rate");
	printRow("Hits", formatNumber(analysis.hits));
	printRow("Misses", formatNumber(analysis.misses));
	printRow("Hit rate", formatPercent(analysis.hitRate));
	printRow("Evicted keys", formatNumber(analysis.evictedKeys));
	printRow("Expired keys", formatNumber(analysis.expiredKeys));
	printRow("Policy", analysis.evictionPolicy);
	for (const recommendation of analysis.recommendations) {
		printBullet(recommendation);
	}
}

export function showSlowCommands(analysis: SlowCommandAnalysis): void {
	printSection("Slow Commands");
	printRow("Logged entries", formatNumber(analysis.totalLogged));
	printRow("Threshold", formatDuration(analysis.threshold / 1000));
	for (const command of analysis.topCommandTypes) {
		printBullet(`${command.command} — ${formatNumber(command.count)} entries`);
		printSubBullet(`Average duration: ${formatDuration(command.avgMs)}`);
	}
	for (const recommendation of analysis.recommendations) {
		printBullet(recommendation);
	}
}

export function showKeyspaces(keyspaces: KeyspaceInfo[]): void {
	printSection("Keyspaces");
	if (keyspaces.length === 0) {
		console.log("  No keys found.");
		return;
	}

	for (const keyspace of keyspaces) {
		printBullet(`db${keyspace.db} — ${formatNumber(keyspace.keys)} keys`);
		printSubBullet(
			`Expiring: ${formatNumber(keyspace.expires)} | Avg TTL: ${formatDuration(keyspace.avgTtl)}`,
		);
	}
}

export function showConnections(info: RedisInfo): void {
	printSection("Connections");
	printRow("Connected clients", formatNumber(info.connectedClients));
	printRow("Blocked clients", formatNumber(info.blockedClients));
	printRow("Max clients", formatNumber(info.maxClients));
	printRow("Rejected connections", formatNumber(info.rejectedConnections));
	printRow("Max input buffer", formatBytes(info.clientRecentMaxInputBuffer));
	printRow("Max output buffer", formatBytes(info.clientRecentMaxOutputBuffer));
}

export function showPersistence(analysis: PersistenceAnalysis): void {
	printSection("Persistence");
	printRow("RDB enabled", analysis.rdb.enabled ? "yes" : "no");
	printRow("RDB last status", analysis.rdb.lastStatus);
	printRow(
		"Seconds since save",
		formatNumber(analysis.rdb.secondsSinceLastSave),
	);
	printRow("AOF enabled", analysis.aof.enabled ? "yes" : "no");
	printRow("AOF last status", analysis.aof.lastStatus);
	for (const recommendation of analysis.recommendations) {
		printBullet(recommendation);
	}
}

export function showReplication(analysis: ReplicationAnalysis): void {
	printSection("Replication");
	printRow("Role", analysis.role);
	printRow("Connected replicas", formatNumber(analysis.connectedSlaves));
	printRow("Link status", analysis.linkStatus ?? "n/a");
	printRow("Lag seconds", analysis.lagSeconds ?? "n/a");
	printRow("Sync in progress", analysis.syncInProgress ? "yes" : "no");
	for (const recommendation of analysis.recommendations) {
		printBullet(recommendation);
	}
}

export function showConfig(config: Record<string, string>): void {
	printSection("Configuration");
	for (const [key, value] of Object.entries(config)) {
		printRow(key, value);
	}
}
