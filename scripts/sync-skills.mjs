#!/usr/bin/env node
// Refresh the skills from the documents boltclaw.ai publishes, so this repository never says
// anything the site does not. Run from the repository root:  node scripts/sync-skills.mjs
//
//   skills/boltclaw/SKILL.md            <- https://boltclaw.ai/skill.md
//   skills/boltclaw-referrals/SKILL.md  <- https://boltclaw.ai/docs/referrals/install.md
//
// Each body is the published document without its own front matter; the front matter here is the
// Agent Skills format (name, description, license, metadata), which is what plugin clients and
// skills.sh read.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SKILLS = [
  {
    name: "boltclaw",
    source: "https://boltclaw.ai/skill.md",
    description:
      "Use Bolt Claw (social media scheduling and inbox, comment-to-DM automations, link-in-bio pages, leads and referral programs) through its REST API or hosted MCP server. Use when the person you act for has a Bolt Claw account.",
  },
  {
    name: "boltclaw-referrals",
    source: "https://boltclaw.ai/docs/referrals/install.md",
    description:
      "Install Bolt Claw referral tracking in a product's own code: capture referral codes, report signups and sales from the server, and test it end to end. Use when the person runs a Bolt Claw referral program and asks you to connect their product.",
  },
];

/** The document without a leading `---` front matter block. */
function body(markdown) {
  const text = markdown.replace(/\r\n/g, "\n");
  if (!text.startsWith("---\n")) return text.trimStart();
  const end = text.indexOf("\n---\n", 4);
  return end === -1 ? text : text.slice(end + 5).trimStart();
}

const quote = (s) => JSON.stringify(s);

for (const skill of SKILLS) {
  const res = await fetch(skill.source, { headers: { Accept: "text/markdown" } });
  if (!res.ok) throw new Error(`${skill.source} answered ${res.status}`);
  const text = await res.text();
  const version = /^version:\s*(\S+)/m.exec(text)?.[1] ?? /Version (\d+\.\d+\.\d+)/.exec(text)?.[1] ?? "unknown";
  const out = [
    "---",
    `name: ${skill.name}`,
    `description: ${quote(skill.description)}`,
    "license: MIT",
    "metadata:",
    `  source: ${quote(skill.source)}`,
    `  api-version: ${quote(version)}`,
    "---",
    "",
    body(text).trimEnd(),
    "",
  ].join("\n");
  const file = join(ROOT, "skills", skill.name, "SKILL.md");
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out);
  console.log(`wrote skills/${skill.name}/SKILL.md (${out.length} bytes, API ${version})`);
}
