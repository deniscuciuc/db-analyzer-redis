import type { Redis } from "ioredis";
import type { KeyspaceInfo, RedisInfo, SlowCommand } from "../types";

type RawSlowLogEntry = [number, number, number, string[], string?, string?];

export function parseSlowLogEntries(entries: RawSlowLogEntry[]): SlowCommand[] {
	return entries.map((entry) => {
		const args = Array.isArray(entry[3]) ? entry[3] : [];
		return {
			id: Number(entry[0]),
			timestamp: Number(entry[1]),
			durationMicros: Number(entry[2]),
			durationMs: Number(entry[2]) / 1000,
			command: args,
			commandPreview: args.slice(0, 3).join(" ").substring(0, 80),
			clientAddr: entry[4]?.toString(),
		};
	});
}

export function parseRedisInfo(raw: string): RedisInfo {
	const lines = raw.split("\r\n");
	const map: Record<string, string> = {};
	for (const line of lines) {
		if (line.startsWith("#") || !line.includes(":")) {
			continue;
		}

		const [key, ...rest] = line.split(":");
		map[key.trim()] = rest.join(":").trim();
	}

	const keyspaces: KeyspaceInfo[] = [];
	for (const [key, value] of Object.entries(map)) {
		if (!key.startsWith("db")) {
			continue;
		}

		const db = Number(key.slice(2));
		if (Number.isNaN(db)) {
			continue;
		}

		const parts: Record<string, number> = {};
		for (const part of value.split(",")) {
			const [partKey, partValue] = part.split("=");
			parts[partKey] = Number(partValue);
		}

		keyspaces.push({
			db,
			keys: parts.keys ?? 0,
			expires: parts.expires ?? 0,
			avgTtl: parts.avg_ttl ?? 0,
		});
	}

	const get = (key: string, fallback = "0") => map[key] ?? fallback;
	const number = (key: string) => Number(get(key));

	return {
		redisVersion: get("redis_version", "unknown"),
		redisMode: get("redis_mode", "standalone"),
		os: get("os", "unknown"),
		uptimeInSeconds: number("uptime_in_seconds"),
		uptimeInDays: number("uptime_in_days"),
		tcpPort: number("tcp_port"),
		executablePath: get("executable"),
		configFile: get("config_file"),
		connectedClients: number("connected_clients"),
		blockedClients: number("blocked_clients"),
		maxClients: number("maxclients"),
		clientRecentMaxInputBuffer: number("client_recent_max_input_buffer"),
		clientRecentMaxOutputBuffer: number("client_recent_max_output_buffer"),
		usedMemory: number("used_memory"),
		usedMemoryHuman: get("used_memory_human"),
		usedMemoryRss: number("used_memory_rss"),
		usedMemoryRssHuman: get("used_memory_rss_human"),
		usedMemoryPeak: number("used_memory_peak"),
		usedMemoryPeakHuman: get("used_memory_peak_human"),
		usedMemoryPeakPerc: Number(
			get("used_memory_peak_perc", "0").replace("%", ""),
		),
		usedMemoryOverhead: number("used_memory_overhead"),
		usedMemoryDataset: number("used_memory_dataset"),
		memFragmentationRatio: Number(get("mem_fragmentation_ratio", "0")),
		memFragmentationBytes: number("mem_fragmentation_bytes"),
		maxmemory: number("maxmemory"),
		maxmemoryHuman: get("maxmemory_human"),
		maxmemoryPolicy: get("maxmemory_policy", "noeviction"),
		totalCommandsProcessed: number("total_commands_processed"),
		instantaneousOpsPerSec: number("instantaneous_ops_per_sec"),
		totalNetInputBytes: number("total_net_input_bytes"),
		totalNetOutputBytes: number("total_net_output_bytes"),
		rejectedConnections: number("rejected_connections"),
		expiredKeys: number("expired_keys"),
		evictedKeys: number("evicted_keys"),
		keyspaceHits: number("keyspace_hits"),
		keyspaceMisses: number("keyspace_misses"),
		role: get("role", "master") as "master" | "slave",
		connectedSlaves: number("connected_slaves"),
		masterLinkStatus: map.master_link_status as "up" | "down" | undefined,
		masterLastIoSecondsAgo: map.master_last_io_seconds_ago
			? number("master_last_io_seconds_ago")
			: undefined,
		masterSyncInProgress: map.master_sync_in_progress
			? get("master_sync_in_progress") === "1"
			: undefined,
		masterReplOffset: map.master_repl_offset
			? number("master_repl_offset")
			: undefined,
		slaveReplOffset: map.slave_repl_offset
			? number("slave_repl_offset")
			: undefined,
		rdbChangesSinceLastSave: number("rdb_changes_since_last_save"),
		rdbBgsaveInProgress: get("rdb_bgsave_in_progress") === "1",
		rdbLastSaveTime: number("rdb_last_save_time"),
		rdbLastBgsaveStatus: get("rdb_last_bgsave_status", "ok") as "ok" | "err",
		rdbLastBgsaveTimeSec: number("rdb_last_bgsave_time_sec"),
		aofEnabled: get("aof_enabled") === "1",
		aofRewriteInProgress: get("aof_rewrite_in_progress") === "1",
		aofLastRewriteTimeSec: number("aof_last_rewrite_time_sec"),
		aofLastBgrewriteStatus: get("aof_last_bgrewrite_status", "ok") as
			| "ok"
			| "err",
		aofCurrentSize: map.aof_current_size
			? number("aof_current_size")
			: undefined,
		keyspaces,
	};
}

export class StatsCollector {
	constructor(private readonly client: Redis) {}

	async getInfo(): Promise<RedisInfo> {
		return parseRedisInfo(await this.client.info("all"));
	}

	async getSlowLog(count: number): Promise<SlowCommand[]> {
		const raw = (await this.client.slowlog("GET", count)) as RawSlowLogEntry[];
		return parseSlowLogEntries(raw);
	}

	async getSlowLogLength(): Promise<number> {
		const raw = await this.client.slowlog("LEN");
		return Number(raw);
	}

	async getConfigValues(
		keys: readonly string[],
	): Promise<Record<string, string>> {
		const config: Record<string, string> = {};
		for (const key of keys) {
			const raw = (await this.client.config("GET", key)) as string[];
			for (let index = 0; index < raw.length; index += 2) {
				const configKey = raw[index];
				const value = raw[index + 1];
				if (configKey && value !== undefined) {
					config[configKey] = value;
				}
			}
		}

		return config;
	}
}
