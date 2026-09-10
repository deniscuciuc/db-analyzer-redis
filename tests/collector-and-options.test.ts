import assert from "node:assert/strict";
import test from "node:test";
import { parseOptions } from "../src/cli/options";
import {
	parseRedisInfo,
	parseSlowLogEntries,
} from "../src/collectors/stats-collector";

const SAMPLE_INFO = `# Server\r
redis_version:7.2.5\r
redis_mode:standalone\r
os:Linux\r
uptime_in_seconds:86400\r
uptime_in_days:1\r
tcp_port:6379\r
executable:/usr/bin/redis-server\r
config_file:/etc/redis/redis.conf\r
# Clients\r
connected_clients:12\r
blocked_clients:1\r
maxclients:1000\r
client_recent_max_input_buffer:2048\r
client_recent_max_output_buffer:4096\r
# Memory\r
used_memory:52428800\r
used_memory_human:50.00M\r
used_memory_rss:78643200\r
used_memory_rss_human:75.00M\r
used_memory_peak:62914560\r
used_memory_peak_human:60.00M\r
used_memory_peak_perc:83.33%\r
used_memory_overhead:10485760\r
used_memory_dataset:41943040\r
mem_fragmentation_ratio:1.75\r
mem_fragmentation_bytes:26214400\r
maxmemory:67108864\r
maxmemory_human:64.00M\r
maxmemory_policy:allkeys-lru\r
# Stats\r
total_commands_processed:1000\r
instantaneous_ops_per_sec:150\r
total_net_input_bytes:1024\r
total_net_output_bytes:2048\r
rejected_connections:2\r
expired_keys:100\r
evicted_keys:5\r
keyspace_hits:900\r
keyspace_misses:100\r
# Replication\r
role:master\r
connected_slaves:0\r
# Persistence\r
rdb_changes_since_last_save:500\r
rdb_bgsave_in_progress:0\r
rdb_last_save_time:1718352000\r
rdb_last_bgsave_status:ok\r
rdb_last_bgsave_time_sec:2\r
aof_enabled:1\r
aof_rewrite_in_progress:0\r
aof_last_rewrite_time_sec:4\r
aof_last_bgrewrite_status:ok\r
aof_current_size:20480\r
# Keyspace\r
db0:keys=1234,expires=234,avg_ttl=60000\r
db1:keys=100,expires=10,avg_ttl=1000\r
`;

test("parseOptions reads Redis CLI flags", () => {
	const options = parseOptions([
		"--host",
		"redis.internal",
		"--port",
		"6380",
		"--db",
		"2",
		"--slow-threshold",
		"5000",
		"--max-slow-commands",
		"10",
		"--command",
		"health",
	]);

	assert.equal(options.host, "redis.internal");
	assert.equal(options.port, 6380);
	assert.equal(options.db, 2);
	assert.equal(options.slowCommandThreshold, 5000);
	assert.equal(options.maxSlowCommands, 10);
	assert.equal(options.command, "health");
});

test("parseRedisInfo parses INFO output and keyspaces", () => {
	const info = parseRedisInfo(SAMPLE_INFO);
	assert.equal(info.redisVersion, "7.2.5");
	assert.equal(info.connectedClients, 12);
	assert.equal(info.maxmemoryPolicy, "allkeys-lru");
	assert.equal(info.keyspaces.length, 2);
	assert.deepEqual(info.keyspaces[0], {
		db: 0,
		keys: 1234,
		expires: 234,
		avgTtl: 60000,
	});
});

test("parseSlowLogEntries normalizes slowlog rows", () => {
	const slowCommands = parseSlowLogEntries([
		[1, 1718500000, 12000, ["KEYS", "*"], "127.0.0.1:50000"],
	]);

	assert.equal(slowCommands[0]!.durationMs, 12);
	assert.equal(slowCommands[0]!.commandPreview, "KEYS *");
	assert.equal(slowCommands[0]!.clientAddr, "127.0.0.1:50000");
});
