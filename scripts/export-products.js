#!/usr/bin/env bun

/**
 * Export all Shopify products with all fields and metafields.
 * Uses a two-pass approach to stay within query cost limits:
 *   1. Fetch products with scalar fields (50/page)
 *   2. For each product, fetch variants and metafields separately
 * Outputs one JSON object per line to stdout (JSONL).
 *
 * Usage:
 *   bun --env-file=.claude/skills/shopify/.env scripts/export-products.js > products.jsonl
 **/

const write = (s) => Bun.stderr.write(s + "\n");
const log = (...args) => write(args.join(" "));
const success = (...args) => write(`\x1b[32m✔︎\x1b[0m ${args.join(" ")}`);
const warning = (...args) => write(`\x1b[33m⚠\x1b[0m ${args.join(" ")}`);
const error = (...args) => write(`\x1b[31m✘\x1b[0m ${args.join(" ")}`);
const data = (o) => write(`\x1b[2m${JSON.stringify(o)}\x1b[0m`);

const apiToken = process.env.SHOPIFY_ADMIN_API_TOKEN;
const apiVersion = process.env.SHOPIFY_API_VERSION;
const storeDomain = process.env.SHOPIFY_STORE_DOMAIN;

if (!apiToken || !apiVersion || !storeDomain) {
  error("Missing SHOPIFY_ADMIN_API_TOKEN, SHOPIFY_API_VERSION, or SHOPIFY_STORE_DOMAIN");
  process.exit(1);
}

const endpoint = `https://${storeDomain}/admin/api/${apiVersion}/graphql.json`;

async function shopify(query, variables = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": apiToken,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Shopify API ${response.status}: ${text}`);
  }

  const json = await response.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors)}`);

  const cost = json.extensions?.cost;
  if (cost?.throttleStatus?.currentlyAvailable < 100) {
    const wait = Math.ceil(cost.requestedQueryCost / cost.throttleStatus.restoreRate) * 1000;
    log(`Throttled, waiting ${wait}ms`);
    await new Promise((r) => setTimeout(r, wait));
  }

  return json.data;
}

/**
 * Pass 1: fetch product scalar fields, options, SEO, media.
 * 50 products/page keeps cost under 1000.
 **/
const PRODUCTS_QUERY = `
  query Products($cursor: String) {
    products(first: 50, after: $cursor) {
      edges {
        node {
          id
          legacyResourceId
          handle
          title
          description
          descriptionHtml
          productType
          vendor
          status
          tags
          templateSuffix
          isGiftCard
          hasOnlyDefaultVariant
          hasOutOfStockVariants
          totalInventory
          tracksInventory
          createdAt
          updatedAt
          publishedAt
          onlineStoreUrl
          onlineStorePreviewUrl
          seo { title description }
          category { id name fullName }
          priceRangeV2 {
            minVariantPrice { amount currencyCode }
            maxVariantPrice { amount currencyCode }
          }
          compareAtPriceRange {
            minVariantCompareAtPrice { amount currencyCode }
            maxVariantCompareAtPrice { amount currencyCode }
          }
          options { id name position values }
          featuredMedia {
            ... on MediaImage { image { url altText width height } }
          }
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

/** Fetch variants for a single product, paginated. */
const VARIANTS_QUERY = `
  query Variants($id: ID!, $cursor: String) {
    product(id: $id) {
      variants(first: 100, after: $cursor) {
        edges {
          node {
            id
            legacyResourceId
            title
            displayName
            sku
            barcode
            price
            compareAtPrice
            position
            availableForSale
            inventoryQuantity
            inventoryPolicy
            taxable
            createdAt
            updatedAt
            selectedOptions { name value }
            image { url altText width height }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/** Fetch media for a single product, paginated. */
const MEDIA_QUERY = `
  query Media($id: ID!, $cursor: String) {
    product(id: $id) {
      media(first: 250, after: $cursor) {
        edges {
          node {
            mediaContentType
            ... on MediaImage { image { url altText width height } }
            ... on Video { sources { url mimeType } }
            ... on ExternalVideo { originUrl }
          }
        }
        pageInfo { hasNextPage endCursor }
      }
    }
  }
`;

/** Fetch metafields for any node (Product or ProductVariant), paginated. */
const METAFIELDS_QUERY = `
  query Metafields($id: ID!, $cursor: String) {
    node(id: $id) {
      ... on Product {
        metafields(first: 250, after: $cursor) {
          edges { node { namespace key value type } }
          pageInfo { hasNextPage endCursor }
        }
      }
      ... on ProductVariant {
        metafields(first: 250, after: $cursor) {
          edges { node { namespace key value type } }
          pageInfo { hasNextPage endCursor }
        }
      }
    }
  }
`;

async function fetchAllPages(query, variables, extract) {
  const items = [];
  let cursor = null;

  while (true) {
    const data = await shopify(query, { ...variables, cursor });
    const connection = extract(data);
    items.push(...connection.edges.map((e) => e.node));
    if (!connection.pageInfo.hasNextPage) break;
    cursor = connection.pageInfo.endCursor;
  }

  return items;
}

async function fetchMetafields(nodeId) {
  return fetchAllPages(
    METAFIELDS_QUERY,
    { id: nodeId },
    (d) => d.node.metafields,
  );
}

async function run() {
  let cursor = null;
  let total = 0;

  log("Starting product export");

  while (true) {
    const data = await shopify(PRODUCTS_QUERY, { cursor });
    const edges = data.products.edges;

    for (const { node: product } of edges) {
      /** Fetch variants, media, and product metafields */
      const [variants, media, metafields] = await Promise.all([
        fetchAllPages(VARIANTS_QUERY, { id: product.id }, (d) => d.product.variants),
        fetchAllPages(MEDIA_QUERY, { id: product.id }, (d) => d.product.media),
        fetchMetafields(product.id),
      ]);

      /** Fetch variant metafields */
      const variantsWithMetafields = await Promise.all(
        variants.map(async (variant) => ({
          ...variant,
          metafields: await fetchMetafields(variant.id),
        })),
      );

      const out = { ...product, metafields, variants: variantsWithMetafields, media };
      console.log(JSON.stringify(out));
      total++;
    }

    log(`${total} products exported`);

    if (!data.products.pageInfo.hasNextPage) break;
    cursor = data.products.pageInfo.endCursor;
  }

  success(`done, ${total} products`);
}

run().catch((err) => {
  error(err.message);
  process.exit(1);
});
