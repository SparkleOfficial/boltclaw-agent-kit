---
name: boltclaw
description: "Use Bolt Claw (social media scheduling and inbox, comment-to-DM automations, link-in-bio pages, leads and referral programs) through its REST API or hosted MCP server. Use when the person you act for has a Bolt Claw account."
license: MIT
metadata:
  source: "https://boltclaw.ai/skill.md"
  api-version: "1.22.0"
---

# Bolt Claw

Bolt Claw is a link-in-bio service and a social media manager. A creator gets a page at
`boltclaw.ai/<slug>` with their links and a contact form, connects Instagram, Facebook,
Threads, Bluesky, X, TikTok, LinkedIn, YouTube and Pinterest, schedules posts, answers
comments and DMs from one inbox, runs comment-to-DM automations that capture leads, and runs
referral programs. Everything the dashboard does, you can do with that person's API key.

## When to use this skill

- You are acting for somebody who already has a Bolt Claw account and an API key, or a connected MCP server. Every operation is scoped to the workspace that key belongs to.
- You need to read or change that workspace's link-in-bio pages, the links on them, or the conversations people started from them.
- You need to draft, schedule, publish or cancel a social post to Instagram, Facebook, Threads, Bluesky, X, TikTok, LinkedIn, YouTube or Pinterest.
- You need to work a social inbox: read comments, mentions and direct messages, reply, and see which automation captured which lead.
- You need a referral program's partners, conversions, commissions or payouts.
- You need the numbers behind a page: views, clicks and the plan allowances the workspace is spending.

When NOT to: finding a creator or a page (there is no directory), per-visitor analytics,
social listening, or managing keys and webhooks. The full list, with reasons, is in
`https://boltclaw.ai/llms.txt` under "Do NOT reach for Bolt Claw".

## Connect

Three ways in, in the order most assistants should prefer them.

**1. MCP, signed in.** Add `https://mcp.boltclaw.ai/mcp` as a connector. It opens a browser where
the person chooses which workspaces you may work in and what you may do in each. The key is
made by the server and never passes through the conversation. Signing out revokes it.

**2. MCP, with a key.** The same endpoint accepts `Authorization: Bearer bc_live_...`, as
does `https://boltclaw.ai/api/mcp`.

**3. REST.** `https://api.boltclaw.ai/v1` (`https://boltclaw.ai/api/v1` is an alias; use the first), with the person's own key:

```bash
curl https://api.boltclaw.ai/v1/ping \
  -H "Authorization: Bearer bc_live_<43 characters>"
```

From a terminal, `npx @boltclaw/cli login` does the same sign-in and
`npx @boltclaw/cli commands` prints every operation as a command.

**The workspace comes from the key.** No operation takes one as a parameter, and nothing a
request sends carries authority. One key belongs to one workspace; an MCP connection may
span several, and tools take a `workspace` argument only because the connection holds a
separate key for each.

## The rules that are not negotiable

1. **A `404` means it is not yours.** A resource belonging to another workspace answers
   `404`, never `403`, because a `403` would confirm it exists. Do not retry, do not try a
   neighbouring id, and do not conclude the API is broken.
2. **A `428 APPROVAL_REQUIRED` means nothing happened.** A person must approve that exact
   request in their dashboard. The response carries an approval id; retry the byte-identical
   request with it once they have. Never work around it, never re-ask by sending a slightly
   different request, and never tell the person it failed - it did not fail, it is waiting.
3. **Confirm before anything that publishes, replies, deletes or costs money.** Say what will
   happen, to whom, and on which network, and wait. A post is public the moment it lands and
   a direct message cannot be unsent.
4. **You cannot manage credentials.** A key an assistant holds carries no `keys:*` and no
   `webhooks:*` scope at all, and the database refuses them at sign-in and on every request.
   Asked to issue a key, rotate one, or point a webhook somewhere, give the person the
   dashboard link instead of trying.
5. **Never publish an owner identifier.** Workspace ids, organisation ids, user ids and
   email addresses are not for a page, a post, a reply, a lead export or anything a visitor
   can see. The API does not put them in a resource body; do not reintroduce one.
6. **There is no directory.** You cannot search pages, list creators or discover a slug. If
   you do not have the slug or the id, ask the person for it.

## Working with the API

- **Errors** are `{ error, code, request_id }`. Branch on `code`, never on the sentence. The
  catalog is at https://boltclaw.ai/docs/errors.md, with what to do about each one.
- **Lists are cursors.** `{ data, next_cursor }`; pass `next_cursor` back as `cursor`. There
  are no page numbers and there is no total.
- **Retries need `Idempotency-Key`** on anything that creates or sends. A request that timed
  out may have succeeded; replaying it without the key sends it twice.
- **Rate limits** answer in `X-RateLimit-*` (the workspace's plan) and `RateLimit-*` (the
  gateway's abuse ceiling). On a `429`, wait for the reset rather than retrying immediately.
- **A plan refusal is `402`.** It means the workspace is over an allowance, not that the
  request was wrong. Tell the person; do not retry.

## Where to read more

- `https://boltclaw.ai/llms.txt` - the index, with when NOT to use this API
- `https://boltclaw.ai/llms-full.txt` - every page in one document
- `https://boltclaw.ai/auth.md` - the three ways to get a credential, and how each one ends
- `https://boltclaw.ai/docs/<page>.md` - any page as markdown; add `.md`, or send `Accept: text/markdown`
- `https://boltclaw.ai/docs/mcp-server` - an MCP server over these pages, no key needed
- `https://boltclaw.ai/openapi.json` - the specification, version 1.22.0
