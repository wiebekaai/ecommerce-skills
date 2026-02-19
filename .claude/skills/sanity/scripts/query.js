#!/usr/bin/env bun

/**
 * Executes a GROQ query against the Sanity Content Lake.
 * Supports dataset and perspective selection.
 * Outputs JSON to stdout, logs to stderr.
 **/

import { createClient } from '@sanity/client'

const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" "));
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`);
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`);
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`);
const data = (s) => write(`\x1b[2m${s}\x1b[0m`);

const flag = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length)

if (!flag('query')) {
  error(`Missing arguments. Usage:

  bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query=<groq> [--dataset=<name>] [--perspective=<name>]

Options:
  --query=<string>        GROQ query (required)
  --params=<json>         JSON object with query parameters (optional)
  --dataset=<name>        Dataset name (default: development)
  --perspective=<name>    raw | previewDrafts | published (default: raw)

Examples:
  bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='*[_type == "homePage"][0]'
  bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='*[_type == "page"][0...5] { _id, title }' --dataset=acceptance`)
  process.exit(1)
}

const dataset = flag('dataset') || 'development'
const perspective = flag('perspective') || 'raw'

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset,
  apiVersion: '2026-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
  perspective,
})

data(`Sanity ${dataset} (${perspective})`)

const params = flag('params') ? JSON.parse(flag('params')) : {}

try {
  const result = await client.fetch(flag('query'), params)
  const count = Array.isArray(result) ? result.length : 1
  success('Found', count, Array.isArray(result) ? 'results' : 'result')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  error(err.message)
  process.exit(1)
}
