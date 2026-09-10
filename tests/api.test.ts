import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { RedisAnalyzer } from "../src/api";
import * as api from "../src/index";

test("the library entry point exports the analyzer and its types", () => {
	assert.equal(typeof api.RedisAnalyzer, "function");
	assert.equal(typeof api.parseRedisInfo, "function");
	assert.equal(typeof api.parseSlowLogEntries, "function");
	assert.equal(typeof api.computeHealthScore, "function");
	assert.equal(typeof api.ReportGenerator, "function");
	assert.equal(typeof api.MemoryAnalyzer, "function");
	assert.ok(Array.isArray(api.COMMANDS));
});

test("constructing an analyzer opens no connection", () => {
	// The point of the split entry points: importing and constructing must be inert, so a
	// consumer is never surprised by a connection attempt at import time.
	const analyzer = new RedisAnalyzer({ host: "203.0.113.1", port: 1 });
	assert.ok(analyzer instanceof RedisAnalyzer);
});

test("analyze reports a connection failure rather than hanging", async () => {
	const analyzer = new RedisAnalyzer({
		host: "127.0.0.1",
		// Nothing listens here.
		port: 1,
	});

	await assert.rejects(
		() => analyzer.analyze(),
		(error: Error) => {
			assert.match(error.message, /Cannot connect to Redis/);
			return true;
		},
	);

	await analyzer.close();
});

test("close is safe to call when never connected", async () => {
	const analyzer = new RedisAnalyzer();
	await analyzer.close();
	await analyzer.close();
});

test("a caller-supplied client is not disconnected by close", async () => {
	let quitCalls = 0;
	let disconnectCalls = 0;
	const fakeClient = {
		status: "ready",
		on: () => fakeClient,
		ping: async () => "PONG",
		connect: async () => undefined,
		quit: async () => {
			quitCalls++;
			return "OK";
		},
		disconnect: () => {
			disconnectCalls++;
		},
	};

	const analyzer = new RedisAnalyzer({
		client: fakeClient as never,
	});
	await analyzer.connect();
	await analyzer.close();

	assert.equal(quitCalls, 0, "close must not quit a client it does not own");
	assert.equal(disconnectCalls, 0);
});

test("generateReport honours the configured output directory", async () => {
	const outputDir = mkdtempSync(join(tmpdir(), "redis-api-"));
	const analyzer = new RedisAnalyzer({ outputDir });

	// A report is supplied, so no connection is needed.
	const report = {
		generatedAt: new Date(),
		host: "localhost",
		port: 6379,
		db: 0,
		healthScore: 90,
		metrics: {
			version: "7.4.0",
			mode: "standalone",
			uptimeDays: 1,
			connectedClients: 1,
			blockedClients: 0,
			maxClients: 10000,
			opsPerSec: 0,
			totalKeyCount: 0,
			keyspacesCount: 0,
			usedMemory: "1.00 MB",
			usedMemoryBytes: 1_048_576,
			maxMemory: "0 B",
			maxMemoryBytes: 0,
			evictionPolicy: "noeviction",
			hitRate: 100,
			totalCommandsProcessed: 10,
			rejectedConnections: 0,
			role: "master",
			connectedReplicas: 0,
		},
		memory: { status: "ok", usedMemoryBytes: 1, recommendations: [] },
		hitRate: {
			hitRate: 100,
			hits: 1,
			misses: 0,
			status: "ok",
			recommendations: [],
		},
		persistence: {
			rdbEnabled: true,
			aofEnabled: false,
			status: "ok",
			recommendations: [],
		},
		replication: {
			role: "master",
			connectedReplicas: 0,
			status: "ok",
			recommendations: [],
		},
		slowCommands: {
			total: 0,
			shown: 0,
			threshold: 10000,
			commands: [],
			recommendations: [],
		},
		keyspaces: [],
		config: {},
		recommendations: [],
	};

	const path = await analyzer.generateReport("json", report as never);

	assert.ok(
		path.startsWith(outputDir),
		`${path} should be inside ${outputDir}`,
	);
	const written = JSON.parse(readFileSync(path, "utf8"));
	assert.equal(written.healthScore ?? written.report?.healthScore, 90);

	await analyzer.close();
});
