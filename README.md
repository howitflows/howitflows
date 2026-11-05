# HowItFlows

**The place for visual learners.** Animated, open-source explorers that show how data and cloud systems really work: every message, hop and handshake, step by step, with working code to try yourself.

- **Watch:** an animated topology shows each packet travelling between your app, servers, disks and replicas.
- **Step through:** scrub the timeline message by message; each lifecycle step explains what happens and why.
- **Build:** a Postman-style snippet studio generates connection, schema, seed and CRUD code in 7 languages (databases explorer).

Live explorer: **Databases**, covering PostgreSQL, MySQL, SQLite, SQL Server, MongoDB, Redis, Cassandra, Neo4j, Elasticsearch and DynamoDB.
Planned: streaming, CDC, query engines, lakehouse formats, orchestration, cloud networking, identity, Kubernetes and distributed systems.

## Develop

```bash
npm install
npm run dev     # http://localhost:5173
npm run build   # type-check + static build into apps/site/dist
```

The repo is a monorepo:

- `packages/brand`: design tokens and logo.
- `packages/art`: illustrations.
- `packages/engine`: the explorer UI.
- `explorers/*`: one package per topic.
- `apps/site`: the Astro site.

See [CONTRIBUTING.md](CONTRIBUTING.md) to add a database or start a new explorer.

## Deploy (Cloudflare Pages)

Connect the GitHub repository in Cloudflare Pages with these settings:

| Setting | Value |
|---|---|
| Framework preset | Astro |
| Build command | `npm run build` |
| Build output directory | `apps/site/dist` |
| Environment variable | `NODE_VERSION` = `26.13.0` (Production and Preview) |

**Node version.** Use the latest patch of an active LTS line: Node 26 (current LTS) or Node 24. Astro needs at least 22.23.4.
Node.js ships security releases regularly, so keep this value current:

- The [October 2026 security releases](https://nodejs.org/en/blog/vulnerability/october-2026-security-releases) were fixed in 22.23.4, 24.22.1 and 26.12.1. `26.13.0` includes those fixes.
- When a new one is published on [Node.js security releases](https://nodejs.org/en/blog/vulnerability), update `NODE_VERSION` here and in Cloudflare, and update Node on your machine too.

Changing the variable does not rebuild the site. It applies from the next deployment, so push a commit or use **Retry deployment** on the latest one.

Every pull request gets a preview URL. Add `howitflows.dev` as a custom domain.

## License

Code: [MIT](LICENSE). Content (explanations, flows, diagrams): CC BY 4.0.
