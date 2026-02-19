> This repository was part of [my presentation](presentation.excalidraw.svg) at the [Claude Code Meetup Amsterdam](https://luma.com/08wx9g7q) on February 19th 2026.

# E-commerce skills

This repository shows how to use skills with Claude Code for e-commerce `management tasks`.

It creates an environment where your agent can handle tasks ranging from answering simple product questions to supporting on large analysis and migration tasks. This approach offers an alternative to navigating dashboards and manually transforming and importing CSV files. You can also perform AI-powered tasks on your data, such as generating product descriptions.

It uses `.claude/skills` to provide discoverable context, along with a `CLAUDE.md` that explains how to combine them for complex tasks by writing scripts. See [How it works](#how-it-works).

## Examples

Here are some examples that demonstrate what these skills can achieve. Remember, you can use planning mode, ask follow-up questions, and provide more context. Be ambitious.

### Questions

```md
How many Shopify products are missing a SEO description?
```

```md
Which subcategories fall under "Clothing" in SFCC?
```

### Quick fixes

```md
I have a `details.category` product metafield. Make a collection for each value: Jeans, Shirts, Shoes.
```

```md
Change the sale link to "Black Friday Sale" in our CMS, link it to the black friday collection.
```

### Combining skills

```md
List the categories and subcategories in SFCC.

Are all of these present as collections in Shopify?
```

```md
In Shopify we have a product metafield `details.material_id`. When this metafield matches the `id` of a `material` document in Sanity, we show an image and a description.

Find all distinct values in Shopify and check if a Sanity document exists. Additionally, let me know if any fields are missing.
```

### Complex tasks

```md
I'd like a setup to generate product descriptions for my Shopify products:

1. Create an export script that exports all products with all fields and available metafields, ready for bulk processing.
2. Create a script that processes each product and generates an unique product description. I'd like to set the prompt, make it very clear where I can change it.
```

## How it works

Each skill wraps an external API with small Bun scripts. A `SKILL.md` file tells the agent what the skill can do and how to use it.

This repository includes three skills:

- **shopify** — Products, collections, inventory, and orders via the Admin and Storefront GraphQL APIs
- **sanity** — CMS content via GROQ queries
- **commerce-cloud** — Categories and products via the SFCC OCAPI Shop API

For simple tasks, the agent calls a skill's scripts directly. For complex tasks, it writes a Bun script in `tmp/` that combines multiple skills — exporting from one system, transforming, and importing into another. Scripts that prove useful can be moved to `scripts/` and improved over time.

All scripts are pipe-friendly (JSON to stdout, progress to stderr) and mutations default to dry-run. Each skill stores its own credentials in a gitignored `.env` file. Copy `.env.example` to `.env` and fill in your tokens.

```
.claude/skills/<name>/
├── SKILL.md            # Discoverable context for the agent
├── .env                # Credentials (gitignored)
├── .env.example        # Credential template
└── scripts/
    └── <operation>.js  # One script per operation type
```

## Links

You can find the Claude docs yourself. Go watch [this video](https://www.youtube.com/watch?v=RFKCzGlAU6Q), it's good.
