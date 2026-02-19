---
name: sanity
description: Manages Sanity CMS content via API. Use for querying, analyzing, and modifying documents including drafts.
---

# Sanity content management

## Quick start

```bash
bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='*[_type == "homePage"][0]'
```

## Explore

**Always check the schema first** — type names are not guessable (e.g. `productPage`, not `product`). Use GROQ introspection to discover types:

```bash
bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='array::unique(*[]._type) | order(@)'
```

If a `schema.json` file is available (check `tmp/`), use it for field-level details:

```bash
# List all document types
jq '[.[].name] | sort' tmp/schema.json

# Fields for a specific type
jq '.[] | select(.name == "TYPE") | .fields[] | .name' tmp/schema.json

# Full field details (name, type, required)
jq '.[] | select(.name == "TYPE") | .fields[] | {name, type: .type.type, required: (.validation // [] | map(select(.flag == "presence")) | length > 0)}' tmp/schema.json
```

## Scripts

**query.js** — GROQ queries

```bash
bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='*[_type == "homePage"][0]'
bun --env-file=.claude/skills/sanity/.env .claude/skills/sanity/scripts/query.js --query='*[_type == "page"][0...5] { _id, title }' --dataset=acceptance
```

Options:
- `--query=<groq>` — GROQ query string (required)
- `--params=<json>` — query parameters (optional)
- `--dataset=<name>` — dataset name (default: development)
- `--perspective=<name>` — raw, previewDrafts, or published (default: raw)

## Custom scripts

Write a custom script for: pagination, data transformation, or mutations.

Env vars: `SANITY_PROJECT_ID`, `SANITY_API_TOKEN`.

## Reference

### Client setup

```js
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: process.env.SANITY_PROJECT_ID,
  dataset: 'development', // or 'acceptance'
  apiVersion: '2026-01-01',
  token: process.env.SANITY_API_TOKEN,
  useCdn: false,
  perspective: 'raw', // or 'previewDrafts', 'published'
});
```

### Perspectives

| Perspective | Use case |
|-------------|----------|
| `raw` | See exact documents including `drafts.*` IDs |
| `previewDrafts` | Drafts overlay published (like preview mode) |
| `published` | Published documents only |

### Operations

```js
// Query
const docs = await client.fetch('*[_type == "homePage"]');

// Delete
await client.delete('drafts.some-id');

// Bulk delete (single transaction for circular refs)
const tx = client.transaction();
ids.forEach(id => tx.delete(id));
await tx.commit();

// Patch
await client.patch('doc-id').set({ field: 'value' }).commit();

// Create
await client.createOrReplace({ _id: 'my-id', _type: 'myType', title: 'Doc' });
```

### Draft IDs

- Published: `my-doc-id`
- Draft: `drafts.my-doc-id`

References should use base ID (`my-doc-id`). If a draft references `drafts.X` explicitly, preview mode breaks.

### Internationalized fields

```groq
*[_type == "page"] { "title": title[_key == "en"][0].value }
```

## Rules

- Confirm before mutations — show dataset, count, sample.
- Single transaction for circular references.
