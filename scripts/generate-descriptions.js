#!/usr/bin/env bun

/**
 * Generate product descriptions using AI. Reads products from stdin (JSONL),
 * outputs products with generated descriptions to stdout (JSONL).
 *
 * Two descriptions per product:
 *   - description: short overview of materials and key features (1-2 sentences)
 *   - longDescription: practical details and specifications (1-2 sentences)
 *
 * Skips products that already have both descriptions, unless --overwrite.
 * Batches 20 products per AI prompt to reduce cost.
 *
 * Usage:
 *   cat products.jsonl | bun scripts/generate-descriptions.js > tmp/20260215-descriptions.jsonl
 *   cat products.jsonl | bun scripts/generate-descriptions.js --overwrite > tmp/20260215-descriptions.jsonl
 **/

import { query } from "@anthropic-ai/claude-agent-sdk";

const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" "));
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`);
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`);
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`);
const data = (o) => write(`\x1b[2m${JSON.stringify(o)}\x1b[0m`);

const overwrite = process.argv.includes("--overwrite");
const BATCH_SIZE = 20;

/** Build a flat object of all available product attributes for the prompt. */
function extractAttributes(product) {
  const mf = {};
  for (const m of product.metafields || []) {
    mf[m.key] = m.value;
  }

  return {
    id: product.id,
    title: product.title,
    productType: product.productType || null,
    vendor: product.vendor || null,
    tags: product.tags || [],
    existingDescription: product.description || null,
    existingLongDescription: mf.longDescription || null,
    /** Include all metafields so any product catalog works */
    metafields: mf,
  };
}

function needsGeneration(product) {
  if (overwrite) return true;
  const mf = {};
  for (const m of product.metafields || []) mf[m.key] = m.value;
  const hasDescription = product.description && product.description.trim().length > 0;
  const hasLong = mf.longDescription && mf.longDescription.trim().length > 0;
  return !hasDescription || !hasLong;
}

const SYSTEM_PROMPT = `You write product descriptions for an online store.

You produce two descriptions per product:

1. "description" — a short overview of the product's materials, composition, or key ingredients. 1-2 sentences. Focus on what the product is made of and what makes it notable.

2. "longDescription" — practical details like dimensions, specifications, or how to use the product. 1-2 sentences. Mention details a buyer would care about.

Style rules:
- Confident, direct tone
- No superlatives or marketing fluff ("perfect", "amazing", "must-have")
- No first/second person ("you", "we", "our")
- Short sentences, simple words
- If most attributes are missing, keep it minimal. One short sentence each. Do not invent details that aren't provided.

Examples:

Product: "Organic Cotton Crew Neck T-Shirt" (type: T-Shirts, tags: organic, cotton, basics)
description: "Made from 100% organic cotton with a soft, breathable feel. A durable everyday fabric that holds its shape wash after wash."
longDescription: "Regular fit crew neck with reinforced collar stitching and a straight hem. Works on its own or as a layering piece."

Product: "Stainless Steel Water Bottle 750ml" (type: Accessories, tags: drinkware, stainless-steel)
description: "Double-walled stainless steel with vacuum insulation. Keeps drinks cold for 24 hours or hot for 12."
longDescription: "750ml capacity with a leak-proof screw cap and wide mouth opening for easy cleaning. Fits standard cup holders."`;

function outputSchema(length) {
  return {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            longDescription: { type: "string" },
          },
          required: ["description", "longDescription"],
          additionalProperties: false,
        },
        minItems: length,
        maxItems: length,
      },
    },
    required: ["products"],
    additionalProperties: false,
  };
}

async function generateBatch(batch) {
  log(`Starting batch of ${batch.length} products`);
  const attrs = batch.map(extractAttributes);

  /**
   * Build a prompt line per product from whatever attributes are available.
   * Skips null/empty values so the AI only sees what exists.
   */
  const prompt = attrs
    .map((a, i) => {
      const lines = [`Product ${i + 1}: ${a.title}`];
      if (a.productType) lines.push(`Type: ${a.productType}`);
      if (a.vendor) lines.push(`Vendor: ${a.vendor}`);
      if (a.tags.length) lines.push(`Tags: ${a.tags.join(", ")}`);

      /** Include metafields as key-value pairs */
      for (const [key, value] of Object.entries(a.metafields)) {
        if (key === "longDescription") continue;
        if (value) lines.push(`${key}: ${value}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");

  let result = null;
  for await (const message of query({
    prompt: `Generate descriptions for these ${batch.length} products in order:\n\n${prompt}`,
    options: {
      model: "haiku",
      maxTurns: 5,
      allowedTools: [],
      outputFormat: { type: "json_schema", schema: outputSchema(batch.length) },
      systemPrompt: SYSTEM_PROMPT,
      permissionMode: "bypassPermissions",
      allowDangerouslySkipPermissions: true,
      env: { ...process.env, CLAUDECODE: "" },
    },
  })) {
    if (message.type === "result") {
      result = message;
      if (message.subtype !== "success") {
        throw new Error(`AI error: ${message.subtype}: ${message.errors?.join(", ")}`);
      }
    }
  }

  return {
    descriptions: result.structured_output.products,
    cost: result.total_cost_usd,
    tokens: result.usage,
  };
}

async function run() {
  const reader = Bun.stdin.stream().getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = 0;
  let skipped = 0;
  let totalCost = 0;
  let totalInput = 0;
  let totalOutput = 0;

  /** Collect products, fire batches as they fill, stream results to stdout */
  const pending = [];
  let total = 0;

  async function processBatch(products) {
    const { descriptions, cost, tokens } = await generateBatch(products);
    totalCost += cost || 0;
    totalInput += tokens?.input_tokens || 0;
    totalOutput += tokens?.output_tokens || 0;

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const desc = descriptions[i];
      console.log(JSON.stringify({
        id: product.id,
        handle: product.handle,
        title: product.title,
        description: desc.description,
        longDescription: desc.longDescription,
      }));
    }

    completed += products.length;
    log(`${completed}/${total} descriptions generated`);
  }

  log("Reading products from stdin...");

  /** Read stdin and dispatch batches as they fill */
  let batch = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newline;
    while ((newline = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!line) continue;

      const product = JSON.parse(line);
      if (!needsGeneration(product)) {
        skipped++;
        continue;
      }

      batch.push(product);
      total++;

      if (batch.length >= BATCH_SIZE) {
        log(`${total} products read, ${skipped} skipped, dispatching batch`);
        pending.push(processBatch(batch));
        batch = [];
      }
    }
  }

  /** Flush remaining products */
  if (batch.length > 0) {
    pending.push(processBatch(batch));
  }

  log(`${total} products to generate, ${skipped} skipped`);

  await Promise.all(pending);

  log(`Cost $${totalCost.toFixed(4)}, ${totalInput} input tokens, ${totalOutput} output tokens`);
  success(`${completed} descriptions generated`);
}

run().catch((err) => {
  error(err.message);
  process.exit(1);
});
