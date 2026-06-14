import type { FullRedisReport } from "../types";
import {
	formatBytes,
	formatDuration,
	formatNumber,
	formatPercent,
} from "../utils/format";

// biome-ignore lint/complexity/noStaticOnlyClass: grouped HTML helpers keep the template readable.
export class HtmlReporter {
	static generate(report: FullRedisReport): string {
		return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Redis Analysis Report</title>
    <style>
      :root {
        --bg: #0f172a;
        --surface: #111827;
        --surface-alt: #1f2937;
        --text: #e5e7eb;
        --muted: #94a3b8;
        --border: #334155;
        --good: #22c55e;
        --warn: #f59e0b;
        --bad: #ef4444;
      }
      body { margin: 0; font-family: Inter, system-ui, sans-serif; background: var(--bg); color: var(--text); }
      main { width: min(1180px, calc(100% - 2rem)); margin: 0 auto; padding: 2rem 0 3rem; }
      h1, h2, h3 { margin: 0 0 0.75rem; }
      .card, section { background: var(--surface); border: 1px solid var(--border); border-radius: 1rem; padding: 1.25rem; }
      .grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin: 1.25rem 0; }
      .muted { color: var(--muted); }
      table { width: 100%; border-collapse: collapse; margin-top: 0.75rem; }
      th, td { border-bottom: 1px solid var(--border); text-align: left; padding: 0.65rem 0.5rem; vertical-align: top; }
      th { color: var(--muted); font-weight: 600; }
      code { background: var(--surface-alt); border-radius: 0.4rem; padding: 0.1rem 0.35rem; }
      .pill { display: inline-block; border-radius: 999px; padding: 0.2rem 0.65rem; font-weight: 700; }
      .good { background: rgba(34, 197, 94, 0.15); color: #86efac; }
      .warn { background: rgba(245, 158, 11, 0.15); color: #fcd34d; }
      .bad { background: rgba(239, 68, 68, 0.15); color: #fca5a5; }
      section + section { margin-top: 1rem; }
      ul { padding-left: 1.25rem; }
    </style>
  </head>
  <body>
    <main>
      <div class="card">
        <p class="muted">${HtmlReporter.escape(`${report.host}:${report.port}/${report.db}`)} · ${HtmlReporter.escape(report.generatedAt.toISOString())}</p>
        <h1>Redis Analysis Report</h1>
        <span class="pill ${HtmlReporter.healthClass(report.healthScore)}">Health score: ${report.healthScore}/100</span>
        <div class="grid">
          ${HtmlReporter.summaryCard("Used Memory", report.memory.usedMemoryHuman)}
          ${HtmlReporter.summaryCard("Hit Rate", formatPercent(report.hitRate.hitRate))}
          ${HtmlReporter.summaryCard("Ops / sec", formatNumber(report.metrics.opsPerSec))}
          ${HtmlReporter.summaryCard("Total Keys", formatNumber(report.metrics.totalKeyCount))}
          ${HtmlReporter.summaryCard("Connected Clients", formatNumber(report.metrics.connectedClients))}
          ${HtmlReporter.summaryCard("Slow Commands", formatNumber(report.slowCommands.totalLogged))}
        </div>
      </div>

      <section>
        <h2>Recommendations</h2>
        <ul>
          ${report.recommendations.map((item) => `<li><strong>${HtmlReporter.escape(item.priority)}</strong> <code>${HtmlReporter.escape(item.category)}</code> — ${HtmlReporter.escape(item.message)}</li>`).join("") || "<li>No recommendations</li>"}
        </ul>
      </section>

      <section>
        <h2>Memory</h2>
        ${HtmlReporter.table(
					["Metric", "Value"],
					[
						["Used Memory", report.memory.usedMemoryHuman],
						["Max Memory", report.memory.maxMemoryHuman || "unlimited"],
						["Usage Percent", formatPercent(report.memory.usagePercent)],
						["Fragmentation Ratio", report.memory.fragRatio.toFixed(2)],
						["Fragmentation Waste", formatBytes(report.memory.fragBytes)],
						["RSS Overhead", formatBytes(report.memory.rssOverhead)],
					],
				)}
      </section>

      <section>
        <h2>Cache & Persistence</h2>
        ${HtmlReporter.table(
					["Metric", "Value"],
					[
						["Hit Rate", formatPercent(report.hitRate.hitRate)],
						["Evicted Keys", formatNumber(report.hitRate.evictedKeys)],
						["Expired Keys", formatNumber(report.hitRate.expiredKeys)],
						["RDB Status", report.persistence.rdb.lastStatus],
						["AOF Enabled", report.persistence.aof.enabled ? "yes" : "no"],
						["AOF Status", report.persistence.aof.lastStatus],
					],
				)}
      </section>

      <section>
        <h2>Slow Commands</h2>
        ${HtmlReporter.table(
					["Command", "Count", "Avg Duration"],
					report.slowCommands.topCommandTypes.map((item) => [
						item.command,
						formatNumber(item.count),
						formatDuration(item.avgMs),
					]),
				)}
      </section>

      <section>
        <h2>Keyspaces</h2>
        ${HtmlReporter.table(
					["DB", "Keys", "Expiring Keys", "Avg TTL"],
					report.keyspaces.map((keyspace) => [
						`db${keyspace.db}`,
						formatNumber(keyspace.keys),
						formatNumber(keyspace.expires),
						formatDuration(keyspace.avgTtl),
					]),
				)}
      </section>
    </main>
  </body>
</html>`;
	}

	private static summaryCard(label: string, value: string): string {
		return `<div class="card"><h3>${HtmlReporter.escape(label)}</h3><p>${HtmlReporter.escape(value)}</p></div>`;
	}

	private static table(headers: string[], rows: string[][]): string {
		if (rows.length === 0) {
			return '<p class="muted">No data available.</p>';
		}

		return `<table><thead><tr>${headers.map((header) => `<th>${HtmlReporter.escape(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${HtmlReporter.escape(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
	}

	private static healthClass(score: number): string {
		if (score >= 90) {
			return "good";
		}
		if (score >= 70) {
			return "warn";
		}
		return "bad";
	}

	private static escape(value: string): string {
		return value
			.replaceAll("&", "&amp;")
			.replaceAll("<", "&lt;")
			.replaceAll(">", "&gt;")
			.replaceAll('"', "&quot;")
			.replaceAll("'", "&#39;");
	}
}
