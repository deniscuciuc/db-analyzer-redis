/**
 * Library entry point for `@deniscuciuc/redis-analyzer`.
 *
 * Importing this module has no side effects. The CLI lives in `src/cli/main.ts` and is
 * reached through the `redis-analyzer` binary — importing the package used to run an
 * analysis as a side effect of `require()`, because the CLI was the package entry point.
 */

export { MemoryAnalyzer } from "./analyzers/memory-analyzer";
export { PerformanceAnalyzer } from "./analyzers/performance-analyzer";
export { PersistenceAnalyzer } from "./analyzers/persistence-analyzer";
export { ReplicationAnalyzer } from "./analyzers/replication-analyzer";
export type { RedisAnalyzerOptions } from "./api";
export { RedisAnalyzer } from "./api";
export {
	parseRedisInfo,
	parseSlowLogEntries,
	StatsCollector,
} from "./collectors/stats-collector";
export type { Command } from "./constants";
export { COMMANDS, DEFAULTS, THRESHOLDS } from "./constants";
export { buildRecommendations, computeHealthScore } from "./health";
export { DiffReporter } from "./reporters/diff-reporter";
export { HtmlReporter } from "./reporters/html-reporter";
export { ReportGenerator } from "./reporters/report-generator";

export type {
	AnalyzerOptions,
	FullRedisReport,
	FullReport,
	HitRateAnalysis,
	KeyspaceInfo,
	MemoryAnalysis,
	PersistenceAnalysis,
	Recommendation,
	RedisConnection,
	RedisInfo,
	RedisMetrics,
	ReplicationAnalysis,
	SlowCommand,
	SlowCommandAnalysis,
	SlowCommandSummary,
} from "./types";
