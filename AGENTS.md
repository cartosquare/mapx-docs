# MapX Documentation Project (Mintlify)

## About this project

- This is the Mintlify documentation site for MapX.
- Content lives in `.mdx` files with YAML frontmatter.
- Content is bilingual: English pages live under `en/`, Simplified Chinese
  pages under `zh/`, with identical relative structure.
- Site configuration lives in `docs.json`.
- The product/source repository is `github.com/cartosquare/mapx` (locally usually
  `/data/xuxiang/mapx`; on this machine: `/Users/xuxiang/Mirror/work/mapx`).

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

## Capturing real product screenshots (runbook, verified 2026-09)

When a docs page needs a current product UI screenshot, capture it from the real
running platform instead of reusing old images or generating mockups. The local
product stack is at `/Users/xuxiang/Mirror/work/mapx`.

### Services and access

- Full app: `http://localhost:8080` (nginx serves the UI and proxies `/api/*`
  to the Hono API). The Next dev server on port `3000` does **not** proxy
  `/api/*`, so drive flows through `8080`.
- Other ports: API `3001`, Martin vector tiles `3004`, docs preview `3002`.
- Auth is a NextAuth encrypted cookie named `authjs.session-token`; anonymous
  `x-anonymous-id` sessions are no longer accepted (401).

### Authenticate without logging in through the UI

The API validates a NextAuth JWT that carries `sub`, `email`, `name`, and a
`sid` claim whose id must exist as an active row in the `user_session` table.
Local Postgres listens on `localhost:5432` (not `5433`), and `psql` requires:

```bash
PGGSSENCMODE=disable PGSSLMODE=disable PGPASSWORD=askmap123 \
  psql -h 127.0.0.1 -p 5432 -U askmap -d mapx -w
```

Workflow:

1. Pick a test user: `SELECT id,email FROM "user" LIMIT 1;`.
2. Insert a session row:
   `INSERT INTO user_session ("userId",jti,provider,"expiresAt") VALUES ('<id>','<uuid>','credentials', now() + interval '30 days');`
3. Encode the cookie with `next-auth/jwt` from the product repo (run with its
   `node_modules`), reading `AUTH_SECRET` from `.env.local` without printing it:

   ```js
   const { encode } = require("next-auth/jwt");
   const token = await encode({
     token: { sub, email, name, sid: "<uuid>" },
     secret: process.env.AUTH_SECRET,
     salt: "authjs.session-token",
   });
   ```

4. Create a workspace: `curl -X POST http://localhost:8080/api/sessions -H
   "Cookie: authjs.session-token=$TOKEN" -H 'Content-Type: application/json'
   -d '{"mapState":{"center":[116.4,39.9],"zoom":10}}'`, then open
   `/workspace/<id>` in the browser.

### Drive the browser with the playwright skill

- The wrapper script is not executable; run it via `bash`:
  `bash "$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh" ...`.
- `run-code` expects an async function expression (the CLI appends `(page)`):

  ```bash
  bash "$PWCLI" run-code "async () => { await page.context().addCookies([{name:'authjs.session-token', value:'$TOKEN', url:'http://localhost:8080'}]); await page.goto('http://localhost:8080/workspace/<id>'); await page.waitForTimeout(9000); }"
  ```

- `eval` runs inside the page context (no `page` object); re-snapshot after
  navigation and use refs from the latest snapshot.
- Upload: click **Upload Data**, then `upload /path/file.geojson`.
- Viewport: `resize 1440 900`; `playwright-cli.json` `deviceScaleFactor` did
  not apply (2026-09), so capture at CSS scale and optimize afterwards.
- Screenshots land in `<cwd>/.playwright-cli/*.png`; move that folder out of the
  repo when done.

### Typical scenes for the introduction page

1. Prepare mock data (about 100 points over one city with `name`/`category`/
   `revenue` fields) and upload it to a fresh workspace.
2. Hero: prompt the AI to style the uploaded layer, for example *"Color the
   store points by category with a legend"*, wait for the turn to finish, open
   the **Layers** panel, and keep the chat panel closed.
3. 3D: click the 3D toggle (`data-testid="view3d-toggle"`) and wait for
   columns to render before capturing.
4. Reports: prompt *"Create a bar chart of revenue by category, then create an
   HTML report that includes the map and the chart"*; the report canvas opens
   automatically and can be screenshotted directly.
5. UI language: switch to English via the header toggle so one image set
   serves both language versions; project titles can be renamed with
   `PATCH /api/sessions/<id>`.

### Image handling and verification

- Save final assets under `images/<section>/` in this repo (e.g.
  `images/introduction/`); write bilingual alt text when embedding.
- Complex map screenshots stay large as PNG (~600 KB at 1200 px); downscale to
  ≤1200–1440 px and use JPEG quality ~85 (~180 KB). Flat preview screenshots
  are fine as PNG.
- Finish with `mint validate` and `mint broken-links`, then confirm both
  language pages return 200 and render the new images.

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
