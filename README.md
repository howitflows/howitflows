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
| Environment variable | `NODE_VERSION` = `22` (or newer) |

Every pull request gets a preview URL. Add `howitflows.dev` as a custom domain.

## License

Code: [MIT](LICENSE). Content (explanations, flows, diagrams): CC BY 4.0.
