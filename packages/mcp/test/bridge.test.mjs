import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { test } from "node:test";

import {
  DEFAULT_ENDPOINT,
  credentialsPath,
  endpointFrom,
  forward,
  main,
  messagesFromEventStream,
  resolveKey,
} from "../lib/bridge.mjs";

const KEY = `bc_live_${"A1b2C3d4".repeat(5)}xyz`;
const saved = (extra = {}) => JSON.stringify({ version: 1, api_key: KEY, key_id: "k", key_prefix: "A1b2C3d4", workspace: { id: "w", name: "Main" }, scopes: [], expires_at: null, created_at: "2026-11-05T00:00:00Z", ...extra });

function fakeResponse(status, body, headers = {}) {
  const map = new Map(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]));
  return { status, ok: status >= 200 && status < 300, headers: { get: (k) => map.get(k.toLowerCase()) ?? null }, text: async () => body };
}

test("the key format is Bolt Claw's", () => {
  assert.equal(KEY.length, "bc_live_".length + 43);
});

test("reads BOLTCLAW_API_KEY first, then the CLI's saved sign-in, and refuses anything else", () => {
  assert.deepEqual(resolveKey({ env: { BOLTCLAW_API_KEY: ` ${KEY} ` } }), { key: KEY, source: "BOLTCLAW_API_KEY" });
  assert.match(resolveKey({ env: { BOLTCLAW_API_KEY: "sk_live_nope" } }).error, /not a Bolt Claw key/);

  const env = { APPDATA: "C:/Users/x/AppData/Roaming" };
  const path = credentialsPath(env, "win32");
  assert.match(path, /boltclaw[\\/]credentials\.json$/);
  const fromFile = resolveKey({ env, platform: "win32", readFile: (p) => (p === path ? saved() : "") });
  assert.deepEqual(fromFile, { key: KEY, source: path });

  assert.match(resolveKey({ env, platform: "win32", readFile: () => { throw new Error("ENOENT"); } }).error, /Not signed in/);
  assert.match(resolveKey({ env, platform: "win32", readFile: () => saved({ version: 2 }) }).error, /cannot be read/);
  const expired = resolveKey({ env, platform: "win32", readFile: () => saved({ expires_at: "2026-01-01T00:00:00Z" }), now: Date.parse("2026-11-05") });
  assert.match(expired.error, /expired/);
});

test("follows the XDG rule off Windows", () => {
  assert.equal(credentialsPath({ XDG_CONFIG_HOME: "/cfg" }, "linux").replace(/\\/g, "/"), "/cfg/boltclaw/credentials.json");
  assert.match(credentialsPath({ XDG_CONFIG_HOME: "relative" }, "linux").replace(/\\/g, "/"), /\/\.config\/boltclaw\/credentials\.json$/);
});

test("talks to the hosted server unless told otherwise, and never over plain http to another host", () => {
  assert.equal(endpointFrom({}), DEFAULT_ENDPOINT);
  assert.equal(DEFAULT_ENDPOINT, "https://mcp.boltclaw.ai/mcp");
  assert.equal(endpointFrom({ BOLTCLAW_MCP_URL: "http://localhost:3406/mcp" }), "http://localhost:3406/mcp");
  assert.throws(() => endpointFrom({ BOLTCLAW_MCP_URL: "http://evil.example/mcp" }), /https/);
  assert.throws(() => endpointFrom({ BOLTCLAW_MCP_URL: "https://u:p@mcp.boltclaw.ai/mcp" }), /credentials/);
});

test("reads every message out of a server-sent events body", () => {
  const body = 'event: message\ndata: {"jsonrpc":"2.0","id":1,"result":{}}\n\n: keep-alive\n\ndata: [{"jsonrpc":"2.0","id":2,"result":{}}]\n\n';
  assert.deepEqual(messagesFromEventStream(body).map((m) => m.id), [1, 2]);
});

test("forwards a message with the key and MCP's headers, and remembers the protocol version", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    return fakeResponse(200, JSON.stringify({ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2025-06-18" } }), { "content-type": "application/json" });
  };
  const session = {};
  const answers = await forward({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }, { key: KEY, session, fetchImpl });
  assert.equal(answers[0].result.protocolVersion, "2025-06-18");
  assert.equal(calls[0].url, DEFAULT_ENDPOINT);
  assert.equal(calls[0].init.headers.Authorization, `Bearer ${KEY}`);
  assert.match(calls[0].init.headers.Accept, /text\/event-stream/);
  assert.equal(session.protocolVersion, "2025-06-18");

  await forward({ jsonrpc: "2.0", id: 2, method: "tools/list" }, { key: KEY, session, fetchImpl });
  assert.equal(calls[1].init.headers["MCP-Protocol-Version"], "2025-06-18");
});

test("a notification's 202 writes nothing; a refusal becomes a JSON-RPC error for the request only", async () => {
  const accepted = await forward({ jsonrpc: "2.0", method: "notifications/initialized" }, { key: KEY, fetchImpl: async () => fakeResponse(202, "") });
  assert.deepEqual(accepted, []);

  const refused = await forward({ jsonrpc: "2.0", id: 7, method: "tools/list" }, { key: KEY, fetchImpl: async () => fakeResponse(401, "{}") });
  assert.equal(refused[0].id, 7);
  assert.match(refused[0].error.message, /refused the key/);

  const down = await forward({ jsonrpc: "2.0", id: 8, method: "tools/list" }, { key: KEY, fetchImpl: async () => { throw new Error("offline"); } });
  assert.match(down[0].error.message, /Could not reach/);
});

test("never puts the key in an answer", async () => {
  const answers = await forward({ jsonrpc: "2.0", id: 9, method: "x" }, { key: KEY, fetchImpl: async () => fakeResponse(500, '{"error":"boom"}') });
  assert.ok(!JSON.stringify(answers).includes(KEY));
});

test("without a key, answers every request at once with how to sign in, and calls nobody", async () => {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  let out = "";
  let err = "";
  stdout.on("data", (c) => (out += c));
  stderr.on("data", (c) => (err += c));
  const done = main([], { env: { APPDATA: "Z:/none", XDG_CONFIG_HOME: "/nonexistent-boltclaw" }, stdin, stdout, stderr });
  stdin.end('{"jsonrpc":"2.0","id":1,"method":"initialize","params":{}}\nnot json\n');
  assert.equal(await done, 0);
  const lines = out.trim().split("\n").map((l) => JSON.parse(l));
  assert.equal(lines[0].id, 1);
  assert.match(lines[0].error.message, /Not signed in|cannot be read/);
  assert.equal(lines[1].error.code, -32700);
  assert.match(err, /boltclaw-mcp:/);
});

test("--version and --help need nothing", async () => {
  let out = "";
  const stdout = { write: (s) => (out += s) };
  assert.equal(await main(["--version"], { stdout }), 0);
  assert.match(out, /^\d+\.\d+\.\d+\n$/);
  out = "";
  assert.equal(await main(["--help"], { stdout }), 0);
  assert.match(out, /mcp\.boltclaw\.ai/);
});
