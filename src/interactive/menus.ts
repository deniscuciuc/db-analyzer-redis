export const MAIN_MENU_CHOICES = [
	{ name: "Run analysis", value: "analysis" },
	{ name: "Generate reports", value: "reports" },
	{ name: "Watch mode", value: "watch" },
	{ name: "Settings", value: "settings" },
	{ name: "Exit", value: "exit" },
];

export const ANALYSIS_MENU_CHOICES = [
	{ name: "Full analysis", value: "full" },
	{ name: "Health", value: "health" },
	{ name: "Single command", value: "single" },
	{ name: "Back", value: "back" },
];

export const MODULE_CHOICES = [
	{ name: "Health", value: "health" },
	{ name: "Server info", value: "server-info" },
	{ name: "Memory", value: "memory" },
	{ name: "Hit rate", value: "hit-rate" },
	{ name: "Slow commands", value: "slow-commands" },
	{ name: "Keys", value: "keys" },
	{ name: "Connections", value: "connections" },
	{ name: "Persistence", value: "persistence" },
	{ name: "Replication", value: "replication" },
	{ name: "Config", value: "config" },
];

export const REPORTS_MENU_CHOICES = [
	{ name: "Markdown + JSON", value: "markdown" },
	{ name: "Markdown + JSON + HTML", value: "html" },
	{ name: "Diff against previous JSON report", value: "diff" },
	{ name: "Back", value: "back" },
];

export const SETTINGS_MENU_CHOICES = [
	{ name: "Show current settings", value: "show" },
	{ name: "Change output directory", value: "output" },
	{ name: "Change slow command threshold", value: "slow-threshold" },
	{ name: "Change max slow commands", value: "max-slow" },
	{ name: "Back", value: "back" },
];

export const WATCH_COMMAND_CHOICES = [
	{ name: "Health", value: "health" },
	{ name: "Connections", value: "connections" },
	{ name: "Hit rate", value: "hit-rate" },
	{ name: "Slow commands", value: "slow-commands" },
	{ name: "Keys", value: "keys" },
	{ name: "Replication", value: "replication" },
];
