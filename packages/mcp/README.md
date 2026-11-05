# @boltclaw/mcp

Bolt Claw's hosted MCP server, for MCP clients that can only start local (stdio) servers.

[Bolt Claw](https://boltclaw.ai) is a social media manager, a link-in-bio service and a referral
platform. Its MCP server lets an AI assistant schedule posts, answer comments and DMs, run
comment-to-DM automations, manage link-in-bio pages and run referral programs, with a person's
approval for anything that publishes, deletes or costs money.

**This package has no tools of its own.** It passes every message to the hosted server at
`https://mcp.boltclaw.ai/mcp` and passes the answers back, so every tool, permission, approval and
limit is the hosted server's.

## Use the hosted server directly if you can

If your client supports remote MCP servers (Claude, ChatGPT, Cursor, VS Code and most others do),
connect it to:

```
https://mcp.boltclaw.ai/mcp
```

It signs you in with OAuth in the browser, where you pick the workspaces and permissions. No key
ever touches the client.

## Otherwise: this bridge

Sign in once from a terminal. A browser opens, you approve, and the key is saved on your machine
(it never appears in the conversation):

```bash
npx @boltclaw/cli login
```

Then add the server to your client:

```json
{
  "mcpServers": {
    "boltclaw": {
      "command": "npx",
      "args": ["-y", "@boltclaw/mcp"]
    }
  }
}
```

You can set `BOLTCLAW_API_KEY` in the server's environment instead of signing in. An explicit key
wins over the saved sign-in. Create one under Settings, Developers in the dashboard, and keep it out
of any file you commit.

## What it sends where

- Each JSON-RPC message from your client goes to `https://mcp.boltclaw.ai/mcp`, with your key as
  the bearer token. Nothing goes anywhere else.
- It reads the key from `BOLTCLAW_API_KEY`, or else from the file `npx @boltclaw/cli login` saves
  (`%APPDATA%\boltclaw\credentials.json` on Windows, `~/.config/boltclaw/credentials.json`
  elsewhere). It never writes or prints a key.
- `npx @boltclaw/cli logout` revokes the key; the bridge then answers that you are not signed in.

Node 18.17 or later. No dependencies.

## Links

- Documentation: https://boltclaw.ai/docs/mcp
- The API: https://boltclaw.ai/docs/api
- Source: https://github.com/SparkleOfficial/boltclaw-agent-kit
