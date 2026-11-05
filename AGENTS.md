# AGENTS.md

Instructions for AI coding agents. The first part applies whenever you integrate a product with
Bolt Claw; the second when you change this repository.

## Working with Bolt Claw

- **Prefer the hosted MCP server** (`https://mcp.boltclaw.ai/mcp`) when you act for a person: they
  sign in with OAuth and choose what you may do, and you never handle a key.
- **Never print, log, commit or ask for an API key.** A person creates a key in the dashboard
  (Settings, Developers) and puts it in the server environment as `BOLTCLAW_API_KEY`. Write code
  that reads the variable, and add its name, never its value, to `.env.example`.
- **Every request is scoped by the key.** The workspace comes from the key; no operation takes a
  workspace id. A key never does more than the person who made it can do now.
- **`428 APPROVAL_REQUIRED` means nothing happened.** A person must approve that exact request.
  Show them the link from the response, then send the identical request again, byte for byte, with
  the approval id in the `BoltClaw-Approval` header.
- **Retry a `POST` with the same `Idempotency-Key`.** A repeated request is never done twice.
- **Branch on `code`, never on `error`.** Every error is `{ "error", "code", "request_id" }`; the
  catalog is https://boltclaw.ai/docs/errors.md.
- **Verify every webhook's signature** before trusting its body:
  https://boltclaw.ai/docs/webhooks.md.
- **Test without live effects** where you can: referral test sales, `"test": true` conversions,
  test webhook events, unpublished pages and draft posts. https://boltclaw.ai/docs/testing.md
  lists them, and what is real from the first call.
- To install referral tracking in a product, follow `skills/boltclaw-referrals/SKILL.md`.

Reference: https://boltclaw.ai/docs/api.md (every operation), https://boltclaw.ai/llms.txt (an
index of everything published for agents).

## Changing this repository

- The skills are copies of what boltclaw.ai publishes. Do not edit their bodies by hand: run
  `node scripts/sync-skills.mjs` and commit the result. Change only the front matter in that script.
- `plugin.json` and `mcp.json` follow Agent Plugins 1.0.0 (https://agent-plugins.org/specification):
  `plugin.json` takes only `$schema`, `name`, `version`, `description`, `author`, `homepage`,
  `repository`, `license`, `keywords`; `mcp.json` holds no credentials or secret headers.
- `packages/mcp` has no dependencies and must keep none. Test it with `npm test` in that folder.
  It sends messages only to the hosted server and never writes or prints a key.
- Keep every example on placeholders (`acme`, `jane@example.com`, `bc_live_...`).
