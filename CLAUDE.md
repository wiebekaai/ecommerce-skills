## Custom scripts

Write and perform Bun scripts. Used for combining skills, bulk operations, and automation.

### Files

- Write scripts in `tmp/YYYYMMDD-HHmm-*.js` unless told otherwise. Propose deletion at end of session.
- Check for existing scripts to reuse or reference
- For bulk operations, use `.jsonl`. Stream results to file.
- For big jobs, use intermediate files between steps instead of piping directly. Allows rerunning steps independently.

```bash
# run with env, redirect output
bun --env-file=.claude/skills/shopify/.env tmp/20260215-1700-export-products.js > tmp/20260215-1700-products.jsonl

# pipe between scripts
bun ... tmp/20260215-1700-export.js | bun ... tmp/20260215-1710-transform.js > tmp/20260215-1710-output.jsonl

# or read from file
bun --env-file=.claude/skills/sanity/.env tmp/20260215-1710-import.js < tmp/20260215-1700-products.jsonl
```

### Style

- Use Bun APIs: `Bun.file()`, `Bun.write()`, `Bun.spawn()`, `Bun.$`
- Comments in multi-line `/** **/` blocks
- Include usage instructions and why the script exists
- For mutations, default to dry-runs and provide `--apply`
- Tone: no emojis, concise, simple words, confident, direct, short sentences, sentence case

### Output

Prefer JSON for data output. Use `.jsonl` for bulk/streaming, `.json` for single results.

### Logging

Pipe-friendly `stdout` for output, `stderr` for logs. Sentence case for all log messages. Log progress as items completed out of total, say what was done (e.g. `400/2000 product descriptions generated`).

```js
const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" ")); // Progress, status updates
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`); // Final success message
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`); // Recoverable issues
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`); // Final failure message
const data = (o) => write(`\x1b[2m${JSON.stringify(o)}\x1b[0m`); // Structured data below a log/success line
```

### AI tasks

Use `@anthropic-ai/claude-agent-sdk` for AI tasks. No concurrency limits. Group up to 20 items per prompt. Log cost and token usage.

- Stream in from stdin, fire batches as they fill, write results to stdout as they arrive
- Enforce strict schemas — use `minItems`/`maxItems` when array length is known
- Keep output schemas minimal — only fields the AI generates

```js
import { query } from "@anthropic-ai/claude-agent-sdk";

async function run(prompt, schema) {
  let result = null;
  for await (const message of query({
    prompt,
    options: {
      model: "haiku", // Or 'sonnet', 'opus'
      maxTurns: 5, // Structured output uses internal tool_use turns
      allowedTools: [], // No tools for pure text generation
      outputFormat: { type: "json_schema", schema },
      systemPrompt: "...",
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env: { ...process.env, CLAUDECODE: "" }, // Required inside Claude Code sessions
    },
  })) {
    if (message.type === "result") {
      result = message;
      if (message.subtype !== "success") {
        throw new Error(`${message.subtype}: ${message.errors?.join(", ")}`);
      }
    }
  }
  return result; // { structured_output, usage, total_cost_usd }
}
```
