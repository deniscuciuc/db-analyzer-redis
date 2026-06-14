import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { MemoryAnalyzer } from "../src/analyzers/memory-analyzer";
import { PerformanceAnalyzer } from "../src/analyzers/performance-analyzer";
import { PersistenceAnalyzer } from "../src/analyzers/persistence-analyzer";
import { ReplicationAnalyzer } from "../src/analyzers/replication-analyzer";
import { computeHealthScore } from "../src/health";
import { ReportGenerator } from "../src/reporters/report-generator";
import type { FullRedisReport, RedisInfo } from "../src/types";

function createInfo(): RedisInfo {
	return {
		redisVersion: "7.2.5",
		redisMode: "standalone",
		os: "Linux",
		uptimeInSeconds: 86400,
		uptimeInDays: 1,
		tcpPort: 6379,
		executablePath: "/usr/bin/redis-server",
		configFile: "/etc/redis/redis.conf",
		connectedClients: 12,
		blockedClients: 1,
		maxClients: 1000,
		clientRecentMaxInputBuffer: 2048,
		clientRecentMaxOutputBuffer: 4096,
		usedMemory: 50 * 1024 * 1024,
		usedMemoryHuman: "50.00M",
		usedMemoryRss: 75 * 1024 * 1024,
		usedMemoryRssHuman: "75.00M",
		usedMemoryPeak: 60 * 1024 * 1024,
		usedMemoryPeakHuman: "60.00M",
		usedMemoryPeakPerc: 83.33,
		usedMemoryOverhead: 10 * 1024 * 1024,
		usedMemoryDataset: 40 * 1024 * 1024,
		memFragmentationRatio: 1.75,
		memFragmentationBytes: 25 * 1024 * 1024,
		maxmemory: 64 * 1024 * 1024,
		maxmemoryHuman: "64.00M",
		maxmemoryPolicy: "allkeys-lru",
		totalCommandsProcessed: 1000,
		instantaneousOpsPerSec: 150,
		totalNetInputBytes: 1024,
		totalNetOutputBytes: 2048,
		rejectedConnections: 2,
		expiredKeys: 100,
		evictedKeys: 5,
		keyspaceHits: 900,
		keyspaceMisses: 100,
		role: "master",
		connectedSlaves: 0,
		rdbChangesSinceLastSave: 500,
		rdbBgsaveInProgress: false,
		rdbLastSaveTime: Math.floor(Date.now() / 1000) - 3600,
		rdbLastBgsaveStatus: "ok",
		rdbLastBgsaveTimeSec: 2,
		aofEnabled: true,
		aofRewriteInProgress: false,
		aofLastRewriteTimeSec: 4,
		aofLastBgrewriteStatus: "ok",
		aofCurrentSize: 20480,
		keyspaces: [
			{ db: 0, keys: 1234, expires: 234, avgTtl: 60000 },
			{ db: 1, keys: 100, expires: 10, avgTtl: 1000 },
		],
	};
}

test("analyzers produce actionable redis report data", () => {
	const info = createInfo();
	const memory = new MemoryAnalyzer().analyze(info);
	const performance = new PerformanceAnalyzer();
	const hitRate = performance.analyzeHitRate(info);
	const persistence = new PersistenceAnalyzer().analyze(info);
	const replication = new ReplicationAnalyzer().analyze(info);
	const slowCommands = performance.analyzeSlowCommands(
		[
			{
				id: 1,
				timestamp: 1718500000,
				durationMicros: 12000,
				durationMs: 12,
				command: ["KEYS", "*"],
				commandPreview: "KEYS *",
			},
		],
		1,
		10000,
	);

	assert.equal(memory.fragSeverity, "warning");
	assert.equal(Number(hitRate.hitRate.toFixed(1)), 90);
	assert.equal(persistence.severity, "ok");
	assert.equal(replication.role, "standalone");
	assert.equal(slowCommands.topCommandTypes[0].command, "KEYS");
});

test("computeHealthScore deducts for redis risks", () => {
	const info = createInfo();
	const memory = new MemoryAnalyzer().analyze(info);
	const performance = new PerformanceAnalyzer();
	const report = {
		generatedAt: new Date(),
		host: "localhost",
		port: 6379,
		db: 0,
		metrics: {
			version: info.redisVersion,
			mode: info.redisMode,
			uptimeDays: info.uptimeInDays,
			connectedClients: info.connectedClients,
			blockedClients: info.blockedClients,
			maxClients: info.maxClients,
			opsPerSec: info.instantaneousOpsPerSec,
			totalKeyCount: 1334,
			keyspacesCount: 2,
			rejectedConnections: info.rejectedConnections,
		},
		memory,
		hitRate: performance.analyzeHitRate(info),
		persistence: new PersistenceAnalyzer().analyze(info),
		replication: new ReplicationAnalyzer().analyze(info),
		slowCommands: performance.analyzeSlowCommands([], 0, 10000),
		keyspaces: info.keyspaces,
		config: {},
	};

	assert.ok(computeHealthScore(report) < 100);
});

test("ReportGenerator writes markdown, json, and html reports", async () => {
	const info = createInfo();
	const memory = new MemoryAnalyzer().analyze(info);
	const performance = new PerformanceAnalyzer();
	const report: FullRedisReport = {
		generatedAt: new Date(),
		host: "localhost",
		port: 6379,
		db: 0,
		healthScore: 87,
		metrics: {
			version: info.redisVersion,
			mode: info.redisMode,
			uptimeDays: info.uptimeInDays,
			connectedClients: info.connectedClients,
			blockedClients: info.blockedClients,
			maxClients: info.maxClients,
			opsPerSec: info.instantaneousOpsPerSec,
			totalKeyCount: 1334,
			keyspacesCount: 2,
			rejectedConnections: info.rejectedConnections,
		},
		memory,
		hitRate: performance.analyzeHitRate(info),
		persistence: new PersistenceAnalyzer().analyze(info),
		replication: new ReplicationAnalyzer().analyze(info),
		slowCommands: performance.analyzeSlowCommands([], 0, 10000),
		keyspaces: info.keyspaces,
		config: { maxmemory: "67108864" },
		recommendations: [
			{
				priority: "medium",
				category: "memory",
				message: "Monitor fragmentation.",
			},
		],
	};

	const outputDir = mkdtempSync(join(tmpdir(), "redis-analyzer-"));
	const generator = new ReportGenerator(outputDir);

	const markdown = await generator.generateFullReport(
		report,
		"2026-06-14T00-00-00-000Z",
	);
	const json = await generator.generateJsonReport(
		report,
		"2026-06-14T00-00-00-000Z",
	);
	const html = await generator.generateHtmlReport(
		report,
		"2026-06-14T00-00-00-000Z",
	);

	assert.ok(markdown.endsWith(".md"));
	assert.ok(json.endsWith(".json"));
	assert.ok(html.endsWith(".html"));
});
