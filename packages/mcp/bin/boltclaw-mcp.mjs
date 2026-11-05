#!/usr/bin/env node
// @boltclaw/mcp: Bolt Claw's hosted MCP server for stdio-only MCP clients. See ../lib/bridge.mjs.
import { main } from "../lib/bridge.mjs";

main().then((code) => process.exit(code));
