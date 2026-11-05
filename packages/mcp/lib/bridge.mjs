// @boltclaw/mcp : Bolt Claw's hosted MCP server, for MCP clients that only start local servers.
//
// WHAT THIS IS. A stdio bridge: it reads JSON-RPC messages from stdin, sends each one to the hosted
// server at https://mcp.boltclaw.ai/mcp, and writes the answers to stdout. It has no tools of its
// own and no copy of any: every tool, permission, approval and limit is the hosted server's, so a
// client that runs this gets exactly what a client connected to the hosted server gets.
//
// THE KEY. The hosted server accepts a Bolt Claw API key as its bearer token. This bridge sends the
// key from BOLTCLAW_API_KEY, or else the one `npx @boltclaw/cli login` saved (the same file the
// CLI reads). It never prints a key, never writes one, and sends it only to the hosted server.
// Clients that support remote MCP servers should connect to https://mcp.boltclaw.ai/mcp directly
// instead: they sign in with OAuth and never handle a key at all.
//
// No dependencies: Node 18.17 or later (global fetch).

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join } from "node:path";
import { createInterface } from "node:readline";

export const VERSION = "1.0.0";
export const DEFAULT_ENDPOINT = "https://mcp.boltclaw.ai/mcp";
/** `bc_live_` + 43 base62 characters, as Bolt Claw issues them. */
export const KEY_FORMAT = /^bc_live_[0-9A-Za-z]{43}$/;

const SIGN_IN =
  "Run `npx @boltclaw/cli login` once, or set BOLTCLAW_API_KEY to a key from Bolt Claw's Settings, Developers. " +
  `Or connect your client to ${DEFAULT_ENDPOINT} directly: it signs you in with OAuth and needs no key.`;

/** Where `@boltclaw/cli login` saves its key: the same rule as the CLI's own `credentialsPath()`. */
export function credentialsPath(env = process.env, platform = process.platform) {
  if (platform === "win32") {
    const appData = env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "boltclaw", "credentials.json");
  }
  const xdg = env.XDG_CONFIG_HOME;
  const base = xdg && isAbsolute(xdg) ? xdg : join(homedir(), ".config");
  return join(base, "boltclaw", "credentials.json");
}

/**
 * The key to send, and where it came from: `{ key, source }`, or `{ error }` with a sentence for a
 * person. An explicit BOLTCLAW_API_KEY wins over the saved sign-in, as it does in the CLI.
 */
export function resolveKey({ env = process.env, platform = process.platform, readFile = readFileSync, now = Date.now() } = {}) {
  const explicit = (env.BOLTCLAW_API_KEY ?? "").trim();
  if (explicit) {
    return KEY_FORMAT.test(explicit)
      ? { key: explicit, source: "BOLTCLAW_API_KEY" }
      : { error: "BOLTCLAW_API_KEY is set but is not a Bolt Claw key (bc_live_ and 43 letters and digits)." };
  }
  const path = credentialsPath(env, platform);
  let saved;
  try {
    saved = JSON.parse(readFile(path, "utf8"));
  } catch {
    return { error: `Not signed in to Bolt Claw. ${SIGN_IN}` };
  }
  if (!saved || saved.version !== 1 || typeof saved.api_key !== "string" || !KEY_FORMAT.test(saved.api_key)) {
    return { error: `The saved sign-in at ${path} cannot be read. ${SIGN_IN}` };
  }
  if (saved.expires_at && Date.parse(saved.expires_at) <= now) {
    return { error: `The saved Bolt Claw sign-in expired on ${saved.expires_at}. ${SIGN_IN}` };
  }
  return { key: saved.api_key, source: path };
}

/** The server to talk to: BOLTCLAW_MCP_URL for testing (https, or http on localhost), else the hosted one. */
export function endpointFrom(env = process.env) {
  const raw = (env.BOLTCLAW_MCP_URL ?? "").trim();
  if (!raw) return DEFAULT_ENDPOINT;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("BOLTCLAW_MCP_URL is not a URL.");
  }
  const loopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("BOLTCLAW_MCP_URL must be https (http is allowed only for localhost).");
  }
  if (url.username || url.password || url.hash) throw new Error("BOLTCLAW_MCP_URL must not carry credentials or a fragment.");
  return url.toString();
}

/** Every JSON-RPC message in a server-sent events body: each event's `data:` lines, joined. */
export function messagesFromEventStream(text) {
  const out = [];
  for (const block of text.replace(/\r\n/g, "\n").split(/\n\n+/)) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data.trim()) continue;
    try {
      const parsed = JSON.parse(data);
      out.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch {
      // Not JSON-RPC: a comment or keep-alive. Nothing to pass on.
    }
  }
  return out;
}

