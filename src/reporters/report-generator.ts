import * as fs from "node:fs";
import * as path from "node:path";
import type {
	AnalyzerOptions,
	FullRedisReport,
	KeyspaceInfo,
	Recommendation,
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
	printSeparator,
} from "../utils/print";
import { HtmlReporter } from "./html-reporter";

export class ReportGenerator {
	constructor(
		private readonly outputDir: string = "./reports",
		_options: AnalyzerOptions = {},
	) {
		void _options;
	}

	async generateFullReport(
		report: FullRedisReport,
		timestamp?: string,
	): Promise<string> {
		const ts = timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
		const filepath = path.join(this.outputDir, `redis-analysis-${ts}.md`);
		await this.ensureOutputDir();
		fs.writeFileSync(filepath, this.buildMarkdownReport(report));
		return filepath;
	}

	async generateJsonReport(
		report: FullRedisReport,
		timestamp?: string,
	): Promise<string> {
		const ts = timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
		const filepath = path.join(this.outputDir, `redis-analysis-${ts}.json`);
		await this.ensureOutputDir();
		fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
		return filepath;
	}

	async generateHtmlReport(
		report: FullRedisReport,
		timestamp?: string,
	): Promise<string> {
		const ts = timestamp ?? new Date().toISOString().replace(/[:.]/g, "-");
		const filepath = path.join(this.outputDir, `redis-analysis-${ts}.html`);
		await this.ensureOutputDir();
		fs.writeFileSync(filepath, HtmlReporter.generate(report));
		return filepath;
	}

	printSummary(report: FullRedisReport): void {
		printRow(
			"Health score",
			`${report.healthScore}/100 ${healthEmoji(report.healthScore)} ${healthLabel(report.healthScore)}`,
		);
		printRow("Redis version", report.metrics.version);
		printRow("Mode", report.metrics.mode);
		printRow("Used memory", report.memory.usedMemoryHuman);
		printRow("Hit rate", formatPercent(report.hitRate.hitRate));
		printRow("Slow log length", report.slowCommands.totalLogged);
		printSeparator();

		for (const recommendation of report.recommendations.slice(0, 5)) {
			printBullet(`[${recommendation.priority}] ${recommendation.message}`);
		}
	}

	private async ensureOutputDir(): Promise<void> {
		if (!fs.existsSync(this.outputDir)) {
			fs.mkdirSync(this.outputDir, { recursive: true });
		}
	}

	private buildMarkdownReport(report: FullRedisReport): string {
		return [
			this.buildHeader(report),
			this.buildExecutiveSummary(report),
			this.buildMetricsSection(report),
			this.buildMemorySection(report),
			this.buildHitRateSection(report),
			this.buildPersistenceSection(report),
			this.buildReplicationSection(report),
			this.buildSlowCommandsSection(report),
			this.buildKeyspacesSection(report.keyspaces),
			this.buildConfigSection(report.config),
			this.buildRecommendationsSection(report.recommendations),
		].join("\n\n");
	}

	private buildHeader(report: FullRedisReport): string {
		return `# Redis Analysis Report

**Target:** ${report.host}:${report.port}/${report.db}
**Generated:** ${report.generatedAt.toISOString()}
**Tool:** Redis Analyzer

---`;
	}

	private buildExecutiveSummary(report: FullRedisReport): string {
		const issues = report.recommendations
			.slice(0, 5)
			.map((item) => `- **${item.priority}** ${item.message}`);
		return `## Executive Summary

### Health Score: ${report.healthScore}/100 ${healthEmoji(report.healthScore)}

### Key Findings
${issues.length > 0 ? issues.join("\n") : "- No critical issues found"}

### Quick Stats
| Metric | Value |
|--------|-------|
| Redis Version | ${report.metrics.version} |
| Used Memory | ${report.memory.usedMemoryHuman} |
| Hit Rate | ${formatPercent(report.hitRate.hitRate)} |
| Ops / sec | ${formatNumber(report.metrics.opsPerSec)} |
| Total Keys | ${formatNumber(report.metrics.totalKeyCount)} |`;
	}

	private buildMetricsSection(report: FullRedisReport): string {
		return `## Core Metrics

| Metric | Value |
|--------|-------|
| Mode | ${report.metrics.mode} |
| Uptime | ${report.metrics.uptimeDays} days |
| Connected Clients | ${report.metrics.connectedClients} |
| Blocked Clients | ${report.metrics.blockedClients} |
| Max Clients | ${report.metrics.maxClients} |
| Ops / sec | ${formatNumber(report.metrics.opsPerSec)} |
| Total Keys | ${formatNumber(report.metrics.totalKeyCount)} |
| Keyspaces | ${report.metrics.keyspacesCount} |
| Rejected Connections | ${formatNumber(report.metrics.rejectedConnections)} |`;
	}

