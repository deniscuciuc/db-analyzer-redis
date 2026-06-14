export const COMMANDS = [
	"full",
	"health",
	"server-info",
	"memory",
	"hit-rate",
	"slow-commands",
	"keys",
	"connections",
	"persistence",
	"replication",
	"config",
] as const;

export type Command = (typeof COMMANDS)[number];

export const WATCH_ALLOWED = new Set<Command>([
	"health",
	"connections",
	"hit-rate",
	"slow-commands",
	"keys",
	"replication",
]);

export const WATCH_BLOCKED = new Set<Command>([]);

export const FULL_ANALYSIS_COMMANDS: Command[] = [
	"health",
	"memory",
	"hit-rate",
	"slow-commands",
	"keys",
	"connections",
	"persistence",
	"replication",
	"config",
];

export const THRESHOLDS = {
	memory: {
		usageWarning: 70,
		usageCritical: 90,
		fragWarning: 1.5,
		fragCritical: 2.0,
	},
	hitRate: {
		warning: 90,
		critical: 80,
	},
	replication: {
		lagWarning: 10,
		lagCritical: 60,
	},
	persistence: {
		rdbStaleHours: 24,
	},
	slowCommand: {
		defaultThresholdMicros: 10_000,
	},
} as const;

export const SCORE_DEDUCTIONS = {
	memoryUsageCritical: 20,
	memoryUsageWarning: 10,
	highFragmentation: 15,
	lowHitRate: 20,
	veryLowHitRate: 10,
	linkDown: 25,
	highReplicationLag: 15,
	rdbFailed: 20,
	aofFailed: 20,
	stalePersistence: 10,
	highEviction: 10,
	rejectedConnections: 15,
} as const;

export const DEFAULTS = {
	host: "localhost",
	port: 6379,
	db: 0,
	slowCommandThreshold: 10_000,
	maxSlowCommands: 25,
	output: "./reports",
	watchInterval: 30,
} as const;

export const IMPORTANT_CONFIG_KEYS = [
	"maxmemory",
	"maxmemory-policy",
	"appendonly",
	"appendfsync",
	"save",
	"timeout",
	"tcp-keepalive",
	"slowlog-log-slower-than",
	"slowlog-max-len",
	"databases",
] as const;
