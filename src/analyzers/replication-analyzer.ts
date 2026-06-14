import { THRESHOLDS } from "../constants";
import type { RedisInfo, ReplicationAnalysis } from "../types";

export class ReplicationAnalyzer {
	analyze(info: RedisInfo): ReplicationAnalysis {
		if (info.role === "master" && info.connectedSlaves === 0) {
			return {
				role: "standalone",
				connectedSlaves: 0,
				severity: "ok",
				recommendations: [],
			};
		}

		const recommendations: string[] = [];
		let severity: ReplicationAnalysis["severity"] = "ok";
		let lagSeconds: number | undefined;

		if (info.role === "slave") {
			if (info.masterLinkStatus === "down") {
				severity = "critical";
				recommendations.push(
					"Replication link to the primary is down. Check network reachability and primary health.",
				);
			} else if (info.masterLastIoSecondsAgo !== undefined) {
				lagSeconds = info.masterLastIoSecondsAgo;
				if (lagSeconds >= THRESHOLDS.replication.lagCritical) {
					severity = "critical";
					recommendations.push(
						`Replication lag is ${lagSeconds}s. Check network throughput, replica CPU pressure, and write load on the primary.`,
					);
				} else if (lagSeconds >= THRESHOLDS.replication.lagWarning) {
					severity = "warning";
					recommendations.push(
						`Replication lag of ${lagSeconds}s detected. Monitor catch-up speed and backlog size.`,
					);
				}
			}

			if (info.masterSyncInProgress) {
				recommendations.push(
					"A full resync is in progress. Expect reduced replica freshness until synchronization completes.",
				);
			}
		}

		if (info.role === "master" && info.connectedSlaves > 0) {
			recommendations.push(
				`Primary has ${info.connectedSlaves} replica(s). Validate lag from replica INFO output.`,
			);
		}

		return {
			role: info.role === "master" ? "master" : "slave",
			connectedSlaves: info.connectedSlaves,
			linkStatus: info.masterLinkStatus,
			lagSeconds,
			syncInProgress: info.masterSyncInProgress,
			severity,
			recommendations,
		};
	}
}
