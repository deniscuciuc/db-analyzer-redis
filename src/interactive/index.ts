import { input, select } from "@inquirer/prompts";
import type { Redis } from "ioredis";
import { MemoryAnalyzer } from "../analyzers/memory-analyzer";
import { PerformanceAnalyzer } from "../analyzers/performance-analyzer";
import { PersistenceAnalyzer } from "../analyzers/persistence-analyzer";
import { ReplicationAnalyzer } from "../analyzers/replication-analyzer";
import type { ParsedOptions } from "../cli/options";
import {
	buildFullReport,
	loadPreviousReport,
	summarizeKeyspaces,
} from "../cli/runner";
import { StatsCollector } from "../collectors/stats-collector";
import { IMPORTANT_CONFIG_KEYS } from "../constants";
import { DiffReporter } from "../reporters/diff-reporter";
import { ReportGenerator } from "../reporters/report-generator";
import type { RedisConnection } from "../types";
import { runWatchLoop } from "../watch/runner";
import * as display from "./display";
import {
	ANALYSIS_MENU_CHOICES,
	MAIN_MENU_CHOICES,
	MODULE_CHOICES,
	REPORTS_MENU_CHOICES,
	SETTINGS_MENU_CHOICES,
	WATCH_COMMAND_CHOICES,
} from "./menus";

export class InteractiveCLI {
	private readonly collector: StatsCollector;
	private readonly memory = new MemoryAnalyzer();
	private readonly performance = new PerformanceAnalyzer();
	private readonly persistence = new PersistenceAnalyzer();
	private readonly replication = new ReplicationAnalyzer();

	constructor(
		private readonly client: Redis,
		private readonly connection: RedisConnection,
		private readonly runtimeOptions: ParsedOptions,
	) {
		this.collector = new StatsCollector(client);
	}

	async start(): Promise<void> {
		console.clear();
		console.log(
			`\n  Redis Analyzer — ${this.connection.host}:${this.connection.port}/${this.connection.db}\n`,
		);

		let running = true;
		while (running) {
			const action = await select({
				message: "Main menu",
				choices: MAIN_MENU_CHOICES,
			});

			switch (action) {
				case "analysis":
					await this.analysisMenu();
					break;
				case "reports":
					await this.reportsMenu();
					break;
				case "watch":
					await this.watchMenu();
					break;
				case "settings":
					await this.settingsMenu();
					break;
				case "exit":
					running = false;
					break;
			}
		}
	}

	private reporter(): ReportGenerator {
		return new ReportGenerator(this.runtimeOptions.outputDir, {
			outputDir: this.runtimeOptions.outputDir,
			slowCommandThreshold: this.runtimeOptions.slowCommandThreshold,
			maxSlowCommands: this.runtimeOptions.maxSlowCommands,
		});
	}

	private async analysisMenu(): Promise<void> {
		const choice = await select({
			message: "Run analysis",
			choices: ANALYSIS_MENU_CHOICES,
		});

		switch (choice) {
			case "full":
				display.showFullReport(
					await buildFullReport(
						this.client,
						this.runtimeOptions,
						this.connection,
					),
				);
				break;
			case "health":
				display.showHealth(
					await buildFullReport(
						this.client,
						this.runtimeOptions,
						this.connection,
					),
				);
				break;
			case "single":
				await this.singleModuleMenu();
				break;
		}
	}

	private async singleModuleMenu(): Promise<void> {
		const command = await select({
			message: "Select command",
			choices: MODULE_CHOICES,
		});
		await this.runModule(command);
	}

