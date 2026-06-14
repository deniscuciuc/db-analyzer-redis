import type { FullReport } from "../types";
import { formatBytes, formatPercent } from "../utils/format";

export interface MetricDiff {
	label: string;
	before: number | string;
	after: number | string;
	delta?: number;
	trend: "better" | "worse" | "neutral" | "unchanged";
}

export interface ReportDiff {
	currentAt: string;
	previousAt: string;
	timeDelta: string;
	metrics: MetricDiff[];
	newIssues: string[];
	resolvedIssues: string[];
}

type TrendDirection = "higher" | "lower" | "neutral";

export const DiffReporter = {
	diff(current: FullReport, previous: FullReport): ReportDiff {
		const currentIssues = collectIssues(current);
		const previousIssues = collectIssues(previous);

		return {
			currentAt: toIsoString(current.generatedAt),
			previousAt: toIsoString(previous.generatedAt),
			timeDelta: describeTimeDelta(previous.generatedAt, current.generatedAt),
			metrics: [
				createMetricDiff(
					"Health score",
					previous.healthScore,
					current.healthScore,
					"higher",
				),
				createMetricDiff(
					"Hit rate",
					previous.hitRate.hitRate,
					current.hitRate.hitRate,
					"higher",
				),
				createMetricDiff(
					"Used memory",
					previous.memory.usedMemory,
					current.memory.usedMemory,
					"lower",
				),
				createMetricDiff(
					"Slow commands",
					previous.slowCommands.totalLogged,
					current.slowCommands.totalLogged,
					"lower",
				),
				createMetricDiff(
					"Ops / sec",
					previous.metrics.opsPerSec,
					current.metrics.opsPerSec,
					"neutral",
				),
				createMetricDiff(
					"Connected clients",
					previous.metrics.connectedClients,
					current.metrics.connectedClients,
					"neutral",
				),
				createMetricDiff(
					"Rejected connections",
					previous.metrics.rejectedConnections,
					current.metrics.rejectedConnections,
					"lower",
				),
			],
			newIssues: currentIssues.filter(
				(issue) => !previousIssues.includes(issue),
			),
			resolvedIssues: previousIssues.filter(
				(issue) => !currentIssues.includes(issue),
			),
		};
	},

	print(
		diff: ReportDiff,
		write: (
			message?: unknown,
			...optionalParams: unknown[]
		) => void = console.log,
	): void {
		write(
			`\nReport diff (${diff.previousAt} → ${diff.currentAt}, ${diff.timeDelta})`,
		);
		for (const metric of diff.metrics) {
			const arrow =
				metric.trend === "better" ? "⬆️" : metric.trend === "worse" ? "⬇️" : "↔️";
			const delta =
				metric.delta === undefined || metric.delta === 0
					? ""
					: ` (${metric.delta > 0 ? "+" : ""}${formatValue(metric.label, metric.delta)})`;
			write(
				`${arrow}  ${metric.label.padEnd(20)} ${formatValue(metric.label, metric.before)} → ${formatValue(metric.label, metric.after)}${delta}`,
			);
		}

		if (diff.newIssues.length > 0) {
			write(
				`⚠️  New issues (${diff.newIssues.length}): ${diff.newIssues.join(", ")}`,
			);
		}
		if (diff.resolvedIssues.length > 0) {
			write(
				`✓  Resolved (${diff.resolvedIssues.length}): ${diff.resolvedIssues.join(", ")}`,
			);
		}
	},
};

function createMetricDiff(
	label: string,
	before: number,
	after: number,
	direction: TrendDirection,
): MetricDiff {
	const delta = Math.round((after - before) * 100) / 100;
	if (delta === 0) {
		return { label, before, after, delta: 0, trend: "unchanged" };
	}

	if (direction === "neutral") {
		return { label, before, after, delta, trend: "neutral" };
	}

	const improved =
		(direction === "higher" && delta > 0) ||
		(direction === "lower" && delta < 0);
	return { label, before, after, delta, trend: improved ? "better" : "worse" };
}

function collectIssues(report: FullReport): string[] {
	const issues = report.recommendations.map(
		(item) => `${item.priority}:${item.category}:${item.message}`,
	);
	if (report.memory.fragSeverity !== "ok") {
		issues.push(`fragmentation:${report.memory.fragSeverity}`);
	}
	if (report.persistence.severity !== "ok") {
		issues.push(`persistence:${report.persistence.severity}`);
	}
	if (report.replication.severity !== "ok") {
		issues.push(`replication:${report.replication.severity}`);
	}
	return issues;
}

function describeTimeDelta(
	previousAt: Date | string,
	currentAt: Date | string,
): string {
	const previous = new Date(previousAt);
	const current = new Date(currentAt);
	const minutes = Math.max(
		1,
		Math.round((current.getTime() - previous.getTime()) / 60000),
	);
	if (minutes < 60) {
		return `${minutes} minute${minutes === 1 ? "" : "s"} apart`;
	}

	const hours = Math.round(minutes / 60);
	if (hours < 48) {
		return `${hours} hour${hours === 1 ? "" : "s"} apart`;
	}

	const days = Math.round(hours / 24);
	return `${days} day${days === 1 ? "" : "s"} apart`;
}

function toIsoString(value: Date | string): string {
	return new Date(value).toISOString();
}

function formatValue(label: string, value: number | string): string {
	if (typeof value === "string") {
		return value;
	}
	if (label === "Used memory") {
		return formatBytes(value);
	}
	if (label === "Hit rate") {
		return formatPercent(value);
	}
	return Number.isInteger(value) ? value.toString() : value.toFixed(2);
}
