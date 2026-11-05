import type { ConnConfig, Lang, OpId, SnippetResult } from '../types';
import type { ApiDb } from './api';
import { generateQuery, QUERY_DBS } from './query';
import { MONGO } from './mongo';
import { REDIS } from './redis';
import { ELASTIC } from './elastic';
import { DYNAMO } from './dynamo';

export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: 'native', label: 'Native / CLI', short: 'CLI' },
  { id: 'python', label: 'Python', short: 'PY' },
  { id: 'node', label: 'Node.js', short: 'JS' },
  { id: 'go', label: 'Go', short: 'GO' },
  { id: 'java', label: 'Java', short: 'JAVA' },
  { id: 'csharp', label: 'C#', short: 'C#' },
  { id: 'php', label: 'PHP', short: 'PHP' },
];

export const OPS: { id: OpId; verb: string; label: string; desc: string }[] = [
  { id: 'docker', verb: 'RUN', label: 'Run locally', desc: 'Start a disposable local instance with Docker' },
  { id: 'connect', verb: 'CONN', label: 'Connect', desc: 'Open a connection and check the server version' },
  { id: 'schema', verb: 'DDL', label: 'Create schema', desc: 'Tables, collections, indexes or key design' },
  { id: 'seed', verb: 'SEED', label: 'Seed sample data', desc: 'Load four sample users, idempotently where possible' },
  { id: 'create', verb: 'POST', label: 'Create', desc: 'Insert one new user' },
  { id: 'read', verb: 'GET', label: 'Read', desc: 'Find users aged 40 or more' },
  { id: 'update', verb: 'PUT', label: 'Update', desc: "Change Ada's age to 37" },
  { id: 'delete', verb: 'DEL', label: 'Delete', desc: 'Remove Alan by email' },
];

const API: Record<string, ApiDb> = { mongodb: MONGO, redis: REDIS, elasticsearch: ELASTIC, dynamodb: DYNAMO };

const HL: Record<Lang, string> = { native: 'bash', python: 'python', node: 'javascript', go: 'go', java: 'java', csharp: 'csharp', php: 'php' };
const FILE: Record<Lang, string> = {
  native: 'script.sh',
  python: 'main.py',
  node: 'index.mjs',
  go: 'main.go',
  java: 'App.java',
  csharp: 'Program.cs',
  php: 'index.php',
};