	private buildMemorySection(report: FullRedisReport): string {
		return `## Memory

| Metric | Value |
|--------|-------|
| Used Memory | ${report.memory.usedMemoryHuman} |
| Max Memory | ${report.memory.maxMemoryHuman || "unlimited"} |
| Usage Percent | ${formatPercent(report.memory.usagePercent)} |
| Fragmentation Ratio | ${report.memory.fragRatio.toFixed(2)} |
| Fragmentation Waste | ${formatBytes(report.memory.fragBytes)} |
| RSS Overhead | ${formatBytes(report.memory.rssOverhead)} |
| Peak Memory | ${formatBytes(report.memory.peakMemory)} |
| Dataset Memory | ${formatBytes(report.memory.dataMemory)} |
| Overhead Memory | ${formatBytes(report.memory.overheadMemory)} |`;
	}

	private buildHitRateSection(report: FullRedisReport): string {
		return `## Cache Hit Rate

| Metric | Value |
|--------|-------|
| Hits | ${formatNumber(report.hitRate.hits)} |
| Misses | ${formatNumber(report.hitRate.misses)} |
| Hit Rate | ${formatPercent(report.hitRate.hitRate)} |
| Evicted Keys | ${formatNumber(report.hitRate.evictedKeys)} |
| Expired Keys | ${formatNumber(report.hitRate.expiredKeys)} |
| Eviction Policy | ${report.hitRate.evictionPolicy} |`;
	}

	private buildPersistenceSection(report: FullRedisReport): string {
		return `## Persistence

| Metric | Value |
|--------|-------|
| RDB Enabled | ${report.persistence.rdb.enabled ? "yes" : "no"} |
| Seconds Since Last Save | ${formatNumber(report.persistence.rdb.secondsSinceLastSave)} |
| RDB Status | ${report.persistence.rdb.lastStatus} |
| RDB Changes Since Save | ${formatNumber(report.persistence.rdb.changesSinceLastSave)} |
| AOF Enabled | ${report.persistence.aof.enabled ? "yes" : "no"} |
| AOF Status | ${report.persistence.aof.lastStatus} |
| AOF Rewrite In Progress | ${report.persistence.aof.rewriteInProgress ? "yes" : "no"} |`;
	}

	private buildReplicationSection(report: FullRedisReport): string {
		return `## Replication

| Metric | Value |
|--------|-------|
| Role | ${report.replication.role} |
| Connected Replicas | ${report.replication.connectedSlaves} |
| Link Status | ${report.replication.linkStatus ?? "n/a"} |
| Lag Seconds | ${report.replication.lagSeconds ?? "n/a"} |
| Sync In Progress | ${report.replication.syncInProgress ? "yes" : "no"} |`;
	}

	private buildSlowCommandsSection(report: FullRedisReport): string {
		const topCommands = report.slowCommands.topCommandTypes
			.map(
				(command) =>
					`| ${command.command} | ${formatNumber(command.count)} | ${formatDuration(command.avgMs)} |`,
			)
			.join("\n");
		return `## Slow Commands

| Metric | Value |
|--------|-------|
| Logged Slow Commands | ${formatNumber(report.slowCommands.totalLogged)} |
| Threshold | ${formatDuration(report.slowCommands.threshold / 1000)} |

### Top Slow Command Types
| Command | Count | Avg Duration |
|---------|-------|--------------|
${topCommands || "| none | 0 | 0ms |"}`;
	}

	private buildKeyspacesSection(keyspaces: KeyspaceInfo[]): string {
		const rows = keyspaces
			.map(
				(keyspace) =>
					`| db${keyspace.db} | ${formatNumber(keyspace.keys)} | ${formatNumber(keyspace.expires)} | ${formatDuration(keyspace.avgTtl)} |`,
			)
			.join("\n");
		return `## Keyspaces

| DB | Keys | Expiring Keys | Avg TTL |
|----|------|---------------|---------|
${rows || "| none | 0 | 0 | 0ms |"}`;
	}

	private buildConfigSection(config: Record<string, string>): string {
		const rows = Object.entries(config)
			.map(([key, value]) => `| ${key} | ${value} |`)
			.join("\n");
		return `## Important Configuration

| Setting | Value |
|---------|-------|
${rows || "| none | n/a |"}`;
	}

	private buildRecommendationsSection(
		recommendations: Recommendation[],
	): string {
		const items = recommendations.map(
			(item) => `- **${item.priority}** \`${item.category}\` — ${item.message}`,
		);
		return `## Recommendations

${items.length > 0 ? items.join("\n") : "- No recommendations"}`;
	}
}
