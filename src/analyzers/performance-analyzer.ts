import { THRESHOLDS } from "../constants";
import type {
	HitRateAnalysis,
	RedisInfo,
	SlowCommand,
	SlowCommandAnalysis,
	SlowCommandSummary,
} from "../types";

export class PerformanceAnalyzer {
	analyzeHitRate(info: RedisInfo): HitRateAnalysis {
		const total = info.keyspaceHits + info.keyspaceMisses;
		const hitRate = total === 0 ? 100 : (info.keyspaceHits / total) * 100;
		const evictionSeverity =
			info.evictedKeys > 0 && info.maxmemoryPolicy === "noeviction"
				? "critical"
				: info.evictedKeys > 1000
					? "warning"
					: "ok";

		const recommendations: string[] = [];

		if (hitRate < THRESHOLDS.hitRate.critical) {
			recommendations.push(
				`Cache hit rate is critically low at ${hitRate.toFixed(1)}%. Review TTL strategy, memory sizing, and whether Redis is serving the right workload.`,
			);
		} else if (hitRate < THRESHOLDS.hitRate.warning) {
			recommendations.push(
				`Cache hit rate ${hitRate.toFixed(1)}% is below the 90% target. Review hot keys, eviction pressure, and expiry policy.`,
			);
		}

		if (info.evictedKeys > 0) {
			recommendations.push(
				`${info.evictedKeys.toLocaleString()} keys have been evicted (policy: ${info.maxmemoryPolicy}). Increase headroom or adjust TTL and eviction policy.`,
			);
		}

		return {
			hits: info.keyspaceHits,
			misses: info.keyspaceMisses,
			hitRate,
			evictedKeys: info.evictedKeys,
			expiredKeys: info.expiredKeys,
			evictionPolicy: info.maxmemoryPolicy,
			evictionSeverity,
			recommendations,
		};
	}

	analyzeSlowCommands(
		commands: SlowCommand[],
		totalLogged: number,
		threshold: number,
	): SlowCommandAnalysis {
		const byCommand = new Map<string, { count: number; totalMs: number }>();
		for (const command of commands) {
			const name = command.command[0]?.toUpperCase() ?? "UNKNOWN";
			const current = byCommand.get(name) ?? { count: 0, totalMs: 0 };
			byCommand.set(name, {
				count: current.count + 1,
				totalMs: current.totalMs + command.durationMs,
			});
		}

		const topCommandTypes: SlowCommandSummary[] = [...byCommand.entries()]
			.sort((left, right) => right[1].count - left[1].count)
			.slice(0, 5)
			.map(([command, summary]) => ({
				command,
				count: summary.count,
				avgMs: summary.totalMs / summary.count,
			}));

		const recommendations: string[] = [];

		if (totalLogged > 100) {
			recommendations.push(
				`${totalLogged} slow commands were logged. Check for O(N) operations such as KEYS, large set scans, or long list traversals.`,
			);
		}

		const dangerousCommands = new Set([
			"KEYS",
			"FLUSHDB",
			"FLUSHALL",
			"DEBUG",
			"CONFIG",
		]);
		for (const command of topCommandTypes) {
			if (dangerousCommands.has(command.command)) {
				recommendations.push(
					`${command.command} appears in the slow log. Replace KEYS with SCAN and avoid administrative commands on the hot path.`,
				);
			}
		}

		return {
			totalLogged,
			commands,
			topCommandTypes,
			threshold,
			recommendations,
		};
	}
}
