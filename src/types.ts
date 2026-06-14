export interface RedisConnection {
	host: string;
	port: number;
	password?: string;
	db: number;
	tls: boolean;
	uri?: string;
}

export interface RedisInfo {
	redisVersion: string;
	redisMode: string;
	os: string;
	uptimeInSeconds: number;
	uptimeInDays: number;
	tcpPort: number;
	executablePath: string;
	configFile: string;
	connectedClients: number;
	blockedClients: number;
	maxClients: number;
	clientRecentMaxInputBuffer: number;
	clientRecentMaxOutputBuffer: number;
	usedMemory: number;
	usedMemoryHuman: string;
	usedMemoryRss: number;
	usedMemoryRssHuman: string;
	usedMemoryPeak: number;
	usedMemoryPeakHuman: string;
	usedMemoryPeakPerc: number;
	usedMemoryOverhead: number;
	usedMemoryDataset: number;
	memFragmentationRatio: number;
	memFragmentationBytes: number;
	maxmemory: number;
	maxmemoryHuman: string;
	maxmemoryPolicy: string;
	totalCommandsProcessed: number;
	instantaneousOpsPerSec: number;
	totalNetInputBytes: number;
	totalNetOutputBytes: number;
	rejectedConnections: number;
	expiredKeys: number;
	evictedKeys: number;
	keyspaceHits: number;
	keyspaceMisses: number;
	role: "master" | "slave";
	connectedSlaves: number;
	masterLinkStatus?: "up" | "down";
	masterLastIoSecondsAgo?: number;
	masterSyncInProgress?: boolean;
	masterReplOffset?: number;
	slaveReplOffset?: number;
	rdbChangesSinceLastSave: number;
	rdbBgsaveInProgress: boolean;
	rdbLastSaveTime: number;
	rdbLastBgsaveStatus: "ok" | "err";
	rdbLastBgsaveTimeSec: number;
	aofEnabled: boolean;
	aofRewriteInProgress: boolean;
	aofLastRewriteTimeSec: number;
	aofLastBgrewriteStatus: "ok" | "err";
	aofCurrentSize?: number;
	keyspaces: KeyspaceInfo[];
}

export interface KeyspaceInfo {
	db: number;
	keys: number;
	expires: number;
	avgTtl: number;
}

export interface SlowCommand {
	id: number;
	timestamp: number;
	durationMicros: number;
	durationMs: number;
	command: string[];
	commandPreview: string;
	clientAddr?: string;
}

export interface MemoryAnalysis {
	usedMemory: number;
	usedMemoryHuman: string;
	maxMemory: number;
	maxMemoryHuman: string;
	usagePercent: number;
	fragRatio: number;
	fragBytes: number;
	fragSeverity: "ok" | "warning" | "critical";
	rssOverhead: number;
	peakMemory: number;
	dataMemory: number;
	overheadMemory: number;
	recommendations: string[];
}

export interface HitRateAnalysis {
	hits: number;
	misses: number;
	hitRate: number;
	evictedKeys: number;
	expiredKeys: number;
	evictionPolicy: string;
	evictionSeverity: "ok" | "warning" | "critical";
	recommendations: string[];
}

export interface PersistenceAnalysis {
	rdb: {
		enabled: boolean;
		lastSaveTime: number;
		secondsSinceLastSave: number;
		lastStatus: "ok" | "err";
		changesSinceLastSave: number;
		saveInProgress: boolean;
	};
	aof: {
		enabled: boolean;
		lastStatus: "ok" | "err";
		rewriteInProgress: boolean;
		currentSizeBytes?: number;
	};
	severity: "ok" | "warning" | "critical";
	recommendations: string[];
}

export interface ReplicationAnalysis {
	role: "master" | "slave" | "standalone";
	connectedSlaves: number;
	linkStatus?: "up" | "down";
	lagSeconds?: number;
	syncInProgress?: boolean;
	severity: "ok" | "warning" | "critical";
	recommendations: string[];
}

export interface SlowCommandSummary {
	command: string;
	count: number;
	avgMs: number;
}

export interface SlowCommandAnalysis {
	totalLogged: number;
	commands: SlowCommand[];
	topCommandTypes: SlowCommandSummary[];
	threshold: number;
	recommendations: string[];
}

export interface RedisMetrics {
	version: string;
	mode: string;
	uptimeDays: number;
	connectedClients: number;
	blockedClients: number;
	maxClients: number;
	opsPerSec: number;
	totalKeyCount: number;
	keyspacesCount: number;
	rejectedConnections: number;
}

export interface Recommendation {
	priority: "critical" | "high" | "medium" | "low";
	category: string;
	message: string;
	action?: string;
}

export interface FullRedisReport {
	generatedAt: Date;
	host: string;
	port: number;
	db: number;
	healthScore: number;
	metrics: RedisMetrics;
	memory: MemoryAnalysis;
	hitRate: HitRateAnalysis;
	persistence: PersistenceAnalysis;
	replication: ReplicationAnalysis;
	slowCommands: SlowCommandAnalysis;
	keyspaces: KeyspaceInfo[];
	config: Record<string, string>;
	recommendations: Recommendation[];
}

export type FullReport = FullRedisReport;

export interface AnalyzerOptions {
	slowCommandThreshold?: number;
	maxSlowCommands?: number;
	outputDir?: string;
}
