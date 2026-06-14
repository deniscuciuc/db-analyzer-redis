import { SCORE_DEDUCTIONS, THRESHOLDS } from "./constants";
import type {
	FullRedisReport,
	HitRateAnalysis,
	MemoryAnalysis,
	PersistenceAnalysis,
	Recommendation,
	RedisMetrics,
	ReplicationAnalysis,
} from "./types";

const PRIORITY_ORDER = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
} as const;

export function computeHealthScore(
	report: Omit<FullRedisReport, "healthScore" | "recommendations">,
): number {
	let score = 100;
	const { memory, hitRate, persistence, replication } = report;

	if (memory.maxMemory > 0) {
		if (memory.usagePercent >= THRESHOLDS.memory.usageCritical) {
			score -= SCORE_DEDUCTIONS.memoryUsageCritical;
		} else if (memory.usagePercent >= THRESHOLDS.memory.usageWarning) {
			score -= SCORE_DEDUCTIONS.memoryUsageWarning;
		}
	}

	if (memory.fragSeverity === "critical") {
		score -= SCORE_DEDUCTIONS.highFragmentation;
	}

	if (hitRate.hitRate < THRESHOLDS.hitRate.critical) {
		score -= SCORE_DEDUCTIONS.lowHitRate + SCORE_DEDUCTIONS.veryLowHitRate;
	} else if (hitRate.hitRate < THRESHOLDS.hitRate.warning) {
		score -= SCORE_DEDUCTIONS.lowHitRate;
	}

	if (hitRate.evictedKeys > 1000) {
		score -= SCORE_DEDUCTIONS.highEviction;
	}

	if (persistence.rdb.lastStatus === "err") {
		score -= SCORE_DEDUCTIONS.rdbFailed;
	}
	if (persistence.aof.enabled && persistence.aof.lastStatus === "err") {
		score -= SCORE_DEDUCTIONS.aofFailed;
	}
	if (persistence.severity === "warning") {
		score -= SCORE_DEDUCTIONS.stalePersistence;
	}

	if (replication.linkStatus === "down") {
		score -= SCORE_DEDUCTIONS.linkDown;
	} else if (replication.severity === "warning") {
		score -= SCORE_DEDUCTIONS.highReplicationLag;
	}

	if (report.metrics.rejectedConnections > 0) {
		score -= SCORE_DEDUCTIONS.rejectedConnections;
	}

	return Math.max(0, score);
}

export function buildRecommendations(input: {
	memory: MemoryAnalysis;
	hitRate: HitRateAnalysis;
	persistence: PersistenceAnalysis;
	replication: ReplicationAnalysis;
	metrics: RedisMetrics;
}): Recommendation[] {
	const recommendations: Recommendation[] = [];

	recommendations.push(
		...toRecommendations(
			"memory",
			input.memory.fragSeverity === "critical"
				? "critical"
				: input.memory.fragSeverity === "warning" ||
						input.memory.usagePercent >= THRESHOLDS.memory.usageWarning
					? "high"
					: "low",
			input.memory.recommendations,
		),
	);
	recommendations.push(
		...toRecommendations(
			"hit-rate",
			input.hitRate.hitRate < THRESHOLDS.hitRate.critical
				? "critical"
				: input.hitRate.hitRate < THRESHOLDS.hitRate.warning ||
						input.hitRate.evictedKeys > 0
					? "high"
					: "low",
			input.hitRate.recommendations,
		),
	);
	recommendations.push(
		...toRecommendations(
			"persistence",
			mapSeverity(input.persistence.severity),
			input.persistence.recommendations,
		),
	);
	recommendations.push(
		...toRecommendations(
			"replication",
			mapSeverity(input.replication.severity),
			input.replication.recommendations,
		),
	);

	if (input.metrics.rejectedConnections > 0) {
		recommendations.push({
			priority: "high",
			category: "connections",
			message: `${input.metrics.rejectedConnections.toLocaleString()} rejected connections detected.`,
			action:
				"Raise maxclients, inspect client churn, or add connection pooling.",
		});
	}

	if (input.metrics.blockedClients > 0) {
		recommendations.push({
			priority: "medium",
			category: "connections",
			message: `${input.metrics.blockedClients.toLocaleString()} blocked clients detected.`,
			action: "Inspect blocking Lua scripts, transactions, or slow commands.",
		});
	}

	return recommendations.sort(
		(left, right) =>
			PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority],
	);
}

function toRecommendations(
	category: string,
	priority: Recommendation["priority"],
	items: string[],
): Recommendation[] {
	return items.map((message) => ({ priority, category, message }));
}

function mapSeverity(
	severity: "ok" | "warning" | "critical",
): Recommendation["priority"] {
	if (severity === "critical") {
		return "critical";
	}
	if (severity === "warning") {
		return "high";
	}
	return "low";
}
