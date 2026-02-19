---
name: commerce-cloud
description: Queries Salesforce Commerce Cloud via OCAPI Shop API. Use for categories, products, and product search.
---

# Commerce Cloud OCAPI Shop API

## Quick start

```bash
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='categories/root?levels=2'
```

## Explore

Start broad, then drill down to find what you need:

```bash
# Category tree — find category IDs
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='categories/root?levels=3'

# Products in a category
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='product_search?refine_1=cgid%3Dmens-suits&count=5'

# Product detail with variations and images
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='products/PRODUCT_ID?expand=variations,images'

# Search by keyword
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='product_search?q=lazio&count=5'
```

## Scripts

**query.js** — read-only GET requests

```bash
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='categories/root?levels=2'
bun --env-file=.claude/skills/commerce-cloud/.env .claude/skills/commerce-cloud/scripts/query.js --path='products/PRODUCT_ID?expand=variations,images' --site=GBR
```

Options:

- `--path=<api-path>` — OCAPI Shop API path (required)
- `--site=<site-id>` — site ID (default: USA)

## Custom scripts

Write a custom script for: multi-step operations or data transformation.

Env vars: `SFCC_INSTANCE_HOSTNAME`, `SFCC_CLIENT_ID`, `SFCC_OCAPI_VERSION`.

## Reference

### Site IDs

| ID    | Market         |
| ----- | -------------- |
| `INT` | International  |
| `USA` | United States  |
| `GBR` | United Kingdom |
| `DEU` | Germany        |
| `NLD` | Netherlands    |
| `BEL` | Belgium        |
| `FRA` | France         |
| `ITA` | Italy          |
| `ESP` | Spain          |
| `AUT` | Austria        |
| `CHE` | Switzerland    |
| `SWE` | Sweden         |
| `DNK` | Denmark        |
| `FIN` | Finland        |
| `NOR` | Norway         |
| `POL` | Poland         |
| `CAN` | Canada         |
| `AUS` | Australia      |
| `SGP` | Singapore      |
| `HKG` | Hong Kong      |
| `MAC` | Macau          |
| `CHN` | China          |
| `IND` | India          |
| `MEX` | Mexico         |

### Useful parameters

- `?levels=N` — category depth
- `?expand=variations,images` — include extra product data
- `?count=N&start=N` — pagination
- `?refine_1=cgid%3D{id}` — filter by category (URL-encode the `=`)