const DOCKER: Record<string, (c: ConnConfig) => { run: string; compose: string }> = {
  postgres: (c) => ({
    run: `docker run -d --name postgres -p ${c.port}:5432 \\\n  -e POSTGRES_USER=${c.user} -e POSTGRES_PASSWORD=${c.password} -e POSTGRES_DB=${c.database} \\\n  postgres:17`,
    compose: `  postgres:\n    image: postgres:17\n    ports: ["${c.port}:5432"]\n    environment:\n      POSTGRES_USER: ${c.user}\n      POSTGRES_PASSWORD: ${c.password}\n      POSTGRES_DB: ${c.database}\n    volumes: [pgdata:/var/lib/postgresql/data]\nvolumes:\n  pgdata:`,
  }),
  mysql: (c) => ({
    run: `docker run -d --name mysql -p ${c.port}:3306 \\\n  -e MYSQL_ROOT_PASSWORD=${c.password} -e MYSQL_DATABASE=${c.database} \\\n  mysql:8.4`,
    compose: `  mysql:\n    image: mysql:8.4\n    ports: ["${c.port}:3306"]\n    environment:\n      MYSQL_ROOT_PASSWORD: ${c.password}\n      MYSQL_DATABASE: ${c.database}\n    volumes: [mysqldata:/var/lib/mysql]\nvolumes:\n  mysqldata:`,
  }),
  sqlite: (c) => ({
    run: `# SQLite is embedded — there is no server to run.\n# The database is just a file that your program opens:\nls -la ${c.database}\n\n# Optional: inspect it with the CLI from a container\ndocker run --rm -it -v "$PWD":/data -w /data keinos/sqlite3 sqlite3 ${c.database}`,
    compose: `# no service needed — SQLite runs inside your application process`,
  }),
  mssql: (c) => ({
    run: `docker run -d --name mssql -p ${c.port}:1433 \\\n  -e ACCEPT_EULA=Y -e MSSQL_SA_PASSWORD='${c.password}' \\\n  mcr.microsoft.com/mssql/server:2022-latest\n\n# then create the database:\ndocker exec -it mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P '${c.password}' -C -Q "CREATE DATABASE ${c.database}"`,
    compose: `  mssql:\n    image: mcr.microsoft.com/mssql/server:2022-latest\n    ports: ["${c.port}:1433"]\n    environment:\n      ACCEPT_EULA: "Y"\n      MSSQL_SA_PASSWORD: "${c.password}"`,
  }),
  cassandra: (c) => ({
    run: `docker run -d --name cassandra -p ${c.port}:9042 cassandra:5\n\n# first boot takes ~60s; wait until it's ready:\ndocker exec cassandra cqlsh -e "DESCRIBE KEYSPACES"`,
    compose: `  cassandra:\n    image: cassandra:5\n    ports: ["${c.port}:9042"]\n    environment:\n      CASSANDRA_CLUSTER_NAME: dev\n    volumes: [cassdata:/var/lib/cassandra]\nvolumes:\n  cassdata:`,
  }),
  neo4j: (c) => ({
    run: `docker run -d --name neo4j -p 7474:7474 -p ${c.port}:7687 \\\n  -e NEO4J_AUTH=${c.user}/${c.password} \\\n  neo4j:5\n\n# Browser UI: http://localhost:7474`,
    compose: `  neo4j:\n    image: neo4j:5\n    ports: ["7474:7474", "${c.port}:7687"]\n    environment:\n      NEO4J_AUTH: ${c.user}/${c.password}\n    volumes: [neo4jdata:/data]\nvolumes:\n  neo4jdata:`,
  }),
  mongodb: (c) => ({
    run: `docker run -d --name mongo -p ${c.port}:27017 \\\n  -e MONGO_INITDB_ROOT_USERNAME=${c.user} -e MONGO_INITDB_ROOT_PASSWORD=${c.password} \\\n  mongo:8`,
    compose: `  mongo:\n    image: mongo:8\n    ports: ["${c.port}:27017"]\n    environment:\n      MONGO_INITDB_ROOT_USERNAME: ${c.user}\n      MONGO_INITDB_ROOT_PASSWORD: ${c.password}\n    volumes: [mongodata:/data/db]\nvolumes:\n  mongodata:`,
  }),
  redis: (c) => ({
    run: `docker run -d --name redis -p ${c.port}:6379 redis:7-alpine${c.password ? ` \\\n  redis-server --requirepass '${c.password}'` : ''}`,
    compose: `  redis:\n    image: redis:7-alpine\n    ports: ["${c.port}:6379"]${c.password ? `\n    command: ["redis-server", "--requirepass", "${c.password}"]` : ''}`,
  }),
  elasticsearch: (c) => ({
    run: `docker run -d --name elasticsearch -p ${c.port}:9200 -m 1g \\\n  -e discovery.type=single-node \\\n  -e ELASTIC_PASSWORD=${c.password} \\\n  -e xpack.security.http.ssl.enabled=false \\\n  docker.elastic.co/elasticsearch/elasticsearch:8.16.1`,
    compose: `  elasticsearch:\n    image: docker.elastic.co/elasticsearch/elasticsearch:8.16.1\n    ports: ["${c.port}:9200"]\n    environment:\n      discovery.type: single-node\n      ELASTIC_PASSWORD: ${c.password}\n      xpack.security.http.ssl.enabled: "false"\n    mem_limit: 1g`,
  }),
  dynamodb: (c) => ({
    run: `# DynamoDB Local: an offline emulator of the AWS service\ndocker run -d --name dynamodb -p ${c.port}:8000 amazon/dynamodb-local`,
    compose: `  dynamodb:\n    image: amazon/dynamodb-local\n    ports: ["${c.port}:8000"]\n    command: ["-jar", "DynamoDBLocal.jar", "-sharedDb"]`,
  }),
};

export function generate(db: string, lang: Lang, op: OpId, cfg: ConnConfig): SnippetResult {
  if (op === 'docker') {
    const d = DOCKER[db](cfg);
    return {
      code: `# Option A — one-off container\n${d.run}\n\n# Option B — docker-compose.yml\n# services:\n${d.compose
        .split('\n')
        .map((l) => '# ' + l)
        .join('\n')}\n`,
      hl: 'bash',
      install: 'Docker Desktop or Docker Engine',
      driver: 'docker',
      filename: 'run.sh',
    };
  }
  if ((QUERY_DBS as string[]).includes(db)) return generateQuery(db, lang, op, cfg);
  const api = API[db]?.[lang];
  if (!api) return { unsupported: `No snippet for ${db} in ${lang} yet.` };
  const code = api.wrap(cfg, api.ops[op](cfg), op).replace(/\n{3,}/g, '\n\n');
  return { code, hl: api.hl ?? HL[lang], install: api.install, driver: api.driver, filename: api.file ?? FILE[lang], notes: api.notes };
}

export function isSupported(db: string, lang: Lang): boolean {
  if ((QUERY_DBS as string[]).includes(db)) return !(db === 'cassandra' && lang === 'php');
  return !!API[db]?.[lang];
}