const isRequest = (message) => message && typeof message === "object" && !Array.isArray(message) && "id" in message && "method" in message;

function failure(id, message) {
  return { jsonrpc: "2.0", id, error: { code: -32000, message } };
}

/** The answer for each request in `message` (one message or a batch) when the call itself failed. */
function failuresFor(message, sentence) {
  const list = Array.isArray(message) ? message : [message];
  return list.filter(isRequest).map((m) => failure(m.id, sentence));
}

function sentenceFor(status, body) {
  let said = "";
  try {
    const parsed = JSON.parse(body);
    said = typeof parsed?.error === "string" ? parsed.error : typeof parsed?.error?.message === "string" ? parsed.error.message : "";
  } catch {
    // Not JSON; the status says enough.
  }
  if (status === 401) return `Bolt Claw refused the key (401). ${SIGN_IN}`;
  return `Bolt Claw's MCP server answered ${status}${said ? `: ${said}` : "."}`;
}

/**
 * Send one stdin message (or batch) to the server and return the messages to write to stdout.
 * `session` carries what the server told us to send back: its protocol version and any session id.
 */
export async function forward(message, { key, endpoint = DEFAULT_ENDPOINT, session = {}, fetchImpl = fetch } = {}) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "User-Agent": `boltclaw-mcp/${VERSION}`,
  };
  if (key) headers.Authorization = `Bearer ${key}`;
  if (session.protocolVersion) headers["MCP-Protocol-Version"] = session.protocolVersion;
  if (session.id) headers["Mcp-Session-Id"] = session.id;

  let response;
  try {
    response = await fetchImpl(endpoint, { method: "POST", headers, body: JSON.stringify(message) });
  } catch {
    return failuresFor(message, `Could not reach Bolt Claw's MCP server at ${endpoint}. Check the connection and try again.`);
  }
  const sessionId = response.headers.get("mcp-session-id");
  if (sessionId) session.id = sessionId;
  if (response.status === 202 || response.status === 204) return [];

  const body = await response.text();
  if (!response.ok) return failuresFor(message, sentenceFor(response.status, body));

  const type = (response.headers.get("content-type") ?? "").toLowerCase();
  let answers;
  if (type.includes("text/event-stream")) {
    answers = messagesFromEventStream(body);
  } else {
    try {
      const parsed = JSON.parse(body);
      answers = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return failuresFor(message, "Bolt Claw's MCP server sent an answer that is not JSON.");
    }
  }
  // Remember the version the server chose, and send it on every later request (MCP's rule).
  for (const answer of answers) {
    const version = answer?.result?.protocolVersion;
    if (typeof version === "string" && isRequest(message) && message.method === "initialize") session.protocolVersion = version;
  }
  return answers;
}

const HELP = `boltclaw-mcp ${VERSION}

Bolt Claw's hosted MCP server (${DEFAULT_ENDPOINT}) for MCP clients that only
start local servers. Every tool, permission and approval is the hosted server's.

Sign in once:  npx @boltclaw/cli login     (or set BOLTCLAW_API_KEY)
Client config: { "command": "npx", "args": ["-y", "@boltclaw/mcp"] }

If your client supports remote MCP servers, connect it to ${DEFAULT_ENDPOINT}
instead: it signs you in with OAuth and needs no key.
Docs: https://boltclaw.ai/docs/mcp
`;

export async function main(argv = process.argv.slice(2), { env = process.env, stdin = process.stdin, stdout = process.stdout, stderr = process.stderr } = {}) {
  if (argv.includes("--help") || argv.includes("-h")) {
    stdout.write(HELP);
    return 0;
  }
  if (argv.includes("--version") || argv.includes("-v")) {
    stdout.write(`${VERSION}\n`);
    return 0;
  }

  let endpoint;
  try {
    endpoint = endpointFrom(env);
  } catch (err) {
    stderr.write(`boltclaw-mcp: ${err.message}\n`);
    return 2;
  }
  const resolved = resolveKey({ env });
  if (resolved.error) stderr.write(`boltclaw-mcp: ${resolved.error}\n`);

  const session = {};
  const pending = new Set();
  const write = (messages) => {
    for (const m of messages) stdout.write(`${JSON.stringify(m)}\n`);
  };

  const lines = createInterface({ input: stdin, crlfDelay: Infinity });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      write([{ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error." } }]);
      continue;
    }
    if (resolved.error) {
      // Without a key every call would be refused; say why at once instead.
      write(failuresFor(message, resolved.error));
      continue;
    }
    const job = forward(message, { key: resolved.key, endpoint, session }).then(write);
    pending.add(job);
    job.finally(() => pending.delete(job));
  }
  await Promise.allSettled([...pending]);
  return 0;
}
