# Bolt Claw agent kit

Everything an AI agent needs to work with [Bolt Claw](https://boltclaw.ai): the hosted MCP
servers, skills for coding agents, an [Agent Plugin](https://agent-plugins.org) manifest, and a
stdio bridge for MCP clients that cannot connect to a remote server.

Bolt Claw is a social media manager (scheduling, the inbox of comments and DMs, comment-to-DM
automations and leads), a link-in-bio service and a referral platform, with a REST API at
`https://api.boltclaw.ai/v1`.

## Connect an assistant

| Server | Address | What it does |
| --- | --- | --- |
| Bolt Claw | `https://mcp.boltclaw.ai/mcp` | Acts in your workspace: posts, inbox, automations, leads, pages, referrals. OAuth sign-in in the browser; you choose the workspaces and permissions, and approve anything that publishes, deletes or costs money. |
| Bolt Claw documentation | `https://boltclaw.ai/docs/mcp-server` | Searches and reads the API documentation. Read-only, no sign-in. |

Both are Streamable HTTP. The documentation server is in the official MCP Registry as
`ai.boltclaw/docs`.

For a client that only starts local servers, use the bridge in [`packages/mcp`](packages/mcp)
(`npx -y @boltclaw/mcp`). It passes every message to the hosted server, so it adds no tools and
removes no safeguards.

## What is here

| Path | What it is |
| --- | --- |
| [`plugin.json`](plugin.json) | The Agent Plugin manifest (Agent Plugins 1.0.0). |
| [`mcp.json`](mcp.json) | The plugin's MCP servers: the two above. No credentials. |
| [`skills/boltclaw`](skills/boltclaw/SKILL.md) | Using Bolt Claw through the API or the MCP server: what needs a person's approval, and the rules that are not negotiable. |
| [`skills/boltclaw-referrals`](skills/boltclaw-referrals/SKILL.md) | Installing referral tracking in a product's own code, for a coding agent. |
| [`AGENTS.md`](AGENTS.md) | Instructions for AI coding agents working with Bolt Claw, or in this repository. |
| [`packages/mcp`](packages/mcp) | `@boltclaw/mcp`, the stdio bridge to the hosted server. |
| [`scripts/sync-skills.mjs`](scripts/sync-skills.mjs) | Refreshes the skills from the documents boltclaw.ai publishes. |

## Install the skills

```bash
npx skills add SparkleOfficial/boltclaw-agent-kit
```

## More

- Documentation: https://boltclaw.ai/docs/api
- The MCP server: https://boltclaw.ai/docs/mcp
- How an agent gets access: https://boltclaw.ai/auth.md
- Everything in one index: https://boltclaw.ai/llms.txt

MIT licensed. The Bolt Claw service itself is not open source; this repository holds the parts an
agent uses to reach it.