	private async runModule(command: string): Promise<void> {
		const info =
			command === "slow-commands" ? undefined : await this.collector.getInfo();

		switch (command) {
			case "health":
				display.showHealth(
					await buildFullReport(
						this.client,
						this.runtimeOptions,
						this.connection,
					),
				);
				break;
			case "server-info":
				display.showServerInfo(info!);
				break;
			case "memory":
				display.showMemory(this.memory.analyze(info!));
				break;
			case "hit-rate":
				display.showHitRate(this.performance.analyzeHitRate(info!));
				break;
			case "slow-commands": {
				const [commands, totalLogged] = await Promise.all([
					this.collector.getSlowLog(this.runtimeOptions.maxSlowCommands),
					this.collector.getSlowLogLength(),
				]);
				display.showSlowCommands(
					this.performance.analyzeSlowCommands(
						commands,
						totalLogged,
						this.runtimeOptions.slowCommandThreshold,
					),
				);
				break;
			}
			case "keys":
				display.showKeyspaces(summarizeKeyspaces(info!).keyspaces);
				break;
			case "connections":
				display.showConnections(info!);
				break;
			case "persistence":
				display.showPersistence(this.persistence.analyze(info!));
				break;
			case "replication":
				display.showReplication(this.replication.analyze(info!));
				break;
			case "config":
				display.showConfig(
					await this.collector.getConfigValues(IMPORTANT_CONFIG_KEYS),
				);
				break;
		}
	}

	private async reportsMenu(): Promise<void> {
		const choice = await select({
			message: "Generate report",
			choices: REPORTS_MENU_CHOICES,
		});
		if (choice === "back") {
			return;
		}

		const report = await buildFullReport(
			this.client,
			this.runtimeOptions,
			this.connection,
		);
		const reporter = this.reporter();

		if (choice === "markdown" || choice === "html") {
			const markdown = await reporter.generateFullReport(report);
			const json = await reporter.generateJsonReport(report);
			console.log(`  ✅ Markdown: ${markdown}`);
			console.log(`  ✅ JSON:     ${json}`);
			if (choice === "html") {
				const html = await reporter.generateHtmlReport(report);
				console.log(`  ✅ HTML:     ${html}`);
			}
		}

		if (choice === "diff") {
			const previousPath = await input({
				message: "Path to previous JSON report:",
			});
			DiffReporter.print(
				DiffReporter.diff(report, loadPreviousReport(previousPath)),
			);
		}
	}

	private async watchMenu(): Promise<void> {
		const command = await select({
			message: "Select watch command",
			choices: WATCH_COMMAND_CHOICES,
		});
		const interval = await input({
			message: "Watch interval in seconds",
			default: String(this.runtimeOptions.watch ?? 30),
			validate: (value) =>
				Number(value) > 0 ? true : "Must be a positive number",
		});
		await runWatchLoop({
			intervalSeconds: Number.parseInt(interval, 10),
			command,
			runCommand: () => this.runModule(command),
		});
	}

	private async settingsMenu(): Promise<void> {
		const choice = await select({
			message: "Settings",
			choices: SETTINGS_MENU_CHOICES,
		});

		switch (choice) {
			case "show":
				this.showSettings();
				break;
			case "output":
				this.runtimeOptions.outputDir = await input({
					message: "Output directory",
					default: this.runtimeOptions.outputDir,
				});
				break;
			case "slow-threshold":
				this.runtimeOptions.slowCommandThreshold = Number.parseInt(
					await input({
						message: "Slow command threshold in microseconds",
						default: String(this.runtimeOptions.slowCommandThreshold),
						validate: (value) =>
							Number(value) > 0 ? true : "Must be a positive number",
					}),
					10,
				);
				break;
			case "max-slow":
				this.runtimeOptions.maxSlowCommands = Number.parseInt(
					await input({
						message: "Max slow commands to fetch",
						default: String(this.runtimeOptions.maxSlowCommands),
						validate: (value) =>
							Number(value) > 0 ? true : "Must be a positive number",
					}),
					10,
				);
				break;
		}
	}

	/**
	 * Print the settings that are safe to show. Dumping runtimeOptions directly
	 * would put the connection password on screen.
	 */
	private showSettings(): void {
		console.log({
			host: this.connection.host,
			port: this.connection.port,
			db: this.connection.db,
			tls: this.connection.tls ?? false,
			password: this.connection.password ? "***" : undefined,
			outputDir: this.runtimeOptions.outputDir,
			slowCommandThreshold: this.runtimeOptions.slowCommandThreshold,
			maxSlowCommands: this.runtimeOptions.maxSlowCommands,
			profile: this.runtimeOptions.profile,
		});
	}
}
