#!/usr/bin/env bun

/**
 * Executes a read-only GET request against the SFCC OCAPI Shop API.
 * Outputs JSON to stdout, logs to stderr.
 **/

const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" "));
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`);
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`);
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`);
const data = (s) => write(`\x1b[2m${s}\x1b[0m`);

const flag = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length)

if (!flag('path')) {
  error(`Missing arguments. Usage:

  bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path=<api-path> [--site=<site-id>]

Options:
  --path=<string>   OCAPI Shop API path (required)
  --site=<string>   Site ID (default: USA)

Examples:
  bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='categories/root?levels=2'
  bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='product_search?q=lazio&count=5' --site=NLD`)
  process.exit(1)
}

const SFCC_HOSTNAME = process.env.SFCC_INSTANCE_HOSTNAME
const SFCC_CLIENT_ID = process.env.SFCC_CLIENT_ID
const SFCC_VERSION = process.env.SFCC_OCAPI_VERSION || 'v24_5'

if (!SFCC_HOSTNAME || !SFCC_CLIENT_ID) {
  error('Missing SFCC_INSTANCE_HOSTNAME or SFCC_CLIENT_ID environment variables')
  process.exit(1)
}

async function ocapi(path, site = 'USA') {
  const url = `https://${SFCC_HOSTNAME}/s/${site}/dw/shop/${SFCC_VERSION}/${path}`
  data(`GET ${url}`)
  const res = await fetch(url, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json', 'x-dw-client-id': SFCC_CLIENT_ID },
  })
  if (!res.ok) throw new Error(`OCAPI ${res.status}: ${await res.text()}`)
  return res.json()
}

try {
  const result = await ocapi(flag('path'), flag('site') || 'USA')
  success('Query executed successfully')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  error(err.message)
  process.exit(1)
}
