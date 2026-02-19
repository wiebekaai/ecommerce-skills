---
name: shopify
description: Queries Shopify via Admin and Storefront GraphQL APIs. Use for products, collections, filters, inventory, and orders.
---

# Shopify GraphQL APIs

Admin API returns all products regardless of publication status. Storefront API only returns products published to its sales channel.

## Quick start

```bash
# Admin API
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query='{ shop { name } }'

# Storefront API
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/storefront-query.js --query='{ shop { name } }'
```

## Explore

Discover available types and fields using introspection:

```graphql
# List all queryable types
{ __schema { queryType { fields { name description } } } }

# Describe a type's fields
{ __type(name: "Product") { fields { name type { name kind ofType { name } } } } }

# List available mutations
{ __schema { mutationType { fields { name description } } } }
```

## Scripts

### Admin API

**query.js** — read operations

```bash
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query='{ shop { name } }'
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/query.js --query=./queries/products.graphql --variables='{"first": 10}'
```

**mutation.js** — write operations (dry run by default, `--apply` to execute)

```bash
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/mutation.js --query='mutation { ... }'           # dry run
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/mutation.js --query='mutation { ... }' --apply   # execute
```

### Storefront API

**storefront-query.js** — public storefront data

```bash
bun --env-file=.claude/skills/shopify/.env .claude/skills/shopify/scripts/storefront-query.js --query='{ shop { name } }'
```

All scripts accept:
- `--query=<string|path>` — GraphQL query string or path to `.graphql` file (required)
- `--variables=<json>` — JSON object with variables (optional)

## Custom scripts

Write a custom script for: pagination, multi-step queries, or complex mutations.

Env vars: `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_ADMIN_API_TOKEN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN`, `SHOPIFY_API_VERSION`.

### When to use each API

| Use case | API |
|----------|-----|
| Products, collections, inventory, orders | Admin API |
| Metafields (read/write) | Admin API |
| Collection filters (Search & Discovery) | Storefront API |
| Product recommendations | Storefront API |
| Cart and checkout | Storefront API |

### Pagination

Use `pageInfo { hasNextPage endCursor }` with cursor-based pagination. Always use the max page size (250).

### Storefront token

Storefront API uses `SHOPIFY_STOREFRONT_ACCESS_TOKEN` if set, otherwise falls back to `SHOPIFY_ADMIN_API_TOKEN`.

## Rules

- Before mutations, show the user what will change: operation, target resource(s), and field changes.
