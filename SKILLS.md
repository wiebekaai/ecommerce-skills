# Skills Architecture

## Directory Layout

```
.claude/skills/<name>/
├── SKILL.md            # Skill definition (Claude reads this)
├── .env                # Actual secrets (gitignored)
├── .env.example        # Template with empty values
└── scripts/
    └── <operation>.js  # One script per operation type
```

## SKILL.md Structure

```markdown
---
name: <skill-name>
description: <one-liner for skill matching>
---

# Title

## Quick start

<!-- Copy-paste bun command with --env-file flag -->

## Explore

<!-- Discovery queries to learn what's available -->

## Scripts

<!-- Each script documented: purpose, flags, usage examples -->

## Reference

<!-- API-specific details: pagination, types, setup links -->

## Rules

<!-- Behavioral guardrails: dry-run defaults, no bun -e, etc. -->
```

The `description` in frontmatter is what Claude uses for skill matching — make it precise about when to trigger.

## Script Conventions

- **One script per operation type** — `query.js` for reads, `mutation.js` for writes, separate scripts for different API surfaces
- **Invocation**: `bun --env-file=.claude/skills/<name>/.env .claude/skills/<name>/scripts/<script>.js --flag=value`
- **Shared helpers inlined in every script**: `flag()` for `--name=value` parsing, `c` object for ANSI colors
- **Output discipline**: JSON to stdout (pipe-friendly), status/errors to stderr
- **Safe defaults**: mutations dry-run unless `--apply`, read-only APIs have no mutation script
- **Lean**: ~60–90 lines each

### Script Skeleton

```js
#!/usr/bin/env bun

// Usage: bun --env-file=.claude/skills/<name>/.env .claude/skills/<name>/scripts/query.js --flag=value

const flag = (name) => {
  const f = process.argv.find((a) => a.startsWith(`--${name}=`));
  return f ? f.split("=").slice(1).join("=") : undefined;
};

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
};

// Validate env
const required = process.env.SOME_VAR;
if (!required) {
  console.error(c.red("✘ Missing SOME_VAR"));
  process.exit(1);
}

// Parse flags
const query = flag("query");
if (!query) {
  console.error(c.red("✘ --query= is required"));
  process.exit(1);
}

// Execute
try {
  const res = await fetch(/* ... */);
  const json = await res.json();
  console.error(c.green("✔︎ Done"));
  console.log(JSON.stringify(json, null, 2));
} catch (e) {
  console.error(c.red(`✘ ${e.message}`));
  process.exit(1);
}
```

## Adding a New Skill

1. Create `.claude/skills/<name>/`
2. Add `.env.example` with required/optional vars and comments pointing to where to get credentials
3. Add `.env` with actual values (gitignored)
4. Write `scripts/query.js` (and `mutation.js` if writes are needed) using the skeleton above
5. Write `SKILL.md` with frontmatter + all sections
6. For custom/complex operations, document how to write `tmp/` scripts that reference the built-in scripts as patterns
