import { THRESHOLDS } from "../constants";
import type { PersistenceAnalysis, RedisInfo } from "../types";

export class PersistenceAnalyzer {
	analyze(info: RedisInfo): PersistenceAnalysis {
		const now = Math.floor(Date.now() / 1000);
		const secondsSinceRdb =
			info.rdbLastSaveTime > 0 ? now - info.rdbLastSaveTime : 0;
		const hoursSinceRdb = secondsSinceRdb / 3600;
		const recommendations: string[] = [];
		let severity: PersistenceAnalysis["severity"] = "ok";

		if (info.rdbLastBgsaveStatus === "err") {
			severity = "critical";
			recommendations.push(
				"Last RDB save failed. Check Redis logs and available disk space immediately.",
			);
		} else if (
			info.rdbLastSaveTime > 0 &&
			hoursSinceRdb > THRESHOLDS.persistence.rdbStaleHours
		) {
			severity = "warning";
			recommendations.push(
				`No successful RDB save in ${hoursSinceRdb.toFixed(1)} hours. Verify save settings or trigger a manual BGSAVE.`,
			);
		}

		if (info.aofEnabled && info.aofLastBgrewriteStatus === "err") {
			severity = "critical";
			recommendations.push(
				"Last AOF rewrite failed. Check disk pressure and Redis background rewrite activity.",
			);
		}

		if (!info.aofEnabled && info.rdbChangesSinceLastSave > 10_000) {
			if (severity === "ok") {
				severity = "warning";
			}
			recommendations.push(
				`${info.rdbChangesSinceLastSave.toLocaleString()} unsaved changes detected since the last RDB snapshot. Consider enabling AOF or reducing snapshot intervals.`,
			);
		}

		if (!info.aofEnabled && info.rdbLastSaveTime === 0) {
			if (severity === "ok") {
				severity = "warning";
			}
			recommendations.push(
				"No persistence configured (no AOF and no successful RDB snapshot). Data will be lost on restart.",
			);
		}

		return {
			rdb: {
				enabled:
					info.rdbLastSaveTime > 0 ||
					info.rdbChangesSinceLastSave > 0 ||
					info.rdbBgsaveInProgress,
				lastSaveTime: info.rdbLastSaveTime,
				secondsSinceLastSave: secondsSinceRdb,
				lastStatus: info.rdbLastBgsaveStatus,
				changesSinceLastSave: info.rdbChangesSinceLastSave,
				saveInProgress: info.rdbBgsaveInProgress,
			},
			aof: {
				enabled: info.aofEnabled,
				lastStatus: info.aofLastBgrewriteStatus,
				rewriteInProgress: info.aofRewriteInProgress,
				currentSizeBytes: info.aofCurrentSize,
			},
			severity,
			recommendations,
		};
	}
}
