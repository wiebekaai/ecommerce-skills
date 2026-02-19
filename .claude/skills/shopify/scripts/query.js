#!/usr/bin/env bun

/**
 * Executes a read-only GraphQL query against the Shopify Admin API.
 * Rejects mutations — use mutation.js for those.
 * Outputs JSON to stdout, logs to stderr.
 **/

const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" "));
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`);
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`);
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`);
const data = (s) => write(`\x1b[2m${s}\x1b[0m`);

const flag = name => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(`--${name}=`.length)

if (!flag('query')) {
  error(`Missing arguments. Usage:

  bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query=<query|file> [--variables=<json>]

Options:
  --query=<string|path>   GraphQL query string or path to .graphql file (required)
  --variables=<json>      JSON object with query variables (optional)

Examples:
  bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query='{ shop { name } }'
  bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query=./queries/products.graphql`)
  process.exit(1)
}

const apiToken = process.env.SHOPIFY_ADMIN_API_TOKEN
const apiVersion = process.env.SHOPIFY_API_VERSION
const storeDomain = process.env.SHOPIFY_STORE_DOMAIN

if (!apiToken || !apiVersion || !storeDomain) {
  error('Missing SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_API_VERSION, or SHOPIFY_STORE_DOMAIN environment variables')
  process.exit(1)
}

const endpoint = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`

async function executeQuery(query, variables = {}) {
  data(`POST ${endpoint}`)
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': apiToken,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(
      `Shopify API error: ${response.status} ${response.statusText}\n${text}`,
    )
  }

  const json = await response.json()
  if (json.errors)
    throw new Error(`GraphQL errors: ${JSON.stringify(json.errors)}`)
  return json.data
}

async function resolveQuery(queryArg) {
  const file = Bun.file(queryArg)
  if (await file.exists()) return file.text()
  return queryArg
}

const query = await resolveQuery(flag('query'))

// Reject mutations — use mutation.js instead
if (/^\s*mutation\b/i.test(query.trim())) {
  error('Mutations are not allowed in query.js. Use mutation.js instead.')
  process.exit(1)
}

const variables = flag('variables') ? JSON.parse(flag('variables')) : {}

try {
  const result = await executeQuery(query, variables)
  success('Query executed successfully')
  console.log(JSON.stringify(result, null, 2))
} catch (err) {
  error(err.message)
  process.exit(1)
}
