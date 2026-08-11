# MapX Documentation Project (Mintlify)

## About this project

- This is the Mintlify documentation site for MapX.
- Content lives in `.mdx` files with YAML frontmatter.
- Content is bilingual: English pages live under `en/`, Simplified Chinese
  pages under `zh/`, with identical relative structure.
- Site configuration lives in `docs.json`.
- The product/source repository is `github.com/cartosquare/mapx` (locally usually
  `/data/xuxiang/mapx`).

## Source of truth

The `source/` directory contains a generated snapshot of the product's current
API, MCP, and skill facts:

- `source/api-routes.json` — API endpoints parsed from the MapX backend.
- `source/mcp-tools.json` — MCP tool names and descriptions.
- `source/skills.json` — skill index (names and descriptions).
- `source/system-prompt.md` — the AI system prompt used by the product.
- `openapi.json` — the OpenAPI 3.0.3 contract for the public `/api/v1` REST API.
  It is also served live at `GET /api/v1/openapi.json` and rendered as the
  interactive **API Reference** group in `docs.json`.

Always read the relevant source file before writing or updating documentation.

## Workflow when updating docs

1. Read `docs.json` to understand the site structure, then check existing pages
   before creating new ones.
2. Read the relevant `source/*` files for current facts.
3. Map changes to pages:
   - API endpoint changes → `developers/api-reference.mdx`
   - Public REST API changes → regenerate `openapi.json` (from the MapX repo:
     `pnpm openapi:gen`, then copy `docs-source/openapi.json` here)
   - MCP tool changes → `developers/mcp.mdx`
   - Skill changes → `developers/skills.mdx`
   - Product/feature changes → existing `guides/*.mdx` or `concepts/*.mdx`
   - Page paths above are relative to each language directory (`en/` and `zh/`)
4. Every page must exist in **both languages**: `en/<path>` is the source of
   truth, `zh/<path>` is the translated copy. Create or update both together.
5. Internal links are language-scoped: use `/en/...` inside English pages and
   `/zh/...` inside Chinese pages. Never link across language prefixes.
6. Register new pages in **both** `languages` entries of `docs.json`
   (`en` and `zh`), with localized group/tab labels.
7. When moving or renaming pages, add a redirect from the old path to the new
   one in `docs.json`.
8. If `source/` is stale, regenerate it in the MapX repository:

   ```bash
   cd /data/xuxiang/mapx
   pnpm docs:gen
   ```

   Then copy the generated pack into this repository:

   ```bash
   cp -r /data/xuxiang/mapx/docs-source/* source/
   cp /data/xuxiang/mapx/docs-source/openapi.json openapi.json
   ```

9. Verify with `mint validate` and `mint broken-links`.

## Style preferences

- Use active voice and second person ("you").
- Keep sentences concise — one idea per sentence.
- Use sentence case for headings.
- Bold UI elements: Click **Settings**.
- Use code formatting for file names, commands, paths, and code references.
- Do not use marketing language or filler phrases.

## Content boundaries

- Document user-facing product features and developer integration (API, MCP,
  skills).
- Do not document internal admin endpoints unless they are part of a public
  integration surface.
