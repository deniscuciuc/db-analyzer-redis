import { THRESHOLDS } from "../constants";
import type { MemoryAnalysis, RedisInfo } from "../types";
import { formatBytes } from "../utils/format";

export class MemoryAnalyzer {
	analyze(info: RedisInfo): MemoryAnalysis {
		const hasLimit = info.maxmemory > 0;
		const usagePercent = hasLimit
			? (info.usedMemory / info.maxmemory) * 100
			: 0;
		const fragRatio = info.memFragmentationRatio;
		const fragSeverity =
			fragRatio >= THRESHOLDS.memory.fragCritical
				? "critical"
				: fragRatio >= THRESHOLDS.memory.fragWarning
					? "warning"
					: "ok";

		const recommendations: string[] = [];

		if (hasLimit && usagePercent >= THRESHOLDS.memory.usageCritical) {
			recommendations.push(
				`Memory usage at ${usagePercent.toFixed(1)}% — increase maxmemory or reduce data size immediately.`,
			);
		} else if (hasLimit && usagePercent >= THRESHOLDS.memory.usageWarning) {
			recommendations.push(
				`Memory at ${usagePercent.toFixed(1)}% of maxmemory — plan capacity increase.`,
			);
		}

		if (!hasLimit) {
			recommendations.push(
				"maxmemory is not set — Redis will grow until an OOM kill unless the host limits it.",
			);
		}

		if (fragSeverity === "critical") {
			recommendations.push(
				`High fragmentation ratio ${fragRatio.toFixed(2)} (${formatBytes(info.memFragmentationBytes)} wasted). Run MEMORY PURGE or restart Redis during a low-traffic window.`,
			);
		} else if (fragSeverity === "warning") {
			recommendations.push(
				`Moderate fragmentation ratio ${fragRatio.toFixed(2)}. Monitor allocator pressure and peak RSS.`,
			);
		}

		if (info.usedMemory > 0 && info.usedMemoryRss > info.usedMemory * 2) {
			recommendations.push(
				`RSS (${formatBytes(info.usedMemoryRss)}) is more than 2x allocated memory (${info.usedMemoryHuman}). Consider MEMORY PURGE, jemalloc tuning, or a controlled restart.`,
			);
		}

		return {
			usedMemory: info.usedMemory,
			usedMemoryHuman: info.usedMemoryHuman,
			maxMemory: info.maxmemory,
			maxMemoryHuman: info.maxmemoryHuman,
			usagePercent,
			fragRatio,
			fragBytes: info.memFragmentationBytes,
			fragSeverity,
			rssOverhead: info.usedMemoryRss - info.usedMemory,
			peakMemory: info.usedMemoryPeak,
			dataMemory: info.usedMemoryDataset,
			overheadMemory: info.usedMemoryOverhead,
			recommendations,
		};
	}
}
